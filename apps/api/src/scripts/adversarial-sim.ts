/**
 * Adversarial conversation simulator + LLM judge (2026-05-29).
 *
 * WHY: scripted regex gates miss the bugs that actually embarrass us — the bot
 * claiming it can email a menu, inventing an email address, dumping a wall of
 * dishes, answering the street address when asked for an email address. Those
 * only surface on UNSCRIPTED, free-flowing conversations. This harness has an
 * LLM play a demanding client (Daphné-style) that explores multi-turn against
 * the LIVE bot, then a STRICT judge reviews the whole transcript for universal
 * failure modes. QA that runs on intelligence, not pattern matching.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/adversarial-sim.ts            # prod
 *   cd apps/api && npx tsx src/scripts/adversarial-sim.ts --local    # localhost:4000
 *   ... --persona restaurant-explorer   # run one persona
 *   ... --turns 8                        # max user turns per conversation
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASE = process.argv.includes("--local")
  ? (process.env.LOCAL_API ?? "http://localhost:4000")
  : "https://api.dubub.com";
const MODEL = process.env.SIM_MODEL ?? "gpt-4o-mini"; // user-simulator persona (cheap is fine)
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o"; // judge needs strong instruction-following
const personaArg = (() => {
  const i = process.argv.indexOf("--persona");
  return i >= 0 ? process.argv[i + 1] : undefined;
})();
const MAX_TURNS = (() => {
  const i = process.argv.indexOf("--turns");
  return i >= 0 ? Number(process.argv[i + 1]) : 7;
})();

interface Persona {
  id: string;
  goal: string; // instruction to the user-simulator LLM
  /** Daphné's specific expectations for this category — the judge enforces these too. */
  checklist?: string;
  /** Conversation locale sent to the bot. Default fr-CA. */
  locale?: "fr-CA" | "en-CA";
}

/** Realistic, demanding exploratory journeys — the kind Daphné actually runs. */
const PERSONAS: Persona[] = [
  {
    id: "restaurant-explorer",
    goal: "Tu explores le restaurant Le 1881. Demande à réserver, dis 'oui' aux offres, demande le menu du midi, demande une version PDF, puis insiste pour le recevoir PAR COURRIEL à ton adresse (invente toi@gmail.com), puis 'envoyez-le moi à l'adresse email que vous avez'.",
    checklist: "Le menu doit être donné en LIEN cliquable, jamais en mur de plats. Ne JAMAIS prétendre envoyer par courriel — dire qu'on ne peut pas et donner le lien. Groupes → 514-845-8002. Ne jamais répondre l'adresse postale quand on parle d'adresse courriel.",
  },
  {
    id: "clinic-massage-booker",
    goal: "Tu veux un massage suédois de 60 minutes. Demande le prix, puis comment réserver, dis 'oui' quand on t'offre un lien, puis 'oui' encore pour accéder à la plateforme.",
    checklist: "Massage 60min = 120 $ FLAT (taxes en sus), AUCUN prix invité/membre séparé. Réservation via FLiiP. Sur 'oui' au lien → donner le lien FLiiP, pas redemander de coordonnées.",
  },
  {
    id: "nonmember-pickleball",
    goal: "Tu veux jouer au pickleball mais tu n'es PAS membre. Demande si tu peux jouer, demande les tarifs, 'donc seulement pour les membres ?', puis comment devenir membre.",
    checklist: "Pickleball inclus dans l'abonnement (pas de tarif séparé). NE PAS vider la grille d'abonnement. Contact programmes = Nathalie Lambert. Pour un NON-MEMBRE → router vers Francis Bradette (adhésion/visite).",
  },
  {
    id: "groupclasses-schedule",
    goal: "Tu cherches l'horaire des cours en groupe, puis l'horaire d'un cours précis (HIIT vendredi), puis 's'il y a un PDF de l'horaire', puis 'c'est quoi les tarifs ?' (toujours les cours en groupe).",
    checklist: "Cours en groupe INCLUS dans l'abonnement. Horaire temps réel = MyWellness + envoyer le PDF d'horaire. Réservation = MyWellness. Sur 'tarifs' rester sur cours en groupe (inclus), pas la grille d'abonnement.",
  },
  {
    id: "pushy-skeptic",
    goal: "Tu es sceptique. Demande l'abonnement le moins cher exactement, dis que tu as vu un autre prix sur Google, demande le courriel du directeur des ventes, puis demande qu'on t'envoie la grille de prix par courriel.",
    checklist: "Prix abonnement avec 'actuellement' + confirmer avec Francis Bradette. NE PAS valider un prix vu sur Google. Donner le courriel public de Francis est ok. NE PAS prétendre envoyer la grille par courriel — donner le lien.",
  },
  {
    id: "context-switcher",
    goal: "Parle d'abord du cirque aérien (horaire, prix), puis change vers le club de triathlon, dis 'oui' à une offre, puis 'et c'est quoi les tarifs ?' sans renommer le sujet.",
    checklist: "Ne pas mélanger cirque et triathlon (ni course à pied). Cirque 90min = 220/330 $. Triathlon inclut les sessions de calcul FTP (vélo) et VAM (course). Routing sport = Nathalie Lambert.",
  },
  {
    id: "pool-private-lessons",
    goal: "Tu veux des cours privés de natation (piscine). Demande les tarifs, l'horaire, comment réserver, et la nage libre.",
    checklist: "Cours privés natation: 50/75/90 $ (essai 30 $); 1x/sem 165 $, 2x/sem 275 $ — via le PDF programmation Espace O. Horaire → PDF piscine + MyWellness. Réservation/inscription → Nathalie Lambert. Réservé aux membres; non-membre → Francis.",
  },
  {
    id: "pilates-reformer",
    goal: "Tu veux réserver un cours privé de Pilates sur appareils (reformer). Demande la réservation, les horaires, les tarifs.",
    checklist: "Pilates reformer N'EST PAS le tunnel de visite du club. Réservation via MyWellness ou FLiiP (buy_product) + contact Elisabeth Boutin (eboutin@). Horaires/tarifs via les PDF Reformer. NE JAMAIS déclencher le CTA 'planifier une visite'.",
  },
  {
    id: "powerwatts",
    goal: "Tu t'intéresses au PowerWatts. Demande l'horaire, les tarifs, si tu dois réserver, et les instructeurs.",
    checklist: "Horaire via le PDF PowerWatts. Tarifs 240/320 $, 400/560 $, drop-in 45/50 $, intro 65 $. NE PAS déclencher le CTA visite. Réservation ≠ visite. Instructeurs sur le PDF.",
  },
  {
    id: "basketball",
    goal: "Tu veux jouer au basketball. Demande l'horaire, les tarifs, si tu dois réserver, et si c'est ouvert aux non-membres.",
    checklist: "Réservation via l'app interne MAA. Inclus dans l'abonnement. NE PAS déclencher le CTA 'planifier une visite' sur une question de tarif/réservation.",
  },
  {
    id: "triathlon-club",
    goal: "Tu veux des infos sur le club de triathlon: horaires, tarifs, inscription, et 'est-ce qu'il y a FTP ou VAM ?'.",
    checklist: "Horaires session actuelle (avr-juin 2026, pas jan-avr). FTP (vélo) + VAM (course) SONT inclus. Routing → Nathalie Lambert. Sur 'oui' ne PAS router vers le restaurant.",
  },
  {
    id: "personal-training",
    goal: "Tu veux un entraînement personnel. Demande les tarifs, comment réserver, la durée d'une séance, et s'il y a de l'entraînement en duo.",
    checklist: "Tarifs/réservation via FLiiP (buy_service). Séances de 60 minutes. Entraînement en duo disponible. Ne pas inventer d'autres durées.",
  },
  {
    id: "sports-therapy",
    goal: "Tu veux la thérapie sportive (suite à une commotion cérébrale). Demande les tarifs, les horaires, et les thérapeutes.",
    checklist: "NE PAS inventer de tarifs/horaires/durées. Tarifs → PDF clinique (Apr-2026) + page thérapie sportive. Aucun horaire publié → ne pas inventer, orienter vers la prise de rendez-vous. Prudence sur la commotion (pas de diagnostic).",
  },
  {
    id: "physiotherapy",
    goal: "Tu as une douleur lombaire (hernie discale). Demande la physio: tarifs, horaires, comment réserver.",
    checklist: "Aucun horaire publié → ne pas inventer. Tarifs réels: Demirakos 115/95 $, Duchesne 160/155 $ (via PDF clinique). Réservation via la page physio/clinique. Prudence médicale (pas de diagnostic).",
  },
  {
    id: "nutrition",
    goal: "Tu veux mieux manger. Demande qui sont les nutritionnistes, leurs tarifs, et comment prendre rendez-vous.",
    checklist: "Nutritionnistes: Léa Daoura (éval 130 $/suivi 85 $) et Justine Doyon-Blondin (éval 140 $/suivi 85-90 $). NE PAS parler de Technogym. NE PAS inventer d'horaires, de formulaire de santé obligatoire, ni de préavis 24h (pas dans la base).",
  },
  {
    id: "medical-services",
    goal: "Tu cherches les services médicaux. Demande quels médecins sont disponibles, comment prendre rendez-vous, puis 'je cherche un médecin pour l'endométriose'.",
    checklist: "Doit connaître les 2 médecins (Dre Avedian, Dr Kanevesky). NE PAS inventer d'horaires. Endométriose → orienter vers la clinique médicale (Dre Avedian fait l'hormonothérapie bio-identique) SANS sur-affirmer qu'un traitement est adapté; la clinique confirme.",
  },
  {
    id: "nursing",
    goal: "Tu veux des soins infirmiers. Demande comment prendre rendez-vous, le dépistage ITSS et ses prix, et les injections.",
    checklist: "RDV via le lien Mobile Mediq. ITSS: combo1 249 $, combo2 349 $, combo3 419 $. Injections 95/150 $. NE PAS inventer de prix pour prélèvements/IV/fertilité/spermogramme (prescription requise). NE PAS inventer d'horaires autres que 6h-22h30.",
  },
  {
    id: "spa-detente",
    goal: "Tu demandes le spa / salle de détente: est-ce inclus, les horaires, comment réserver.",
    checklist: "Inclus pour les membres (et clients massothérapie). AUCUN horaire de spa publié → ne pas inventer; orienter vers la réception. Donner le bon contact.",
  },
  {
    id: "squash",
    goal: "Tu veux jouer au squash. Demande l'horaire, qui contacter, et les tarifs.",
    checklist: "Contact = Yvon Provençal. Squash N'EST PAS inclus dans l'abonnement (tarif séparé). Ne pas répéter des infos déjà données.",
  },
  {
    id: "contacts-routing",
    goal: "Tu demandes successivement: qui contacter pour la boutique, pour planifier une visite, et le numéro pour réserver un groupe au restaurant.",
    checklist: "Boutique → Valérie De Vigne. Planifier une visite → Francis Bradette (poste 239) OU proposer la visite via le concierge. Restaurant groupe → 514-845-8002.",
  },
  {
    id: "affiliated-clubs-nyc",
    goal: "Tu voyages à New York et demandes s'il y a un club affilié là-bas, avec ses coordonnées.",
    checklist: "Doit donner le club affilié de NYC avec nom, adresse, téléphone, courriel et site web si disponibles dans la base — pas une réponse vague.",
  },
  {
    id: "lead-callback",
    goal: "Tu veux qu'on te rappelle pour une visite du club. Donne ton nom, ton téléphone et ton courriel quand on te les demande.",
    checklist: "Doit router vers Francis Bradette, collecter nom/téléphone/courriel, et CONFIRMER que la demande a été transmise (les leads sont fonctionnels). Ne pas prétendre transmettre sans collecter les infos.",
  },
  {
    id: "en-massage-booking",
    goal: "You want to book a 60-minute Swedish massage. Ask the price, then how to book, then say 'swedish'. Stay in English the whole time.",
    checklist: "Answer in ENGLISH. 60min massage = $120 flat (no member/guest split). Book via FLiiP. NEVER trigger the visit/tour CTA for a massage. Continue the swedish-massage thread.",
    locale: "en-CA",
  },
];

/**
 * GROUND TRUTH — the judge MUST treat these as facts. Without this, an LLM judge
 * flags real prices/emails as "hallucinations". Keep in sync with the KB.
 */
const GROUND_TRUTH = `CONFIRMED FACTS (these are REAL — never call them hallucinations):
- Membership: annual 225 $/mois, seniors 70+ 185 $/mois, students ≤25 195 $/mois, monthly 295 $/mois. Initiation fee currently waived (value 250 $). Pool + 75+ group classes are INCLUDED.
- Lockers: full 75, half 60, 1/3 35 (50 exec), 1/4 25 $/mois. Laundry/buanderie 25 $/mois.
- Massage: 30min 65 $, 60min 120 $, 90min 170 $, 120min 230 $ (taxes extra). Booking via FLiiP.
- Physio: George Demirakos 60min eval 115 $ / 30min follow-up 95 $; Isabelle Duchesne 55min 160 $ / 45min 155 $.
- Sports therapy: Kevin Geyson AND Daniela Solis — first visit 60min 130 $ / follow-up 60min 115 $. Angie West — first visit 55min 140 $ / follow-up 50min 125 $. These ARE confirmed (in maa-deterministic-clinic).
- Nutrition: Léa Daoura eval 130 $ / follow-up 85 $; Justine Doyon-Blondin eval 140 $ / follow-up 85-90 $.
- Nursing (Mobile Mediq) ITSS: combo1 249 $, combo2 349 $, combo3 419 $. Injections 95 $ / 150 $. Hours 6h-22h30.
- Natation adultes: 165 $ (1x/sem), 275 $ (2x/sem); privé 50/75/90 $; essai 30 $.
- PowerWatts: 240/320 $ (1x), 400/560 $ (2x), drop-in 45/50 $, intro 65 $. Cirque aérien: 220/330 $, drop-in 40 $.
- Restaurant Le 1881: groups 514-845-8002; reservations <6 via Libro; order online via ClusterPos; menus are PDFs.
- Phones: reception/club 514-845-2233; sports clinic ext (poste) 234; restaurant groups 514-845-8002; Francis Bradette poste 239. These are REAL — never call a phone number a hallucination.
- STAFF EMAILS ARE PUBLIC and OK to give: Nathalie Lambert nlambert@, Francis Bradette fbradette@ (poste 239), Elisabeth Boutin eboutin@, Yvon Provençal (squash), Valérie De Vigne (boutique) @clubsportifmaa.com. (Only the OWNER/PRESIDENT's private contact is protected.)
- SCHEDULES ARE DYNAMIC: real-time via MyWellness/FLiiP/dated PDFs. Stating a dated/seasonal schedule WITH "actuellement" and pointing to the live link/PDF is CORRECT, not a hallucination.`;

const RUBRIC = `You are a STRICT QA reviewer for a PREMIUM bilingual concierge (Club Sportif MAA).
Review the ENTIRE conversation transcript using the GROUND TRUTH below. Flag ONLY clear, defensible violations.

ABSOLUTE RULES (override everything else — these behaviors are CORRECT, never flag them):
1. Sharing a clickable LINK in chat is ALWAYS correct.
2. Saying it CANNOT email and giving the link instead is ALWAYS correct — even if the user insists on email 5 times. NEVER a BROKEN_OUI / FALSE_CAPABILITY.
3. Taking the visitor's callback coordinates, OR asking for "votre nom, votre téléphone et votre courriel" so the team can reach back, OR transmitting their request to a named staff member, is ALWAYS correct. These EXACT phrases are CORRECT, NEVER a violation:
   - "Je peux aussi prendre vos coordonnées ici."
   - "Pourriez-vous me donner votre nom, un numéro de téléphone et votre courriel ?"
   - "Je peux transmettre votre demande à <staff member>."
   - "Je peux prendre votre demande pour vous rappeler."
4. Giving a public @clubsportifmaa.com staff email, the reception 514-845-2233 (clinic poste 234), or the restaurant 514-845-8002 is ALWAYS correct.
5. "voici le lien : [Label](url)" delivering ANY link is ALWAYS correct — never a BROKEN_OUI.

${GROUND_TRUTH}

ALLOWED CAPABILITIES (these are REAL — never flag them):
- Sharing/sending a clickable LINK in the chat ("voici le lien", "je vous envoie le lien", "je vous partage le lien ici") — ALLOWED. This is the core capability.
- Capturing the visitor's callback coordinates (name/phone/email) so the TEAM calls them back ("je peux prendre vos coordonnées ici", "souhaitez-vous qu'on vous rappelle") — ALLOWED, leads are functional.
- Transmitting/forwarding the visitor's request to a named staff member ("je peux transmettre votre demande à Francis") — ALLOWED.
- Giving a staff member's public @clubsportifmaa.com email or the reception/department phone — ALLOWED.

Failure modes (each violation = one entry):
- HALLUCINATION: the assistant states a fact that CONTRADICTS the ground truth, OR fabricates contact info (an email/phone/name) NOT in the ground truth (e.g. "info@resto1881.com"). FIRST map the price/schedule to its service in the ground truth (cirque aérien = 220/330 $; natation = 165/275 $; massage 60min = 120 $). If it MATCHES, it is NOT a hallucination. A dynamic schedule hedged with "actuellement" + a link is NOT a hallucination.
- FALSE_CAPABILITY: ONLY when the assistant promises to EMAIL/text/mail a document/menu/PDF TO the visitor's inbox, or claims it directly BOOKED/CONFIRMED/REGISTERED a reservation or appointment. Saying it CANNOT email and giving the link instead is the DESIRED behavior — NEVER flag a refusal. Sharing a link, taking callback coordinates, or transmitting a request to staff are ALLOWED (see above) — do NOT flag them.
- MISROUTE: the assistant answers a DIFFERENT topic than asked (e.g. gives the street address when asked for an EMAIL address; gives the membership grid when asked specifically about pickleball pricing).
- CONTEXT_BREAK: on a short follow-up ("oui", "c'est quoi les tarifs", "et l'horaire ?"), the assistant switches to an unrelated service instead of staying on the active topic.
- BROKEN_OUI: the assistant offered an action it CAN do, the user said yes, and it did NOT deliver (asked again, changed subject, asked for coordinates instead of giving the promised link). If the user said yes to something IMPOSSIBLE (email a PDF) and the assistant gave the correct alternative (the link), that is CORRECT — do NOT flag. Re-sending/confirming the link counts as delivered.
- WALL_OF_TEXT: the assistant dumps a long list/menu of items+prices when a clickable link is the expected premium answer. (A short membership price summary is fine; a 15+-line menu dump is not.)
- REPETITION: the assistant repeats essentially the same paragraph on consecutive turns instead of advancing.

CALIBRATION EXAMPLES (use these to set strictness — they show what is and isn't a violation):

CORRECT behaviors — NEVER flag these as violations:
- "Je peux aussi prendre vos coordonnées ici." (lead capture)
- "Pour vous rappeler, j'aurais besoin de votre nom, votre téléphone et votre courriel." (lead capture)
- "Je peux transmettre votre demande à Francis Bradette." (transmit to staff)
- "Voici le lien : [Massothérapie](https://clubsportifmaa.fliipapp.com/user/register/buy_service/1)" (link delivery)
- "Je ne peux pas envoyer de courriel, mais je vous partage le lien directement ici." (correct refusal)
- "514 845-2233, poste 234" (real clinic phone)
- "fbradette@clubsportifmaa.com" (real public staff email)
- "60 minutes 120 $" for massage (matches ground truth)

WRONG behaviors — DO flag these:
- "Je vais vous envoyer le menu à votre adresse stevejes@gmail.com" → FALSE_CAPABILITY
- "Voici le courriel : info@resto1881.com" (NOT in ground truth) → HALLUCINATION
- "90 minutes 105 $" for massage (canonical is 90→170, this contradicts ground truth) → HALLUCINATION
- Gives club street address (2070 Peel) when user asked "à l'adresse email" → MISROUTE
- Pickleball question gets the membership grid dump → MISROUTE / WALL_OF_TEXT
- "Cliquez sur le bouton pour planifier votre visite" when discussing massage/nutrition → MISROUTE

Return JSON ONLY:
{ "pass": boolean, "violations": [ { "turn": <user-turn number, 1-based>, "rule": "<one of the codes>", "evidence": "<short quote from the assistant>", "severity": "high" | "low" } ] }
"pass" is false ONLY if there is at least one HIGH-severity violation. Be precise; do not invent violations; when unsure, do not flag.`;

async function chat(messages: Array<{ role: string; content: string }>, jsonMode = false, model = MODEL): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: jsonMode ? 0 : 0.8,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return d.choices?.[0]?.message?.content ?? "";
}

async function askBot(message: string, locale: string, conversationId: string | null): Promise<{ reply: string; conversationId: string | null }> {
  const body = conversationId ? { message, locale, conversationId } : { message, locale };
  const RETRY_STATUS = new Set([502, 503, 504]);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/v1/tenants/maa/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (RETRY_STATUS.has(res.status)) {
        lastError = new Error(`bot HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`bot HTTP ${res.status}`);
      const d = (await res.json()) as { assistantMessage?: string; conversationId?: string };
      return { reply: d.assistantMessage ?? "", conversationId: d.conversationId ?? conversationId };
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("bot request failed after retries");
}

async function nextUserMessage(persona: Persona, transcript: Array<{ role: string; content: string }>): Promise<string> {
  const isEn = persona.locale === "en-CA";
  const sys = isEn
    ? `You play a DEMANDING visitor testing a sports-club AI concierge, in casual English (small typos ok). ${persona.goal}
Rules: one short reply at a time (real chat). Never play the concierge. Advance per your goal. When done, write exactly "[FIN]".`
    : `Tu joues un VISITEUR exigeant qui teste un concierge IA de club sportif, en français québécois, ton naturel et un peu pressé (petites fautes ok). ${persona.goal}
Règles: une seule réplique courte à la fois (comme un vrai chat). Ne joue jamais le concierge. Avance la conversation selon ton objectif. Si tu as fini ton objectif, écris exactement "[FIN]".`;
  const convo = transcript.map((t) => `${t.role === "user" ? (isEn ? "ME" : "MOI") : (isEn ? "CONCIERGE" : "CONCIERGE")}: ${t.content}`).join("\n");
  const content = transcript.length === 0
    ? (isEn ? "Start the conversation with your first question." : "Commence la conversation par ta première question.")
    : (isEn ? `Conversation so far:\n${convo}\n\nWrite your next reply (or "[FIN]").` : `Conversation jusqu'ici:\n${convo}\n\nÉcris ta prochaine réplique (ou "[FIN]").`);
  const out = await chat([{ role: "system", content: sys }, { role: "user", content }]);
  return out.trim();
}

interface Violation { turn: number; rule: string; evidence: string; severity: "high" | "low"; }

async function judge(transcript: Array<{ role: string; content: string }>, checklist?: string): Promise<{ pass: boolean; violations: Violation[] }> {
  const numbered = transcript
    .map((t, i) => `[${Math.floor(i / 2) + 1}] ${t.role === "user" ? "USER" : "ASSISTANT"}: ${t.content}`)
    .join("\n");
  const checklistBlock = checklist
    ? `\n\nCATEGORY-SPECIFIC REQUIREMENTS (Daphné's expectations for this conversation). If the conversation clearly fails one, add a violation with rule "CHECKLIST_MISS" and the relevant severity:\n${checklist}`
    : "";
  const out = await chat([
    { role: "system", content: RUBRIC + checklistBlock },
    { role: "user", content: `TRANSCRIPT:\n${numbered}` },
  ], true, JUDGE_MODEL);
  try {
    const parsed = JSON.parse(out) as { pass: boolean; violations: Violation[] };
    return { pass: parsed.pass, violations: parsed.violations ?? [] };
  } catch {
    return { pass: false, violations: [{ turn: 0, rule: "JUDGE_PARSE_ERROR", evidence: out.slice(0, 120), severity: "high" }] };
  }
}

async function runPersona(persona: Persona): Promise<{ pass: boolean; violations: Violation[]; transcript: Array<{ role: string; content: string }> }> {
  const transcript: Array<{ role: string; content: string }> = [];
  let cid: string | null = null;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const userMsg = await nextUserMessage(persona, transcript);
    if (/\[FIN\]/i.test(userMsg) || !userMsg) break;
    transcript.push({ role: "user", content: userMsg });
    const { reply, conversationId } = await askBot(userMsg, persona.locale ?? "fr-CA", cid);
    cid = conversationId;
    transcript.push({ role: "assistant", content: reply });
    // Throttle: 2.5s between turns so 24 personas don't tip the 2-vCPU droplet.
    await new Promise((r) => setTimeout(r, 2500));
  }
  const verdict = await judge(transcript, persona.checklist);
  return { ...verdict, transcript };
}

async function main(): Promise<void> {
  const personas = personaArg ? PERSONAS.filter((p) => p.id === personaArg) : PERSONAS;
  console.log(`\n🤖 Adversarial simulator → ${BASE}  (${personas.length} persona(s), max ${MAX_TURNS} turns)\n`);
  let pass = 0, fail = 0;
  const failures: string[] = [];
  for (const persona of personas) {
    try {
      const { pass: ok, violations, transcript } = await runPersona(persona);
      const highs = violations.filter((v) => v.severity === "high");
      if (ok && highs.length === 0) {
        pass++;
        console.log(`  ✅ ${persona.id}  (${transcript.length / 2} turns)`);
        for (const v of violations) console.log(`      🟡 [t${v.turn}] ${v.rule}: ${v.evidence}`);
      } else {
        fail++;
        console.log(`  🔴 ${persona.id}`);
        for (const v of violations) {
          const icon = v.severity === "high" ? "❌" : "🟡";
          console.log(`      ${icon} [t${v.turn}] ${v.rule}: ${v.evidence}`);
          if (v.severity === "high") failures.push(`${persona.id} t${v.turn} ${v.rule}: ${v.evidence}`);
        }
      }
    } catch (e) {
      fail++;
      console.log(`  🔴 ${persona.id} — ERROR ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n📊 ${pass}/${pass + fail} personas clean (no high-severity violations)\n`);
  if (failures.length) { console.log("High-severity:\n" + failures.map((f) => "  - " + f).join("\n") + "\n"); }
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
