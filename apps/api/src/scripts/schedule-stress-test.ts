/**
 * Schedule stress-test — comprehensive coverage of how real clients ask about
 * hours/schedules/availability. ~45 probes covering every service Daphné asked
 * about, in the way real Québec/French/English visitors actually phrase it
 * (formal, casual, typo, slang, holiday edge cases, time edge cases).
 *
 * Each probe is one-shot (no conversation continuity — most schedule questions
 * are standalone). The grounded gpt-4o judge reviews windows of 3 Q/A pairs
 * against the MAA ground truth + a schedule-specific checklist.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/schedule-stress-test.ts           # prod
 *   cd apps/api && npx tsx src/scripts/schedule-stress-test.ts --local   # localhost:4000
 *   ... --window 4                                                       # judge window size
 */
import { askBot, judgeTranscript, type Violation } from "../qa/grounded-judge.js";
import maaConfig from "../qa/tenants/maa/config.js";

const BASE = process.argv.includes("--local") ? (process.env.LOCAL_API ?? "http://localhost:4000") : "https://api.dubub.com";
const WINDOW = (() => { const i = process.argv.indexOf("--window"); return i >= 0 ? Number(process.argv[i + 1]) : 4; })();

interface ScheduleProbe { id: string; query: string; locale: "fr-CA" | "en-CA"; }

const PROBES: ScheduleProbe[] = [
  // Club general hours — training floor 6h-22h weekday, 7h-19h weekend
  { id: "club-1-when-open", query: "À quelle heure ouvre le club?", locale: "fr-CA" },
  { id: "club-2-open-late", query: "Vous êtes ouvert tard le soir?", locale: "fr-CA" },
  { id: "club-3-close-time", query: "À quelle heure ferme le club?", locale: "fr-CA" },
  { id: "club-4-sunday", query: "Vous êtes ouvert le dimanche?", locale: "fr-CA" },
  { id: "club-5-en-hours", query: "What are your hours?", locale: "en-CA" },
  { id: "club-6-midnight-wrong", query: "Vous fermez à minuit?", locale: "fr-CA" },
  { id: "club-7-tomorrow-5am", query: "Open tomorrow at 5 AM?", locale: "en-CA" },
  { id: "club-8-quel-heure-slang", query: "Le gym ouvre à kelle heure?", locale: "fr-CA" },

  // Pool — dynamic via PDF + MyWellness
  { id: "pool-1-hours", query: "Horaire de la piscine?", locale: "fr-CA" },
  { id: "pool-2-open-time", query: "À quelle heure ouvre la piscine?", locale: "fr-CA" },
  { id: "pool-3-tonight", query: "Piscine ce soir?", locale: "fr-CA" },
  { id: "pool-4-sunday-en", query: "Pool hours on sunday?", locale: "en-CA" },
  { id: "pool-5-tomorrow-am", query: "Piscine demain matin?", locale: "fr-CA" },
  { id: "pool-6-free-swim", query: "Nage libre quand?", locale: "fr-CA" },

  // Group classes — dynamic via MyWellness
  { id: "classes-1-schedule", query: "Horaire des cours en groupe?", locale: "fr-CA" },
  { id: "classes-2-yoga-tomorrow", query: "Yoga demain matin?", locale: "fr-CA" },
  { id: "classes-3-hiit-friday", query: "HIIT vendredi à 18h?", locale: "fr-CA" },
  { id: "classes-4-spinning-tonight", query: "Spinning ce soir?", locale: "fr-CA" },
  { id: "classes-5-pilates-today", query: "Cours de pilates aujourd'hui?", locale: "fr-CA" },
  { id: "classes-6-saturday-en", query: "What classes are on saturday morning?", locale: "en-CA" },

  // Pickleball — 28 slots/week confirmed in KB
  { id: "pickleball-1-schedule", query: "Horaire pickleball?", locale: "fr-CA" },
  { id: "pickleball-2-thursday-eve", query: "Pickleball jeudi soir?", locale: "fr-CA" },
  { id: "pickleball-3-how-many", query: "Combien de créneaux pickleball par semaine?", locale: "fr-CA" },
  { id: "pickleball-4-sunday-am", query: "Pickleball dimanche matin?", locale: "fr-CA" },

  // Basketball
  { id: "basketball-1-schedule", query: "Horaire du basketball au club?", locale: "fr-CA" },
  { id: "basketball-2-sunday", query: "Basketball le dimanche?", locale: "fr-CA" },

  // PowerWatts — dated PDF
  { id: "powerwatts-1-session", query: "Horaire PowerWatts cette session?", locale: "fr-CA" },

  // Pilates Reformer — dated PDF
  { id: "pilates-1-reformer", query: "Horaire Pilates reformer?", locale: "fr-CA" },
  { id: "pilates-2-tuesday", query: "Pilates appareils mardi?", locale: "fr-CA" },

  // Cirque aérien
  { id: "cirque-1-schedule", query: "Horaire cirque aérien?", locale: "fr-CA" },

  // Triathlon
  { id: "triathlon-1-schedule", query: "Horaire club de triathlon?", locale: "fr-CA" },
  { id: "triathlon-2-session-end", query: "Quand finit la session de triathlon?", locale: "fr-CA" },

  // Restaurant 1881
  { id: "resto-1-now", query: "Le restaurant est ouvert maintenant?", locale: "fr-CA" },
  { id: "resto-2-saturday-eve", query: "Restaurant samedi soir, ouvert?", locale: "fr-CA" },
  { id: "resto-3-sunday-17h", query: "Dimanche à 17h, le resto est ouvert?", locale: "fr-CA" },
  { id: "resto-4-brunch-en", query: "Are you open for brunch sunday?", locale: "en-CA" },

  // Clinic / Spa / Nursing — no public hours
  { id: "clinic-1-hours", query: "Horaire de la clinique sportive?", locale: "fr-CA" },
  { id: "spa-1-hours", query: "Horaire du spa?", locale: "fr-CA" },
  { id: "spa-2-late", query: "Spa ouvert tard le soir?", locale: "fr-CA" },
  { id: "nursing-1-hours", query: "Soins infirmiers à quelle heure?", locale: "fr-CA" },

  // Edge cases: out-of-bounds times, holidays
  { id: "edge-1-5am", query: "Vous êtes ouvert demain à 5h?", locale: "fr-CA" },
  { id: "edge-2-23h", query: "Le club est ouvert à 23h?", locale: "fr-CA" },
  { id: "edge-3-holiday", query: "Vous êtes ouvert pendant les fêtes?", locale: "fr-CA" },
  { id: "edge-4-stjean", query: "Ouvert le 24 juin pour la Saint-Jean?", locale: "fr-CA" },
  { id: "edge-5-canada-day", query: "Open on Canada Day?", locale: "en-CA" },
  { id: "edge-6-summer", query: "Hours during the summer?", locale: "en-CA" },
  { id: "edge-7-right-now", query: "Are you open right now?", locale: "en-CA" },
  { id: "edge-8-still-open", query: "Vous êtes encore ouvert?", locale: "fr-CA" },
];

const CHECKLIST = `SCHEDULE-SPECIFIC EXPECTATIONS (apply to every reply in the transcript):

CONFIRMED hours (must state correctly when asked):
- Training floor: 6h-22h en semaine, 7h-19h fin de semaine. Hedge with "actuellement" or recommend the reception confirm specifics.
- Restaurant Le 1881: 7h-22h du lun-ven, 8h-22h sam, 8h-16h dim.
- Pickleball: 28 créneaux par semaine, day-by-day grid is in the KB and CORRECT — the bot may state it directly.
- Nursing (Mobile Mediq): 6h-22h30.

DYNAMIC schedules (bot must point to the live link/PDF, NOT invent times):
- Pool / piscine → PDF "MAA_Piscine_Pool_Printemps2026" + MyWellness for live availability.
- Group classes / cours en groupe → MyWellness real-time + PDF "MAA_CoursEnGroupe_HoraireClassifications".
- PowerWatts → PDF "MAA_PowerWatts_Hiver-Spring2026".
- Pilates reformer → PDF "MAA_Pilates_Reformer_Horaire-Schedule".
- Cirque aérien → PDF "MAA_Aerial-Circus_Spring2026".
- Triathlon → current session avril 7 → juin 19 2026, programmation PDF.

NO PUBLISHED HOURS (bot must say so and route correctly):
- Spa / sauna / salle de détente → "non publiés", direct to reception (poste 0).
- Clinic / sports therapy / physio / nutrition → no fixed weekly hours, route to clinique (poste 234).

EDGE CASE RULES:
- Holidays (Saint-Jean, Canada Day, Christmas, fêtes) → NEVER affirm hours. Say "les horaires peuvent varier" + confirm with reception.
- Out-of-bounds times (5h, 23h, midnight) → state the ACTUAL hours; do NOT confirm an out-of-bounds time as open.
- "Open right now" / "still open" → if the bot can't know real-time state, hedge ("selon nos horaires affichés…").
- Specific class+time questions (yoga demain 18h, HIIT vendredi 18h, etc.) → point to MyWellness, NEVER affirm a specific class at a specific time.
- "What classes on saturday morning" → MyWellness link, list class families generally, don't invent specific times.

Violations to flag:
- HALLUCINATION: invents specific times that aren't in the ground truth.
- MISROUTE: gives clinic phone (poste 234) for non-clinic queries, or vice versa.
- CHECKLIST_MISS: dynamic schedule answered without a link/PDF; holiday affirmed without disclaimer; non-published hours given specific weekly grid.
- WALL_OF_TEXT: dumps a huge grid when a link is the expected answer.`;

async function main(): Promise<void> {
  console.log(`\n📅 Schedule stress-test → ${BASE}  (${PROBES.length} probes, judge window ${WINDOW} Q/A pairs)\n`);

  const transcript: Array<{ role: string; content: string }> = [];
  const replies: Array<{ id: string; query: string; reply: string }> = [];
  for (const probe of PROBES) {
    try {
      const { reply } = await askBot(BASE, probe.query, probe.locale, null, "maa");
      transcript.push({ role: "user", content: probe.query }, { role: "assistant", content: reply });
      replies.push({ id: probe.id, query: probe.query, reply });
      process.stdout.write(".");
    } catch (e) {
      replies.push({ id: probe.id, query: probe.query, reply: `ERROR: ${e instanceof Error ? e.message : e}` });
      process.stdout.write("E");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`\n`);

  // Judge in overlapping windows.
  const allViolations: Violation[] = [];
  for (let i = 0; i < transcript.length; i += WINDOW * 2) {
    const slice = transcript.slice(i, i + WINDOW * 2);
    const { violations } = await judgeTranscript(slice, {
      groundTruth: maaConfig.groundTruth,
      checklist: CHECKLIST,
      turnOffset: i / 2,
    });
    allViolations.push(...violations);
  }

  // Report — group by probe id where possible.
  const idByTurn = new Map<number, string>();
  PROBES.forEach((p, idx) => idByTurn.set(idx + 1, p.id));

  for (const v of allViolations) {
    const icon = v.severity === "high" ? "❌" : "🟡";
    const probeId = idByTurn.get(v.turn) ?? `t${v.turn}`;
    console.log(`  ${icon} [${probeId}] ${v.rule}: ${v.evidence}`);
  }
  const highs = allViolations.filter((v) => v.severity === "high");
  console.log(`\n📊 ${highs.length} high-severity, ${allViolations.length - highs.length} low across ${PROBES.length} schedule probes\n`);
  process.exit(highs.length > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
