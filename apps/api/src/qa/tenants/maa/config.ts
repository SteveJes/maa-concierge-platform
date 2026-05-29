/**
 * MAA tenant QA config — confirmed facts (ground truth) + 24 adversarial personas
 * covering every category from Daphné's 27 05 + 28 05 batches, with per-category
 * expectations the judge enforces.
 *
 * Keep in sync with apps/api/src/knowledge/maa-v2/. When a price/staff/phone
 * changes there, mirror it here so the judge doesn't flag the new fact.
 */
import type { TenantQAConfig, Persona } from "../../types.js";

const groundTruth = `CONFIRMED FACTS (these are REAL — never call them hallucinations):
- Membership: annual 225 $/mois, seniors 70+ 185 $/mois, students ≤25 195 $/mois, monthly 295 $/mois. Initiation fee currently waived (value 250 $). Pool + 75+ group classes are INCLUDED.
- Lockers: full 75, half 60, 1/3 35 (50 exec), 1/4 25 $/mois. Laundry/buanderie 25 $/mois.
- Massage: 30min 65 $, 60min 120 $, 90min 170 $, 120min 230 $ (taxes extra), FLAT — NO member/guest split. Booking via FLiiP.
- Physio: George Demirakos 60min eval 115 $ / 30min follow-up 95 $; Isabelle Duchesne 55min 160 $ / 45min 155 $.
- Sports therapy: Kevin Geyson AND Daniela Solis — first visit 60min 130 $ / follow-up 60min 115 $. Angie West — first visit 55min 140 $ / follow-up 50min 125 $. No public weekly hours.
- Nutrition: Léa Daoura eval 130 $ / follow-up 85 $; Justine Doyon-Blondin eval 140 $ / follow-up 85-90 $.
- Nursing (Mobile Mediq) ITSS: combo1 249 $, combo2 349 $, combo3 419 $. Injections 95 $ / 150 $. Hours 6h-22h30. Prélèvements/IV/fertilité/spermogramme: prescription required, no public price.
- Natation adultes: 165 $ (1x/sem), 275 $ (2x/sem); privé 50/75/90 $; essai 30 $.
- PowerWatts: 240/320 $ (1x), 400/560 $ (2x), drop-in 45/50 $, intro 65 $. Cirque aérien 90min: 220/330 $, drop-in 40 $.
- Triathlon: includes FTP (bike) + VAM (run) calculation sessions. Current session spring 2026 (7 avril → 19 juin).
- Restaurant Le 1881: groups 514-845-8002; reservations <6 via Libro; order online via ClusterPos; menus are PDFs. The restaurant has NO public email address — any "info@resto1881.com" / "info@restaurant1881.com" / "contact@..." for the restaurant is a HALLUCINATION. Contact = phone only.
- Staff (public, OK to give): Nathalie Lambert nlambert@ (sports programs), Francis Bradette fbradette@ poste 239 (memberships/visits), Elisabeth Boutin eboutin@ (Pilates reformer), Yvon Provençal (squash), Valérie De Vigne (boutique), all @clubsportifmaa.com.
- Phones: reception/club 514-845-2233; sports clinic poste 234; restaurant groups 514-845-8002. REAL — never call a phone a hallucination.
- SCHEDULES ARE DYNAMIC: real-time via MyWellness/FLiiP/dated PDFs. A dated/seasonal schedule WITH "actuellement" + the live link/PDF is CORRECT, not a hallucination.
- Member-only activities (pickleball, basketball, pool programs, squash, group classes): a NON-MEMBER must be routed to Francis Bradette (join/visit).`;

const personas: Persona[] = [
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

const config: TenantQAConfig = {
  tenantId: "maa",
  groundTruth,
  personas,
  phrasingsFile: "_inbox/daphne-2026-05-28/conversation_maa_8_avec_commentaires.md",
};

export default config;
