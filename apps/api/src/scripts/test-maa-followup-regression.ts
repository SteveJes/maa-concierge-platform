import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { answerMaaChat } from "../services/maa-chat.js";

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

async function main(): Promise<void> {
  loadEnvFiles();

  const firstTurn = await answerMaaChat({
    userMessage: "Tell me about annual membership pricing.",
    locale: "en",
  });

  assert.equal(firstTurn.followUpMode, "done");
  assert.match(firstTurn.assistantMessage, /\$225\s*(?:\/|per\s+)month/i);
  assert.match(firstTurn.assistantMessage, /pool/i);
  assert.doesNotMatch(firstTurn.assistantMessage, /\[\d+\]/);

  const secondTurn = await answerMaaChat({
    userMessage: "And the pool?",
    locale: "en",
    conversationHistory: [
      {
        role: "user",
        content: "Tell me about annual membership pricing.",
      },
      {
        role: "assistant",
        content: firstTurn.assistantMessage,
      },
    ],
  });

  assert.equal(secondTurn.followUpMode, "done");
  assert.match(secondTurn.assistantMessage, /pool/i);
  assert.match(secondTurn.assistantMessage, /include|included|includes/i);
  assert.doesNotMatch(secondTurn.assistantMessage, /\[\d+\]/);

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA follow-up regression passed.",
        firstTurn: {
          followUpMode: firstTurn.followUpMode,
          assistantMessage: firstTurn.assistantMessage,
          retrieval: firstTurn.retrieval,
        },
        secondTurn: {
          followUpMode: secondTurn.followUpMode,
          assistantMessage: secondTurn.assistantMessage,
          retrieval: secondTurn.retrieval,
        },
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