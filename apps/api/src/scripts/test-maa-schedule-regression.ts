import assert from "node:assert/strict";
import type { SearchResult } from "@platform/retrieval";
import { tryAnswerScheduleQuestion } from "../services/maa-schedule.js";

function makeResult(
  overrides: Partial<SearchResult> & Pick<SearchResult, "citationLabel" | "content">,
): SearchResult {
  return {
    chunkId: overrides.chunkId ?? "chunk-1",
    documentId: overrides.documentId ?? "doc-1",
    sourceId: overrides.sourceId ?? "source-1",
    locale: overrides.locale ?? "en-CA",
    citationLabel: overrides.citationLabel,
    snippet: overrides.snippet ?? overrides.content.slice(0, 120),
    content: overrides.content,
    score: overrides.score ?? 100,
    chunkIndex: overrides.chunkIndex ?? 0,
    sourceTitle: overrides.sourceTitle ?? "maa_en_hours_en",
  };
}

async function main(): Promise<void> {
  const englishHoursChunk = makeResult({
    citationLabel: "https://www.clubsportifmaa.com/en/hours",
    sourceTitle: "maa_en_hours_en",
    chunkIndex: 1,
    content:
      "Opening Hours MAA AT 2070 PEEL STREET Training Center Monday to Friday: 6:00 AM to 10:00 PM Saturday and Sunday: 7:00 AM to 7:00 PM Pool and Terrace Monday to Friday: 7:00 AM to 8:00 PM Saturday and Sunday: 7:00 AM to 5:00 PM",
  });

  const englishResult = tryAnswerScheduleQuestion("What are the pool hours?", [
    englishHoursChunk,
  ]);

  assert.ok(englishResult, "Expected English schedule answer to be returned");
  assert.equal(englishResult!.followUpMode, "done");
  assert.match(englishResult!.assistantMessage, /pool hours/i);
  assert.match(
    englishResult!.assistantMessage,
    /monday to friday: 7:00 am to 8:00 pm saturday and sunday: 7:00 am to 5:00 pm/i,
  );
  assert.deepEqual(englishResult!.usedCitations, [0]);

  const frenchHoursChunk = makeResult({
    citationLabel: "https://www.clubsportifmaa.com/fr/planifier-une-visite-gym-montreal",
    sourceTitle: "maa_fr_planifier-une-visite-gym-montreal_fr",
    locale: "fr-CA",
    chunkIndex: 2,
    content:
      "Si vous voulez obtenir plus d’informations ou planifier une visite, communiquez avec notre Directeur des ventes et des opération, Francis Bradette. Heures d'ouverture MAA au 2070, rue peel Plateaux d’entraînement Lundi à vendredi de 6h à 22h Samedi et dimanche de 7h à 19h Piscine et terrasse Lundi à vendredi de 7h à 20h Samedi et dimanche de 7h à 17h Abonnement Programmation Clinique sportive MAAgazine Le Club Restaurant le 1881",
  });

  const frenchResult = tryAnswerScheduleQuestion(
    "Quels sont les horaires de la piscine ?",
    [frenchHoursChunk],
  );

  assert.ok(frenchResult, "Expected French schedule answer to be returned");
  assert.equal(frenchResult!.followUpMode, "done");
  assert.match(frenchResult!.assistantMessage, /horaires de la piscine/i);
  assert.match(
    frenchResult!.assistantMessage,
    /lundi à vendredi de 7h à 20h samedi et dimanche de 7h à 17h/i,
  );
  assert.deepEqual(frenchResult!.usedCitations, [0]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA schedule regression passed.",
        englishAssistantMessage: englishResult!.assistantMessage,
        frenchAssistantMessage: frenchResult!.assistantMessage,
        usedCitations: frenchResult!.usedCitations,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});