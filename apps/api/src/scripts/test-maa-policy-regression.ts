import assert from "node:assert/strict";
import type { SearchResult } from "@platform/retrieval";
import { tryAnswerPolicyQuestion } from "../services/maa-policy.js";

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
    sourceTitle: overrides.sourceTitle ?? "maa_en_massage-therapy_en",
  };
}

async function main(): Promise<void> {
  const massageChunk = makeResult({
    citationLabel: "https://www.clubsportifmaa.com/en/massage-therapy",
    sourceTitle: "maa_en_massage-therapy_en",
    chunkIndex: 4,
    content:
      "Massage Therapy Policies You must complete a health form upon your first visit. Please come 10 minutes before your session to fill it out. This way, you can enjoy your full massage time. A receipt for your insurance can be given to you with your invoice. For cancellations or time changes, a 24-hour notice is required.",
  });

  const cancellationResult = tryAnswerPolicyQuestion(
    "What is the massage cancellation policy?",
    [massageChunk],
  );

  assert.ok(cancellationResult, "Expected policy answer to be returned");
  assert.equal(cancellationResult!.followUpMode, "done");
  assert.match(cancellationResult!.assistantMessage, /24-hour notice/i);
  assert.deepEqual(cancellationResult!.usedCitations, [0]);

  const frenchChunk = makeResult({
    citationLabel: "https://www.clubsportifmaa.com/fr/massotherapie",
    sourceTitle: "maa_fr_massotherapie_fr",
    locale: "fr-CA",
    chunkIndex: 4,
    content:
      "Politiques pour les massages Vous devez remplir un formulaire de santé lors de votre première visite. Veuillez prévoir 10 minutes avant votre séance pour le compléter et ainsi profiter de votre temps de massage complet. Un reçu pour vos assurances peut vous être remis avec votre facture. Un avis de 24 heures est requis pour annuler sans frais un rendez-vous ou en modifier l’heure.",
  });

  const frenchResult = tryAnswerPolicyQuestion(
    "Quelle est la politique pour les massages ?",
    [frenchChunk],
  );

  assert.ok(frenchResult, "Expected French policy answer to be returned");
  assert.equal(frenchResult!.followUpMode, "done");
  assert.match(frenchResult!.assistantMessage, /formulaire de santé/i);
  assert.match(frenchResult!.assistantMessage, /10 minutes/i);
  assert.match(frenchResult!.assistantMessage, /reçu/i);
  assert.match(frenchResult!.assistantMessage, /24 heures/i);
  assert.deepEqual(frenchResult!.usedCitations, [0]);

  const guestResult = tryAnswerPolicyQuestion("What is the guest policy?", [
    massageChunk,
  ]);

  assert.ok(guestResult, "Expected guest policy clarify answer");
  assert.equal(guestResult!.followUpMode, "clarify");
  assert.match(guestResult!.assistantMessage, /guests|visitors/i);
  assert.deepEqual(guestResult!.usedCitations, []);

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA policy regression passed.",
        cancellationAssistantMessage: cancellationResult!.assistantMessage,
        frenchAssistantMessage: frenchResult!.assistantMessage,
        guestAssistantMessage: guestResult!.assistantMessage,
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