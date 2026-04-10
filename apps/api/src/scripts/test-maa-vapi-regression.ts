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
  vapi: {
    enabled: boolean;
    configured: boolean;
    source: string | null;
    assistantId: string | null;
    publicKey: string | null;
    phoneNumber: string | null;
    handoffToken: string | null;
    handoffUrl: string | null;
    launchMode: string | null;
    buttonLabel: string | null;
    fallbackToCallback: boolean;
    summary: string | null;
    error: string | null;
  };
};

type VapiHandoffBody = {
  conversationId: string | null;
  locale: string | null;
  assistantId: string | null;
  publicKey: string | null;
  phoneNumber: string | null;
  launchMode: string;
  summary: string;
  lastUserMessage: string;
  recentTurns: Array<{
    role: string;
    content: string;
  }>;
};

async function testEnglishVapiFlow(app: ReturnType<typeof createServer>): Promise<void> {
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

  const secondResponse = await app.inject({
    method: "POST",
    url: "/v1/tenants/maa/chat",
    payload: {
      message: "Can we continue this by phone now?",
      locale: "en",
      conversationId: firstTurn.conversationId,
      dryRunPersistence: true,
    },
  });

  assert.equal(secondResponse.statusCode, 200);

  const secondTurn = JSON.parse(secondResponse.body) as ChatResponseBody;

  assert.equal(secondTurn.followUpMode, "vapi");
  assert.equal(secondTurn.vapi.enabled, true);
  assert.equal(secondTurn.vapi.configured, true);
  assert.equal(secondTurn.vapi.launchMode, "web_call_or_number");
  assert.equal(secondTurn.vapi.buttonLabel, "Continue by phone");
  assert.ok(secondTurn.vapi.handoffToken);
  assert.ok(secondTurn.vapi.handoffUrl);
  assert.ok(secondTurn.vapi.assistantId);
  assert.ok(secondTurn.vapi.publicKey);
  assert.ok(secondTurn.vapi.phoneNumber);
  assert.match(secondTurn.assistantMessage, /continue this conversation by phone/i);

  const handoffResponse = await app.inject({
    method: "GET",
    url: secondTurn.vapi.handoffUrl!,
  });

  assert.equal(handoffResponse.statusCode, 200);

  const handoff = JSON.parse(handoffResponse.body) as VapiHandoffBody;

  assert.equal(handoff.conversationId, firstTurn.conversationId);
  assert.equal(handoff.locale, "en");
  assert.equal(handoff.lastUserMessage, "Can we continue this by phone now?");
  assert.match(handoff.summary, /annual membership pricing/i);
  assert.match(handoff.summary, /continue this by phone/i);
  assert.ok(
    handoff.recentTurns.some((turn) =>
      /annual membership pricing/i.test(turn.content),
    ),
  );
}

async function testFrenchVapiFlow(app: ReturnType<typeof createServer>): Promise<void> {
  const firstResponse = await app.inject({
    method: "POST",
    url: "/v1/tenants/maa/chat",
    payload: {
      message: "Parle-moi du prix de l'abonnement annuel.",
      locale: "fr-CA",
      dryRunPersistence: true,
    },
  });

  assert.equal(firstResponse.statusCode, 200);
  const firstTurn = JSON.parse(firstResponse.body) as ChatResponseBody;
  assert.ok(firstTurn.conversationId);

  const secondResponse = await app.inject({
    method: "POST",
    url: "/v1/tenants/maa/chat",
    payload: {
      message: "Peut-on continuer par téléphone maintenant ?",
      locale: "fr-CA",
      conversationId: firstTurn.conversationId,
      dryRunPersistence: true,
    },
  });

  assert.equal(secondResponse.statusCode, 200);

  const secondTurn = JSON.parse(secondResponse.body) as ChatResponseBody;

  assert.equal(secondTurn.followUpMode, "vapi");
  assert.equal(secondTurn.vapi.enabled, true);
  assert.equal(secondTurn.vapi.configured, true);
  assert.equal(secondTurn.vapi.launchMode, "web_call_or_number");
  assert.match(secondTurn.vapi.buttonLabel ?? "", /Continuer/i);
  assert.ok(secondTurn.vapi.handoffToken);
  assert.ok(secondTurn.vapi.handoffUrl);
  assert.match(secondTurn.assistantMessage, /téléphone|telephone/i);

  const handoffResponse = await app.inject({
    method: "GET",
    url: secondTurn.vapi.handoffUrl!,
  });

  assert.equal(handoffResponse.statusCode, 200);

  const handoff = JSON.parse(handoffResponse.body) as VapiHandoffBody;

  assert.equal(handoff.conversationId, firstTurn.conversationId);
  assert.equal(handoff.locale, "fr-CA");
  assert.equal(handoff.lastUserMessage, "Peut-on continuer par téléphone maintenant ?");
  assert.match(handoff.summary, /abonnement annuel/i);
  assert.match(handoff.summary, /téléphone|telephone/i);
  assert.ok(
    handoff.recentTurns.some((turn) =>
      /abonnement annuel/i.test(turn.content),
    ),
  );
}

async function main(): Promise<void> {
  loadEnvFiles();

  const app = createServer();
  await app.ready();

  try {
    await testEnglishVapiFlow(app);
    await testFrenchVapiFlow(app);

    console.log(
      JSON.stringify(
        {
          ok: true,
          message: "MAA Vapi regression passed for English and French.",
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
