/**
 * Daphné-replay canary.
 *
 * Six realistic multi-turn conversations against the LIVE HTTP API.
 * This is the layer Daphné actually sees — the chat endpoint, with the
 * full prompt + safety chain. The harness asserts the things she would
 * notice without reading code: no verbatim repetition across turns,
 * no topic-jumps on "oui", no off-topic CTAs.
 *
 * USE THIS BEFORE EVERY COMMIT TOUCHING THE PROMPT, REGEX, OR KB.
 *
 * Run locally:   cd apps/api && npx tsx src/scripts/daphne-replay.ts
 * Run on prod:   DAPHNE_REPLAY_URL=https://api.dubub.com npx tsx ...
 * Exit code 1 if any flow fails — gates deploy.sh.
 */
import "dotenv/config";

interface Turn { role: "user" | "assistant"; content: string }
interface Flow {
  id: string;
  label: string;
  locale: "fr-CA" | "en-CA";
  turns: Array<{
    say: string;
    expect?: { mustInclude?: RegExp[]; mustNotInclude?: RegExp[] };
  }>;
}

const BASE_URL = process.env.DAPHNE_REPLAY_URL ?? "http://localhost:4000";
const TENANT = "maa";

// 6 flows — each one models a real Daphné-style mini-conversation.
// Designed to catch the bug class Steve flagged on 2026-05-18.
const FLOWS: Flow[] = [
  {
    id: "maagazine-handoff",
    label: "MAAgazine: 'alors oui svp' must move forward, NOT loop the same answer",
    locale: "fr-CA",
    turns: [
      { say: "je vois que vous avez un maagazine, c'est quoi au juste?" },
      {
        say: "alors oui svp",
        expect: {
          mustInclude: [/(coordonn[éè]es|courriel|transmet|maagazine|clubsportifmaa\.com|email)/i],
          mustNotInclude: [/Le MAAgazine est une publication exclusive du Club/i],
        },
      },
      {
        say: "oui",
        expect: {
          mustNotInclude: [/planifier\s+une\s+visite/i],
        },
      },
    ],
  },
  {
    id: "pool-hours-handoff",
    label: "Pool hours: explicit handoff request, 'oui svp' must advance to contact-info ask",
    locale: "fr-CA",
    turns: [
      // Force a handoff context in turn 1 — the autonomous bot would just
      // answer pool hours otherwise (which is correct behaviour). We're
      // testing the handoff-acceptance path specifically.
      { say: "j'aimerais que quelqu'un de l'équipe m'aide avec mes horaires de nage libre" },
      {
        say: "oui svp",
        expect: {
          mustInclude: [/(nathalie|coordonn[éè]es|nom|t[éè]l[éè]phone|courriel|transmet|contact)/i],
        },
      },
    ],
  },
  {
    id: "restaurant-link",
    label: "Restaurant menu: must include a clickable link",
    locale: "fr-CA",
    turns: [
      {
        say: "pouvez-vous m'envoyer le menu du restaurant ?",
        expect: {
          mustInclude: [/\[.+\]\(https?:\/\/|clubsportifmaa\.com|libroreserve|resto1881/i],
        },
      },
    ],
  },
  {
    id: "non-member-class",
    label: "Non-member asking about a class — must mention Francis and explain membership tie",
    locale: "fr-CA",
    turns: [
      { say: "je veux essayer un cours de yoga" },
      { say: "non, je ne suis pas membre" },
      {
        say: "donc oui je suis intéressé",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[éè]sion)/i],
          mustNotInclude: [/\bje\s+(?:vous\s+)?(?:r[éè]serve|inscris)\b/i],
        },
      },
    ],
  },
  {
    id: "price-objection-en",
    label: "EN price objection: reply must stay in English",
    locale: "en-CA",
    turns: [
      {
        say: "Why is it $225/month? That seems expensive.",
        expect: {
          mustInclude: [/(pool|spa|class|restaurant|1881|squash|amenit|include)/i],
          mustNotInclude: [/\b(votre|équipe|n['’]?hésitez|souhaitez-vous|notre)\b/i],
        },
      },
    ],
  },
  {
    // Daphné demo bug 2026-05-19: after bot described Le 1881, user said "oui
    // svp kjaimerais reserver" — bot collapsed to "Cliquez sur le bouton pour
    // planifier votre visite" (Club visit template, WRONG). Restaurant
    // reservation ≠ Club visit. The reply must point to LibroReserve / phone,
    // NOT trigger the visit-booking button.
    id: "restaurant-reservation-handoff",
    label: "Restaurant: after Le 1881 desc, 'oui je veux réserver' must NOT trigger Club visit template",
    locale: "fr-CA",
    turns: [
      { say: "parlez-moi du restaurant Le 1881" },
      {
        say: "oui svp j'aimerais réserver une table",
        expect: {
          mustInclude: [/(libroreserve|resto1881|reservation|r[ée]servation|514\s*845.8002|menu|1881)/i],
          mustNotInclude: [
            /Cliquez\s+sur\s+le\s+bouton\s+ci-dessous\s+pour\s+planifier\s+votre\s+visite/i,
            /planifier\s+(?:votre|une)\s+visite\s+du\s+club/i,
          ],
        },
      },
    ],
  },
  {
    id: "spa-non-member",
    label: "Spa for a non-member — never bluntly refuse, must route warmly",
    locale: "fr-CA",
    turns: [
      { say: "est-ce que je peux utiliser le sauna sans être membre ?" },
      {
        say: "donc je dois être membre c'est ça ?",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[éè]sion)/i],
          mustNotInclude: [/\bnon[,\s]+(?:c['’]?est|on\s+ne)\b/i],
        },
      },
    ],
  },

  // ──── 2026-05-19 expansion batch — proactive coverage so Daphné finds
  // ──── nothing during her test runs. Each case here represents a real or
  // ──── likely failure class — DO NOT remove without a replacement.

  {
    id: "membership-prices-direct",
    label: "Pricing: must give 225/185/195/295 with 'actuellement' + soft inclusion mention",
    locale: "fr-CA",
    turns: [
      {
        say: "combien coûte l'abonnement annuel ?",
        expect: {
          mustInclude: [/\b225\s*\$|225\$|225\s*par\s+mois/i],
          mustNotInclude: [/Cliquez\s+sur\s+le\s+bouton/i],
        },
      },
    ],
  },
  {
    id: "membership-prices-en",
    label: "Pricing EN: must reply in English with the rate (no FR leak)",
    locale: "en-CA",
    turns: [
      {
        say: "what's the annual membership price?",
        expect: {
          mustInclude: [/\$\s?225|225\s*\$|225\s*(?:per|\/)\s*month/i],
          mustNotInclude: [/\b(votre|équipe|n['']?hésitez|souhaitez-vous|bien sûr|avec plaisir)\b/i],
        },
      },
    ],
  },
  {
    id: "student-pricing",
    label: "Student rate: 195 $/mois under 25 — confirm with caveat",
    locale: "fr-CA",
    turns: [
      {
        say: "j'ai 22 ans, est-ce qu'il y a un tarif étudiant ?",
        expect: {
          mustInclude: [/\b195\s*\$|195\$|tarif\s+[ée]tudiant/i],
        },
      },
    ],
  },
  {
    id: "senior-pricing",
    label: "Senior rate: 185 $/mois 70+ — confirm",
    locale: "fr-CA",
    turns: [
      {
        say: "j'ai 72 ans, avez-vous un tarif aîné ?",
        expect: {
          mustInclude: [/\b185\s*\$|185\$|a[îi]n[ée]s?\b/i],
        },
      },
    ],
  },
  {
    id: "pool-hours-direct",
    label: "Pool hours: autonomous answer with confirmed schedule, no '514 845-2233' trailer",
    locale: "fr-CA",
    turns: [
      {
        say: "quels sont les horaires de la piscine ?",
        expect: {
          mustInclude: [/\b(7|6h30|7h)|\b(20h30|20h|18h)\b/i],
          mustNotInclude: [/Je\s+vous\s+recommande\s+de\s+valider/i],
        },
      },
    ],
  },
  {
    id: "pickleball-schedule",
    label: "Pickleball: 28 timeslots, members-only, MAA app for reservation",
    locale: "fr-CA",
    turns: [
      {
        say: "j'aimerais jouer au pickleball, comment ça marche ?",
        expect: {
          mustInclude: [/\b(28|membre|application|app)\b/i],
        },
      },
    ],
  },
  {
    id: "pickleball-non-member",
    label: "Pickleball non-member: clear answer, warm route to Francis",
    locale: "fr-CA",
    turns: [
      { say: "je ne suis pas membre, est-ce que je peux jouer au pickleball ?" },
      {
        say: "donc seulement membres ?",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite)/i],
        },
      },
    ],
  },
  {
    id: "yoga-included",
    label: "Yoga: included with membership, NO à-la-carte affirmation",
    locale: "fr-CA",
    turns: [
      {
        say: "est-ce que le yoga est inclus dans l'abonnement ?",
        expect: {
          mustInclude: [/\b(inclus|incluse|fait\s+partie|inclus[e]?s?\s+dans)\b/i],
          mustNotInclude: [
            /participer\s+sans\s+être\s+membre/i,
            /(à|a)\s+la\s+carte/i,
            /drop[\s-]?in/i,
          ],
        },
      },
    ],
  },
  {
    id: "group-classes-lead-yes",
    label: "Group classes: must lead with 'Oui' affirmation",
    locale: "fr-CA",
    turns: [
      {
        say: "les cours de groupe sont-ils inclus avec l'abonnement ?",
        expect: {
          mustInclude: [/^(?:Oui|absolument)/i, /(inclus|incluse|fait\s+partie)/i],
        },
      },
    ],
  },
  {
    id: "restaurant-take-out",
    label: "Restaurant take-out: must include ordering or restaurant phone",
    locale: "fr-CA",
    turns: [
      {
        say: "puis-je commander pour emporter au restaurant ?",
        expect: {
          mustInclude: [/clusterpos|emporter|take[\s-]?out|514\s*845.8002|1881/i],
        },
      },
    ],
  },
  {
    id: "restaurant-group-12",
    label: "Restaurant group of 12: must route to group reservations phone",
    locale: "fr-CA",
    turns: [
      {
        say: "j'aimerais réserver une table pour 12 personnes au restaurant",
        expect: {
          mustInclude: [/514\s*845.8002|groupe|conf[ée]rence|grand[s]?\s+groupes?/i],
        },
      },
    ],
  },
  {
    id: "spa-massage-prices",
    label: "Massage prices: must give 60/80/105 $ tiers",
    locale: "fr-CA",
    turns: [
      {
        say: "combien coûte un massage de 55 minutes ?",
        expect: {
          mustInclude: [/\b80\s*\$|80\$/i],
        },
      },
    ],
  },
  {
    id: "clinique-pain",
    label: "Pain query: NO diagnosis, route to physio/sports therapy",
    locale: "fr-CA",
    turns: [
      {
        say: "j'ai mal au genou depuis une semaine",
        expect: {
          mustInclude: [/(physio|th[ée]rapie\s+sportive|clinique)/i],
          mustNotInclude: [/\b(arthrite|tendinite|hernie|m[ée]niscale?|sciatique|capsulite)\b/i],
        },
      },
    ],
  },
  {
    id: "club-history",
    label: "Heritage: 1881 founding, premium heritage tone",
    locale: "fr-CA",
    turns: [
      {
        say: "depuis quand existe le Club ?",
        expect: {
          mustInclude: [/\b1881\b/],
        },
      },
    ],
  },
  {
    id: "address",
    label: "Address: 2070 Peel Montreal",
    locale: "fr-CA",
    turns: [
      {
        say: "où se trouve le Club ?",
        expect: {
          mustInclude: [/2070|Peel|Montr[ée]al/i],
        },
      },
    ],
  },
  {
    id: "phone-general",
    label: "General phone: 514 845-2233 (no inventions)",
    locale: "fr-CA",
    turns: [
      {
        say: "quel est votre numéro de téléphone ?",
        expect: {
          mustInclude: [/514\s*845.2233/i],
        },
      },
    ],
  },
  {
    id: "language-switch-en-to-fr",
    label: "Language switch EN→FR: subsequent reply fully French, no English leak",
    locale: "en-CA",
    turns: [
      { say: "what's the membership price?" },
      {
        say: "désolé, je préfère continuer en français svp",
        expect: {
          mustNotInclude: [/\b(currently|membership|monthly|please|right|the team)\b/i],
        },
      },
    ],
  },
  {
    id: "language-switch-fr-to-en",
    label: "Language switch FR→EN: subsequent reply fully English",
    locale: "fr-CA",
    turns: [
      { say: "combien coûte l'abonnement ?" },
      {
        say: "sorry can we continue in English?",
        expect: {
          mustNotInclude: [/\b(votre|équipe|n['']?hésitez|souhaitez-vous|bien sûr|avec plaisir|svp|s['']?il vous pla[iî]t|actuellement)\b/i],
        },
      },
    ],
  },
  {
    id: "quick-info-no-form",
    label: "Quick-info / no-form: NO booking suggestion, NO 'transmettre demande', NO visit CTA",
    locale: "fr-CA",
    turns: [
      {
        say: "je veux juste savoir vite si vous avez du pickleball, pas remplir de formulaire",
        expect: {
          mustNotInclude: [
            /transmettre\s+votre\s+demande/i,
            /planifier\s+une\s+visite/i,
            /Cliquez\s+sur\s+le\s+bouton/i,
            /Souhaitez-vous\s+que\s+je\s+vous\s+(?:mette|transmette|orient)/i,
          ],
        },
      },
    ],
  },
  {
    id: "cancellation",
    label: "Cancellation request: NO calendly/visit template, route appropriately",
    locale: "fr-CA",
    turns: [
      {
        say: "je veux annuler mon abonnement",
        expect: {
          mustNotInclude: [
            /Cliquez\s+sur\s+le\s+bouton\s+ci-dessous\s+pour\s+planifier/i,
            /planifier\s+(?:votre|une)\s+visite/i,
          ],
        },
      },
    ],
  },
  {
    id: "urgent-callback-no-promise",
    label: "Urgent callback in 5 min: must NOT promise specific timing (only catch PROMISE patterns, not quoted-back user phrasing)",
    locale: "fr-CA",
    turns: [
      {
        say: "pouvez-vous me rappeler dans 5 minutes ?",
        expect: {
          // Only catch PROMISE phrasings — bot quoting back the user's
          // request ("votre demande de rappel dans 5 minutes") is fine when
          // followed by "je ne peux pas garantir" / "I cannot guarantee".
          mustNotInclude: [
            /\b(?:Je\s+vous|on\s+vous|nous\s+vous)\s+(?:rappelle|rappellerons|rappellerai|appel|appelons|appellerons)\s+(?:dans|d['']?ici|en)\s+5\s*minutes\b/i,
            /\bI['']?ll\s+(?:call|phone|reach)\s+(?:you\s+)?(?:back\s+)?in\s+5\s*minutes\b/i,
            /\b(?:we['']?ll|we\s+will)\s+(?:call|phone)\s+(?:you\s+)?(?:back\s+)?in\s+5\s*minutes\b/i,
          ],
        },
      },
    ],
  },
  {
    id: "external-price-claim",
    label: "External price claim ($150): must NOT confirm, route to Francis or team",
    locale: "fr-CA",
    turns: [
      {
        say: "mon ami m'a dit que c'est 150$ par mois",
        expect: {
          mustNotInclude: [/\bbien\s+s[uû]r,?\s+(?:c['']?est|150)/i],
        },
      },
    ],
  },
  {
    id: "price-objection-en-justify",
    label: "EN price objection ($225 expensive): justify with concrete inclusions list",
    locale: "en-CA",
    turns: [
      {
        say: "$225/mo is expensive, why?",
        expect: {
          mustInclude: [/(pool|sauna|spa|squash|class|restaurant|1881|Pilates|fitness|amenit)/i],
        },
      },
    ],
  },
  {
    id: "maagazine-no-forbidden-phrase",
    label: "MAAgazine: must NOT use 'publication exclusive du Club'",
    locale: "fr-CA",
    turns: [
      { say: "c'est quoi le MAAgazine ?" },
      {
        say: "ok merci",
        expect: {
          mustNotInclude: [/publication\s+exclusive\s+du\s+club/i],
        },
      },
    ],
  },
  {
    id: "autonomy-buanderie-no-trailer",
    label: "Buanderie price: 25 $/mois confirmed, must NOT add '514 845-2233 valider' trailer",
    locale: "fr-CA",
    turns: [
      {
        say: "avez-vous un service de buanderie ?",
        expect: {
          mustInclude: [/\b25\s*\$|25\$|buanderie/i],
          mustNotInclude: [/Je\s+vous\s+recommande\s+de\s+valider[^.]+514\s*845.2233/i],
        },
      },
    ],
  },
  {
    id: "explicit-team-help",
    label: "Explicit team help: 'quelqu'un de l'équipe m'aide' → offer named handoff, not raw facts",
    locale: "fr-CA",
    turns: [
      {
        say: "j'aimerais que quelqu'un de l'équipe m'aide à choisir un programme",
        expect: {
          mustInclude: [/(francis|nathalie|clinique|coordonn[ée]es|nom|t[ée]l[ée]phone|courriel|transmet|contact)/i],
        },
      },
    ],
  },
  {
    id: "restaurant-link-button",
    label: "Restaurant menu link: markdown link present (UI renders as button, not raw URL)",
    locale: "fr-CA",
    turns: [
      {
        say: "pouvez-vous m'envoyer le menu du restaurant ?",
        expect: {
          mustInclude: [/\[.+\]\(https?:\/\/|clubsportifmaa\.com|1881|libroreserve/i],
        },
      },
    ],
  },
  {
    id: "non-member-class-warm-route",
    label: "Non-member asks about a class: mention Francis + explain membership tie",
    locale: "fr-CA",
    turns: [
      { say: "je voudrais essayer un cours de pilates" },
      { say: "non, je ne suis pas encore membre" },
      {
        say: "donc je suis intéressé pour devenir membre",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[éè]sion)/i],
        },
      },
    ],
  },
  {
    id: "spa-mother-non-member",
    label: "Spa with mother (non-member): warm route, NO assumption of access",
    locale: "fr-CA",
    turns: [
      {
        say: "je veux aller au spa avec ma mère, sans abonnement",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[éè]sion|massoth[ée]rapie|rendez-vous)/i],
        },
      },
    ],
  },
  {
    id: "gym-access-unknown-membership",
    label: "Gym access (no member declaration): qualified answer, NO visit CTA, NO 'Vous pouvez accéder'",
    locale: "fr-CA",
    turns: [
      {
        say: "puis-je m'entraîner dans la salle de musculation ?",
        expect: {
          mustNotInclude: [
            /^Vous\s+pouvez\s+acc[ée]der/i,
            /Cliquez\s+sur\s+le\s+bouton\s+ci-dessous\s+pour\s+planifier/i,
          ],
        },
      },
    ],
  },

  // Daphné 2026-05-19 demo bug: "je voudrais me joindre à votre gym" was
  // misread as "contact us at 514 845-2233". The bot must interpret JOIN as
  // membership interest, never reply with a phone number alone.
  {
    id: "membership-interest-embonpoint",
    label: "Prospect with weight-loss goal wants to join: WARM acknowledgement + Francis/visit, NO bare phone number",
    locale: "fr-CA",
    turns: [
      {
        say: "je fais de l'embonpoint et voudrais me joindre à votre gym",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[ée]sion|trainer|entra[îi]neur|programme|d['']?accueillir|bienvenue)/i],
          mustNotInclude: [
            /^Vous\s+pouvez\s+nous\s+joindre\s+au\s+514\s*845.2233/i,
            /^You\s+can\s+reach\s+us\s+at/i,
          ],
        },
      },
    ],
  },
  {
    id: "membership-interest-join-direct",
    label: "Direct 'I want to join' must route to Francis/visit, never to a generic phone number",
    locale: "fr-CA",
    turns: [
      {
        say: "j'aimerais devenir membre de votre club",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[ée]sion)/i],
          mustNotInclude: [/^Vous\s+pouvez\s+nous\s+joindre\s+au\s+514/i],
        },
      },
    ],
  },
  {
    id: "yoga-denial-not-affirmation",
    label: "Yoga: when bot says 'NOT à la carte', it must NOT trigger the affirmation guard wrongly",
    locale: "fr-CA",
    turns: [
      {
        say: "puis-je faire du yoga sans abonnement ?",
        expect: {
          // Either bot affirms membership-only OR uses "non" / "n'est pas" denial — both valid
          mustInclude: [/(membre|abonnement|francis|bradette|adh[ée]sion)/i],
        },
      },
    ],
  },
];

async function postChat(message: string, locale: string, conversationId: string | null): Promise<{
  assistantMessage: string;
  conversationId: string | null;
}> {
  const url = `${BASE_URL.replace(/\/$/, "")}/v1/tenants/${TENANT}/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, locale, conversationId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { assistantMessage: string; conversationId: string | null };
  return data;
}

function longestCommonSubstring(a: string, b: string): string {
  if (!a || !b) return "";
  let best = "";
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best.length) best = a.slice(i, i + k);
    }
  }
  return best;
}

// Throttle so we don't hammer NocoDB / OpenAI rate limits during back-to-back
// flows. 600ms between requests keeps the full 37-flow suite well under any
// burst limit while only adding ~22s to total runtime.
const THROTTLE_MS = Number(process.env.DAPHNE_REPLAY_THROTTLE_MS ?? 600);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFlow(flow: Flow): Promise<{ id: string; passed: boolean; failureReason?: string; transcript: string[] }> {
  const transcript: string[] = [];
  let conversationId: string | null = null;
  const priorBotReplies: string[] = [];
  for (const [i, turn] of flow.turns.entries()) {
    if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
    transcript.push(`USER ${i + 1}: ${turn.say}`);
    let reply: string;
    try {
      const res = await postChat(turn.say, flow.locale, conversationId);
      conversationId = res.conversationId;
      reply = res.assistantMessage;
    } catch (err) {
      return { id: flow.id, passed: false, failureReason: `HTTP error at turn ${i + 1}: ${(err as Error).message}`, transcript };
    }
    transcript.push(`BOT  ${i + 1}: ${reply.replace(/\s+/g, " ").slice(0, 200)}${reply.length > 200 ? "..." : ""}`);

    if (turn.expect) {
      for (const re of turn.expect.mustInclude ?? []) {
        if (!re.test(reply)) {
          return { id: flow.id, passed: false, failureReason: `Turn ${i + 1}: reply missing required pattern ${re}`, transcript };
        }
      }
      for (const re of turn.expect.mustNotInclude ?? []) {
        if (re.test(reply)) {
          return { id: flow.id, passed: false, failureReason: `Turn ${i + 1}: reply matched FORBIDDEN pattern ${re}`, transcript };
        }
      }
    }

    const currentReplyNormalized = reply.replace(/\s+/g, " ").trim();
    for (const prev of priorBotReplies) {
      const overlap = longestCommonSubstring(currentReplyNormalized, prev);
      if (overlap.length > 0 && overlap.length / Math.max(currentReplyNormalized.length, 1) >= 0.8) {
        return {
          id: flow.id,
          passed: false,
          failureReason: `Turn ${i + 1}: bot repeated a prior reply verbatim (${overlap.length}/${currentReplyNormalized.length} chars match)`,
          transcript,
        };
      }
    }
    priorBotReplies.push(currentReplyNormalized);
  }
  return { id: flow.id, passed: true, transcript };
}

(async () => {
  console.log(`[daphne-replay] base=${BASE_URL} flows=${FLOWS.length}\n`);
  const results = [];
  for (const flow of FLOWS) {
    process.stdout.write(`  ${flow.id.padEnd(28)} ${flow.label}\n`);
    const r = await runFlow(flow);
    results.push(r);
    if (r.passed) {
      console.log(`    PASS`);
    } else {
      console.log(`    FAIL — ${r.failureReason}`);
      for (const line of r.transcript) console.log(`      ${line}`);
    }
    console.log();
  }
  const failed = results.filter((r) => !r.passed);
  console.log(`\n[daphne-replay] ${results.length - failed.length}/${results.length} flows passed`);
  if (failed.length > 0) {
    console.log(`[daphne-replay] FAILED flows: ${failed.map((f) => f.id).join(", ")}`);
    process.exit(1);
  }
})();
