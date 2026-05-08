# MAA Chatbot — Fourth Pass Fixes

## Purpose

This document summarizes the fourth round of MAA chatbot and phone-concierge testing.

The key finding: **security and sensitive-intent handling are much better now**. The remaining problems are mostly about:

* Fine-grained intent routing
* Knowledge base alignment with the official MAA website
* CTA/button routing
* Chat vs phone consistency
* Voice interruption behavior
* Correctly answering precise inclusion/access questions

---

# Executive Summary

## First observation

The security fixes clearly improved the critical cases.

The remaining issue is no longer mainly “security.” It is now mostly:

```text
intent routing + knowledge base not aligned enough with the official site
```

The concierge has improved significantly on sensitive cases, including:

* Cancellation
* Immediate reservation request
* Guarantee of a spot or appointment
* Request to speak with a human
* AI manipulation / prompt injection
* Privacy
* Payment problems
* Direct contact with management

Before, many of these requests triggered the wrong automatic message, like:

```text
Avec plaisir, cliquez sur le bouton...
```

In V4, these cases are now mostly blocked or redirected to a human. This is a real structural improvement.

---

# Technical Progress

The main improvement appears to come from moving some security and CTA logic into the backend.

The system no longer relies only on generated text to decide whether to show:

```text
Planifier une visite
```

Protections were also added for sensitive intents and regression tests.

According to the notes:

```text
MAA tests: 37/37 passing
DUBUB tests: 12/12 passing
Total: 49/49 passing
```

This is good progress and should not regress.

---

# Remaining Problem

The concierge still struggles with fine intent understanding.

It sometimes answers with:

* A full price grid when the user asked about a specific included service
* A generic button when the user asked a precise question
* A callback/phone CTA instead of answering simply
* The wrong source answer when the official site appears to say otherwise

The biggest remaining weak cases from this test pass include:

* Technogym / Checkup Technogym
* Course access: unlimited vs reservation per class
* Spa / sauna / steam room / hot tub access
* Appointment with trainer or specialist
* English question with two intents: price + booking
* Laundry service / buanderie
* Restaurant menu
* Pickleball
* Chat vs phone inconsistency

---

# Source-of-Truth / Knowledge Base Alignment

The MAA knowledge base may be out of sync with the official website.

According to the testing notes, the official indexed site indicates items such as:

* Full evaluation with Checkup Technogym
* Special rate at 215 $/month
* More than 75 classes per week
* Pool access
* Technogym equipment
* Laundry service at 25 $/month
* Pickleball court
* Included spa installations
* Steam room
* Sauna
* Hot tub
* Day lockers

But in tests, the concierge often replies with older or conflicting information, such as:

* 225 $/month
* 195 $ student
* Full tariff grid instead of answering the actual question
* Ignoring Technogym completely
* Saying laundry/menu/pickleball are not available or not visible

## Required action

Before sending the demo, update and clean the MAA source of truth.

Specifically review and sync:

```text
215 $/month
student pricing 185 $
monthly pricing 285 $
Checkup Technogym included
Technogym equipment
more than 75 classes/week
laundry service 25 $
pickleball confirmed
spa/sauna/steam/hot tub included
pool access
restaurant menu link/source
```

Important: only update these if they are confirmed by the approved official sources.

---

# Progress vs Regression

## Clear progress

The concierge is much safer than before.

Improved areas:

* Security refusals
* Impossible promise refusal
* Cancellation handling
* Urgent request handling
* External price caution
* Payment problems
* Management contact protection
* Privacy

## Remaining weakness / regression

The concierge may now be too defensive or too button/phone oriented.

Instead of answering simply, it sometimes redirects.

When trigger words like these appear:

```text
abonnement
réserver
prix
included
book
```

They can override the real question.

Example:

The user asks whether Technogym is included.

Incorrect behavior:

```text
Show full membership price grid + Planifier une visite
```

Correct behavior:

```text
Answer only whether Technogym / Checkup Technogym is included, or say the source does not confirm it.
```

---

# Clear Recommendation Before Demo

Do not rebuild the whole system.

Do one final targeted correction for precise, non-sensitive intents:

Create priority routing rules for:

```text
Technogym
included / non-included questions
unlimited classes / class booking
spa / sauna / steam room / hot tub
trainer / specialist appointment
English multi-intent questions
laundry / buanderie
pickleball
restaurant menu
```

Add a global rule:

```text
If the user asks “is X included?”, answer about X only. Never output the full tariff grid unless the user directly asks for pricing.
```

Add another global rule:

```text
If the user reformulates or corrects the concierge, stay on the same topic.
```

Example:

```text
User: non je parle de la buanderie
Correct: Continue about buanderie.
Incorrect: Jump to basketball, visit booking, or full pricing.
```

---

# Phone-Specific Issues

## 1. The phone concierge interrupts the user

Observed issue:

```text
Elle me coupe la parole.
```

Required behavior:

* Improve interruption / barge-in handling.
* Stop speaking quickly when the user starts talking.
* Use shorter phone responses.
* Do not continue talking over the user.

Suggested instruction:

```text
En mode téléphone, si l’utilisateur commence à parler, arrêter rapidement la réponse et écouter. Réduire la longueur des réponses vocales. Ne pas parler par-dessus l’utilisateur.
```

---

## 2. Chat and phone do not always say the same thing

Observed inconsistencies:

* Student-related answer differs between chat and phone.
* Trial / “essai avant de devenir membre” differs between chat and phone.
* Phone may say yes while chat says no.

Required behavior:

* Chat and phone must use the same source of truth.
* Do not have separate outdated pricing/access logic for voice.
* Trial passes, guest access, student pricing, and membership benefits must be consistent across channels.

Suggested instruction:

```text
Vérifier pourquoi les réponses chat et téléphone diffèrent. Le chat et l’appel doivent utiliser la même source de vérité pour les prix, rabais étudiants, essais, accès invités, services inclus et conditions d’abonnement.
```

---

## 3. Restaurant menu causes bugs

Observed issue:

```text
Demander menu elle bug.
```

Chat issue:

* For laundry/menu, the concierge says they do not exist, but they do.
* Link is not clickable and positioned awkwardly.
* If the user has access to the menu link, the concierge should also know it from approved sources.

Required behavior:

* Add the restaurant menu source if approved.
* Ensure links are clickable in chat.
* Place menu links cleanly in the answer.
* Do not claim menu does not exist or is unavailable unless confirmed.

Suggested instruction:

```text
Si l’utilisateur demande le menu du restaurant, utiliser la source officielle approuvée si disponible. Le lien doit être cliquable et placé clairement. Ne pas affirmer que le menu n’existe pas ou n’est pas en ligne sans certitude.
```

---

# Priority Test Cases

## #1 — Technogym included with membership

### Priority

1

### Question

Est-ce que l'évaluation Technogym est incluse avec l'abonnement ?

### Réponse du concierge

Voici nos tarifs d'abonnement actuels

Abonnement 1 an 225 par mois pour un terme de 1 an

Abonnement senior 70 ans et plus, terme de 1 an 185 par mois

Abonnement étudiant 25 ans et moins, terme de 1 an 195 par mois

Abonnement mensuel 295 par mois

Les frais d'initiation sont présentement offerts gratuitement 0, une valeur de 250.

L'adhésion comprend l'accès à la piscine.

Les tarifs et promotions peuvent changer. Nous vous recommandons d'appeler pour confirmer les prix actuels.

Prochaine étape ? Planifier une visite

### Note

1/10

### Recommandation d’instruction

Si l'utilisateur demande Technogym, ne jamais répondre avec la grille tarifaire. Répondre directement Technogym. Si l'information n'est pas dans les sources, dire : “Je ne vois pas cette information dans mes sources actuelles; je recommande de confirmer avec l'équipe.”

### Expected behavior

* Detect Technogym / Checkup Technogym intent.
* Do not output the tariff grid.
* Do not show “Planifier une visite” unless the user asks to visit.
* Answer whether Technogym / evaluation is included only if confirmed by source.
* If uncertain, say current sources do not confirm it and recommend validation.

---

## #2 — Repeated Technogym included question

### Priority

2

### Question

Est-ce que l'évaluation Technogym est incluse avec l'abonnement ?

### Réponse du concierge

Voici nos tarifs d'abonnement actuels

Abonnement 1 an 225 par mois pour un terme de 1 an

Abonnement senior 70 ans et plus, terme de 1 an 185 par mois

Abonnement étudiant 25 ans et moins, terme de 1 an 195 par mois

Abonnement mensuel 295 par mois

Les frais d'initiation sont présentement offerts gratuitement 0, une valeur de 250.

L'adhésion comprend l'accès à la piscine.

Les tarifs et promotions peuvent changer. Nous vous recommandons d'appeler pour confirmer les prix actuels.

Prochaine étape ? Planifier une visite

### Note

1/10

### Recommandation d’instruction

Même bug répété. Ajouter une règle de priorité : Technogym, évaluation Technogym, bilan Technogym, programme Technogym doivent router vers l'intention évaluation/technologie d'entraînement, pas tarifs d'abonnement.

### Expected behavior

* Add priority intent for:

  * Technogym
  * Évaluation Technogym
  * Bilan Technogym
  * Programme Technogym
  * Checkup Technogym
* Route to training technology/evaluation intent.
* Never route directly to full pricing grid just because “abonnement” appears.

---

## #3 — User asks whether Technogym is included

### Priority

3

### Question

je veux savoir si technogym est inclus avec labonnement

### Réponse du concierge

Voici nos tarifs d'abonnement actuels

Abonnement 1 an 225 par mois pour un terme de 1 an

Abonnement senior 70 ans et plus, terme de 1 an 185 par mois

Abonnement étudiant 25 ans et moins, terme de 1 an 195 par mois

Abonnement mensuel 295 par mois

Les frais d'initiation sont présentement offerts gratuitement 0, une valeur de 250.

L'adhésion comprend l'accès à la piscine.

Les tarifs et promotions peuvent changer. Nous vous recommandons d'appeler pour confirmer les prix actuels.

Prochaine étape ? Planifier une visite

### Note

1/10

### Recommandation d’instruction

Si l'utilisateur répète “je veux savoir si X est inclus”, répondre X uniquement. Ne pas redonner les prix.

### Expected behavior

* Detect `included_question`.
* Extract X = Technogym.
* Answer only whether X is included.
* Do not list membership prices.
* Do not show visit CTA.

---

## #4 — Unlimited classes or booking required

### Priority

4

### Question

Est-ce que les cours sont illimités ou faut-il réserver chaque séance ?

### Réponse du concierge

Avec plaisir. Cliquez sur le bouton ci-dessous pour planifier votre visite. Vous préférez qu'on vous contacte ? Je peux aussi prendre vos coordonnées ici.

### Note

1/10

### Recommandation d’instruction

Si l'utilisateur demande illimité ou réservation, ne jamais déclencher le CTA de visite. Répondre : “Je ne vois pas si les cours sont illimités ou si chaque séance doit être réservée; il faut confirmer selon le type de cours.”

### Expected behavior

* Detect class access/reservation policy intent.
* Do not trigger visit CTA.
* Do not confuse class reservation with visit booking.
* If not confirmed, state that course rules may vary by class and must be confirmed.

---

## #5 — Spa/sauna/steam/hot tub access included

### Priority

5

### Question

Est-ce que l'abonnement donne accès aux installations de spa comme sauna, vapeur ou bain remous ?

### Réponse du concierge

Voici nos tarifs d'abonnement actuels

Abonnement 1 an 225 par mois pour un terme de 1 an

Abonnement senior 70 ans et plus, terme de 1 an 185 par mois

Abonnement étudiant 25 ans et moins, terme de 1 an 195 par mois

Abonnement mensuel 295 par mois

Les frais d'initiation sont présentement offerts gratuitement 0, une valeur de 250.

L'adhésion comprend l'accès à la piscine.

Les tarifs et promotions peuvent changer. Nous vous recommandons d'appeler pour confirmer les prix actuels.

### Note

1/10

### Recommandation d’instruction

Si l'utilisateur demande sauna, vapeur, bain remous ou spa, ne pas répondre avec les tarifs. Router vers l'intention installations spa incluses ou non.

### Expected behavior

* Detect spa/amenities included intent.
* Answer about sauna, steam room, hot tub, spa access only.
* Do not list pricing.
* Do not trigger visit CTA.
* If source confirms inclusion, say it cautiously and recommend confirming conditions.
* If uncertain, say current sources do not confirm it.

---

## #6 — English multi-intent: prices and booking

### Priority

6

### Question

What are your prices and can I book in English?

### Réponse du concierge

Happy to help. Click the button below to visit our booking page and schedule your visit. Prefer to have us reach out instead? I can capture your contact info here.

### Note

2/10

### Recommandation d’instruction

En anglais, répondre aux deux intentions prix + réservation. Ne pas ignorer la question sur les prix. Exemple : “Our membership prices start at…” puis “Booking can be guided in English, but confirmation must come through the official team/system.”

### Expected behavior

* Reply in English.
* Detect both intents:

  * pricing question
  * booking in English
* Answer both.
* Use approved pricing only.
* Do not only trigger booking CTA.
* Explain that booking can be guided in English but final confirmation must come through the official team/system.

---

## #7 — Informal follow-up: unlimited or not

### Priority

7

### Question

c'est tu illimité ou pas

### Réponse du concierge

Bien sûr. Utilisez le bouton ci-dessous pour continuer par téléphone. Je peux aussi vous rappeler si vous préférez.

### Note

2/10

### Recommandation d’instruction

Si l'utilisateur reformule en langage familier “c'est-tu illimité ou pas”, répondre directement à l'intention précédente. Ne pas remplacer la réponse par un bouton téléphone.

### Expected behavior

* Preserve previous context.
* Interpret as follow-up to class unlimited/reservation question if that was the previous topic.
* Answer directly or say the information is not confirmed.
* Do not replace answer with phone/callback button.

---

## #8 — Weight loss / fitness program

### Priority

8

### Question

je veux perdre du poids et avoir un programme de remise en forme. comment ca marche ?

### Réponse du concierge

Avec plaisir. Cliquez sur le bouton ci-dessous pour planifier votre visite. Vous préférez qu'on vous contacte ? Je peux aussi prendre vos coordonnées ici.

### Note

2/10

### Recommandation d’instruction

Si l'utilisateur parle perte de poids/remise en forme, poser des questions sur objectifs, niveau, préférences, puis orienter vers entraînement personnel/cours/évaluation. Ne pas lancer directement le CTA visite.

### Expected behavior

* Detect fitness/weight-loss program intent.
* Ask 1–3 clarification questions:

  * goal
  * current level
  * frequency
  * preference for trainer/classes/gym/evaluation
* Avoid medical promises or personalized health advice.
* Do not immediately trigger visit CTA.

---

## #9 — Appointment with trainer or specialist

### Priority

9

### Question

Comment prendre rendez-vous avec un entraîneur ou un spécialiste ?

### Réponse du concierge

Avec plaisir. Cliquez sur le bouton ci-dessous pour planifier votre visite. Vous préférez qu'on vous contacte ? Je peux aussi prendre vos coordonnées ici.

### Note

3/10

### Recommandation d’instruction

Si l'utilisateur demande un rendez-vous avec entraîneur/spécialiste, ne pas répondre avec “Planifier une visite”. Répondre à l’intention rendez-vous professionnel : préciser que l’assistant peut guider ou transmettre la demande, mais que le rendez-vous doit être confirmé par l’équipe ou le système officiel.

### Expected behavior

* Detect trainer/specialist appointment intent.
* Do not treat it as generic club visit planning.
* Explain how to request an appointment.
* Do not confirm appointment directly.
* Final confirmation must come from team/system.

---

# New Priority Intents to Add or Strengthen

```text
technogym_included_question
included_benefit_question
class_unlimited_or_reservation_question
spa_amenities_access_question
trainer_specialist_appointment_question
english_multi_intent_pricing_booking
informal_followup_context_question
fitness_program_question
laundry_service_question
restaurant_menu_question
pickleball_service_question
```

---

# Global Routing Rules

## Rule 1 — “Is X included?” must answer X only

If the user asks:

```text
est-ce que X est inclus
X est-il inclus
is X included
ça donne accès à X
l'abonnement donne accès à X
```

Then:

* Extract X.
* Answer about X only.
* Do not output full membership price grid.
* Do not trigger visit CTA unless the user also clearly asks to visit.

---

## Rule 2 — Specific service beats broad membership/pricing

If the message contains both:

```text
abonnement
```

and a specific service like:

```text
Technogym
sauna
vapeur
bain remous
spa
cours
entraîneur
spécialiste
buanderie
pickleball
menu
```

Then the specific service intent wins.

Do not route to generic membership pricing unless the user directly asks for prices.

---

## Rule 3 — Class reservation is not visit booking

If the user asks about:

```text
cours illimités
réserver chaque séance
réservation de cours
class booking
unlimited classes
```

Do not trigger “Planifier une visite.”

Answer about class rules or say they vary by course and must be confirmed.

---

## Rule 4 — Spa amenities are not pricing questions

If the user asks about:

```text
spa
sauna
vapeur
bain remous
hot tub
steam room
```

Answer about access/inclusion/conditions.

Do not output full tariff grid.

---

## Rule 5 — English multi-intent must answer all parts

If the user writes in English and asks two questions, answer both in English.

Example:

```text
What are your prices and can I book in English?
```

Required structure:

1. Pricing answer with approved/cautious pricing.
2. Booking answer in English.
3. Reminder that booking confirmation must come through the official team/system.

---

## Rule 6 — Informal follow-ups preserve context

If user says:

```text
c'est tu illimité ou pas
pis ça
ok mais inclus ou non
non je parle de X
```

Use the previous topic.

Do not replace with phone/callback CTA.

---

## Rule 7 — Phone and chat must use the same source of truth

Chat and phone should not disagree on:

* Student pricing
* Trial passes
* Guest access
* Membership benefits
* Included services
* Laundry
* Restaurant menu
* Pickleball
* Technogym

---

# Recommended Implementation Order

## Phase 1 — Intent routing for included/service questions

Implement first:

1. Technogym / Checkup Technogym included
2. Generic “is X included?” extraction
3. Spa / sauna / steam / hot tub access
4. Courses unlimited vs reservation required
5. Trainer/specialist appointment

Relevant cases:

* #1
* #2
* #3
* #4
* #5
* #9

---

## Phase 2 — Multi-intent and context handling

Implement:

1. English multi-intent: prices + booking
2. Informal follow-up context: “c’est-tu illimité ou pas”
3. Reformulation/correction handling

Relevant cases:

* #6
* #7

---

## Phase 3 — Knowledge base synchronization

Review and sync approved sources for:

* Technogym / Checkup Technogym
* Current pricing
* Student pricing
* Monthly pricing
* More than 75 classes/week
* Laundry service
* Pickleball
* Spa / sauna / steam / hot tub
* Restaurant menu
* Trial pass / guest access

Do not hard-code uncertain claims unless official approved sources confirm them.

---

## Phase 4 — Phone consistency and voice UX

Implement or configure:

1. Chat and phone same source of truth.
2. Shorter voice answers.
3. Better interruption/barge-in behavior.
4. Restaurant menu bug fix.
5. Clickable/clean menu link placement in chat.

---

# Suggested Claude Code Prompt

Use this prompt after adding this file to the project:

```text
Read docs/claude-tasks/maa-chatbot-fourth-pass-fixes.md.

This is the fourth round of testing. Security and sensitive intent handling improved significantly. The remaining issues are mostly fine intent routing and source-of-truth alignment with the MAA website.

First inspect the codebase and identify:
- intent detection logic
- prompt/system rules
- response templates
- fallback behavior
- automatic CTA/button logic
- source retrieval / knowledge base logic
- chat vs phone configuration differences
- context handling between turns
- test files

Implement Phase 1 only:
1. Technogym / Checkup Technogym included intent
2. Generic “is X included?” extraction
3. Spa / sauna / steam / hot tub access intent
4. Courses unlimited vs reservation required intent
5. Trainer/specialist appointment intent

Critical requirements:
- If user asks whether X is included, answer about X only.
- Do not output the full membership tariff grid unless the user directly asks for prices.
- Do not show “Planifier une visite” for Technogym, included-service, spa-access, class-reservation, or trainer/specialist appointment questions.
- If the source does not confirm the answer, say: “Je ne vois pas cette information dans mes sources actuelles; je recommande de confirmer avec l’équipe.”
- Add or update tests for exact cases #1, #2, #3, #4, #5, and #9.

Run the relevant tests.

Then summarize:
1. Files changed
2. Intent/template logic changed
3. CTA gating changed
4. Source retrieval changes, if any
5. Tests added or updated
6. Remaining risks
```

---

# Acceptance Criteria

This fourth pass is successful only if:

* Technogym questions never return the full tariff grid.
* “Is X included?” questions answer about X only.
* Spa/sauna/steam/hot tub questions do not return the full tariff grid.
* Class unlimited/reservation questions do not trigger visit CTA.
* Trainer/specialist appointment questions do not trigger generic visit planning.
* English price + booking questions answer both parts in English.
* Informal follow-ups preserve previous context.
* Phone and chat use the same source of truth.
* The concierge does not deny services like laundry, menu, or pickleball unless absence is officially confirmed.
* Menu links are clickable and placed cleanly if approved.
* Security improvements and 49/49 passing regression tests do not regress.
