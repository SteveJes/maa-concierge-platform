# MAA Chatbot — Fifth Pass Fixes

## Purpose

This document summarizes the fifth round of MAA chatbot testing.

Overall, the chatbot has improved significantly on several sensitive and previously broken areas. However, the biggest remaining issue is still **knowledge base alignment + direct routing for specific services**, especially:

* Buanderie / laundry service
* Pickleball
* Spa access for non-members
* Follow-up conversation handling
* Medical/clinic guidance without overclaiming
* Chat/phone consistency
* Menu link handling

---

# High-Level Summary

## Phone Testing

Phone testing was not completed in this round.

### Phone status

```text
PAS EU LE TEMPS
```

Previous phone issues should still remain on the watchlist:

* User interruption / barge-in handling
* Chat vs phone consistency
* Menu handling
* Trial pass / guest access consistency
* Student pricing consistency

---

# Chat Testing Summary

## What improved

### 1. English interim response

Good behavior observed:

When the user writes in English and the assistant is processing, the interface now says:

```text
one moment
```

instead of:

```text
un instant
```

This is good localization behavior.

### 2. Health / knee pain routing improved

User asked about knee pain and whether they should see:

* Physiotherapy
* Sports therapy
* Trainer

The chatbot gave a generally useful answer. However, it repeated the same answer twice after the user replied “oui,” which indicates poor follow-up handling.

### 3. Prompt-injection and sensitive flow quality remains improved

No regression noted in this review for internal-info refusal, payment issue handling, and several sensitive flows.

---

# Main Remaining Issue

## Database / source alignment still has major errors

The chatbot still says that Club Sportif MAA does not have:

* Buanderie / laundry service
* Pickleball

But the testing notes state that both **exist in the Club Sportif MAA sources**.

Therefore, these should not fall back to:

```text
Je ne vois pas d'information précise...
```

if the source data actually includes them.

---

# Priority Correction — Buanderie and Pickleball

## 1. BUANDERIE

### Trigger phrases

If the user asks any of the following:

```text
buanderie
buandrie
lavage
faire mon lavage
service de lavage
service de linge
laver mes vêtements
lavage au club
laundry
```

Route to:

```text
service_buanderie
```

### Expected response

The chatbot should say that Club Sportif MAA offers a laundry service **if this information is present in the sources**.

It should:

* Explain the service briefly according to the source.
* Mention known conditions if available.
* If price or exact conditions are not confirmed in the active source, say to validate with the team.
* Avoid making it sound like a public laundromat open to everyone.

### Never say

```text
Je ne vois pas d'information précise concernant un service de buanderie dans mes sources actuelles.
```

if buanderie is present in the official source data.

### Special case: public laundromat confusion

If the user asks:

```text
je peux venir faire mon lavage ?
```

Expected behavior:

* Clarify that this is a Club/member-related service.
* Do not imply anyone can walk in like a public laundromat.
* Say access and exact conditions must be validated with the team.

---

## 2. PICKLEBALL

### Trigger phrases

If the user asks any of the following:

```text
pickleball
pickball
pickle ball
pickelball
terrain de pickleball
réserver pickleball
jouer au pickleball
```

Route to:

```text
installation_pickleball
```

### Expected response

The chatbot should say that Club Sportif MAA offers pickleball / a pickleball court / a pickleball activity **if this information is present in the sources**.

It should then clarify that the following must be confirmed with the team:

* Availability
* Schedule
* Member vs non-member access
* Reservation rules

### Never say

```text
Je ne vois pas d'information précise concernant un terrain de pickleball dans mes sources actuelles.
```

if pickleball is present in the official source data.

---

## 3. General source-priority rule

If information exists in official sources, it must be prioritized over the fallback.

The fallback should only activate if:

* No source mentions the service.
* Semantic search returns no reliable result.
* The exact conditions are not available.

### Better uncertainty response

Use:

```text
Ce service semble bien mentionné dans les informations du Club, mais les conditions exactes doivent être confirmées avec l’équipe.
```

instead of:

```text
Je ne vois pas d’information dans mes sources.
```

when the service is known to exist but details are unclear.

---

# Test Cases and Required Behavior

## #1 — Spa with mother, no membership

### Question

Je veux aller au spa avec ma mère, mais sans abonnement. Est-ce que c’est possible ou c’est réservé aux membres ?

### Réponse du concierge

L'adhésion comprend l'accès à la piscine. Les tarifs et promotions peuvent changer. Nous vous recommandons d'appeler pour confirmer les prix actuels.

### Note

0/10

### Recommandation d’instruction à ajouter

Si l’utilisateur demande spa, massothérapie, accès invité, accès non-membre ou “sans abonnement”, ne jamais répondre avec la piscine, les tarifs d’abonnement ou une phrase générique d’adhésion. Répondre uniquement sur l’accès au service demandé. Si l’accès non-membre n’est pas confirmé, dire qu’il faut valider avec l’équipe.

### Expected behavior

* Detect spa / non-member access intent.
* Do not answer with pool access.
* Do not answer with generic membership pricing.
* Answer only about spa/massotherapy/non-member access.
* If non-member spa access is not confirmed, say it must be validated with the team.

---

## #2 — Pickleball typo: pickball

### Question

Avez vous un terrain de pickball

### Réponse du concierge

FAUX.

Daphné, je ne vois pas d'information précise concernant un terrain de pickleball dans mes sources actuelles. Je vous recommande de valider cette information directement avec l'équipe au 514 845-2233, poste 234.

### Note

0/10

### Recommandation d’instruction à ajouter

Ajouter les variantes orthographiques : “pickball”, “pickleball”, “pickle ball”, “pickelball”. Si le pickleball existe dans les sources, router vers l’intention installation sportive/pickleball au lieu de répondre “non trouvé”.

### Expected behavior

* Detect typo `pickball` as pickleball.
* Route to `installation_pickleball`.
* Say pickleball exists if present in sources.
* Clarify that availability, access, and reservation details must be confirmed.

---

## #3 — Pickleball reservation for non-member

### Question

Pour le pickleball, est-ce que je peux réserver si je ne suis pas membre ?

### Réponse du concierge

FAUX.

Daphné, je ne vois pas d'information précise concernant la réservation de terrains de pickleball pour les non-membres dans mes sources actuelles. Je vous recommande de valider cette possibilité directement avec l'équipe au 514 845-2233, poste 234.

### Note

0/10

### Recommandation d’instruction à ajouter

Ajouter les variantes orthographiques : “pickball”, “pickleball”, “pickle ball”, “pickelball”. Si le pickleball existe dans les sources, router vers l’intention installation sportive/pickleball au lieu de répondre “non trouvé”.

### Expected behavior

* Detect pickleball intent.
* Do not say pickleball info is missing if pickleball exists in sources.
* Answer that pickleball exists if sourced.
* For non-member reservation, say access/reservation rules must be confirmed with the team unless explicitly known.

---

## #4 — Pickleball weekly availability

### Question

Le pickleball a combien de disponibilités par semaine environ ?

### Réponse du concierge

FAUX.

Daphné, je ne vois pas d'information précise sur le nombre de disponibilités hebdomadaires pour le pickleball dans mes sources actuelles. Je vous recommande de valider directement avec l'équipe au 514 845-2233, poste 234 pour obtenir les détails exacts.

### Note

0/10

### Recommandation d’instruction à ajouter

Ajouter les variantes orthographiques : “pickball”, “pickleball”, “pickle ball”, “pickelball”. Si le pickleball existe dans les sources, router vers l’intention installation sportive/pickleball au lieu de répondre “non trouvé”.

### Expected behavior

* Detect pickleball intent.
* Confirm existence if sourced.
* If weekly availability count is not in sources, say that only the exact availability count must be confirmed.
* Do not imply pickleball itself is not found.

---

## #5 — Laundry service typo: buandrie

### Question

avez vous un service de buandrie?

### Réponse du concierge

FAUX.

Daphné, je ne vois pas d'information précise concernant un service de buanderie dans mes sources actuelles. Je vous recommande de valider cette information directement avec l'équipe au 514 845-2233, poste 234.

### Note

0/10

### Recommandation d’instruction à ajouter

Bonne prudence. Si le site contient une mention de buanderie, améliorer l’indexation. Ne jamais affirmer qu’un service n’existe pas si l’information n’est pas trouvée.

### Expected behavior

* Detect typo `buandrie` as buanderie.
* Route to `service_buanderie`.
* Confirm the service exists if present in source.
* Explain known conditions cautiously.
* Do not say current sources have no laundry information if the service is indexed.

---

## #6 — Gym access without booking a time slot

### Question

Est-ce que les salles d’entraînement sont accessibles sans réservation ou je dois booker un créneau ?

### Réponse du concierge

Avec plaisir. Cliquez sur le bouton ci-dessous pour planifier votre visite. Vous préférez qu'on vous contacte ? Je peux aussi prendre vos coordonnées ici.

### Note

1/10

### Recommandation d’instruction à ajouter

Si l’utilisateur demande accès au gym, salles d’entraînement, réservation de créneau, accès libre ou besoin de booker, ne jamais déclencher “Planifier une visite”. Répondre aux modalités d’accès; si elles ne sont pas dans les sources, dire qu’il faut confirmer avec l’équipe.

### Expected behavior

* Detect gym access / booking slot intent.
* Do not trigger visit CTA.
* Answer access/reservation modality if known.
* If unknown, say modalities must be confirmed with the team.

---

## #7 — Membership downgrade / cheaper plan

### Question

Je peux changer mon abonnement actuel pour un abonnement plus bas ?

### Réponse du concierge

Bien sûr. Utilisez le bouton ci-dessous pour continuer par téléphone. Je peux aussi vous rappeler si vous préférez.

### Note

2/10

### Recommandation d’instruction à ajouter

Si l’utilisateur demande de changer, baisser, modifier, réduire ou passer à un forfait moins cher, traiter comme une demande administrative sensible. Répondre que l’équipe doit valider selon le dossier et que le concierge ne peut pas confirmer un changement de forfait ici.

### Expected behavior

* Detect membership modification/downgrade intent.
* Do not say “Bien sûr” as if it is possible.
* Do not just show phone/callback button.
* Explain the team must validate based on the account and contract.

---

## #8 — User says “oui” after clinical routing

### Question

oui

### Réponse du concierge

Daphné, la physiothérapie est idéale pour évaluer une douleur au genou, car nos physiothérapeutes sont spécialisés dans ce type de traitement. La thérapie sportive peut aussi convenir si la douleur est liée à une blessure sportive, tandis qu'un entraîneur personnel se concentre davantage sur l'entraînement et la prévention. Je peux transmettre votre demande pour un rendez-vous, mais la confirmation finale viendra de l'équipe du club.

### Note

4/10

### Recommandation d’instruction à ajouter

Si l’utilisateur répond seulement “oui” après une proposition de transmission ou de rendez-vous, ne pas répéter l’explication. Passer à l’étape suivante. Pour les douleurs/blessures, ne jamais dire qu’une option est “idéale”; dire plutôt qu’elle peut être un bon point de départ à confirmer avec l’équipe clinique.

### Expected behavior

* Preserve previous context.
* Interpret “oui” as acceptance of the next step.
* Do not repeat the same explanation.
* Ask for needed info or explain next step.
* Avoid saying a clinical option is “ideal.”

---

## #9 — User says “oui” again after clinical routing

### Question

oui

### Réponse du concierge

Daphné, pour une douleur au genou, la physiothérapie est généralement recommandée car nos physiothérapeutes sont spécialisés dans ce type de traitement. La thérapie sportive peut aussi être appropriée si la douleur est liée à une blessure sportive, tandis qu'un entraîneur personnel se concentre davantage sur l'entraînement et la prévention. Je peux transmettre votre demande pour un rendez-vous, mais la confirmation finale viendra de l'équipe du club.

### Note

5/10

### Recommandation d’instruction à ajouter

Si l’utilisateur répond “oui”, interpréter comme une acceptation de la prochaine étape. Ne pas répéter le même contenu. Demander les informations nécessaires pour transmettre la demande ou expliquer clairement l’étape suivante.

### Expected behavior

* Do not repeat previous clinical explanation.
* Move the conversation forward.
* Ask for required handoff/request details, if applicable.
* State that final confirmation comes from the team.

---

## #10 — English prices + booking unit translation issue

### Question

What are your prices and can I book in English?

### Réponse du concierge

Daphné, membership pricing at Club Sportif MAA starts around $225 per month for an annual plan, with no initiation fee currently. There are also special rates for seniors (70+) at $185 per year and students (25 and under) at $195 per year. For the most accurate and up-to-date pricing, I recommend confirming with the team at (514) 845-2233, ext. 234. Regarding booking, yes, you can book services in English. I can help guide you through the process, but final confirmation and scheduling come directly from the team or the official booking system.Prochaine étape ? → Planifier une visite

### Note

6/10

### Recommandation d’instruction à ajouter

Ne jamais changer les unités de prix en traduction. Si la source dit 185 $/mois et 195 $/mois, traduire par “per month”, jamais “per year”. Répondre en anglais au complet, incluant le CTA s’il y en a un.

### Expected behavior

* Reply fully in English.
* Preserve pricing units exactly.
* If source says per month, translate as per month.
* Do not mix French CTA into English response.
* Answer both price and booking parts.
* Avoid visit CTA unless appropriate.

---

## #11 — Knee pain: physio, sports therapy, or trainer

### Question

Si je veux une douleur au genou évaluée, c’est physiothérapie, thérapie sportive ou entraîneur ?

### Réponse du concierge

Daphné, pour une douleur au genou, la physiothérapie est généralement recommandée, car nos physiothérapeutes sont spécialisés dans le traitement des douleurs musculo-squelettiques, y compris celles au genou. La thérapie sportive est aussi une option, surtout si la douleur est liée à une blessure sportive. Un entraîneur personnel, quant à lui, se concentre davantage sur l'entraînement et la prévention. Je peux transmettre votre demande de rendez-vous, mais la confirmation finale viendra de l'équipe du club.

### Note

7/10

### Recommandation d’instruction à ajouter

Pour douleur, blessure, genou, physio, thérapie sportive ou symptômes, ne pas poser de diagnostic ni recommander fermement une option. Orienter prudemment : “La physiothérapie peut être un bon point de départ, mais l’équipe clinique pourra confirmer le bon service.”

### Expected behavior

* Treat as health/clinical triage-adjacent question.
* Do not diagnose.
* Do not strongly recommend one option as definitive.
* Use cautious language.
* Say clinical team can confirm the appropriate service.

---

## #12 — Repeated knee pain question

### Question

Si je veux une douleur au genou évaluée, c’est physiothérapie, thérapie sportive ou entraîneur ?

### Réponse du concierge

Daphné, pour une douleur au genou, la physiothérapie est généralement recommandée, car nos physiothérapeutes sont spécialisés dans le traitement des douleurs musculo-squelettiques, y compris celles au genou. La thérapie sportive peut aussi être appropriée, surtout si la douleur est liée à une blessure sportive, tandis qu'un entraîneur personnel se concentrera davantage sur l'entraînement et la prévention. Je peux transmettre votre demande pour un rendez-vous avec un physiothérapeute ou un thérapeute du sport, mais la confirmation finale viendra de l'équipe du club.

### Note

7/10

### Recommandation d’instruction à ajouter

Même règle : éviter “généralement recommandée” si ça sonne comme une évaluation clinique. Dire plutôt : “Pour une douleur au genou, l’équipe clinique pourra vous orienter; la physiothérapie ou la thérapie sportive peuvent être pertinentes selon la situation.”

### Expected behavior

* Avoid “generally recommended” if it sounds like clinical advice.
* Use safe orientation language.
* Emphasize clinical team confirmation.

---

## #13 — Yoga included or à la carte

### Question

Le yoga est inclus dans l’abonnement ou je peux payer juste un cours à la carte ?

### Réponse du concierge

Daphné, le yoga fait partie de la vaste programmation de cours en groupe incluse dans l'abonnement tout-inclus du Club Sportif MAA, qui offre la plupart des cours, y compris le yoga, pour ceux qui préfèrent la simplicité d'un accès complet. Il est aussi possible de participer à un ou quelques cours à la carte sans être membre, mais des frais supplémentaires s'appliquent. Pour les détails précis sur les tarifs à la carte, je vous recommande de valider avec l'équipe au 514 845-2233, poste 234.

### Note

7/10

### Recommandation d’instruction à ajouter

Ne pas affirmer qu’un cours à la carte est possible sans être membre si ce n’est pas explicitement confirmé dans les sources. Dire : “L’abonnement semble inclure le yoga; pour l’option à la carte ou non-membre, je recommande de confirmer avec l’équipe.”

### Expected behavior

* Answer yoga inclusion if confirmed.
* Do not claim à la carte/non-member access unless confirmed.
* Recommend confirming à la carte/non-member options with the team.

---

## #14 — Restaurant weekly menu links

### Question

pis est-ce que je peux savoir vos menus cette semaine pour le resto

### Réponse du concierge

Daphné, vous pouvez consulter les menus officiels du restaurant Le 1881 pour la semaine via ces liens : - Menu principal◆Petit-déjeuner◆Carte des vins Le menu peut varier chaque semaine, donc il est toujours bon de confirmer directement avec le restaurant au (514) 845-8002.

### Note

7/10

### Recommandation d’instruction à ajouter

Si le concierge dit “via ces liens”, il doit afficher des liens réels/cliquables. Sinon, ne pas dire “via ces liens”. Répondre plutôt : “Les menus sont disponibles sur le site du restaurant Le 1881; pour confirmer cette semaine, appelez le 514 845-8002.”

### Expected behavior

* If saying “via these links,” provide actual clickable links.
* If links are unavailable in the response channel, do not claim links are shown.
* Provide restaurant phone number for weekly confirmation.
* Keep link placement clean.

---

## #15 — Class unlimited / booking distinction

### Question

Est-ce que les cours sont illimités ou faut-il réserver chaque séance ?

### Réponse du concierge

Daphné, les règles de réservation pour les cours peuvent varier selon le type de cours. Par exemple, pour les cours de Pilates sur appareils, il y a un forfait mensuel illimité, mais vous êtes responsable de vous retirer si vous ne pouvez pas vous présenter. Pour les autres cours de groupe, il est préférable de confirmer les modalités précises de réservation avec l'équipe au 514 845-2233, poste 234.

### Note

8/10

### Recommandation d’instruction à ajouter

Bonne réponse, mais ajouter une distinction systématique entre cours de groupe réguliers, Pilates sur appareils, cours spécialisés et services payants. Ne pas utiliser l’exemple du Pilates pour laisser croire que tous les cours sont illimités.

### Expected behavior

* Keep improved behavior.
* Distinguish between course categories:

  * Regular group classes
  * Pilates apparatus
  * Specialized courses
  * Paid services
* Do not imply all classes are unlimited because one category has an unlimited option.

---

## #16 — Spa/sauna/steam/hot tub included

### Question

Est-ce que l’abonnement donne accès aux installations de spa comme sauna, vapeur ou bain à remous ?

### Réponse du concierge

Daphné, l'accès aux installations de spa telles que le sauna, le bain vapeur et le bain à remous est inclus dans l'abonnement au Club Sportif MAA, avec des conditions qui peuvent varier. Ces installations se trouvent directement dans les vestiaires, et l'accès au spa est également inclus avec les services de massothérapie. Pour tous les détails précis, je vous recommande de confirmer avec l'équipe au 514 845-2233, poste 234.

### Note

8/10

### Recommandation d’instruction à ajouter

Distinguer “installations détente incluses” et “services spa/massothérapie payants ou sur rendez-vous”. Éviter de dire “l’accès au spa” si ça peut confondre les installations avec les soins.

### Expected behavior

* Distinguish amenities from paid spa/massotherapy services.
* Use clearer wording:

  * “installations détente” for sauna/steam/hot tub
  * “soins spa/massothérapie” for services/treatments
* Confirm conditions with team.

---

## #17 — Weight loss: trainer or nutritionist

### Question

Je veux perdre du poids : est-ce que je dois parler à un entraîneur personnel ou à la nutritionniste ?

### Réponse du concierge

Daphné, pour une démarche de perte de poids, vous pouvez consulter notre nutritionniste qui vous aidera à faire des choix alimentaires judicieux et à équilibrer votre assiette, ou bien travailler avec un entraîneur personnel pour un programme d'exercices adapté. Je peux transmettre votre demande de rendez-vous, mais la confirmation finale viendra de l'équipe du club. Pour prendre rendez-vous, vous pouvez aussi appeler au 514 845-2233, poste 234.

### Note

8/10

### Recommandation d’instruction à ajouter

Sujet santé sensible : ne pas donner de conseil personnalisé. Répondre en orientation générale : nutritionniste pour l’alimentation, entraîneur pour l’activité physique, équipe du club pour confirmer le bon parcours.

### Expected behavior

* Treat as health/wellness sensitive topic.
* Give general orientation only.
* Nutritionist: food/nutrition questions.
* Trainer: physical activity/exercise programming.
* Team confirms appropriate pathway.

---

## #18 — Fitness program / weight loss process

### Question

je veux perdre du poids et avoir un progrsamme de remise en forme. comment ca marche ?

### Réponse du concierge

Daphné, pour un programme de remise en forme complet incluant entraînement, nutrition et suivi, le Club Sportif MAA propose des services personnalisés via son équipe de la Clinique Sportive. Je vous recommande de contacter directement l'équipe au 514 845-2233, poste 234 pour connaître les modalités précises et organiser un suivi adapté à vos objectifs.

### Note

8/10

### Recommandation d’instruction à ajouter

Bonne amélioration. Ajouter 1-2 questions de clarification avant de référer : objectif, niveau actuel, préférence entraînement/nutrition, disponibilité.

### Expected behavior

* Ask 1–2 clarification questions before referral.
* Avoid personalized health plan.
* Offer team/clinic confirmation.

---

## #19 — Technogym evaluation included

### Question

Est-ce que l’évaluation Technogym est incluse avec l’abonnement ?

### Réponse du concierge

Daphné, l'évaluation complète avec le Checkup Technogym est incluse dans l'abonnement, mais les conditions précises peuvent varier. Je vous recommande de confirmer directement avec l'équipe au 514 845-2233, poste 234 pour tous les détails.

### Note

9/10

### Recommandation d’instruction à ajouter

Bonne correction. Garder cette règle : si Technogym est demandé, répondre directement à Technogym sans afficher la grille tarifaire.

### Expected behavior

* Keep this behavior.
* Answer Technogym directly.
* Do not output pricing grid.
* Mention conditions may vary.

---

## #20 — Technogym included reformulation

### Question

je veux savoir si technogym est inclus avec labonnement

### Réponse du concierge

Daphné, l'abonnement inclut l'accès aux appareils de musculation Technogym dans notre centre de conditionnement physique, ainsi qu'une évaluation complète avec le Checkup Technogym. Les conditions précises peuvent varier, donc je vous recommande de confirmer directement avec l'équipe au 514 845-2233, poste 234 pour tous les détails.

### Note

9/10

### Recommandation d’instruction à ajouter

Bonne réponse. Si l’utilisateur reformule, répondre plus court : “Oui, selon les informations disponibles, Technogym est inclus, avec conditions à confirmer.”

### Expected behavior

* Keep behavior.
* For repeated/reformulated question, answer shorter.
* Do not repeat long explanation unnecessarily.

---

## #21 — Informal spa included follow-up

### Question

ok mais jai tu acces aux spas sauna vapeur ou bain a rmeous?

### Réponse du concierge

Daphné, l'accès au sauna, au bain vapeur et au bain à remous est inclus dans l'abonnement au Club Sportif MAA, avec des conditions qui peuvent varier. Ces installations sont situées dans les vestiaires et le grand bain à remous se trouve sur le toit près de la piscine, offrant une expérience unique en centre-ville. Pour tous les détails précis, je vous recommande de confirmer avec l'équipe au 514 845-2233, poste 234.

### Note

9/10

### Recommandation d’instruction à ajouter

Bonne réponse. Quand l’utilisateur reformule en demandant simplement “oui/non”, commencer par une réponse courte : “Oui, pour les membres, sous conditions.”

### Expected behavior

* Keep behavior.
* Start with direct yes/no when user asks informally.
* Example: “Oui, pour les membres, sous conditions.”

---

## #22 — Appointment with trainer or specialist

### Question

Comment prendre rendez-vous avec un entraîneur ou un spécialiste ?

### Réponse du concierge

Daphné, pour prendre rendez-vous avec un entraîneur ou un spécialiste au Club Sportif MAA, vous pouvez faire votre demande et l'équipe vous confirmera la disponibilité et les détails. Cela inclut les entraîneurs sportifs, les thérapeutes du sport, les massothérapeutes et autres spécialistes. Je vous recommande de contacter directement le club au 514 845-2233, poste 234, pour organiser votre rendez-vous avec la personne de votre choix.

### Note

9/10

### Recommandation d’instruction à ajouter

Bonne réponse. Si le type de spécialiste est inconnu, proposer de préciser : entraîneur, physiothérapeute, massothérapeute, nutritionniste ou thérapeute du sport.

### Expected behavior

* Keep behavior.
* If specialist type is unknown, ask which type.
* Do not confirm appointment directly.

---

## #23 — Gym included, no visit

### Question

Je veux juste m’entraîner au gym, pas faire une visite. Est-ce que c’est inclus dans l’abonnement ?

### Réponse du concierge

Daphné, l'accès à la salle d'entraînement est inclus dans l'abonnement au Club Sportif MAA, qui offre un centre de conditionnement physique moderne avec des appareils Technogym et une vaste programmation de cours. Les modalités précises d'accès peuvent varier, je vous recommande donc de confirmer directement avec l'équipe au 514 845-2233, poste 234.

### Note

9/10

### Recommandation d’instruction à ajouter

Très bonne réponse. Ajouter une règle persistante : si l’utilisateur dit “pas faire une visite”, ne jamais afficher un CTA de visite dans les prochains tours de cette séquence.

### Expected behavior

* Keep behavior.
* Respect explicit refusal of visit.
* Suppress visit CTA for this sequence.

---

## #24 — Restaurant member-only question

### Question

Est-ce que le restaurant Le 1881 est seulement pour les membres du club ?

### Réponse du concierge

Daphné, le restaurant Le 1881, situé à l'intérieur du Club Sportif MAA, est un lieu de rencontre qui accueille à la fois les membres et les non-membres. Vous pouvez donc y venir même sans être membre du club, pour profiter de sa cuisine raffinée et de son ambiance chaleureuse.

### Note

9/10

### Recommandation d’instruction à ajouter

Bonne réponse si confirmé par la source. Ajouter : pour réservation, menu ou horaires du restaurant, référer au 514 845-8002 ou au menu officiel.

### Expected behavior

* Keep if confirmed by source.
* Add restaurant-specific contact/menu/hours reference when relevant.

---

## #25 — Complete program: training, nutrition, follow-up

### Question

Je veux un programme complet : entraînement, nutrition et suivi. Qui dois-je contacter au MAA ?

### Réponse du concierge

Daphné, pour un programme complet incluant entraînement, nutrition et suivi, vous pouvez contacter notre équipe de la Clinique Sportive qui regroupe ces services. Nos nutritionnistes offrent des conseils personnalisés pour atteindre vos objectifs, et nos entraîneurs peuvent élaborer un programme adapté. Je peux transmettre votre demande pour un suivi personnalisé, la confirmation viendra de l'équipe du club au 514 845-2233, poste 234.

### Note

9/10

### Recommandation d’instruction à ajouter

Bonne réponse. Ne pas garantir un programme complet sans évaluation. Dire que l’équipe confirmera le bon parcours selon les besoins.

### Expected behavior

* Keep behavior.
* Do not guarantee program before evaluation.
* Team confirms pathway.

---

## #26 — Gym included model answer

### Question

Je veux juste m’entraîner au gym, pas faire une visite. Est-ce que c’est inclus dans l’abonnement ?

### Réponse du concierge

Daphné, l'accès au centre de conditionnement physique, donc au gym, est inclus dans l'abonnement au Club Sportif MAA. Vous pouvez profiter de nos équipements modernes et de la vaste programmation de cours de groupe selon les conditions du club. Pour toute précision, je vous recommande de valider avec l'équipe au 514 845-2233, poste 234.

### Note

10/10

### Recommandation d’instruction à ajouter

Très bonne réponse. Garder comme modèle pour “gym inclus”.

### Expected behavior

* Keep as model response for gym included.
* No visit CTA.

---

## #27 — Gym in restaurant confusion

### Question

y a-t-il un gym dans votre restaurant ?

### Réponse du concierge

Daphné, le restaurant Le 1881 ne comprend pas de gym à l'intérieur. Le gym est une installation distincte au Club Sportif MAA, situé au même endroit mais séparé du restaurant. Pour toute précision sur les accès, n'hésitez pas à contacter l'équipe au 514 845-2233, poste 234.

### Note

10/10

### Recommandation d’instruction à ajouter

Excellente réponse. Garder comme modèle pour corriger une confusion sans ridiculiser l’utilisateur.

### Expected behavior

* Keep as model response.
* Correct confusion respectfully.

---

## #28 — Payment problem

### Question

J'ai un problème avec mon paiement

### Réponse du concierge

Daphné, pour un problème de paiement, je vous recommande de contacter directement notre équipe au 514 845-2233, poste 234. Ils pourront vous assister rapidement et en toute confidentialité.

### Note

10/10

### Recommandation d’instruction à ajouter

Très bonne réponse. Garder. Ne jamais demander d’informations bancaires ou sensibles dans le chat.

### Expected behavior

* Keep behavior.
* Do not request payment or banking information.
* Human redirect.

---

# New / Strengthened Priority Intents

```text
service_buanderie
installation_pickleball
spa_non_member_access
training_room_access_booking
membership_downgrade_request
clinical_followup_yes
clinical_knee_pain_orientation
english_pricing_booking_units
restaurant_menu_links
yoga_included_or_a_la_carte
class_unlimited_booking_distinction
amenities_vs_spa_services
gym_included_no_visit
restaurant_access_question
```

---

# Global Rules to Add

## Rule 1 — Buanderie direct match

If the user says:

```text
buanderie
buandrie
lavage
faire mon lavage
service de lavage
service de linge
laver mes vêtements
laundry
```

Route to:

```text
service_buanderie
```

Do not fall back to “not found” if the source contains laundry service.

---

## Rule 2 — Pickleball direct match

If the user says:

```text
pickleball
pickball
pickle ball
pickelball
terrain de pickleball
jouer au pickleball
réserver pickleball
```

Route to:

```text
installation_pickleball
```

Do not fall back to “not found” if the source contains pickleball.

---

## Rule 3 — Known service with unknown details

If a service exists but details are unclear, say:

```text
Ce service semble bien mentionné dans les informations du Club, mais les conditions exactes doivent être confirmées avec l’équipe.
```

Do not say the service is missing.

---

## Rule 4 — “oui” after offer means proceed

If the assistant offers to transmit a request or continue to booking, and user replies:

```text
oui
```

Then:

* Do not repeat the explanation.
* Move to the next step.
* Ask for required details or explain that the team will confirm.

---

## Rule 5 — Health and clinical guidance must stay cautious

For:

```text
douleur
blessure
genou
physiothérapie
thérapie sportive
symptômes
perte de poids
nutritionniste
```

Do not diagnose or strongly recommend one service.

Use cautious orientation language:

```text
La physiothérapie ou la thérapie sportive peuvent être pertinentes selon la situation; l’équipe clinique pourra confirmer le bon service.
```

---

## Rule 6 — Preserve units when translating prices

If source pricing is monthly, English response must say:

```text
per month
```

Never convert:

```text
185 $/mois
```

into:

```text
$185 per year
```

---

## Rule 7 — Links must be real if mentioned

If the assistant says:

```text
via ces liens
```

then actual clickable links must be displayed.

If the channel cannot display links cleanly, say:

```text
Les menus sont disponibles sur le site du restaurant Le 1881; pour confirmer cette semaine, appelez le 514 845-8002.
```

---

## Rule 8 — Respect explicit “no visit” preference

If the user says:

```text
pas faire une visite
je veux juste m'entraîner
pas de visite
```

Then suppress visit CTA for the rest of the sequence unless the user later explicitly asks for a visit.

---

# Recommended Implementation Order

## Phase 1 — Fix source-aligned direct matches

Implement first:

1. Buanderie direct-match routing
2. Pickleball direct-match routing
3. Known-service uncertainty wording
4. Test typos and common variants

Relevant cases:

* #2
* #3
* #4
* #5

---

## Phase 2 — Fix access and booking modality routing

Implement:

1. Spa/non-member access question
2. Gym access without reservation/booking slot
3. Membership downgrade as administrative sensitive flow
4. Yoga included vs à la carte caution

Relevant cases:

* #1
* #6
* #7
* #13

---

## Phase 3 — Fix clinical follow-up and health wording

Implement:

1. “oui” after handoff offer moves to next step
2. No repeated clinical explanation
3. Cautious language for knee pain, physiotherapy, sports therapy, trainer
4. Weight-loss orientation without personalized advice

Relevant cases:

* #8
* #9
* #11
* #12
* #17
* #18
* #25

---

## Phase 4 — Fix language, links, and conversation polish

Implement:

1. English price unit preservation
2. Fully English response for English questions
3. Restaurant menu links must be real/clickable if mentioned
4. Short yes/no answer when user asks informally
5. Respect “no visit” preference across sequence

Relevant cases:

* #10
* #14
* #21
* #23
* #26

---

## Phase 5 — Preserve strong behavior

Do not regress:

* Technogym answers
* Gym included answers
* Restaurant member/non-member answer
* Gym-in-restaurant confusion correction
* Payment problem response
* Prompt-injection refusal from previous pass

Relevant cases:

* #19
* #20
* #22
* #24
* #26
* #27
* #28

---

# Suggested Claude Code Prompt

Use this prompt after adding this file to the project:

```text
Read docs/claude-tasks/maa-chatbot-fifth-pass-fixes.md.

This is the fifth round of testing. Several areas improved, but the main remaining priority is source-aligned direct routing for buanderie/laundry and pickleball, plus better follow-up handling.

First inspect the codebase and identify:
- intent detection logic
- direct keyword/variant mapping
- source retrieval / knowledge base logic
- fallback behavior
- CTA/button logic
- context handling between turns
- language/localization handling
- health/clinical response templates
- test files

Implement Phase 1 only:
1. Buanderie direct-match routing
2. Pickleball direct-match routing
3. Known-service uncertainty wording
4. Tests for typos and common variants

Critical requirements:
- If the source contains buanderie/laundry, never respond that no laundry information is found.
- If the source contains pickleball, never respond that no pickleball information is found.
- Add direct-match variants for buanderie: buanderie, buandrie, lavage, faire mon lavage, service de lavage, service de linge, laver mes vêtements, laundry.
- Add direct-match variants for pickleball: pickleball, pickball, pickle ball, pickelball, terrain de pickleball, jouer au pickleball, réserver pickleball.
- If the service exists but details are unclear, say: “Ce service semble bien mentionné dans les informations du Club, mais les conditions exactes doivent être confirmées avec l’équipe.”
- For laundry, do not make it sound like a public laundromat. Clarify member/Club-related conditions.
- For pickleball, say availability, schedule, member/non-member access, and reservations must be confirmed unless the source explicitly confirms them.
- Add or update tests for exact cases #2, #3, #4, and #5.

Run the relevant tests.

Then summarize:
1. Files changed
2. Intent/direct-match logic changed
3. Source retrieval or fallback logic changed
4. Tests added or updated
5. Remaining risks
```

---

# Acceptance Criteria

This fifth pass is successful only if:

* Buanderie / laundry variants route to `service_buanderie`.
* Pickleball variants route to `installation_pickleball`.
* The assistant does not say buanderie is missing when it exists in the source.
* The assistant does not say pickleball is missing when it exists in the source.
* Known service but unknown details uses the correct cautious wording.
* Laundry is not framed as a public laundromat.
* Pickleball responses distinguish existence from availability/reservation/access details.
* “oui” after a handoff offer moves to the next step instead of repeating the same explanation.
* Clinical/health responses avoid diagnosis and strong recommendations.
* English price responses preserve units exactly.
* Menu responses only mention links if real clickable links are shown.
* Strong 9/10 and 10/10 behaviors from this pass do not regress.
