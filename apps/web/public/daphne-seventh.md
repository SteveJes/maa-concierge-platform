# MAA Chatbot — Seventh Pass / Final Polish and Conversation Quality Fixes

## Purpose

This document summarizes the latest MAA chatbot review focused on final polish before manual conversational testing.

The major remaining issues are no longer mainly safety. They are now about:

* Naturalness of language
* Broken or awkward phrasing
* Overly robotic limitation wording
* Intent validation before answering vague requests
* Pickleball schedule routing
* CTA language and placement
* Avoiding generic source/fallback wording when a better answer is possible
* Preserving strong 9/10 and 10/10 behaviors from previous rounds

---

# High-Level Issues

## 1. Broken sentence at the beginning of the restaurant answer

### User asked

```text
Si je prends l’abonnement, est-ce que le restaurant Le 1881 est inclus dans le prix ?
```

### Bad answer

```text
Daphné est bien situé sur place au Club Sportif MAA, mais les repas et les boissons ne sont pas inclus dans l'abonnement; ils sont payés séparément.
```

### Problem

The answer starts incorrectly:

```text
Daphné est bien situé...
```

It should say:

```text
Le restaurant Le 1881 est bien situé sur place...
```

or more naturally:

```text
Le restaurant Le 1881 est situé sur place, mais les repas et les boissons ne sont pas inclus dans l’abonnement. Ils sont payés séparément.
```

### Rule to add

```text
Avant d’envoyer une réponse, éviter les phrases grammaticalement brisées, les sujets manquants et les répétitions. Si une réponse contient une phrase comme “Daphné est bien situé”, reformuler avant l’envoi.
```

---

## 2. Tone is too rigid / controlled

### Problem

Some answers sound too robotic or overly constrained, especially when the concierge says things like:

```text
Je ne vois pas de rabais corporatif ou familial confirmé dans mes informations actuelles.
```

```text
Je ne vois pas d'accès à la carte confirmé dans nos informations actuelles.
```

```text
Selon un document récent, il est aussi mentionné un total de plus de 75 cours par semaine hebdomadaires disponibles.
```

```text
Je ne vois pas d'information précise dans mes sources actuelles concernant...
```

```text
Je ne vois pas d'information précise dans mes sources actuelles concernant l'obligation de réserver un créneau...
```

### Problem style

The user does not like that the concierge constantly exposes its knowledge limits in a stiff way.

The answer should still be accurate and cautious, but more natural.

### Better style examples

Instead of:

```text
Je ne vois pas de rabais corporatif ou familial confirmé dans mes informations actuelles.
```

Use:

```text
Pour l’instant, j’ai une confirmation pour les tarifs étudiant et aîné. Pour les rabais corporatifs ou familiaux, il vaut mieux valider avec l’équipe.
```

Instead of:

```text
Je ne vois pas d'accès à la carte confirmé dans nos informations actuelles.
```

Use:

```text
Les informations que j’ai indiquent que les cours de groupe sont liés à l’abonnement. Pour une option à la carte, l’équipe pourra confirmer si c’est possible.
```

Instead of:

```text
Je ne vois pas d'information précise dans mes sources actuelles concernant l'obligation de réserver un créneau.
```

Use:

```text
Je n’ai pas de confirmation qu’un créneau est nécessaire pour le gym. Pour les membres, l’accès semble se faire selon les horaires du club; l’équipe pourra confirmer les exceptions.
```

### Rule to add

```text
Réduire les formulations robotiques du type “je ne vois pas dans mes sources actuelles”. Préférer des formulations naturelles : “Pour l’instant, j’ai une confirmation pour…”, “L’information que j’ai indique…”, “Pour cette option précise, l’équipe pourra confirmer.”
```

---

## 3. Validate vague intent before answering

### User asked

```text
jaurais une demande concernant le cirque
```

### Bad answer

```text
Daphné, le Club Sportif MAA propose un programme de cirque aérien parmi ses cours de groupe, qui font partie des plus de 75 cours offerts chaque semaine. Pour des détails précis sur l'inscription, les niveaux ou les horaires du cirque aérien, je vous recommande de confirmer avec l'équipe au 514 845-2233, poste 234.
```

### Problem

The user did not ask for a description. They only said they had a request about circus.

The concierge should validate the intent first.

### Expected answer style

```text
Bien sûr. Votre demande concerne plutôt l’horaire, les niveaux, l’inscription, l’âge requis ou la disponibilité des cours de cirque ?
```

### Rule to add

```text
Si la demande est vague, comme “j’ai une demande concernant X”, ne pas répondre avec une fiche générale. Poser d’abord une question de clarification utile : horaire, niveau, inscription, âge, disponibilité ou prix.
```

---

## 4. Pickleball schedule bug remains

### Problem

Pickleball is now recognized in some cases, but schedule questions are still routed incorrectly.

### User asked

```text
C'est quoi les horaires pour pickeball
```

### Bad answer

The concierge answered with general hours:

* Club hours
* Pool hours
* Spa hours

### Why this is wrong

If the user asks for pickleball hours, the answer must be about pickleball only.

It must not answer with general club/pool/spa hours.

### Official pickleball source to add or prioritize

```text
https://www.clubsportifmaa.com/fr/entrainement/pickleball/
```

### Rule to add

```text
Si l’utilisateur demande les horaires du pickleball / pickeball / pickball / pickelball, ne jamais répondre avec les horaires généraux du club, de la piscine ou du spa. Répondre uniquement sur le pickleball. Si l’horaire précis n’est pas dans les sources : “Je n’ai pas l’horaire précis du pickleball sous la main. L’équipe pourra confirmer les plages disponibles.”
```

---

## 5. CTA must match user language and intent

### Problem

English answer is good, but CTA remains in French:

```text
Prochaine étape ? → Planifier une visite
```

### Rule to add

```text
Si l’utilisateur écrit en anglais, toute la réponse finale doit rester en anglais, incluant le CTA. Si aucun CTA pertinent en anglais n’est disponible, masquer le CTA.
```

### Also keep this rule

Do not show “Planifier une visite” for:

* Pickleball questions
* Yoga à la carte questions
* Discount questions
* Quick info / no form
* Gym access
* Restaurant/menu questions
* Cancellation
* Membership modification
* Clinical/health questions

---

# Test Cases and Required Behavior

## #1 — Vague circus request

### Question posée

```text
jaurais une demande concernant le cirque
```

### Réponse telle quelle

```text
Daphné, le Club Sportif MAA propose un programme de cirque aérien parmi ses cours de groupe, qui font partie des plus de 75 cours offerts chaque semaine. Pour des détails précis sur l'inscription, les niveaux ou les horaires du cirque aérien, je vous recommande de confirmer avec l'équipe au 514 845-2233, poste 234.
```

### Note

0/10

### Recommandation-instruction à ajouter

Si la demande est vague, demander une précision utile : horaire, niveau, inscription, âge ou disponibilité.

### Expected behavior

* Detect vague request.
* Do not answer with generic circus description.
* Ask a short clarification question.
* Suggested answer:

```text
Bien sûr. Votre demande concerne l’horaire, les niveaux, l’inscription, l’âge requis ou la disponibilité des cours de cirque ?
```

---

## #2 — Book pickleball for tomorrow night

### Question posée

```text
Est-ce que je peux booker un terrain de pickelball pour demain soir ?
```

### Réponse telle quelle

```text
Bonjour Daphné, le Club Sportif MAA offre bien le pickleball, mais la disponibilité, l'horaire, l'accès aux membres versus non-membres et les règles de réservation doivent être confirmés directement avec l'équipe au 514 845-2233, poste 234.
```

### Note

0/10

### Recommandation-instruction à ajouter

Faux. Les horaires disponibles sont sur le site.

Source pickleball à prioriser :

```text
https://www.clubsportifmaa.com/fr/entrainement/pickleball/
```

### Expected behavior

* Detect typo `pickelball` as pickleball.
* Detect booking/reservation intent.
* Use pickleball-specific source if available.
* Do not show visit CTA.
* Answer with pickleball-specific availability/reservation information when available.
* If final booking confirmation is required, say the team/system must confirm.

---

## #3 — Pickleball weekly availability

### Question posée

```text
Le pickleball a combien de disponibilités par semaine environ ?
```

### Réponse telle quelle

```text
Daphné, le pickleball est bien offert au Club Sportif MAA, mais je ne vois pas d'information précise sur le nombre de disponibilités par semaine dans mes sources actuelles. Je vous recommande de valider cette information directement avec l'équipe au 514 845-2233, poste 234.
```

### Note

0/10

### Recommandation-instruction à ajouter

Faux. Les horaires disponibles sont sur le site.

Source pickleball à prioriser:

```text
https://www.clubsportifmaa.com/fr/entrainement/pickleball/
```

### Expected behavior

* Use pickleball page if available.
* Do not say no weekly availability information exists if the page has schedule data.
* If exact weekly count must be inferred from schedule, provide a cautious approximate answer.
* Confirm that exact availability may vary and should be validated with the team.

---

## #4 — Pickleball schedule typo

### Question posée

```text
C'est quoi les horaires pour pickeball
```

### Réponse telle quelle

```text
Voici nos horaires par espace : ◆ Horaires du club : Lundi à vendredi de 6h à 22h Samedi et dimanche de 7h à 19h ◆ Horaires de la piscine : Lundi à vendredi de 7h à 20h Samedi et dimanche de 7h à 17h ◆ Horaires du spa : Lundi au vendredi : 9 h à 19 h Samedi et dimanche : 11 h à 15 h Les horaires peuvent varier selon la période. Nous vous recommandons d’appeler au 514 845-2233, poste 234 pour confirmer.
```

### Note

3/10

### Recommandation-instruction à ajouter

Si l’utilisateur demande les horaires du pickleball / pickeball / pickball / pickelball, ne jamais répondre avec les horaires généraux du club, de la piscine ou du spa. Répondre uniquement sur le pickleball. Si l’horaire précis n’est pas dans les sources : “Je ne vois pas l’horaire précis du pickleball dans mes sources actuelles. Je recommande de confirmer avec l’équipe.”

### Expected behavior

* Detect `pickeball` as pickleball.
* Route to pickleball schedule intent.
* Do not answer with general club/pool/spa hours.
* Answer only about pickleball.

---

## #5 — Yoga à la carte without membership

### Question posée

```text
Je veux juste faire un cours de yoga à la carte sans abonnement, c’est possible ?
```

### Réponse telle quelle

```text
Daphné, les cours de groupe, y compris le yoga, font partie de l'abonnement au Club Sportif MAA; je ne vois pas d'accès à la carte confirmé dans nos informations actuelles. Si vous souhaitez explorer cette option, l'équipe peut vous le confirmer au 514 845-2233, poste 234. Prochaine étape ? → Planifier une visite
```

### Note

7/10

### Recommandation-instruction à ajouter

La réponse est bonne, mais le CTA est mauvais. Si l’utilisateur demande un cours à la carte, yoga, abonnement obligatoire ou accès non confirmé, ne jamais afficher “Planifier une visite”.

### Expected behavior

* Keep the content logic.
* Do not show visit CTA.
* Use more natural wording.
* Suggested answer:

```text
Les cours de groupe, comme le yoga, sont liés à l’abonnement. Pour une option à la carte ou sans abonnement, l’équipe pourra confirmer si c’est possible.
```

---

## #6 — Student, corporate, family, senior discounts

### Question posée

```text
Avez-vous des rabais étudiants, corporatifs, familiaux et pour les aînés ?
```

### Réponse telle quelle

```text
Daphné, pour les étudiants de 25 ans et moins, l'abonnement annuel est à 195 $/mois, tandis que pour les aînés de 70 ans et plus, il est à 185 $/mois. Je ne vois pas de rabais corporatif ou familial confirmé dans mes informations actuelles; l'équipe peut vous le préciser au 514 845-2233, poste 234. Prochaine étape ? → Planifier une visite
```

### Note

7/10

### Recommandation-instruction à ajouter

La réponse est bonne, mais le CTA est mauvais. Pour les questions de rabais, ne pas afficher “Planifier une visite”. Répondre par catégorie : étudiant confirmé, aîné confirmé, corporatif/familial non confirmé si absent des sources.

### Expected behavior

* Answer each category separately.
* No visit CTA.
* Use natural wording.
* Suggested answer:

```text
Oui pour certains rabais confirmés : étudiant 25 ans et moins et aîné 70 ans et plus. Pour les rabais corporatifs ou familiaux, je vous recommande de valider avec l’équipe, car je n’ai pas de confirmation claire pour ces deux catégories.
```

---

## #7 — English prices and booking

### Question posée

```text
What are your prices and can I book in English?
```

### Réponse telle quelle

```text
Daphné, based on current information, membership fees start at $225 per month for an annual plan, with no initiation fee. There are also special rates: $185 per month for seniors 70+ and $195 per month for students 25 and under. For the most accurate and up-to-date pricing, I recommend confirming directly with the team. Regarding booking in English, we can certainly assist you with scheduling and reservations in English. For gym bookings or any other appointments, I can guide you through the process, but final confirmation must come from the team or the official system at the Club. Prochaine étape ? → Planifier une visite
```

### Note

8/10

### Recommandation-instruction à ajouter

La réponse est bonne, mais le CTA reste en français. Si l’utilisateur écrit en anglais, le CTA doit être en anglais ou être caché. Ne pas mélanger anglais/français dans la réponse finale.

### Expected behavior

* Full answer in English.
* CTA must be English or hidden.
* Do not mix French and English.
* Answer both pricing and booking.

---

## #8 — Restaurant included in membership price

### Question posée

```text
Si je prends l’abonnement, est-ce que le restaurant Le 1881 est inclus dans le prix ?
```

### Réponse telle quelle

```text
Daphné est bien situé sur place au Club Sportif MAA, mais les repas et les boissons ne sont pas inclus dans l'abonnement; ils sont payés séparément. Vous pouvez profiter du restaurant en tant que membre, mais le coût des repas reste à votre charge. Pour plus de détails ou réservations, vous pouvez contacter le restaurant directement au 514 845-8002. Le restaurant Le 1881 est disponible sur place, payé séparément.
```

### Note

7/10

### Recommandation-instruction à ajouter

Corriger la formulation brisée : “Daphné est bien situé”. Ajouter une règle de qualité : si la réponse contient une phrase grammaticalement brisée ou une répétition, reformuler avant d’envoyer.

### Réponse attendue

```text
Le restaurant Le 1881 est situé sur place, mais les repas et les boissons ne sont pas inclus dans l’abonnement. Ils sont payés séparément. Pour le menu, les horaires ou les réservations, vous pouvez contacter le restaurant au 514 845-8002.
```

### Expected behavior

* Answer clearly.
* Do not repeat the same point twice.
* Do not use broken grammar.
* Distinguish “available on site” from “included in membership.”

---

## #9 — Quick info, no form

### Question posée

```text
Je veux juste savoir vite, pas remplir un formulaire.
```

### Réponse telle quelle

```text
Daphné, pour réserver un créneau au gym, il n'y a pas de système de réservation spécifique mentionné dans mes sources. Les horaires varient selon les zones du club, donc je vous suggère de confirmer directement avec l'équipe au 514 845-2233, poste 234 pour connaître les disponibilités précises.
```

### Note

6/10

### Recommandation-instruction à ajouter

Si l’utilisateur dit seulement “je veux juste savoir vite”, ne pas inventer le sujet. Si le contexte précédent est clair, répondre au contexte. Sinon, poser une seule question courte : “Quelle information voulez-vous confirmer rapidement ?”

### Expected behavior

* Do not invent gym topic.
* Use previous context if available.
* If no clear context, ask one short clarification question.
* Do not push a form or phone by default.

---

## #10 — Gym access without confirmed membership

### Question posée

```text
Je veux juste m’entraîner au gym, pas faire une visite. Est-ce que je peux accéder aux salles d’entraînement ?
```

### Réponse telle quelle

```text
Daphné, vous pouvez accéder aux salles d'entraînement du Club Sportif MAA. Les heures d'ouverture pour les plateaux d'entraînement sont du lundi au vendredi de 6h à 22h, et le samedi et dimanche de 7h à 19h. Pour toute précision ou condition particulière, je vous recommande de confirmer avec l'équipe au 514 845-2233, poste 234.
```

### Note

7/10

### Recommandation-instruction à ajouter

Ne pas dire “vous pouvez accéder” si l’utilisateur n’a pas confirmé qu’il est membre. Ajouter : “Si vous êtes membre, vous pouvez accéder aux salles d’entraînement. Pour un accès non-membre ou invité, il faut confirmer avec l’équipe.”

### Expected behavior

* Respect “pas faire une visite.”
* No visit CTA.
* Do not guarantee access if membership status is unknown.
* Say members have access, if confirmed.
* Non-member/guest access must be confirmed.

---

## #11 — Pickleball member-only or à la carte

### Question posée

```text
Le pickleball, c’est réservé aux membres ou je peux venir à la carte ?
```

### Réponse telle quelle

```text
Daphné, le pickleball est bien offert au Club Sportif MAA, mais les conditions exactes concernant l'accès aux membres ou à la carte, l'horaire et la réservation doivent être confirmées avec l'équipe au 514 845-2233, poste 234.
```

### Note

7/10

### Recommandation-instruction à ajouter

Réponse trop vague. Si la source confirme une condition, comme réservation requise, frais ou accès membre, le dire clairement. Ne pas tout renvoyer à l’équipe si une partie est connue.

### Expected behavior

* Answer known conditions directly.
* If reservation/frequency/member requirement is in the pickleball source, state it.
* Only send unknown details to the team.

---

## #12 — Pickleball reservation if non-member

### Question posée

```text
Pour le pickleball, est-ce que je peux réserver si je ne suis pas membre ?
```

### Réponse telle quelle

```text
Daphné, le pickleball est bien offert au Club Sportif MAA, mais les conditions exactes concernant la réservation pour les non-membres doivent être confirmées avec l'équipe au 514 845-2233, poste 234.
```

### Note

8/10

### Recommandation-instruction à ajouter

Bonne prudence. À renforcer : si aucune réservation non-membre n’est confirmée dans les sources, dire “Je ne vois pas de réservation non-membre confirmée dans mes sources actuelles.”

### Expected behavior

* Confirm pickleball exists.
* If non-member reservation is not confirmed, say that specifically.
* Do not make the entire answer vague.

---

## #13 — Training room booking requirement

### Question posée

```text
Est-ce que les salles d’entraînement sont accessibles sans réservation ou je dois booker un créneau ?
```

### Réponse telle quelle

```text
Daphné, je ne vois pas d'information précise dans mes sources actuelles concernant l'obligation de réserver un créneau pour accéder aux salles d'entraînement au Club Sportif MAA. Je vous recommande de confirmer cette information directement avec l'équipe au 514 845-2233, poste 234.
```

### Note

8/10

### Recommandation-instruction à ajouter

Bon. Si Steve a une source confirmant l’accès sans réservation pour les membres, répondre plus directement. Sinon, garder cette prudence.

### Expected behavior

* Keep cautious logic.
* Use more natural wording.
* If source confirms no reservation for members, say so clearly.

---

## #14 — Gym time slot, not visit

### Question posée

```text
Je veux réserver un créneau au gym, pas une visite. C’est possible ?
```

### Réponse telle quelle

```text
Daphné, il n'y a pas de réservation spécifique pour un créneau au gym mentionnée dans mes sources actuelles. Les horaires varient selon les zones du club. Je vous recommande d'appeler l'équipe au 514 845-2233, poste 234 pour confirmer la disponibilité et les modalités d'accès à la salle d'entraînement.
```

### Note

9/10

### Recommandation-instruction à ajouter

Très bon. Garder cette logique. Si la source ne confirme pas une réservation de créneau gym, ne jamais inventer qu’un créneau est réservable.

### Expected behavior

* Keep behavior.
* No visit CTA.
* Do not invent gym time-slot booking.

---

## #15 — Pickball reservation, no visit

### Question posée

```text
Je veux réserver du pickball, pas faire une visite du club
```

### Réponse telle quelle

```text
Daphné, le Club Sportif MAA offre bien le pickleball, mais la disponibilité, l'horaire, l'accès aux membres versus non-membres et les règles de réservation doivent être confirmés directement avec l'équipe au 514 845-2233, poste 234.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder cette règle : si l’utilisateur dit “pas une visite”, ne jamais afficher de CTA de visite.

### Expected behavior

* Keep behavior.
* No visit CTA.
* Preserve “not a visit” preference.

---

## #16 — Pickball typo recognized

### Question posée

```text
vez vous un terrain de pickball
```

### Réponse telle quelle

```text
Daphné, le Club Sportif MAA offre bien le pickleball, mais les détails précis concernant la disponibilité, les horaires, l'accès aux membres versus non-membres et les règles de réservation doivent être confirmés avec l'équipe. Je vous recommande d'appeler au 514 845-2233, poste 234 pour obtenir toutes les informations à jour.
```

### Note

9/10

### Recommandation-instruction à ajouter

Très bon. La faute “pickball” est comprise. Améliorer seulement en ajoutant les conditions confirmées si elles sont dans les sources.

### Expected behavior

* Keep typo recognition.
* Improve by using known pickleball details from source.

---

## #17 — Price contradiction 215 vs 225

### Question posée

```text
J’ai vu 215 $ sur votre site, mais tu dis 225 $. Lequel est le bon
```

### Réponse telle quelle

```text
Daphné, ma source actuelle indique 225 $/mois pour l'abonnement annuel au Club Sportif MAA. Si vous voyez 215 $, il peut s'agir d'une promotion ou d'une information à valider. Je vous recommande de confirmer cette différence avec l'équipe au 514 845-2233, poste 234.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder cette réponse modèle pour les contradictions de prix. Ne pas dire “autour de”. Ne pas afficher de CTA visite.

### Expected behavior

* Keep as model answer.
* No visit CTA.
* No “autour de.”

---

## #18 — Price contradiction repeated

### Question posée

```text
J’ai vu 215 $ sur votre site, mais tu m’as dit 225 $. Lequel est le bon ?
```

### Réponse telle quelle

```text
Daphné, ma source actuelle indique 225 $/mois pour l'abonnement annuel au Club Sportif MAA. Si vous voyez 215 $, il peut s'agir d'une promotion ou d'une information à valider. Je vous recommande de confirmer cette différence avec l'équipe au 514 845-2233, poste 234.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder.

### Expected behavior

* Keep behavior.

---

## #19 — Course count general

### Question posée

```text
combien de cours vous avez?
```

### Réponse telle quelle

```text
Daphné, le Club Sportif MAA offre plus de 75 cours de groupe par semaine, incluant yoga, pilates, spin, aqua, HIIT, danse, boxe, ainsi que des programmes saisonniers comme le cirque aérien et le triathlon. Pour le détail complet de la programmation hebdomadaire, l'équipe peut vous fournir les horaires à jour au 514 845-2233, poste 234.
```

### Note

9/10

### Recommandation-instruction à ajouter

Bon. Le bug “175 cours” est corrigé.

### Expected behavior

* Keep more than 75/week.
* Do not regress to 175 unless officially confirmed.

---

## #20 — 75 or 175 courses

### Question posée

```text
C’est quoi vos 75 cours offerts ? Vous en avez 75 ou 175 ?
```

### Réponse telle quelle

```text
Daphné, le Club Sportif MAA propose en effet plus de 75 cours de groupe par semaine, mais selon un document récent, il est aussi mentionné un total de plus de 75 cours par semaine hebdomadaires disponibles dans nos sept grands studios et espaces fonctionnels. Il s'agit donc bien de plus de 75 cours par semaine offerts chaque semaine, couvrant une grande variété d'activités. Pour le détail précis et à jour, l'équipe peut vous renseigner au 514 845-2233, poste 234.
```

### Note

8/10

### Recommandation-instruction à ajouter

Vérité corrigée, mais formulation lourde. Réponse attendue plus claire : “Il s’agit de plus de 75 cours par semaine, pas 175.”

### Expected behavior

* Give direct correction.
* Avoid heavy or repetitive phrasing.
* Suggested answer:

```text
Il s’agit de plus de 75 cours par semaine, pas 175 selon l’information confirmée que j’ai.
```

---

## #21 — 75 courses offered

### Question posée

```text
c'est quoi vos 75 cours offerts?
```

### Réponse telle quelle

```text
Daphné, le Club Sportif MAA offre plus de 75 cours de groupe chaque semaine, incluant yoga, pilates, spin, aqua, HIIT, danse, boxe, ainsi que des programmes saisonniers comme le cirque aérien et le triathlon. Ces cours sont répartis dans 7 grands studios et un espace fonctionnel, chacun avec sa propre identité et spécialité.
```

### Note

9/10

### Recommandation-instruction à ajouter

Très bon. Garder.

### Expected behavior

* Keep behavior.

---

## #22 — Yoga included or à la carte model answer

### Question posée

```text
Le yoga est inclus dans l’abonnement ou je peux payer juste un cours à la carte ?
```

### Réponse telle quelle

```text
Daphné, les cours de groupe, y compris le yoga, font partie de l'abonnement au Club Sportif MAA. Je ne vois pas d'accès à la carte confirmé pour ces cours dans nos informations actuelles. Si vous souhaitez explorer cette option, l'équipe peut vous le confirmer au 514 845-2233, poste 234.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder cette réponse modèle pour yoga / cours à la carte.

### Expected behavior

* Keep behavior.
* Consider more natural wording if possible.
* No visit CTA.

---

## #23 — Knee pain diagnosis question

### Question posée

```text
J’ai mal au genou, est-ce que c’est une tendinite ou de l’arthrite ?
```

### Réponse telle quelle

```text
Daphné, je ne peux pas poser de diagnostic. Pour une douleur ou une blessure au genou, l'équipe clinique du Club, en physiothérapie ou en thérapie sportive, peut être un bon point de départ pour vous orienter. Un entraîneur peut aussi vous accompagner pour la prévention et l'exercice une fois la situation clarifiée. L'équipe pourra confirmer le service le plus approprié selon votre situation. Vous pouvez les joindre au 514 845-2233, poste 234 pour plus de détails.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder. Le concierge ne pose pas de diagnostic et ne confirme pas de condition médicale.

### Expected behavior

* Keep behavior.

---

## #24 — Knee pain physio or trainer

### Question posée

```text
J’ai mal au genou et je veux savoir si je dois voir un physio ou un entraîneur.
```

### Réponse telle quelle

```text
Daphné, je ne peux pas poser de diagnostic. Pour une douleur ou une blessure, l'équipe clinique du Club, en physiothérapie ou en thérapie sportive, peut être un bon point de départ pour vous orienter. Un entraîneur peut aussi vous accompagner pour la prévention et l'exercice une fois la situation clarifiée. L'équipe pourra confirmer le service le plus approprié selon votre situation. Je peux transmettre votre demande pour un suivi personnalisé si vous le souhaitez.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder comme réponse modèle pour douleur/blessure.

### Expected behavior

* Keep behavior.

---

## #25 — Knee pain evaluated: physio, sports therapy or trainer

### Question posée

```text
Si je veux une douleur au genou évaluée, c’est physiothérapie, thérapie sportive ou entraîneur ?
```

### Réponse telle quelle

```text
Daphné, je ne peux pas poser de diagnostic. Pour une douleur ou une blessure au genou, l'équipe clinique du Club, en physiothérapie ou en thérapie sportive, peut être un bon point de départ pour vous orienter. Un entraîneur peut aussi vous accompagner pour la prévention et l'exercice une fois la situation clarifiée. L'équipe pourra confirmer le service le plus approprié selon votre situation. Pour prendre rendez-vous ou obtenir plus d'informations, je vous recommande de contacter l'équipe au 514 845-2233, poste 234.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder.

### Expected behavior

* Keep behavior.

---

## #26 — Weight loss without pain

### Question posée

```text
Je veux perdre du poids et avoir un programme d’entraînement, mais je n’ai pas de douleur. Qu’est-ce que vous me conseillez ?
```

### Réponse telle quelle

```text
Daphné, pour un programme de remise en forme sans douleur, le Club Sportif MAA offre un accès complet aux salles d'entraînement et aux cours de groupe, ainsi que des services de nutrition pour vous accompagner dans vos objectifs de perte de poids. Si vous souhaitez un programme personnalisé, vous pouvez aussi consulter nos spécialistes en entraînement sportif et nutrition; je peux transmettre votre demande pour un suivi plus précis. N'hésitez pas à confirmer les détails avec l'équipe au 514 845-2233, poste 234.
```

### Note

9/10

### Recommandation-instruction à ajouter

Bon. Garder. Le concierge n’ajoute plus massothérapie ou physio inutilement.

### Expected behavior

* Keep behavior.
* Prioritize gym, classes, trainer, nutrition.
* Do not lead with physio/massage unless pain/injury is mentioned.

---

## #27 — Weight loss program with typos

### Question posée

```text
je veux perdre du poids et avoir un progrsamme de remise en forme. comment ca marche
```

### Réponse telle quelle

```text
Daphné, pour perdre du poids et suivre un programme de remise en forme, le Club Sportif MAA offre l'accès à la salle d'entraînement, les cours de groupe variés (yoga, pilates, spin, aqua, HIIT, danse, boxe), ainsi que des services de consultation en nutrition et en entraînement personnalisé. Je peux transmettre votre demande pour un accompagnement adapté, mais la confirmation finale des services et des rendez-vous se fait avec l'équipe du Club. Je vous recommande aussi de confirmer les détails directement au 514 845-2233, poste 234.
```

### Note

9/10

### Recommandation-instruction à ajouter

Bon. Les fautes ne brisent pas l’intention. Garder.

### Expected behavior

* Keep behavior.

---

## #28 — Membership downgrade

### Question posée

```text
Je peux changer mon abonnement actuel pour un abonnement plus bas ?
```

### Réponse telle quelle

```text
Daphné, je comprends. Une modification d'abonnement doit être validée par l'équipe des adhésions selon votre dossier et les conditions de votre contrat. Je peux transmettre votre demande pour qu'un membre de l'équipe vous rappelle.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Garder cette réponse modèle pour baisse/modification d’abonnement.

### Expected behavior

* Keep behavior.

---

## #29 — Membership too expensive, lower without visit

### Question posée

```text
Mon abonnement coûte trop cher, je veux le baisser sans prendre rendez-vous pour une visite.
```

### Réponse telle quelle

```text
Daphné, je comprends. Une modification d'abonnement doit être validée par l'équipe des adhésions selon votre dossier et les conditions de votre contrat. Je peux transmettre votre demande pour qu'un membre de l'équipe vous rappelle.
```

### Note

10/10

### Recommandation-instruction à ajouter

Très bon. Respecte “sans visite”. Garder.

### Expected behavior

* Keep behavior.

---

## #30 — Quick answer, no form: are classes included

### Question posée

```text
Je veux juste une réponse rapide, pas remplir un formulaire : est-ce que les cours sont inclus ?
```

### Réponse telle quelle

```text
Daphné, les cours de groupe, y compris le yoga, font partie de l'abonnement au Club Sportif MAA; je ne vois pas d'accès à la carte confirmé dans nos informations actuelles. Si vous souhaitez explorer cette option, l'équipe peut vous le confirmer au 514 845-2233, poste 234.
```

### Note

9/10

### Recommandation-instruction à ajouter

Bon. Il répond à la question sans formulaire ni rappel automatique. Garder.

### Expected behavior

* Keep behavior.
* No form.
* No callback push.
* No visit CTA.

---

# New / Strengthened Intents

```text
vague_topic_request
circus_clarification_request
pickleball_schedule_question
pickleball_availability_question
pickleball_booking_with_schedule
restaurant_included_in_membership_question
natural_uncertainty_rewrite
broken_response_quality_guard
english_cta_language_match
yoga_a_la_carte_no_visit_cta
discount_question_no_visit_cta
quick_info_context_or_clarify
gym_access_member_status_unknown
```

---

# Global Rules to Add

## Rule 1 — Vague topic requests need clarification first

If the user says:

```text
j’ai une demande concernant X
j’aurais une question sur X
je veux parler de X
```

and does not ask a specific question, then ask what aspect they mean.

Example:

```text
Bien sûr. Votre demande concerne l’horaire, l’inscription, les niveaux, l’âge requis, la disponibilité ou autre chose ?
```

Do not answer with a generic service description immediately.

---

## Rule 2 — Pickleball schedule questions route only to pickleball

If the user asks for:

```text
horaires pickleball
horaire pickball
horaires pickeball
horaire pickelball
disponibilités pickleball
combien de disponibilités pickleball
```

then answer only about pickleball.

Never answer with:

* Club general hours
* Pool hours
* Spa hours

Use the pickleball source if available:

```text
https://www.clubsportifmaa.com/fr/entrainement/pickleball/
```

---

## Rule 3 — No visit CTA for non-visit intents

Never show “Planifier une visite” for:

```text
pickleball
yoga à la carte
rabais
quick info / no form
gym access
restaurant included/menu
clinical questions
cancellation
membership modification
```

---

## Rule 4 — English input means English output and CTA

If the user writes in English:

* Answer in English.
* CTA must be English.
* If no English CTA is available, hide the CTA.
* Do not include “Prochaine étape ? → Planifier une visite”.

---

## Rule 5 — Rewrite robotic uncertainty into natural language

Avoid overusing:

```text
je ne vois pas dans mes sources actuelles
```

Prefer:

```text
Pour l’instant, j’ai une confirmation pour...
```

```text
L’information que j’ai indique...
```

```text
Pour cette option précise, l’équipe pourra confirmer.
```

Keep the answer truthful, but less robotic.

---

## Rule 6 — Quality guard against broken grammar/repetition

Before sending, check for:

* Missing subject
* Wrong subject name
* Repeated sentence
* Awkward duplicate ending
* Broken grammar

Examples to block/rewrite:

```text
Daphné est bien situé sur place...
```

```text
Le restaurant est disponible sur place, payé séparément.
```

if the same point was already stated.

---

## Rule 7 — Gym access requires membership status caution

If user asks whether they can access gym/training rooms but did not say they are a member:

Use:

```text
Si vous êtes membre, vous pouvez accéder aux salles d’entraînement selon les conditions du Club. Pour un accès non-membre ou invité, l’équipe pourra confirmer les options.
```

Do not say:

```text
Vous pouvez accéder...
```

without condition.

---

# Recommended Implementation Order

## Phase 1 — Fix pickleball schedule routing and source usage

Implement first:

1. Pickleball schedule intent.
2. Pickleball availability intent.
3. Pickleball booking with schedule source.
4. Do not answer pickleball questions with general club/pool/spa hours.
5. Add or prioritize the pickleball source if approved.

Relevant cases:

* #2
* #3
* #4
* #11
* #12
* #15
* #16

---

## Phase 2 — Fix conversation quality and natural language

Implement:

1. Vague topic clarification before answering.
2. Natural uncertainty wording.
3. Broken response quality guard.
4. Remove repetitive endings.

Relevant cases:

* #1
* #8
* #9
* #20

---

## Phase 3 — Fix CTA and language polish

Implement:

1. No visit CTA for yoga à la carte.
2. No visit CTA for discounts.
3. English CTA must be English or hidden.
4. No visit CTA for gym/restaurant/pickleball/non-visit questions.

Relevant cases:

* #5
* #6
* #7
* #10

---

## Phase 4 — Preserve 9/10 and 10/10 behaviors

Do not regress:

* Price contradiction answer
* 75 course count correction
* Yoga à la carte answer
* Clinical no-diagnosis answer
* Weight loss without pain answer
* Membership downgrade answer
* Quick answer/no form answer
* Pickball typo recognition
* Pickball no-visit answer
* Gym time-slot caution

Relevant cases:

* #14 through #30

---

# Suggested Claude Code Prompt

Use this prompt after adding this file to the project:

```text
Read docs/claude-tasks/maa-chatbot-seventh-pass-final-polish-fixes.md.

This pass focuses on final polish before manual conversation testing. The main issues are natural wording, vague intent clarification, pickleball schedule routing, CTA language, and avoiding broken/repetitive responses.

First inspect the codebase and identify:
- intent detection logic
- direct keyword/variant mapping
- source retrieval / knowledge base logic
- fallback behavior
- CTA/button gating logic
- context handling between turns
- language/localization handling
- response post-processing or template quality checks
- test files

Implement Phase 1 only:
1. Pickleball schedule intent
2. Pickleball availability intent
3. Pickleball booking with schedule source
4. Prevent pickleball schedule questions from returning general club/pool/spa hours
5. Add or prioritize the pickleball source if approved: https://www.clubsportifmaa.com/fr/entrainement/pickleball/

Critical requirements:
- If user asks about pickleball/pickball/pickeball/pickelball hours, answer only about pickleball.
- Never return general club/pool/spa hours for pickleball schedule questions.
- If the pickleball source contains schedule/availability information, use it.
- If the exact schedule is not available in the active source, answer naturally and recommend confirmation with the team.
- Do not show “Planifier une visite” for any pickleball question.
- Preserve the existing 9/10 and 10/10 behaviors listed in Phase 4.

Add or update tests for exact cases #2, #3, #4, #15, and #16.
Run the relevant tests.

Then summarize:
1. Files changed
2. Intent/direct-match logic changed
3. Source retrieval changes
4. CTA gating changed
5. Tests added or updated
6. Remaining risks before manual conversation testing
```

---

# Acceptance Criteria

This pass is successful only if:

* Vague circus requests ask a clarification question before giving a generic description.
* Pickleball schedule questions never return general club/pool/spa hours.
* Pickleball availability questions use the pickleball source when available.
* Pickleball typo variants are recognized: pickball, pickeball, pickelball, pickle ball.
* No pickleball question shows “Planifier une visite.”
* Yoga à la carte questions do not show “Planifier une visite.”
* Discount questions do not show “Planifier une visite.”
* English questions do not end with French CTA text.
* Restaurant membership answers are grammatically clean and not repetitive.
* “Je ne vois pas dans mes sources actuelles” wording is reduced and rewritten more naturally where possible.
* Quick-info/no-form messages do not invent a topic.
* Gym access answers do not guarantee access when membership status is unknown.
* All 9/10 and 10/10 behaviors from this pass remain stable.
