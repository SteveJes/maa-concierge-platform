/**
 * Autonomous regression suite — hits the live API at localhost:4000.
 * Run: pnpm test:maa:auto
 *
 * Exit 0 = all pass (or failures within tolerance).
 * Exit 1 = critical failures exceeded threshold.
 */

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "../..");
for (const f of [".env.local", ".env"].map((n) => path.join(apiDir, n))) {
  if (fs.existsSync(f)) dotenv.config({ path: f, override: false });
}

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
const TENANT = "maa";
const CONCURRENCY = 3; // parallel slots
const FAILURE_THRESHOLD = 5; // fail exit if more than this many tests fail

// ── Types ────────────────────────────────────────────────────────────────────

type FollowUpMode = "done" | "callback" | "vapi" | "calendly" | "clarify";

interface Scenario {
  id: string;
  description: string;
  locale: "fr-CA" | "en-CA";
  message: string;
  /** At least ONE of these must appear in assistantMessage (case-insensitive) */
  mustContainAny?: string[];
  /** ALL of these must appear */
  mustContainAll?: string[];
  /** NONE of these must appear */
  mustNotContain?: string[];
  /** Expected followUpMode — omit to skip */
  followUpMode?: FollowUpMode;
  /** Max acceptable response time in ms */
  maxMs?: number;
}

interface ScenarioResult {
  id: string;
  description: string;
  passed: boolean;
  failures: string[];
  assistantMessage: string;
  followUpMode: string;
  durationMs: number;
}

// ── Scenario definitions ─────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  // ── French — core facts ───────────────────────────────────────────────────
  {
    id: "fr-greeting",
    description: "FR: Bonjour → warm French greeting",
    locale: "fr-CA",
    message: "Bonjour",
    mustContainAny: ["bonjour", "bienvenue", "comment puis-je", "aider"],
    mustNotContain: ["hello", "hi there"],
  },
  {
    id: "fr-address",
    description: "FR: Adresse → 2070 rue Peel",
    locale: "fr-CA",
    message: "Quelle est votre adresse?",
    mustContainAll: ["2070", "peel"],
    mustNotContain: ["je ne sais pas", "je ne dispose pas"],
  },
  {
    id: "fr-metro",
    description: "FR: Métro proche → station Peel",
    locale: "fr-CA",
    message: "Êtes-vous proches d'une station de métro?",
    mustContainAny: ["peel", "métro", "metro", "5 minute", "5 min"],
    mustNotContain: ["je ne sais pas"],
  },
  {
    id: "fr-phone",
    description: "FR: Numéro de téléphone → 514 845-2233",
    locale: "fr-CA",
    message: "Quel est votre numéro de téléphone?",
    mustContainAny: ["514", "845-2233", "845 2233"],
    mustNotContain: ["je ne dispose pas"],
  },
  {
    id: "fr-founded",
    description: "FR: Année de fondation → 1881",
    locale: "fr-CA",
    message: "En quelle année avez-vous été fondé?",
    mustContainAny: ["1881"],
    mustNotContain: ["je ne sais pas", "callback", "rappel"],
    followUpMode: "done",
  },
  {
    id: "fr-hours-general",
    description: "FR: Horaires généraux → lundi à vendredi 6h-22h",
    locale: "fr-CA",
    message: "Quels sont vos horaires d'ouverture?",
    mustContainAny: ["6h", "22h", "lundi", "vendredi", "6:00", "22:00"],
    mustNotContain: ["je ne dispose pas"],
  },
  {
    id: "fr-hours-pool",
    description: "FR: Horaires piscine → 7h-20h lun-ven",
    locale: "fr-CA",
    message: "C'est quoi les horaires de la piscine?",
    mustContainAny: ["7h", "20h", "piscine", "pool"],
    mustNotContain: ["je ne dispose pas"],
  },
  {
    id: "fr-hours-spa",
    description: "FR: Horaires spa",
    locale: "fr-CA",
    message: "Quels sont les horaires du spa?",
    mustContainAny: ["spa", "9h", "19h", "11h", "15h", "horaire"],
  },
  {
    id: "fr-arrive-5am",
    description: "FR: Arrivée à 5h → réponse directe NON (ouvre à 6h)",
    locale: "fr-CA",
    message: "Si j'arrive à 5h du matin, êtes-vous ouverts?",
    mustContainAny: ["non", "pas ouvert", "6h", "6:00", "fermé"],
    mustNotContain: ["oui, nous sommes ouverts"],
  },
  {
    id: "fr-arrive-7am",
    description: "FR: Arrivée à 7h sam → OUI (ouvre à 7h les fins de semaine)",
    locale: "fr-CA",
    message: "Si j'arrive samedi à 7h, êtes-vous ouverts?",
    mustContainAny: ["oui", "7h", "ouvert"],
  },
  {
    id: "fr-pricing",
    description: "FR: Tarifs d'abonnement → info ou hedge",
    locale: "fr-CA",
    message: "Quels sont vos tarifs d'abonnement?",
    mustContainAny: ["tarif", "abonnement", "prix", "$", "confirmer", "contacter"],
    mustNotContain: ["1 $", "2 $"], // no hallucinated micro-prices
  },
  {
    id: "fr-pricing-student",
    description: "FR: Tarif étudiant → info ou hedge",
    locale: "fr-CA",
    message: "Avez-vous des tarifs étudiants?",
    mustContainAny: ["étudiant", "tarif", "prix", "confirmer", "contacter", "réduit"],
  },
  {
    id: "fr-services",
    description: "FR: Services offerts → liste représentative",
    locale: "fr-CA",
    message: "Qu'est-ce que vous offrez comme services?",
    mustContainAny: ["piscine", "spa", "squash", "pilates", "yoga", "cours", "entraînement"],
  },
  {
    id: "fr-restaurant",
    description: "FR: Restaurant → Le 1881",
    locale: "fr-CA",
    message: "Vous avez un restaurant?",
    mustContainAny: ["1881", "restaurant", "le 1881"],
  },
  {
    id: "fr-squash",
    description: "FR: Squash → courts disponibles",
    locale: "fr-CA",
    message: "Est-ce que vous avez des courts de squash?",
    mustContainAny: ["squash"],
    mustNotContain: ["je ne dispose pas"],
  },
  {
    id: "fr-pool-swim",
    description: "FR: Natation → piscine 25m",
    locale: "fr-CA",
    message: "Est-ce que vous avez une piscine?",
    mustContainAny: ["piscine", "25", "mètre", "nage"],
  },
  {
    id: "fr-group-classes",
    description: "FR: Cours de groupe → confirmation + exemples",
    locale: "fr-CA",
    message: "Offrez-vous des cours de groupe?",
    mustContainAny: ["cours", "groupe", "pilates", "yoga", "zumba", "spin"],
  },
  {
    id: "fr-parking",
    description: "FR: Stationnement → info ou honest uncertainty",
    locale: "fr-CA",
    message: "Est-ce qu'il y a du stationnement?",
    mustContainAny: ["stationnement", "parking", "confirmer", "appeler", "voisin"],
  },
  {
    id: "fr-booking",
    description: "FR: Réserver une visite → calendly mode",
    locale: "fr-CA",
    message: "Je voudrais planifier une visite des installations.",
    mustContainAny: ["visite", "planifier", "réserver", "prendre rendez-vous"],
    followUpMode: "calendly",
  },
  {
    id: "fr-smalltalk",
    description: "FR: Ca va bonhomme? → warm redirect, no feelings claim",
    locale: "fr-CA",
    message: "Ca va bonhomme?",
    mustContainAny: ["aider", "comment puis-je", "club", "question"],
    mustNotContain: ["je vais bien", "ça va très bien", "je me sens"],
  },
  {
    id: "fr-outofscope",
    description: "FR: Question hors sujet → polite redirect",
    locale: "fr-CA",
    message: "Pouvez-vous me cuisiner un repas?",
    mustContainAny: ["club", "aider", "question", "sportif", "1881"],
    mustNotContain: ["voici la recette", "bien sûr je vais cuisiner"],
  },
  {
    id: "fr-callback",
    description: "FR: Demande de rappel → callback mode",
    locale: "fr-CA",
    message: "J'aimerais être rappelé par un membre de l'équipe.",
    mustContainAny: ["rappel", "coordonnées", "nom", "téléphone"],
  },
  {
    id: "fr-sunday-open",
    description: "FR: Ouvert dimanche? → OUI avec horaires",
    locale: "fr-CA",
    message: "Êtes-vous ouverts le dimanche?",
    mustContainAny: ["oui", "dimanche", "7h", "19h", "ouvert"],
  },
  {
    id: "fr-physiotherapy",
    description: "FR: Physio → physiothérapie disponible",
    locale: "fr-CA",
    message: "Offrez-vous de la physiothérapie?",
    mustContainAny: ["physio", "physiothérapie"],
  },
  {
    id: "fr-personal-training",
    description: "FR: Entraîneur personnel",
    locale: "fr-CA",
    message: "Avez-vous des entraîneurs personnels?",
    mustContainAny: ["entraîneur", "personnel", "training", "coach", "confirmer"],
  },
  {
    id: "fr-affirmative-followup",
    description: "FR: Pourquoi pas → expands on last topic",
    locale: "fr-CA",
    message: "Pourquoi pas",
    mustContainAny: ["club", "aider", "oui", "bien", "voici"],
  },

  // ── English — core facts ──────────────────────────────────────────────────
  {
    id: "en-greeting",
    description: "EN: Hello → warm English greeting",
    locale: "en-CA",
    message: "Hello",
    mustContainAny: ["hello", "hi", "welcome", "help"],
    mustNotContain: ["bonjour", "bienvenue"],
  },
  {
    id: "en-address",
    description: "EN: Address → 2070 Peel Street",
    locale: "en-CA",
    message: "Where are you located?",
    mustContainAll: ["2070", "peel"],
    mustNotContain: ["i don't know"],
  },
  {
    id: "en-metro",
    description: "EN: Near metro? → Peel station Green Line",
    locale: "en-CA",
    message: "Are you close to a metro station?",
    mustContainAny: ["peel", "metro", "green line", "5 min"],
  },
  {
    id: "en-phone",
    description: "EN: Phone number → 514 845-2233",
    locale: "en-CA",
    message: "What is your phone number?",
    mustContainAny: ["514", "845-2233", "845 2233"],
  },
  {
    id: "en-founded",
    description: "EN: Founded year → 1881",
    locale: "en-CA",
    message: "When was Club Sportif MAA founded?",
    mustContainAny: ["1881"],
    followUpMode: "done",
  },
  {
    id: "en-hours-general",
    description: "EN: General hours → Mon-Fri 6am-10pm",
    locale: "en-CA",
    message: "What are your hours?",
    mustContainAny: ["6am", "10pm", "monday", "friday", "6:00"],
  },
  {
    id: "en-hours-pool",
    description: "EN: Pool hours → 7am-8pm weekdays",
    locale: "en-CA",
    message: "What are the pool hours?",
    mustContainAny: ["7am", "8pm", "pool", "7:00"],
  },
  {
    id: "en-arrive-5am",
    description: "EN: Arrive at 5am → direct NO",
    locale: "en-CA",
    message: "If I arrive at 5am will you be open?",
    mustContainAny: ["no", "not open", "6am", "closed"],
    mustNotContain: ["yes, we are open"],
  },
  {
    id: "en-pricing",
    description: "EN: Membership fees → info or hedge",
    locale: "en-CA",
    message: "What are your membership fees?",
    mustContainAny: ["membership", "fee", "price", "confirm", "contact", "$"],
  },
  {
    id: "en-services",
    description: "EN: Services overview",
    locale: "en-CA",
    message: "What do you offer?",
    mustContainAny: ["pool", "spa", "squash", "pilates", "yoga", "classes", "fitness"],
  },
  {
    id: "en-booking",
    description: "EN: Book a tour → calendly mode",
    locale: "en-CA",
    message: "I'd like to book a tour of the facilities.",
    mustContainAny: ["tour", "book", "visit", "schedule"],
    followUpMode: "calendly",
  },
  {
    id: "en-smalltalk",
    description: "EN: How are you? → warm redirect, no feelings",
    locale: "en-CA",
    message: "How are you doing?",
    mustContainAny: ["help", "club", "question", "assist"],
    mustNotContain: ["i'm doing great", "i feel", "i am doing well"],
  },
  {
    id: "en-outofscope",
    description: "EN: Completely off-topic → polite redirect",
    locale: "en-CA",
    message: "Can you tell me the weather forecast for tomorrow?",
    mustContainAny: ["club", "help", "question", "maa"],
    mustNotContain: ["the forecast", "temperature tomorrow"],
  },
  {
    id: "en-sunday",
    description: "EN: Open Sunday? → YES with hours",
    locale: "en-CA",
    message: "Are you open on Sunday?",
    mustContainAny: ["yes", "sunday", "7am", "7:00", "open"],
  },
  {
    id: "en-restaurant",
    description: "EN: Restaurant → Le 1881",
    locale: "en-CA",
    message: "Do you have a restaurant on site?",
    mustContainAny: ["1881", "restaurant"],
  },

  // ── Language switching ────────────────────────────────────────────────────
  {
    id: "lang-en-after-fr",
    description: "EN message → English response (not French)",
    locale: "en-CA",
    message: "What time does the pool close on weekdays?",
    mustContainAny: ["8pm", "8:00", "pm", "pool", "monday"],
    mustNotContain: ["lundi", "vendredi"],
  },

  // ── Hallucination guards ──────────────────────────────────────────────────
  {
    id: "no-hallucinate-price",
    description: "No hallucinated specific dollar amounts for membership",
    locale: "fr-CA",
    message: "Combien coûte exactement l'abonnement mensuel?",
    // We expect honest uncertainty, not made-up prices
    mustContainAny: ["confirmer", "appeler", "contacter", "variable", "varie", "dépend"],
    mustNotContain: ["49 $", "99 $", "149 $", "199 $", "59 $"],
  },
  {
    id: "no-hallucinate-availability",
    description: "No hallucinated class availability/times",
    locale: "fr-CA",
    message: "Le cours de pilates de 18h est-il disponible demain?",
    mustContainAny: ["confirmer", "appeler", "contacter", "horaire", "vérifier"],
    mustNotContain: ["oui, le cours est disponible", "il reste des places"],
  },

  // ── Response quality ──────────────────────────────────────────────────────
  {
    id: "no-emdash",
    description: "No em-dashes in response",
    locale: "fr-CA",
    message: "Parlez-moi du club.",
    mustContainAny: ["club", "sportif", "maa", "montréal"],
    mustNotContain: ["—"],
  },
  {
    id: "fr-responds-fr",
    description: "French message → French response",
    locale: "fr-CA",
    message: "Quels sont vos cours disponibles?",
    mustContainAny: ["cours", "pilates", "yoga", "groupe"],
    mustNotContain: ["we offer", "our classes"],
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const start = Date.now();
  const failures: string[] = [];
  let assistantMessage = "";
  let followUpMode = "";

  try {
    const res = await fetch(`${API_BASE}/v1/tenants/${TENANT}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: scenario.message,
        locale: scenario.locale,
        dryRunPersistence: true,
      }),
    });

    if (!res.ok) {
      failures.push(`HTTP ${res.status}`);
      return { id: scenario.id, description: scenario.description, passed: false, failures, assistantMessage, followUpMode, durationMs: Date.now() - start };
    }

    const body = (await res.json()) as { assistantMessage?: string; followUpMode?: string };
    assistantMessage = (body.assistantMessage ?? "").trim();
    followUpMode = body.followUpMode ?? "";
    const lower = assistantMessage.toLowerCase();

    if (scenario.mustContainAny && scenario.mustContainAny.length > 0) {
      const found = scenario.mustContainAny.some((kw) => lower.includes(kw.toLowerCase()));
      if (!found) failures.push(`mustContainAny: none of [${scenario.mustContainAny.join(", ")}] found`);
    }

    if (scenario.mustContainAll) {
      for (const kw of scenario.mustContainAll) {
        if (!lower.includes(kw.toLowerCase())) failures.push(`mustContainAll: "${kw}" not found`);
      }
    }

    if (scenario.mustNotContain) {
      for (const kw of scenario.mustNotContain) {
        if (lower.includes(kw.toLowerCase())) failures.push(`mustNotContain: "${kw}" found`);
      }
    }

    if (scenario.followUpMode && followUpMode !== scenario.followUpMode) {
      failures.push(`followUpMode: expected "${scenario.followUpMode}", got "${followUpMode}"`);
    }

    const durationMs = Date.now() - start;
    if (scenario.maxMs && durationMs > scenario.maxMs) {
      failures.push(`slow response: ${durationMs}ms > ${scenario.maxMs}ms`);
    }

  } catch (err) {
    failures.push(`fetch error: ${String(err)}`);
  }

  const durationMs = Date.now() - start;
  return { id: scenario.id, description: scenario.description, passed: failures.length === 0, failures, assistantMessage, followUpMode, durationMs };
}

async function runBatch(scenarios: Scenario[], concurrency: number): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (let i = 0; i < scenarios.length; i += concurrency) {
    const batch = scenarios.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(runScenario));
    results.push(...batchResults);
    // Brief pause between batches to avoid flooding the API
    if (i + concurrency < scenarios.length) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

// ── Report ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🧪 MAA Autonomous Regression Suite`);
  console.log(`   API: ${API_BASE}`);
  console.log(`   Scenarios: ${SCENARIOS.length}`);
  console.log(`   Concurrency: ${CONCURRENCY}\n`);

  const allResults = await runBatch(SCENARIOS, CONCURRENCY);

  const passed = allResults.filter((r) => r.passed);
  const failed = allResults.filter((r) => !r.passed);
  const avgMs = Math.round(allResults.reduce((s, r) => s + r.durationMs, 0) / allResults.length);

  // ── Print summary table ────────────────────────────────────────────────────
  console.log("─".repeat(80));
  for (const r of allResults) {
    const icon = r.passed ? "✓" : "✗";
    const ms = `${r.durationMs}ms`.padStart(6);
    console.log(`${icon} [${ms}] ${r.description}`);
    if (!r.passed) {
      for (const f of r.failures) console.log(`         ↳ ${f}`);
      console.log(`         ↳ AI: "${r.assistantMessage.slice(0, 120)}..."`);
    }
  }

  console.log("─".repeat(80));
  console.log(`\n  Passed : ${passed.length} / ${allResults.length}`);
  console.log(`  Failed : ${failed.length}`);
  console.log(`  Avg ms : ${avgMs}\n`);

  // ── Write JSON report for dashboard ingestion ─────────────────────────────
  const reportPath = path.join(apiDir, "regression-report.json");
  const report = {
    runAt: new Date().toISOString(),
    apiBase: API_BASE,
    total: allResults.length,
    passed: passed.length,
    failed: failed.length,
    avgMs,
    results: allResults,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Report : ${reportPath}\n`);

  if (failed.length > FAILURE_THRESHOLD) {
    console.error(`\n❌ ${failed.length} failures exceed threshold of ${FAILURE_THRESHOLD}. Exiting 1.\n`);
    process.exit(1);
  }

  if (failed.length > 0) {
    console.warn(`\n⚠  ${failed.length} failures within tolerance. Review report.\n`);
  } else {
    console.log(`\n✅ All scenarios passed.\n`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
