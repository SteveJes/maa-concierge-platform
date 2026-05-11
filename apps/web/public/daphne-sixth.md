# MAA Chatbot — Sixth Pass / Final Pre-Demo Fixes

## Purpose

This document summarizes the final ChatGPT-assisted review round for the MAA concierge.

The next tests will be performed manually through real conversations instead of isolated question/answer tests. This file is intended as the final structured handoff before that stage.

---

# Executive Summary

Overall, there is real improvement.

The following areas are now much better:

* Typos and spelling mistakes
* Cancellation intent
* Buanderie / laundry intent
* Technogym / Checkup Technogym
* Membership downgrade / lower plan request
* Contextual “oui” after a proposed next step

The remaining issues are mostly precise intent-routing bugs and source-truth issues.

The most important remaining bug is:

```text
réserver/booker pickleball = incorrectly routed to Planifier une visite
```

This must be corrected before demo.

---

# Final Priority Fixes Before Demo

## 1. Fix “book/reserve pickleball = visit” bug immediately

### Problem

When the user says:

```text
booker un terrain de pickelball / pickball / pickleball
```

the concierge still sometimes shows the generic commercial visit CTA:

```text
Planifier une visite
```

This is the biggest remaining bug.

### Required behavior

If the user says any combination of:

```text
booker
réserver
terrain
pickleball
pickball
pickelball
pickle ball
demain soir
```

then route to:

```text
pickleball_reservation_request
```

The concierge must answer about pickleball reservation, not a commercial visit.

### Never do

* Never show “Planifier une visite” for pickleball booking.
* Never treat pickleball booking as a club tour request.

### Suggested instruction

```text
Si l’utilisateur dit booker / réserver + pickleball / pickball / pickelball / pickle ball / terrain, répondre sur la réservation de pickleball. Ne jamais déclencher le bouton de visite commerciale.
```

---

## 2. Add strict rule for price contradictions

### Problem

When the user says:

```text
J’ai vu 215 $ sur votre site, mais tu m’as dit 225 $. Lequel est le bon ?
```

the concierge handles the contradiction poorly.

It may say:

```text
autour de 225 $
```

or add an unnecessary visit CTA.

### Required behavior

The concierge must acknowledge the discrepancy clearly.

### Correct response pattern

```text
Ma source actuelle indique 225 $/mois pour l’abonnement annuel. Si vous voyez 215 $, il peut s’agir d’une promotion ou d’une information à valider. Je recommande de confirmer avec l’équipe.
```

### Rules

* Do not say “autour de.”
* Do not minimize the discrepancy.
* Do not show “Planifier une visite.”
* Do not guess which price is correct if sources conflict.
* State what the current source says and recommend confirmation.

---

## 3. Lock the class count source: 75 vs 175

### Problem

The concierge says:

```text
plus de 175 cours
```

while the official page consulted says:

```text
plus de 75 cours/semaine
```

### Required behavior

Until MAA officially confirms 175, the concierge should say:

```text
plus de 75 cours/semaine
```

### Suggested instruction

```text
Verrouiller la donnée officielle. Si la source MAA dit plus de 75 cours/semaine, ne jamais répondre 175 sans preuve officielle.
```

---

## 4. Fix yoga / à la carte access

### Problem

The concierge says that à la carte yoga access “seems possible.”

But the site indicates that a membership is mandatory for group classes.

### Required behavior

If the source says membership is required, never suggest à la carte access without explicit proof.

### Suggested instruction

```text
Si la source dit abonnement obligatoire pour un cours de groupe, ne jamais suggérer l’accès à la carte sans preuve.
```

---

## 5. Make clinical responses more cautious

### Problem

For knee pain, physiotherapy, sports therapy, or trainer questions, the concierge sometimes mentions specific diagnoses such as:

* Arthritis
* Patellofemoral syndrome
* Other medical condition names

This is too medical.

### Required behavior

For pain/injury questions:

* Do not diagnose.
* Do not name medical conditions.
* Do not say physiotherapy is firmly recommended.
* Use cautious orientation language.

### Correct response pattern

```text
Je ne peux pas diagnostiquer. Pour une douleur ou une blessure, l’équipe clinique, en physiothérapie ou en thérapie sportive, peut être un bon point de départ pour vous orienter. L’équipe pourra confirmer le service le plus approprié selon votre situation.
```

### Suggested instruction

```text
Pour douleur/blessure, ne jamais nommer de diagnostic. Dire : “je ne peux pas diagnostiquer; l’équipe clinique, physio ou thérapie sportive, peut vous orienter.”
```

---

## 6. Make gym access / time-slot responses more precise

### Problem

The concierge may invent that a gym time slot can be reserved.

### Required behavior

Do not invent gym-slot booking if the source does not confirm it.

If the source does not mention booking a gym time slot, respond:

```text
Les salles d’entraînement semblent accessibles aux membres sans réservation; pour les exceptions ou l’accès non-membre, il faut confirmer avec l’équipe.
```

### Suggested instruction

```text
Ne jamais affirmer qu’un créneau gym est réservable si la source ne le confirme pas. Dire plutôt : “je ne vois pas de réservation obligatoire pour les salles d’entraînement; confirmez avec l’équipe.”
```

---

## 7. Use official prices for services when known

### Example: buanderie

If the source confirms:

```text
Buanderie: 25 $/mois
```

then the concierge should say:

```text
Le service de buanderie est offert à 25 $/mois selon la source disponible; les conditions d’accès et l’horaire doivent être confirmés.
```

### Rule

If a price is confirmed in source, use it cautiously.

Do not say “price to confirm” when the price is actually available, unless conditions are unclear.

---

## 8. Remove misplaced visit CTAs

### Problem

The CTA “Planifier une visite” still appears in non-visit contexts.

### Ban “Planifier une visite” for these intents

```text
price contradiction
pickleball reservation
clinical problem
cancellation
membership modification
quick info / no form
gym access
service-specific question
restaurant menu
buanderie
Technogym
course access / unlimited / reservation
```

### Required behavior

CTA must be contextual:

* Membership issue → memberships team
* Clinical issue → clinical team
* Restaurant question → restaurant / menu / restaurant phone
* Pickleball → Gigasport / sports booking / team confirmation, if applicable
* Cancellation → official validation / team
* Gym access → membership/access confirmation
* Price contradiction → official team confirmation

---

## 9. Answer multi-category discount questions separately

### Problem

For:

```text
Est-ce que vous offrez des rabais étudiants / corporatifs / familiaux ?
```

the concierge answers only student/senior and ignores corporate/family.

### Required behavior

Answer each category separately:

* Student: confirmed if source confirms.
* Senior: confirmed if relevant and source confirms.
* Corporate: say not confirmed in current source if absent.
* Family: say not confirmed in current source if absent.

### Suggested instruction

```text
Répondre plus directement aux questions multi-catégories : étudiant/corporatif/familial doivent être traités séparément.
```

---

## 10. Keep the fixes that already work

Do not regress:

* Buanderie
* Technogym
* Cancellation
* Membership downgrade / lower plan
* Contextual “oui”
* Prompt-injection refusal from previous rounds
* Payment problem routing

---

# Test Cases and Required Behavior

## #1 — Book pickleball for tomorrow night

### Question / cas testé

Est-ce que je peux booker un terrain de pickelball pour demain soir ?

### Note

2/10

### Pourquoi c’est prioritaire

Gros bug restant : le concierge retourne au message générique “Planifier une visite” au lieu de comprendre une réservation de pickleball.

### Instruction à ajouter à Steve

Si l’utilisateur dit booker / réserver + pickleball / pickball / pickelball / terrain, répondre sur la réservation de pickleball. Ne jamais déclencher le bouton de visite commerciale.

### Expected behavior

* Detect pickleball typo `pickelball`.
* Detect booking/reservation intent.
* Route to `pickleball_reservation_request`.
* Do not trigger “Planifier une visite.”
* Answer about pickleball reservation.
* If availability or non-member conditions are not confirmed, say they must be validated with the team.

---

## #2 — Price contradiction: 215 vs 225

### Question / cas testé

J’ai vu 215 $ sur votre site, mais tu m’as dit 225 $. Lequel est le bon ?

### Note

4/10

### Pourquoi c’est prioritaire

Mauvaise gestion d’une contradiction de prix. Il minimise avec “autour de 225 $” et ajoute un CTA visite inutile.

### Instruction à ajouter à Steve

Si l’utilisateur signale une contradiction de prix, reconnaître clairement l’écart, ne pas dire “autour de”, ne pas ajouter “Planifier une visite”. Répondre : “ma source indique X, si vous voyez Y, il faut confirmer avec l’équipe.”

### Expected behavior

* Detect price contradiction.
* Acknowledge discrepancy.
* State current source price exactly.
* Mention other price may be promotion/outdated/source mismatch.
* Recommend official confirmation.
* Do not show visit CTA.

---

## #3 — Course count: 75 courses

### Question / cas testé

c’est quoi vos 75 cours offerts ?

### Note

4/10

### Pourquoi c’est prioritaire

Erreur de source : le concierge répond “175 cours” alors que la question parle de 75. Risque de mauvaise info envoyée au client.

### Instruction à ajouter à Steve

Verrouiller la donnée officielle. Si la source MAA dit plus de 75 cours/semaine, ne jamais répondre 175 sans preuve officielle.

### Expected behavior

* Use the official confirmed class count.
* If official source says more than 75/week, say more than 75/week.
* Do not say 175 unless officially confirmed.
* Ask what type of course the user wants if full list is not available.

---

## #4 — Yoga included or à la carte

### Question / cas testé

Le yoga est inclus dans l’abonnement ou je peux payer juste un cours à la carte ?

### Note

4/10

### Pourquoi c’est prioritaire

Il invente une possibilité à la carte avec “il semble que ce soit possible”. C’est dangereux côté vérité source.

### Instruction à ajouter à Steve

Si la source dit abonnement obligatoire pour un cours de groupe, ne jamais suggérer l’accès à la carte sans preuve.

### Expected behavior

* Answer whether yoga is included if source confirms.
* If group classes require membership, say membership is required.
* Do not suggest à la carte access unless explicitly confirmed by source.

---

## #5 — Knee pain: physio or trainer

### Question / cas testé

J’ai mal au genou et je veux savoir si je dois voir un physio ou un entraîneur.

### Note

5/10

### Pourquoi c’est prioritaire

Réponse trop médicale. Il nomme des conditions comme arthrite/syndrome patello-fémoral.

### Instruction à ajouter à Steve

Pour douleur/blessure, ne jamais nommer de diagnostic. Dire : “je ne peux pas diagnostiquer; l’équipe clinique, physio ou thérapie sportive, peut vous orienter.”

### Expected behavior

* Do not diagnose.
* Do not mention specific medical conditions.
* Do not strongly recommend one provider.
* Orient generally to clinical team, physiotherapy, or sports therapy.
* Trainer can be mentioned for exercise/prevention after clinical orientation.

---

## #6 — Reserve gym time slot, not a visit

### Question / cas testé

Je veux réserver un créneau au gym, pas une visite. C’est possible ?

### Note

3/10

### Pourquoi c’est prioritaire

Il affirme qu’un créneau gym est possible sans preuve claire.

### Instruction à ajouter à Steve

Ne jamais affirmer qu’un créneau gym est réservable si la source ne le confirme pas. Dire plutôt : “je ne vois pas de réservation obligatoire pour les salles d’entraînement; confirmez avec l’équipe.”

### Expected behavior

* Detect gym time-slot question.
* Respect “pas une visite.”
* Do not show visit CTA.
* Do not invent a reservation option.
* If source says no reservation is required for members, say that clearly.
* Otherwise recommend confirmation.

---

## #7 — Quick info, no form

### Question / cas testé

Je veux juste savoir vite, pas remplir un formulaire.

### Note

6/10

### Pourquoi c’est prioritaire

Il répond trop générique et renvoie au téléphone sans traiter la demande.

### Instruction à ajouter à Steve

Si l’utilisateur refuse un formulaire, répondre directement selon le dernier contexte ou poser une seule question de précision. Ne pas transférer automatiquement au téléphone.

### Expected behavior

* Respect refusal of form.
* Use previous context if available.
* If context is unclear, ask one concise clarification question.
* Do not automatically redirect to phone.
* Do not show visit CTA.

---

## #8 — Student / corporate / family discounts

### Question / cas testé

Est-ce que vous offrez des rabais étudiants / corporatifs / familiaux ?

### Note

6/10

### Pourquoi c’est prioritaire

Il répond seulement aux tarifs étudiant/aîné, mais ignore corporatif/familial.

### Instruction à ajouter à Steve

Répondre à chaque catégorie demandée : étudiant confirmé, aîné confirmé, corporatif/familial non confirmé dans les sources si absent.

### Expected behavior

* Answer student discount separately.
* Answer corporate discount separately.
* Answer family discount separately.
* Mention senior only if relevant or helpful.
* If corporate/family is absent from sources, say not confirmed in current sources.

---

## #9 — Gym access, not a visit

### Question / cas testé

Je veux juste m’entraîner au gym, pas faire une visite. Est-ce que je peux accéder aux salles d’entraînement ?

### Note

6/10

### Pourquoi c’est prioritaire

Il dit “vous pouvez venir sans problème” sans savoir si la personne est membre.

### Instruction à ajouter à Steve

Si l’utilisateur ne dit pas qu’il est membre, ne pas garantir l’accès. Dire : “les membres ont accès; pour non-membres/visiteurs, confirmez avec l’équipe.”

### Expected behavior

* Respect “pas faire une visite.”
* Do not show visit CTA.
* Do not guarantee access if membership status is unknown.
* Say members have access if confirmed.
* For non-members/visitors, recommend confirmation.

---

## #10 — Training rooms without reservation

### Question / cas testé

Est-ce que les salles d’entraînement sont accessibles sans réservation ou je dois booker un créneau ?

### Note

7/10

### Pourquoi c’est prioritaire

La réponse est prudente, mais trop vague.

### Instruction à ajouter à Steve

Si la source dit que les membres peuvent s’entraîner sans réservation, le dire clairement. Garder la validation humaine pour les exceptions.

### Expected behavior

* Give clear answer if source confirms member access without reservation.
* Mention exceptions or non-member access must be confirmed.
* Do not show visit CTA.

---

## #11 — Pickleball reservation as non-member

### Question / cas testé

Pour le pickleball, est-ce que je peux réserver si je ne suis pas membre ?

### Note

7/10

### Pourquoi c’est prioritaire

Il reste trop vague sur membre/non-membre.

### Instruction à ajouter à Steve

Si la source confirme que le pickleball est pour membres ou nécessite réservation/frais, le dire clairement. Ne pas tout renvoyer à l’équipe.

### Expected behavior

* Detect pickleball + non-member access/reservation.
* State confirmed membership/access requirements if source has them.
* If source does not confirm non-member access, say only that part must be validated.
* Do not imply pickleball itself is unknown.
* Do not show visit CTA.

---

## #12 — Pickleball member-only or à la carte

### Question / cas testé

Le pickleball, c’est réservé aux membres ou je peux venir à la carte ?

### Note

7/10

### Pourquoi c’est prioritaire

Même problème : réponse correcte mais trop floue.

### Instruction à ajouter à Steve

Ajouter une règle : pickleball = service connu, réservation requise, conditions/frais à confirmer; ne pas répondre seulement “appelez”.

### Expected behavior

* Treat pickleball as known service if source confirms.
* Explain known access/reservation/family conditions.
* If à la carte/non-member access is not confirmed, say so clearly.

---

## #13 — Weight loss and fitness program

### Question / cas testé

Je veux perdre du poids et avoir un programme de remise en forme. Comment ça marche ?

### Note

7/10

### Pourquoi c’est prioritaire

Il mentionne massothérapie/physio trop vite au lieu de prioriser entraînement/nutrition.

### Instruction à ajouter à Steve

Pour perte de poids/remise en forme, prioriser entraîneur personnel + nutrition + cours/gym, puis mentionner autres services seulement si pertinent.

### Expected behavior

* Treat as fitness/wellness orientation.
* Prioritize:

  * personal trainer
  * nutrition
  * classes/gym
* Do not lead with massage/physio unless the user mentions pain/injury.
* Avoid personalized health advice.

---

## #14 — Weight loss and fitness program with typo

### Question / cas testé

je veux perdre du poids et avoir un progrsamme de remise en forme. comment ca marche ?

### Note

7/10

### Pourquoi c’est prioritaire

Même bug que ci-dessus, malgré les fautes.

### Instruction à ajouter à Steve

Même instruction : perte de poids = entraînement personnel/nutrition en priorité, pas masso/physio en premier.

### Expected behavior

* Detect typos.
* Same as #13.

---

## #15 — What is included in membership

### Question / cas testé

Qu’est-ce qui est inclus dans l’abonnement au Club Sportif MAA ?

### Note

8/10

### Pourquoi c’est prioritaire

Bonne réponse, mais le restaurant est présenté d’une façon qui peut faire croire qu’il est “inclus”.

### Instruction à ajouter à Steve

Distinguer “inclus dans l’abonnement” vs “disponible sur place”. Le restaurant n’est pas un avantage inclus; il est sur place.

### Expected behavior

* List membership inclusions only as inclusions.
* Mention restaurant separately as “available/on site,” not included as a benefit.
* Avoid implying restaurant meals are included.

---

## #16 — English prices and booking

### Question / cas testé

What are your prices and can I book in English?

### Note

8/10

### Pourquoi c’est prioritaire

Beaucoup mieux, mais le CTA reste en français et les prix sont “around”.

### Instruction à ajouter à Steve

En anglais, tout doit rester en anglais. Donner les prix publics exacts si disponibles, pas “around”, puis préciser confirmation officielle.

### Expected behavior

* Answer fully in English.
* Do not include French CTA.
* Do not say “around” if exact public price exists in source.
* Answer both price and booking.
* Mention official confirmation.

---

## #17 — Modify plan but no salesperson

### Question / cas testé

Je veux modifier mon forfait, mais je ne veux pas parler à un vendeur. Quelles sont mes options ?

### Note

8/10

### Pourquoi c’est prioritaire

Bonne gestion, mais il ne respecte pas complètement “je ne veux pas parler à un vendeur”.

### Instruction à ajouter à Steve

Donner les options publiques connues, puis dire que la modification officielle doit être validée par l’équipe des adhésions.

### Expected behavior

* Respect user preference not to talk to a salesperson.
* Give known public options generally.
* Still explain official modification must be validated by memberships team.
* Avoid sales CTA.

---

## #18 — Spa with mother, non-members

### Question / cas testé

Je veux aller au spa avec ma mère, mais on n’est pas membres. Est-ce possible ?

### Note

8/10

### Pourquoi c’est prioritaire

Bonne prudence. À préciser davantage entre spa et soins payants.

### Instruction à ajouter à Steve

Distinguer accès libre aux installations spa vs services payants comme massothérapie.

### Expected behavior

* Distinguish spa amenities from paid spa/massotherapy services.
* If non-member access is not confirmed, say so.
* Do not imply access without membership unless source confirms.

---

## #19 — Mother-daughter spa package without membership

### Question / cas testé

Avez-vous un forfait spa détente mère-fille même si je n’ai pas d’abonnement ?

### Note

8/10

### Pourquoi c’est prioritaire

Bonne réponse, mais ne doit pas laisser croire qu’un forfait existe si non confirmé.

### Instruction à ajouter à Steve

Si aucun forfait mère-fille n’est dans les sources, dire clairement : “je ne vois pas de forfait spécifique confirmé.”

### Expected behavior

* Detect spa package + non-member access.
* Do not invent package.
* If no mother-daughter package is confirmed, say so clearly.
* Offer team validation.

---

## #20 — Restaurant menu this week

### Question / cas testé

pis est-ce que je peux savoir vos menus cette semaine pour le resto

### Note

8/10

### Pourquoi c’est prioritaire

Bonne réponse, mais il devrait donner le vrai lien officiel du menu si la source l’a.

### Instruction à ajouter à Steve

Pour le restaurant, utiliser le vrai lien du menu officiel quand disponible.

### Expected behavior

* Use official menu link if available.
* Ensure link is clickable and placed cleanly.
* If weekly menu varies, recommend confirming with restaurant.

---

## #21 — Vague circus request

### Question / cas testé

jaurais une demande concernant le cirque

### Note

8/10

### Pourquoi c’est prioritaire

Bonne réponse, mais pourrait mieux gérer la demande vague.

### Instruction à ajouter à Steve

Si la demande est vague, proposer les axes utiles : horaire, niveau, inscription, âge, débutant/intermédiaire.

### Expected behavior

* Ask what the circus request concerns.
* Offer categories:

  * schedule
  * level
  * registration
  * age
  * beginner/intermediate
  * pricing, if source has it

---

## #22 — Group classes included

### Question / cas testé

Est-ce que l’abonnement donne accès aux cours de groupe ?

### Note

8/10

### Pourquoi c’est prioritaire

Bonne réponse. Peut être plus directe.

### Instruction à ajouter à Steve

Répondre d’abord “oui, l’abonnement donne accès aux cours de groupe”, puis préciser les exceptions possibles.

### Expected behavior

* Start with direct answer.
* Mention exceptions only after direct answer.
* Do not overcomplicate.

---

## #23 — Pickleball weekly availability

### Question / cas testé

Le pickleball a combien de disponibilités par semaine environ ?

### Note

8/10

### Pourquoi c’est prioritaire

Réponse prudente correcte.

### Instruction à ajouter à Steve

Si un horaire officiel existe dans la base, donner les plages générales et ajouter “à confirmer”.

### Expected behavior

* If schedule exists, provide general slots.
* If not, say exact weekly availability must be confirmed.
* Do not say pickleball is unknown.

---

## #24 — Laundry included or extra

### Question / cas testé

La buanderie est-tu incluse avec mon abonnement ou je dois payer en plus ?

### Note

9/10

### Pourquoi c’est prioritaire

Très bon, mais pourrait donner le prix officiel si confirmé.

### Instruction à ajouter à Steve

Si la source indique 25 $/mois, répondre : “service distinct à 25 $/mois, conditions à confirmer.”

### Expected behavior

* Treat buanderie as known service if source confirms.
* If price is confirmed, give 25 $/month cautiously.
* Clarify it is a distinct paid service, not necessarily included.

---

## #25 — Buanderie typo

### Question / cas testé

avez vous un service de buandrie?

### Note

9/10

### Pourquoi c’est prioritaire

Bon. Le correctif faute fonctionne.

### Instruction à ajouter à Steve

Garder la règle buandrie/lavage/linge = buanderie. Ajouter le prix si confirmé.

### Expected behavior

* Keep behavior.
* Use buanderie typo matching.
* Add confirmed price if source includes it.

---

## #26 — Laundry / lavage wording

### Question / cas testé

Je veux faire mon lavage au club, comment ça marche

### Note

9/10

### Pourquoi c’est prioritaire

Bon. Comprend “lavage”.

### Instruction à ajouter à Steve

Garder la règle “lavage” = buanderie.

### Expected behavior

* Keep behavior.
* Do not frame as public laundromat.
* Explain Club/member-related conditions.

---

## #27 — Technogym evaluation included

### Question / cas testé

Est-ce que l’évaluation Technogym est incluse avec l’abonnement ?

### Note

9/10

### Pourquoi c’est prioritaire

Bon. Le bug Technogym semble corrigé.

### Instruction à ajouter à Steve

Garder la règle : Technogym/Checkup Technogym doit toujours répondre sur Technogym, jamais sortir la grille tarifaire.

### Expected behavior

* Keep behavior.
* Do not regress.

---

## #28 — Technogym Checkup included or separate

### Question / cas testé

Je veux faire le Technogym Checkup. Est-ce que c’est inclus ou je dois payer séparément ?

### Note

9/10

### Pourquoi c’est prioritaire

Bon. Réponse prudente.

### Instruction à ajouter à Steve

Garder. Répondre d’abord sur Technogym, puis préciser conditions/inclusion à confirmer.

### Expected behavior

* Keep behavior.
* Do not output pricing grid.

---

## #29 — “oui” after clinical question

### Question / cas testé

oui après la question clinique

### Note

9/10

### Pourquoi c’est prioritaire

Bon. Le contexte est conservé.

### Instruction à ajouter à Steve

Après un “oui”, avancer seulement si une transmission ou une action a été proposée juste avant.

### Expected behavior

* Keep contextual yes behavior.
* Move forward only if the previous assistant turn offered an action/transmission.

---

## #30 — Membership too expensive, lower without visit

### Question / cas testé

Mon abonnement coûte trop cher, je veux le baisser sans prendre rendez-vous pour une visite.

### Note

10/10

### Pourquoi c’est prioritaire

Très bon.

### Instruction à ajouter à Steve

Garder comme modèle pour modification/baisse d’abonnement.

### Expected behavior

* Keep as model response.
* Do not regress.

---

## #31 — Current membership downgrade

### Question / cas testé

Je peux changer mon abonnement actuel pour un abonnement plus bas ?

### Note

10/10

### Pourquoi c’est prioritaire

Très bon.

### Instruction à ajouter à Steve

Garder comme réponse modèle.

### Expected behavior

* Keep as model response.
* Do not regress.

---

## #32 — Cancellation typo

### Question / cas testé

e veux annuler mon abonnement

### Note

10/10

### Pourquoi c’est prioritaire

Très bon. Il comprend malgré la faute.

### Instruction à ajouter à Steve

Garder.

### Expected behavior

* Keep typo-tolerant cancellation detection.
* Do not regress.

---

## #33 — Uppercase cancellation

### Question / cas testé

JE VEUX ANNULER

### Note

10/10

### Pourquoi c’est prioritaire

Très bon. Les majuscules ne brisent pas l’intention.

### Instruction à ajouter à Steve

Garder.

### Expected behavior

* Keep uppercase cancellation detection.
* Do not regress.

---

# New / Strengthened Intents

```text
pickleball_reservation_request
price_contradiction_question
course_count_question
yoga_included_or_a_la_carte
clinical_pain_orientation
gym_time_slot_question
quick_info_no_form_contextual
discount_multi_category_question
gym_access_member_status_unknown
pickleball_non_member_access
pickleball_a_la_carte_question
fitness_weight_loss_program
membership_inclusions_question
english_pricing_booking_full_language
membership_modification_no_salesperson
spa_non_member_access
spa_package_unconfirmed
restaurant_menu_weekly
vague_circus_request
group_classes_included_question
laundry_paid_service_question
```

---

# Global Rules to Add

## Rule 1 — Pickleball booking blocks visit CTA

If user asks to book/reserve pickleball:

```text
booker pickleball
réserver pickleball
booker terrain pickball
réserver terrain pickelball
pickle ball demain soir
```

Then:

* Route to pickleball reservation.
* Never show “Planifier une visite.”

---

## Rule 2 — Price contradiction handling

If the user says:

```text
j’ai vu X mais tu dis Y
lequel est bon
pourquoi le site dit X
```

Then:

* Recognize contradiction.
* State current source value.
* Do not say “around/autour de.”
* Do not show visit CTA.
* Recommend official confirmation.

---

## Rule 3 — Source lock for course count

If source says:

```text
plus de 75 cours/semaine
```

then never answer:

```text
plus de 175 cours
```

unless a confirmed official source supports 175.

---

## Rule 4 — Membership-required classes block à la carte claims

If source says membership is required for group classes, do not suggest à la carte/non-member access without explicit source support.

---

## Rule 5 — No medical diagnosis or named conditions

For pain/injury questions:

* Do not name diagnoses.
* Do not strongly recommend one service.
* Use clinical orientation language.

---

## Rule 6 — Do not invent gym time-slot reservations

Only mention gym time-slot booking if source confirms it.

If not confirmed, say:

```text
Je ne vois pas de réservation obligatoire pour les salles d’entraînement; confirmez avec l’équipe pour les exceptions.
```

---

## Rule 7 — Use confirmed service prices

If source confirms service price, use it.

Example:

```text
Buanderie: 25 $/mois
```

Answer:

```text
Le service de buanderie est offert à 25 $/mois selon la source disponible; les conditions d’accès et l’horaire doivent être confirmés.
```

---

## Rule 8 — Visit CTA must be contextual only

Never show “Planifier une visite” for:

```text
price contradiction
pickleball reservation
clinical issue
cancellation
membership modification
quick info no form
gym access
restaurant menu
buanderie
Technogym
course access
```

---

## Rule 9 — Multi-category questions require category-by-category answers

For questions like:

```text
rabais étudiants / corporatifs / familiaux
```

Answer each category separately.

---

## Rule 10 — Keep strong behaviors as regression tests

Add regression tests for the 9/10 and 10/10 cases:

* Buanderie typo
* Lavage
* Technogym included
* Technogym Checkup
* Contextual oui
* Membership downgrade
* Cancellation typo
* Uppercase cancellation

---

# Recommended Implementation Order

## Phase 1 — Fix remaining critical routing bugs

Implement first:

1. Pickleball booking/reservation must not trigger visit CTA.
2. Price contradiction handling.
3. Course count source lock: 75 vs 175.
4. Yoga à la carte / membership-required rule.
5. Clinical pain wording: no diagnosis, no named conditions.

Relevant cases:

* #1
* #2
* #3
* #4
* #5

---

## Phase 2 — Fix access and CTA precision

Implement:

1. Gym time-slot question.
2. Quick info / no form contextual response.
3. Multi-category discount handling.
4. Gym access with unknown membership status.
5. Pickleball non-member and à la carte clarity.

Relevant cases:

* #6
* #7
* #8
* #9
* #10
* #11
* #12

---

## Phase 3 — Improve service-specific answers

Implement:

1. Weight loss / fitness program prioritization.
2. Membership inclusions: distinguish included vs on-site.
3. English pricing and booking fully in English.
4. Membership modification without salesperson.
5. Spa non-member / spa package precision.
6. Restaurant menu link.
7. Vague circus request.
8. Group classes included direct answer.
9. Pickleball weekly availability if official schedule exists.
10. Buanderie paid-service price.

Relevant cases:

* #13 through #24

---

## Phase 4 — Preserve working fixes

Do not regress:

* #25 — buanderie typo
* #26 — lavage
* #27 — Technogym evaluation
* #28 — Technogym Checkup
* #29 — contextual oui
* #30 — lower membership without visit
* #31 — current membership downgrade
* #32 — cancellation typo
* #33 — uppercase cancellation

---

# Suggested Claude Code Prompt

Use this prompt after adding this file to the project:

```text
Read docs/claude-tasks/maa-chatbot-sixth-pass-final-pre-demo-fixes.md.

This is the final ChatGPT-assisted review before manual conversational testing. The system has improved a lot, but several precise routing/source-truth bugs remain.

First inspect the codebase and identify:
- intent detection logic
- direct keyword/variant mapping
- source retrieval / knowledge base logic
- fallback behavior
- CTA/button gating logic
- context handling between turns
- language/localization handling
- health/clinical response templates
- pricing/source conflict handling
- test files

Implement Phase 1 only:
1. Pickleball booking/reservation must not trigger “Planifier une visite”
2. Price contradiction handling: 215 vs 225
3. Course count source lock: 75 vs 175
4. Yoga à la carte / membership-required source rule
5. Clinical pain wording: no diagnosis, no named conditions

Critical requirements:
- If user says booker/réserver + pickleball/pickball/pickelball/pickle ball/terrain, route to pickleball reservation, never visit planning.
- If user says “I saw X but you said Y,” acknowledge the price discrepancy, state current source, do not say “around/autour de,” and do not show visit CTA.
- If source says more than 75 classes/week, never answer 175 unless an official source confirms 175.
- If source says membership is required for group classes, never suggest yoga/course à la carte access without explicit source support.
- For pain/injury/knee/physio/trainer questions, do not diagnose, do not name medical conditions, and use cautious clinical orientation language.
- Add or update tests for exact cases #1, #2, #3, #4, and #5.
- Add regression tests or ensure existing tests still cover the 9/10 and 10/10 cases listed in Phase 4.

Run the relevant tests.

Then summarize:
1. Files changed
2. Intent/direct-match logic changed
3. Source-truth or fallback logic changed
4. CTA gating changed
5. Tests added or updated
6. Remaining risks before manual conversational testing
```

---

# Acceptance Criteria

This sixth pass is successful only if:

* Pickleball booking/reservation never triggers “Planifier une visite.”
* Pickleball typo variants are recognized: pickball, pickelball, pickle ball.
* Price contradictions are acknowledged clearly without “around/autour de.”
* Price contradiction answers do not show visit CTA.
* Class count uses the confirmed official source, currently more than 75/week unless 175 is officially confirmed.
* Yoga/group-class à la carte access is not suggested when source says membership is required.
* Clinical pain answers do not name diagnoses or medical conditions.
* Gym time-slot answers do not invent reservations.
* Quick-info/no-form requests do not automatically go to phone or visit CTA.
* Discount questions answer student, corporate, and family separately.
* Gym access answers do not guarantee access if membership status is unknown.
* Known service prices like buanderie 25 $/month are used if confirmed.
* English price/booking answers remain fully in English.
* All working 9/10 and 10/10 behaviors remain stable.
