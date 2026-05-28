/**
 * Daphné 2026-05-27 review replay — comprehensive prod probe.
 *
 * Daphné's 38-page review PDF (apps/api/_inbox/daphne-2026-05-27/review_maa_version_2_.txt)
 * walks through 24 service categories and flags specific bugs per category.
 * This script probes prod with the EXACT user phrasings Daphné used (from her
 * review + xlsx transcript) and checks each response against the specific
 * bug patterns she identified.
 *
 * Goal: find every "I claimed it's fixed but the bot still fails" failure
 * BEFORE we hand to Daphné — Steve's 2026-05-27 ask after the Pilates miss.
 *
 * Output:
 *   - apps/api/_alerts/daphne-review-replay-<ISO>.md (per-category report)
 *   - Console digest with pass/fail/warn per probe
 *
 * Run: pnpm.cmd --filter @platform/api exec tsx src/scripts/daphne-review-replay.ts
 *   --prod                # hit api.dubub.com (default)
 *   --local               # hit localhost:3001
 *   --category <N>        # only run a specific review category number
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALERTS_DIR = path.resolve(__dirname, "../../_alerts");

interface Probe {
  category: number;
  categoryLabel: string;
  id: string;
  /** Either a single user message OR a multi-turn history with final message. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  locale?: "fr-CA" | "en-CA";
  /** Bug patterns from Daphné's review — if any match, FAIL. */
  forbidPatterns: RegExp[];
  /** Patterns that SHOULD appear — if none match, WARN. */
  requireAnyPattern?: RegExp[];
  /** One-line description of what Daphné said in her review for this case. */
  daphneSays: string;
}

// ── Probes derived directly from Daphné's review PDF, one or more per category ──
const PROBES: Probe[] = [
  // Category 1 — PISCINE
  {
    category: 1,
    categoryLabel: "PISCINE",
    id: "1-private-pricing",
    userMessage: "quels sont les tarifs pour les cours privés de natation ?",
    forbidPatterns: [
      /tarifs\s+(?:précis\s+)?(?:doivent\s+être\s+validés|ne\s+sont\s+pas\s+publi)/i, // vague non-answer
    ],
    requireAnyPattern: [
      // From override/specialty-courses.json::natation_adulte.pricing_cours_prive
      /50\s*\$|75\s*\$|90\s*\$|MAA_Piscine_Programmme_Spring2026/i,
    ],
    daphneSays: "Tarifs pour cours privés piscine sont sur le PDF programmation Espace O — Spring 2026.",
  },
  {
    category: 1,
    categoryLabel: "PISCINE",
    id: "1-hours-pdf-link",
    userMessage: "quels sont les horaires de la piscine ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /MAA_Piscine_Pool|widgets\.mywellness|programmme|programme/i,
    ],
    daphneSays: "Doit pouvoir envoyer le lien PDF horaire piscine, pas juste rediriger oralement.",
  },

  // Category 2 — PILATES SUR APPAREILS
  {
    category: 2,
    categoryLabel: "PILATES SUR APPAREILS",
    id: "2-reservation",
    userMessage: "comment puis-je réserver des cours privés de pilates pour demain ?",
    forbidPatterns: [
      // From Steve's screenshot 2026-05-27: bot was saying "généralement 6h-22h"
      /g[ée]n[ée]ralement\s+(?:de\s+)?6\s*h\s*(?:à|to)\s*22\s*h/i,
      /clinique\s+MAA/i, // wrong — Pilates Reformer is Elisabeth Boutin, not the clinic
    ],
    requireAnyPattern: [
      /Elisabeth\s+Boutin|eboutin|widgets\.mywellness|fliipapp\.com\/user\/register\/buy_product|7h30|07h30/i,
    ],
    daphneSays: "Réservations via widgets.mywellness ou fliip; contact Elisabeth Boutin. Horaire spécifique du PDF Reformer.",
  },
  {
    category: 2,
    categoryLabel: "PILATES SUR APPAREILS",
    id: "2-pricing",
    userMessage: "combien coûtent les cours de pilates sur appareils ?",
    forbidPatterns: [],
    requireAnyPattern: [
      // Override sports.json::pilates_reformer.pricing
      /\b240\s*\$\b|\b270\s*\$\b|\b160\s*\$\b|forfait/i,
    ],
    daphneSays: "Tarifs 240 $/270 $ pour 6 cours, 160 $/mois illimité, 50 $ drop-in.",
  },

  // Category 3 — MASSOTHÉRAPIE
  {
    category: 3,
    categoryLabel: "MASSOTHÉRAPIE",
    id: "3-pricing",
    userMessage: "combien coûte un massage de 60 minutes ?",
    forbidPatterns: [
      /\b25\s*minutes?\b[^.!?]{0,40}\b60\s*\$/i, // OLD obsolete grid
      /\b55\s*minutes?\b[^.!?]{0,40}\b80\s*\$/i,
      /\b85\s*minutes?\b[^.!?]{0,40}\b105\s*\$/i,
    ],
    requireAnyPattern: [/120\s*\$/i],
    daphneSays: "Tarifs autoritaires : 30 min 65 $, 60 min 120 $, 90 min 170 $, 120 min 230 $.",
  },
  {
    category: 3,
    categoryLabel: "MASSOTHÉRAPIE",
    id: "3-reservation",
    userMessage: "comment je réserve un massage ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /fliip|fliipapp|clinique|poste\s+234/i,
    ],
    daphneSays: "Réservation via FLiiP (fliipapp.com/user/register/buy_service/1) ou par téléphone.",
  },

  // Category 4 — COURS EN GROUPE
  {
    category: 4,
    categoryLabel: "COURS EN GROUPE",
    id: "4-pdf-link",
    userMessage: "j'aimerais voir l'horaire des cours en groupe",
    forbidPatterns: [],
    requireAnyPattern: [
      /widgets\.mywellness|MAA_CoursEnGroupe|HoraireClassifications/i,
    ],
    daphneSays: "Doit envoyer le PDF horaire cours en groupe (lien complet, pas juste mention).",
  },

  // Category 5 — INSTRUCTEURS / ENTRAÎNEURS
  {
    category: 5,
    categoryLabel: "INSTRUCTEURS",
    id: "5-instructors-list",
    userMessage: "où puis-je voir la liste des instructeurs et leurs spécialités ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /experts\/instructeurs|clubsportifmaa\.com\/fr\/experts/i,
    ],
    daphneSays: "Doit pointer vers https://www.clubsportifmaa.com/fr/experts/instructeurs/ — lien dans links.json.",
  },

  // Category 6 — CIRQUE AÉRIEN
  {
    category: 6,
    categoryLabel: "CIRQUE AÉRIEN",
    id: "6-tariffs",
    userMessage: "combien coûte une session de cirque aérien ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /220\s*\$|330\s*\$|Janika|Hannah|Palestra/i,
    ],
    daphneSays: "Tarifs : 220 $ membres, 330 $ non-membres, 40 $ drop-in. Instructeurs Janika, Hannah.",
  },

  // Category 7 — POWERWATTS
  {
    category: 7,
    categoryLabel: "POWERWATTS",
    id: "7-schedule-pdf",
    userMessage: "quels sont les horaires PowerWatts ?",
    forbidPatterns: [],
    requireAnyPattern: [
      // Override specialty-courses.json::powerwatts has the actual schedule + PDF link
      /Mardi|mardi|Manon|Frank|MAA_PowerWatts|12\s*h\s*00|17\s*h\s*30/i,
    ],
    daphneSays: "Horaires précis du PDF (Mardi 12h-13h Manon, Mardi 17h30-18h30 Frank, etc.) + lien PDF.",
  },

  // Category 8 — BASKETBALL
  {
    category: 8,
    categoryLabel: "BASKETBALL",
    id: "8-no-visit-cta",
    userMessage: "faut-il réserver pour le basketball ?",
    forbidPatterns: [
      /planifier\s+une\s+visite|Cliquez\s+sur\s+le\s+bouton\s+ci-dessous\s+pour\s+planifier/i,
    ],
    requireAnyPattern: [/basket|app|application|membre|Nathalie/i],
    daphneSays: "Pas de bouton 'planifier une visite' sur question basketball.",
  },

  // Category 10 — CLUB DE TRIATHLON
  {
    category: 10,
    categoryLabel: "CLUB DE TRIATHLON",
    id: "10-dates",
    userMessage: "quelles sont les dates de la session du club de triathlon ?",
    forbidPatterns: [
      /\b12\s+janvier\b|\bjanvier\s+(?:au|à)\s+(?:avril|3\s+avril)\b/i, // obsolete dates
    ],
    requireAnyPattern: [
      /7\s+avril|avril\s+(?:au|à)\s+(?:19\s+juin|juin)|spring\s+2026|printemps/i,
    ],
    daphneSays: "Dates correctes : 7 avril au 19 juin 2026 — pas les anciennes dates jan-avril.",
  },
  {
    category: 10,
    categoryLabel: "CLUB DE TRIATHLON",
    id: "10-ftp-vam-inclusion",
    userMessage: "qu'est-ce qui est inclus dans le club de triathlon ?",
    forbidPatterns: [],
    requireAnyPattern: [/FTP|VAM|sessions?\s+de\s+calcul/i],
    daphneSays: "FTP (vélo) + VAM (course) sont inclus — Daphné le rappelle explicitement.",
  },

  // Category 11 — ENTRAÎNEMENT PERSONNEL
  {
    category: 11,
    categoryLabel: "ENTRAÎNEMENT PERSONNEL",
    id: "11-pricing",
    userMessage: "combien coûte une séance d'entraînement personnel ?",
    forbidPatterns: [
      /pas\s+(?:explicitement\s+)?d[ée]taill|tarifs\s+pr[ée]cis\s+(?:doivent|ne\s+sont\s+pas)/i, // vague non-answer
    ],
    requireAnyPattern: [
      /\b90\s*\$|\b510\s*\$|\b1\s*275\s*\$|fliipapp|fliip/i,
    ],
    daphneSays: "Tarifs sur Fliip : 90 $ séance, 510 $ pack 6, 1275 $ pack 15 — il NE doit PAS dire 'tarifs non publiés'.",
  },
  {
    category: 11,
    categoryLabel: "ENTRAÎNEMENT PERSONNEL",
    id: "11-duo",
    userMessage: "y a-t-il des entraînements en duo ?",
    forbidPatterns: [
      /\bne\s+sont\s+pas\s+(?:sp[eé]cifiquement\s+)?mentionn[eé]/i,
    ],
    requireAnyPattern: [
      /duo|140\s*\$|150\s*\$|700\s*\$|fliip/i,
    ],
    daphneSays: "Entraînements en duo SONT disponibles via Fliip : single 140 $, Xpert 150 $, pack 5 700 $.",
  },

  // Category 12 — PICKLEBALL
  {
    category: 12,
    categoryLabel: "PICKLEBALL",
    id: "12-contact",
    userMessage: "qui je dois contacter pour avoir plus d'info sur le pickleball ?",
    forbidPatterns: [
      /clinique\s+sportive[^.!?]*?pickleball|pickleball[^.!?]*?clinique\s+sportive|poste\s+234/i,
    ],
    requireAnyPattern: [/Nathalie\s+Lambert|nlambert|poste\s+231/i],
    daphneSays: "Contact = Nathalie Lambert (poste 231), PAS la clinique sportive (poste 234).",
  },

  // Category 13 — PROGRAMMES AQUATIQUES
  {
    category: 13,
    categoryLabel: "PROGRAMMES AQUATIQUES",
    id: "13-tariffs-pdf",
    userMessage: "quels sont les tarifs des programmes aquatiques ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /MAA_Piscine_Programmme|natation\s+adulte|\b165\s*\$|\b275\s*\$|\b50\s*\$|\b75\s*\$|\b90\s*\$/i,
    ],
    daphneSays: "Tarifs sur le PDF programmation Espace O — 165/275 cours groupe, 50/75/90 privés.",
  },

  // Category 14 — SALLES D'ENTRAÎNEMENT
  {
    category: 14,
    categoryLabel: "SALLES D'ENTRAÎNEMENT",
    id: "14-nonmember-access",
    userMessage: "est-ce qu'une personne non-membre peut utiliser la salle d'entraînement ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /membre|Francis|adh[ée]sion|abonnement|non[- ]membre|visite/i,
    ],
    daphneSays: "Doit donner une réponse claire membre/non-membre — pas juste dire 'inclus dans abonnement'.",
  },

  // Category 16 — THÉRAPIE SPORTIVE
  {
    category: 16,
    categoryLabel: "THÉRAPIE SPORTIVE",
    id: "16-no-invented-hours",
    userMessage: "c'est quoi les horaires pour la thérapie sportive ?",
    forbidPatterns: [
      /(?:du\s+)?lundi\s+(?:au|to)\s+vendredi\s+de\s+9\s*h\s+(?:à|to)\s+19\s*h/i,
    ],
    requireAnyPattern: [
      /th[eé]rapeute|rendez-vous|poste\s+234|clinique\s+sportive|prendre\s+rendez/i,
    ],
    daphneSays: "AUCUN horaire fixe pour thérapie sportive — disponibilités par thérapeute via prise de rdv.",
  },

  // Category 18 — NUTRITION
  {
    category: 18,
    categoryLabel: "NUTRITION",
    id: "18-pricing",
    userMessage: "quels sont les tarifs pour la nutrition ?",
    forbidPatterns: [
      /technogym/i, // Daphné explicit: bot was saying technogym
    ],
    requireAnyPattern: [
      /L[eé]a\s+Daoura|Justine\s+Doyon|Doyon-Blondin|\b85\s*\$|\b130\s*\$|\b140\s*\$/i,
    ],
    daphneSays: "Léa Daoura naturopathe (85/130 $), Justine Doyon-Blondin nutrition (85/140 $). PAS de technogym.",
  },

  // Category 19 — SERVICES MÉDICAUX
  {
    category: 19,
    categoryLabel: "SERVICES MÉDICAUX",
    id: "19-doctors",
    userMessage: "qui sont les médecins disponibles au Club ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /Avedian|Kanevesky|Dr\.\s+|services-medicaux/i,
    ],
    daphneSays: "Doit nommer Dr Avedian (hormonothérapie / endométriose) et Dr Kanevesky (Wellcenter).",
  },
  {
    category: 19,
    categoryLabel: "SERVICES MÉDICAUX",
    id: "19-endometriose",
    userMessage: "j'ai un problème d'endométriose, quel service au club peut m'aider ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /Avedian|hormonoth[eé]rapie|bio[- ]?identique|m[ée]decine\s+fonctionnelle|services\s+m[eé]dicaux/i,
    ],
    daphneSays: "Doit rediriger vers Dr Avedian (hormonothérapie bio-identique) — c'est sur le site.",
  },

  // Category 20 — SOINS INFIRMIERS
  {
    category: 20,
    categoryLabel: "SOINS INFIRMIERS",
    id: "20-itss-pricing",
    userMessage: "combien coûte un dépistage ITSS ?",
    forbidPatterns: [],
    requireAnyPattern: [
      /\b249\s*\$|\b349\s*\$|\b419\s*\$|combo|Gonorrh[ée]e|Chlamydia/i,
    ],
    daphneSays: "Combos ITSS confirmés : 249 / 349 / 419 $ selon le combo.",
  },
  {
    category: 20,
    categoryLabel: "SOINS INFIRMIERS",
    id: "20-iv-no-invented-price",
    userMessage: "quel est le prix pour une perfusion IV ?",
    forbidPatterns: [
      /\b(?:IV|intraveineux|perfusion)\b[^.!?]{0,60}\b\d{2,3}\s*\$/i,
    ],
    requireAnyPattern: [
      /Mobile\s+Mediq|514\s*543[- ]2121|à\s+confirmer|prescription|mmqclientweb/i,
    ],
    daphneSays: "Prix IV NON publiés — il faut router vers Mobile Mediq, PAS inventer un tarif.",
  },

  // Category 21 — SPA
  {
    category: 21,
    categoryLabel: "SPA",
    id: "21-no-invented-hours",
    userMessage: "avez-vous des horaires de spa ?",
    forbidPatterns: [
      /\bspa\b[^.!?]{0,40}\b(?:du\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi)\s*(?:au|to)?\s*(?:vendredi|dimanche)?\s*(?:de\s+)?\d{1,2}\s*h/i,
    ],
    requireAnyPattern: [
      /non\s+publi|pas\s+publi|à\s+valider|r[eé]ception|poste\s+0|confirmer/i,
    ],
    daphneSays: "AUCUN horaire spa publié — il NE doit PAS inventer du lundi-vendredi 9h-19h.",
  },

  // Category 22 — CONTACTS (Boutique)
  {
    category: 22,
    categoryLabel: "CONTACTS - BOUTIQUE",
    id: "22-boutique-valerie",
    userMessage: "qui est en charge de la boutique du club ?",
    forbidPatterns: [],
    requireAnyPattern: [/Val[eé]rie\s+De\s+Vigne/i],
    daphneSays: "Contact boutique = Valérie De Vigne.",
  },

  // Category 23 — RESTAURANT
  {
    category: 23,
    categoryLabel: "RESTAURANT",
    id: "23-group-phone",
    userMessage: "je veux réserver pour un groupe de 12 personnes au restaurant 1881",
    forbidPatterns: [
      /514\s*845.2233\s*(?:,\s*)?poste\s+247/i, // wrong number
    ],
    requireAnyPattern: [/514\s*845.8002/i],
    daphneSays: "Téléphone groupe restaurant = 514-845-8002 (PAS le 514-845-2233 poste 247).",
  },
  {
    category: 23,
    categoryLabel: "RESTAURANT",
    id: "23-online-order",
    userMessage: "je veux commander en ligne au restaurant",
    forbidPatterns: [],
    requireAnyPattern: [/clusterpos|clubsportifmaa\.clusterpos/i],
    daphneSays: "Commande en ligne = ClusterPos URL, pas Libro (Libro c'est réservation table).",
  },

  // Category 24 — CLUBS AFFILIÉS
  {
    category: 24,
    categoryLabel: "CLUBS AFFILIÉS",
    id: "24-nyac",
    userMessage: "je voyage à New York, est-ce qu'il y a un club affilié là-bas ?",
    forbidPatterns: [
      /^[^.]*\bplus\s+de\s+\d+\s+clubs?\b[^.]*\.\s*$/i, // generic only
    ],
    requireAnyPattern: [
      /NYAC|New\s+York\s+Athletic|nyac\.org|212.767/i,
    ],
    daphneSays: "Doit nommer NYAC + adresse + téléphone + email + site web.",
  },

  // ── Cross-cutting cases from the full XLSX transcript (rows 200-284) ─────────
  // These span multiple categories and test angles Daphné's per-category text
  // didn't spell out but that the transcript exposed.

  {
    category: 16,
    categoryLabel: "THÉRAPIE SPORTIVE",
    id: "16b-prices-not-massage",
    userMessage: "quels sont les tarifs pour une séance de thérapie sportive ?",
    forbidPatterns: [
      // xlsx row 215: bot gave MASSAGE prices (60/80/105 or 65/120/170/230) for therapy
      /\b60\s*\$\s*pour\s*25\s*minutes|\b80\s*\$\s*pour\s*55\s*minutes|\b105\s*\$\s*pour\s*85\s*minutes/i,
      /\b25\s*minutes?\b[^.!?]{0,30}\b65\s*\$|\b90\s*minutes?\b[^.!?]{0,30}\b170\s*\$/i,
    ],
    requireAnyPattern: [
      // Authoritative therapy prices: Geyson/Solis 130/115, Angie 140/125
      /\b130\s*\$|\b115\s*\$|\b140\s*\$|\b125\s*\$|Geyson|Solis|Angie\s+West|poste\s+234|prendre\s+rendez/i,
    ],
    daphneSays: "Tarifs thérapie sportive = Geyson/Solis 130/115 $, Angie 140/125 $ — JAMAIS les prix de massage.",
  },
  {
    category: 17,
    categoryLabel: "PHYSIOTHÉRAPIE",
    id: "17-prices-not-massage",
    userMessage: "quels sont les tarifs pour la physiothérapie ?",
    forbidPatterns: [
      /\b60\s*\$\s*pour\s*25\s*minutes|\b80\s*\$\s*pour\s*55\s*minutes|\b105\s*\$\s*pour\s*85\s*minutes/i,
    ],
    requireAnyPattern: [
      // Demirakos 115/95, Duchesne 160/155, or honest "varie selon le praticien" + poste 234
      /\b115\s*\$|\b95\s*\$|\b160\s*\$|\b155\s*\$|Demirakos|Duchesne|varient?\s+selon|poste\s+234/i,
    ],
    daphneSays: "Tarifs physio = Demirakos 115/95 $, Duchesne 160/155 $, ou honnêtement 'varie selon le praticien' + poste 234. Pas de prix massage.",
  },
  {
    category: 18,
    categoryLabel: "NUTRITION",
    id: "18b-no-technogym-eval",
    userMessage: "quels sont les prix pour une évaluation nutritionnelle ?",
    forbidPatterns: [
      /technogym/i, // xlsx row 226: "L'évaluation Technogym est gratuite, valeur 180 $"
      /\b180\s*\$/i,
      /\b60\s*\$\s*pour\s*25\s*minutes/i, // massage prices
    ],
    requireAnyPattern: [
      /\b130\s*\$|\b140\s*\$|\b85\s*\$|L[eé]a\s+Daoura|Justine|Doyon-Blondin|poste\s+234/i,
    ],
    daphneSays: "Évaluation nutritionnelle = Justine Doyon-Blondin 140 $ ou naturopathe 130 $. JAMAIS 'évaluation Technogym 180 $'.",
  },
  {
    category: 20,
    categoryLabel: "SOINS INFIRMIERS",
    id: "20c-itss-not-massage-prices",
    userMessage: "quels sont vos tarifs pour le dépistage ITSS ?",
    forbidPatterns: [
      // xlsx row 235: bot gave massage prices 60/80/105 for ITSS
      /\b60\s*\$\s*pour\s*25\s*minutes|\b80\s*\$\s*pour\s*55\s*minutes|\b105\s*\$\s*pour\s*85\s*minutes/i,
    ],
    requireAnyPattern: [
      /\b249\s*\$|\b349\s*\$|\b419\s*\$|combo/i,
    ],
    daphneSays: "Tarifs ITSS = combos 249/349/419 $. JAMAIS les prix de massage 60/80/105.",
  },
  {
    category: 13,
    categoryLabel: "PROGRAMMES AQUATIQUES",
    id: "13b-reservation-no-visit-cta",
    userMessage: "faut-il réserver ou s'inscrire pour les programmes aquatiques ?",
    forbidPatterns: [
      /planifier\s+une\s+visite|Cliquez\s+sur\s+le\s+bouton\s+ci-dessous\s+pour\s+planifier/i,
    ],
    requireAnyPattern: [
      /Nathalie|MyWellness|widgets\.mywellness|membre|inscription|réserv/i,
    ],
    daphneSays: "xlsx row 202: réservation programmes aquatiques ne doit PAS déclencher le bouton visite.",
  },
  {
    category: 23,
    categoryLabel: "RESTAURANT",
    id: "23b-phone-no-poste-247",
    userMessage: "quel numéro pour réserver une table de groupe au restaurant 1881 ?",
    forbidPatterns: [
      // xlsx row 249/266: "514 845-8002, poste 247" — the 8002 has NO poste
      /514\s*845.8002\s*,?\s*poste\s*247/i,
    ],
    requireAnyPattern: [
      /514\s*845.8002/i,
    ],
    daphneSays: "Groupe restaurant = 514-845-8002 (SANS poste). Le poste 247 appartient au 514-845-2233, pas au 8002.",
  },

  // ── EN parity probes — every critical fix must hold in English ──────────────
  {
    category: 3,
    categoryLabel: "MASSAGE (EN)",
    id: "EN-massage-pricing",
    locale: "en-CA",
    userMessage: "how much is a 60-minute massage?",
    forbidPatterns: [
      /\b25\s*min[^.!?]{0,20}\$?\s*60|\b55\s*min[^.!?]{0,20}\$?\s*80|\b85\s*min[^.!?]{0,20}\$?\s*105/i,
    ],
    requireAnyPattern: [/\$?\s*120/i],
    daphneSays: "EN parity: 60-min massage = $120 (new grid), never the old 25/55/85 min grid.",
  },
  {
    category: 16,
    categoryLabel: "SPORTS THERAPY (EN)",
    id: "EN-therapy-no-invented-hours",
    locale: "en-CA",
    userMessage: "what are the hours for sports therapy?",
    forbidPatterns: [
      /monday\s*(?:to|through|-)\s*friday\s*(?:from\s*)?\d{1,2}\s*(?:am|pm|:)/i,
      /\b9\s*(?:am|h)?\s*(?:to|-)\s*(?:7|19)\b/i,
    ],
    requireAnyPattern: [
      /therapist|by\s+appointment|book|ext\.?\s*234|clinic/i,
    ],
    daphneSays: "EN parity: never invent fixed weekly hours for sports therapy.",
  },
  {
    category: 21,
    categoryLabel: "SPA (EN)",
    id: "EN-spa-no-invented-hours",
    locale: "en-CA",
    userMessage: "what are the spa hours?",
    forbidPatterns: [
      /\bspa\b[^.!?]{0,40}\bmonday\s*(?:to|through|-)\s*friday\s*(?:from\s*)?\d{1,2}/i,
    ],
    requireAnyPattern: [
      /not\s+published|reception|ext\.?\s*0|confirm/i,
    ],
    daphneSays: "EN parity: spa hours are not published, route to reception.",
  },
  {
    category: 23,
    categoryLabel: "RESTAURANT GROUP (EN)",
    id: "EN-restaurant-group-no-visit",
    locale: "en-CA",
    userMessage: "I'd like to book a table for a group of 12 at restaurant 1881",
    forbidPatterns: [
      /schedule\s+a\s+visit|click\s+the\s+button\s+below\s+to\s+schedule/i,
    ],
    requireAnyPattern: [/514\s*845.8002|libro|group|phone/i],
    daphneSays: "EN parity: restaurant group reservation must NOT fire the club-visit template.",
  },
  {
    category: 19,
    categoryLabel: "DOCTORS (EN)",
    id: "EN-doctors-named",
    locale: "en-CA",
    userMessage: "who are the doctors available at the club?",
    forbidPatterns: [],
    requireAnyPattern: [
      /Avedian|Kanevesky|services-medicaux/i,
    ],
    daphneSays: "EN parity: name Dr Avedian + Dr Kanevesky.",
  },
  {
    category: 12,
    categoryLabel: "PICKLEBALL (EN)",
    id: "EN-pickleball-contact",
    locale: "en-CA",
    userMessage: "who should I contact for pickleball info?",
    forbidPatterns: [
      /sports\s+clinic|ext\.?\s*234/i,
    ],
    requireAnyPattern: [/Nathalie\s+Lambert|nlambert|ext\.?\s*231/i],
    daphneSays: "EN parity: pickleball contact = Nathalie Lambert, not the clinic.",
  },
  {
    category: 8,
    categoryLabel: "BASKETBALL (EN)",
    id: "EN-basketball-no-visit",
    locale: "en-CA",
    userMessage: "do I need to reserve for basketball?",
    forbidPatterns: [
      /schedule\s+a\s+visit|click\s+the\s+button\s+below\s+to\s+schedule/i,
    ],
    requireAnyPattern: [/basket|app|member|Nathalie/i],
    daphneSays: "EN parity: basketball reservation question must NOT fire the visit template.",
  },
  {
    category: 24,
    categoryLabel: "AFFILIATED CLUBS (EN)",
    id: "EN-nyac",
    locale: "en-CA",
    userMessage: "I'm traveling to New York, is there an affiliated club there?",
    forbidPatterns: [
      /^[^.]*\bmore\s+than\s+\d+\s+clubs?\b[^.]*\.\s*$/i,
    ],
    requireAnyPattern: [/NYAC|New\s+York\s+Athletic|nyac\.org/i],
    daphneSays: "EN parity: name NYAC with contact details.",
  },
];

const PROD_URL = "https://api.dubub.com";
const LOCAL_URL = "http://localhost:3001";

async function probe(p: Probe, baseUrl: string): Promise<{ reply: string; followUpMode: string; suppressBookingCta: boolean }> {
  const body = {
    message: p.userMessage,
    locale: p.locale ?? "fr-CA",
    conversationId: `daphne-review-replay-${p.id}-${Date.now()}`,
    conversationHistory: p.history ?? [],
  };
  const res = await fetch(`${baseUrl}/v1/tenants/maa/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { assistantMessage?: string; reply?: string; followUpMode?: string; suppressBookingCta?: boolean };
  return {
    reply: data.assistantMessage ?? data.reply ?? "",
    followUpMode: data.followUpMode ?? "",
    suppressBookingCta: data.suppressBookingCta ?? false,
  };
}

interface ProbeResult {
  probe: Probe;
  reply: string;
  followUpMode: string;
  suppressBookingCta: boolean;
  status: "PASS" | "FAIL" | "WARN";
  reasons: string[];
}

function evaluate(p: Probe, reply: string, followUpMode: string, suppressBookingCta: boolean): { status: "PASS" | "FAIL" | "WARN"; reasons: string[] } {
  const reasons: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  for (const re of p.forbidPatterns) {
    if (re.test(reply)) {
      status = "FAIL";
      reasons.push(`forbidden pattern matched: ${re.source}`);
    }
  }

  if (p.requireAnyPattern && p.requireAnyPattern.length > 0) {
    const anyMatch = p.requireAnyPattern.some((re) => re.test(reply));
    if (!anyMatch) {
      if (status === "PASS") status = "WARN";
      reasons.push(`none of requireAnyPattern matched: ${p.requireAnyPattern.map((r) => r.source).join(" | ")}`);
    }
  }

  return { status, reasons };
}

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args.includes("--local") ? LOCAL_URL : PROD_URL;
  const categoryFilter = args.includes("--category")
    ? Number(args[args.indexOf("--category") + 1])
    : null;

  const filtered = categoryFilter
    ? PROBES.filter((p) => p.category === categoryFilter)
    : PROBES;

  console.log(`\nDaphné review replay → ${baseUrl}`);
  console.log(`Running ${filtered.length} probe(s)${categoryFilter ? ` (category ${categoryFilter})` : ""}\n`);

  const results: ProbeResult[] = [];
  for (const p of filtered) {
    process.stdout.write(`  [cat ${String(p.category).padStart(2, " ")}] ${p.id.padEnd(28, " ")}`);
    try {
      const { reply, followUpMode, suppressBookingCta } = await probe(p, baseUrl);
      const { status, reasons } = evaluate(p, reply, followUpMode, suppressBookingCta);
      results.push({ probe: p, reply, followUpMode, suppressBookingCta, status, reasons });
      const stIcon = status === "PASS" ? "✅" : status === "WARN" ? "🟡" : "🔴";
      console.log(`${stIcon} ${status}`);
      if (status !== "PASS") {
        for (const r of reasons) console.log(`        ${r}`);
        console.log(`        reply (first 240): ${reply.slice(0, 240).replace(/\n/g, " ")}…`);
      }
    } catch (err) {
      console.log(`💥 ERROR: ${err instanceof Error ? err.message : err}`);
      results.push({ probe: p, reply: "", followUpMode: "", suppressBookingCta: false, status: "FAIL", reasons: [`HTTP error: ${err instanceof Error ? err.message : err}`] });
    }
    // Throttle to avoid rate-limiting prod + give slow LLM responses room
    await new Promise((r) => setTimeout(r, 1500));
  }

  // ── Digest ──
  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n📊 ${pass} PASS / ${warn} WARN / ${fail} FAIL\n`);

  if (fail > 0 || warn > 0) {
    console.log("Failures and warnings by category:");
    const byCategory = new Map<number, ProbeResult[]>();
    for (const r of results) {
      if (r.status === "PASS") continue;
      if (!byCategory.has(r.probe.category)) byCategory.set(r.probe.category, []);
      byCategory.get(r.probe.category)!.push(r);
    }
    for (const [cat, items] of Array.from(byCategory).sort((a, b) => a[0] - b[0])) {
      console.log(`\n  Category ${cat} — ${items[0]!.probe.categoryLabel}:`);
      for (const r of items) {
        const icon = r.status === "FAIL" ? "🔴" : "🟡";
        console.log(`    ${icon} ${r.probe.id} — Daphné: ${r.probe.daphneSays}`);
        for (const reason of r.reasons) {
          console.log(`      ${reason}`);
        }
      }
    }
  }

  // ── Write digest markdown ──
  await fs.mkdir(ALERTS_DIR, { recursive: true });
  const runDate = new Date();
  const outPath = path.join(ALERTS_DIR, `daphne-review-replay-${runDate.toISOString().replace(/[:.]/g, "-")}.md`);
  const md: string[] = [];
  md.push(`# Daphné review replay — ${runDate.toISOString()}`);
  md.push("");
  md.push(`Source: ${baseUrl}`);
  md.push(`Result: **${pass} PASS / ${warn} WARN / ${fail} FAIL** (out of ${results.length})`);
  md.push("");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "WARN" ? "🟡" : "🔴";
    md.push(`## ${icon} cat ${r.probe.category} — ${r.probe.id}`);
    md.push(`**Daphné said**: ${r.probe.daphneSays}`);
    md.push(`**User asked**: \`${r.probe.userMessage}\``);
    md.push(`**Status**: ${r.status}`);
    if (r.reasons.length) {
      md.push(`**Issues**:`);
      for (const reason of r.reasons) md.push(`  - ${reason}`);
    }
    md.push(`**Reply**:`);
    md.push("> " + (r.reply.replace(/\n/g, "\n> ") || "(empty)"));
    md.push("");
  }
  await fs.writeFile(outPath, md.join("\n"), "utf8");
  console.log(`\nDigest written: ${outPath}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
