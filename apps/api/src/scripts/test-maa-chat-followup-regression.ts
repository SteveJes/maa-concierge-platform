import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer } from "../server.js";

function loadEnvFiles(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const scriptsDir = path.dirname(currentFile);
  const apiRoot = path.resolve(scriptsDir, "../..");
  const repoRoot = path.resolve(apiRoot, "../..");

  const envFiles = [
    path.join(apiRoot, ".env.local"),
    path.join(apiRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ];

  for (const envFile of envFiles) {
    dotenv.config({ path: envFile, override: false });
  }
}

type ChatResponseBody = {
  conversationId: string | null;
  assistantMessage: string;
  followUpMode: string;
  persistence: {
    enabled: boolean;
    saved: boolean;
    error: string | null;
  };
  retrieval: {
    query: string;
    chunkCount: number;
    resultCount: number;
  };
};

async function main(): Promise<void> {
  loadEnvFiles();

  const app = createServer();
  await app.ready();

  try {
    const firstResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Tell me about annual membership pricing.",
        locale: "en",
        dryRunPersistence: true,
      },
    });

    assert.equal(firstResponse.statusCode, 200);

    const firstTurn = JSON.parse(firstResponse.body) as ChatResponseBody;

    assert.ok(firstTurn.conversationId);
    assert.equal(firstTurn.persistence.enabled, true);
    assert.equal(firstTurn.persistence.saved, true);
    assert.equal(firstTurn.followUpMode, "done");
    assert.match(firstTurn.assistantMessage, /\$225\s*(?:\/|per\s+)month/i);
    assert.match(firstTurn.assistantMessage, /pool/i);
    assert.doesNotMatch(firstTurn.assistantMessage, /\[\d+\]/);
    assert.match(
      firstTurn.retrieval.query,
      /membership pricing fees monthly yearly annual senior student initiation fee pool access included/i,
    );

    const secondResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "And the pool?",
        locale: "en",
        conversationId: firstTurn.conversationId,
        dryRunPersistence: true,
      },
    });

    assert.equal(secondResponse.statusCode, 200);

    const secondTurn = JSON.parse(secondResponse.body) as ChatResponseBody;

    assert.equal(secondTurn.conversationId, firstTurn.conversationId);
    assert.equal(secondTurn.persistence.enabled, true);
    assert.equal(secondTurn.persistence.saved, true);
    assert.equal(secondTurn.followUpMode, "done");
    assert.match(secondTurn.assistantMessage, /pool/i);
    assert.match(secondTurn.assistantMessage, /include|included|includes/i);
    assert.doesNotMatch(secondTurn.assistantMessage, /\[\d+\]/);
    assert.match(
      secondTurn.retrieval.query,
      /^Does membership include pool access\?/i,
    );
    assert.match(
      secondTurn.retrieval.query,
      /membership pricing fees monthly yearly annual senior student initiation fee pool access included/i,
    );
    assert.doesNotMatch(secondTurn.retrieval.query, /^And the pool\?$/i);

    console.log(
      JSON.stringify(
        {
          ok: true,
          message: "MAA chat follow-up route regression passed.",
          firstTurn: {
            conversationId: firstTurn.conversationId,
            followUpMode: firstTurn.followUpMode,
            assistantMessage: firstTurn.assistantMessage,
            retrieval: firstTurn.retrieval,
          },
          secondTurn: {
            conversationId: secondTurn.conversationId,
            followUpMode: secondTurn.followUpMode,
            assistantMessage: secondTurn.assistantMessage,
            retrieval: secondTurn.retrieval,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});