import assert from "node:assert/strict";
import type { SearchResult } from "@platform/retrieval";
import { tryAnswerPricingQuestion } from "../services/maa-pricing.js";

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
    sourceTitle: overrides.sourceTitle ?? "maa_en_membership_en",
  };
}

async function main(): Promise<void> {
  const membershipChunk = makeResult({
    citationLabel: "https://www.clubsportifmaa.com/en/membership",
    sourceTitle: "maa_en_membership_en",
    chunkIndex: 3,
    content:
      "Fees Membership Fees (monthly) Initiation fee Promo FREE $0 (value of $250) 1 year membership $225 Register Register Senior yearly (70+) $185 Register Register Students yearly (25 and under) Register $195 Register 1 month membership $295 Register Register Membership Includes Access to our 50,000 square foot fitness facility 25m indoor pool, whirlpool and terrace Initial physical assessment and program Day lockers, steam and sauna Other Activities and Services",
  });

  const spaChunk = makeResult({
    chunkId: "chunk-2",
    documentId: "doc-2",
    sourceId: "source-2",
    citationLabel: "https://www.clubsportifmaa.com/en/spa",
    sourceTitle: "maa_en_spa_en",
    chunkIndex: 2,
    content:
      "Access to the swimming pool, sauna, steam bath and hot tub is included in your membership.",
  });

  const result = tryAnswerPricingQuestion(
    "What are the membership fees, and does membership include pool access?",
    [membershipChunk, spaChunk],
  );

  assert.ok(result, "Expected pricing answer to be returned");
  assert.equal(result!.followUpMode, "done");

  const message = result!.assistantMessage;

  assert.match(message, /monthly fees/i);
  assert.match(message, /1 year membership: \$225\/month/i);
  assert.match(message, /Senior yearly \(70\+\): \$185\/month/i);
  assert.match(message, /Students yearly \(25 and under\): \$195\/month/i);
  assert.match(message, /1 month membership: \$295\/month/i);
  assert.match(message, /Initiation fee promo: FREE \(\$0, value of \$250\)/i);
  assert.match(message, /membership includes pool access/i);

  assert.deepEqual(result!.usedCitations, [0, 1]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA pricing regression passed.",
        assistantMessage: message,
        usedCitations: result!.usedCitations,
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