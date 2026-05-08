/* eslint-disable */
const re = /\b(oui[, ]|nous (?:disposons|offrons|proposons|avons)|le club\b[^.!?]*\b(?:dispose|offre|propose|a)\b|on (?:offre|propose)|parmi (?:nos|les) (?:installations|services|amenities)|we (?:have|offer|provide|do offer)|yes,? (?:we|the club)|votre club|the club\b[^.!?]*\b(?:offers|provides|has))/i;

const cases = [
  "Le Club Sportif MAA dispose bien d'un terrain de pickleball parmi ses installations.",
  "Oui, le Club Sportif MAA dispose d'un terrain de pickleball",
  "Je ne vois pas le pickleball dans mes sources actuelles",
  "Le club offre un demi-terrain de basketball",
  "the club has a half-court for basketball",
];
for (const c of cases) console.log(re.test(c) ? "AFFIRM" : "safe ", "|", c);
