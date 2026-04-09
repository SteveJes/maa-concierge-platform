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

async function testEnglishCallbackFlow(): Promise<void> {
  const app = createServer();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "I need help with membership options. Please have someone call me.",
        locale: "en",
        callback: {
          name: "Steve Test",
          phone: "514-555-0101",
          email: "steve@example.com",
          preferredTimeText: "Tomorrow after 2 PM",
          questionSummary: "Membership options and pricing",
          consentToContact: true,
        },
      },
    });

    assert.equal(response.statusCode, 200, "Expected HTTP 200 from English chat route");

    const body = response.json() as {
      tenantId: string;
      conversationId: string | null;
      assistantMessage: string;
      followUpMode: string;
      citations: unknown[];
      retrieval: {
        query: string;
        chunkCount: number;
        resultCount: number;
      };
      persistence: {
        enabled: boolean;
        saved: boolean;
        error: string | null;
      };
      callbackPersistence: {
        enabled: boolean;
        saved: boolean;
        requestId: string | null;
        error: string | null;
      };
    };

    assert.equal(body.tenantId, "maa");
    assert.ok(body.conversationId, "Expected English conversationId to be returned");
    assert.equal(body.followUpMode, "callback");
    assert.match(body.assistantMessage, /callback request has been captured/i);
    assert.match(body.assistantMessage, /514-555-0101/);
    assert.match(body.assistantMessage, /Tomorrow after 2 PM/i);
    assert.deepEqual(body.citations, []);
    assert.equal(body.persistence.enabled, true);
    assert.equal(body.persistence.saved, true);
    assert.equal(body.persistence.error, null);
    assert.equal(body.callbackPersistence.enabled, true);
    assert.equal(body.callbackPersistence.saved, true);
    assert.ok(
      body.callbackPersistence.requestId,
      "Expected English callbackPersistence.requestId to be returned",
    );
    assert.equal(body.callbackPersistence.error, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          locale: "en",
          message: "MAA English callback regression passed.",
          conversationId: body.conversationId,
          callbackRequestId: body.callbackPersistence.requestId,
          assistantMessage: body.assistantMessage,
          followUpMode: body.followUpMode,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

async function testFrenchCallbackFlow(): Promise<void> {
  const app = createServer();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "J’ai besoin d’aide avec les abonnements. Veuillez me rappeler.",
        locale: "fr-CA",
        callback: {
          name: "Steve Test FR",
          phone: "514-555-0202",
          email: "steve.fr@example.com",
          preferredTimeText: "Demain après 14 h",
          questionSummary: "Abonnements et tarifs",
          consentToContact: true,
        },
      },
    });

    assert.equal(response.statusCode, 200, "Expected HTTP 200 from French chat route");

    const body = response.json() as {
      tenantId: string;
      conversationId: string | null;
      assistantMessage: string;
      followUpMode: string;
      citations: unknown[];
      retrieval: {
        query: string;
        chunkCount: number;
        resultCount: number;
      };
      persistence: {
        enabled: boolean;
        saved: boolean;
        error: string | null;
      };
      callbackPersistence: {
        enabled: boolean;
        saved: boolean;
        requestId: string | null;
        error: string | null;
      };
    };

    assert.equal(body.tenantId, "maa");
    assert.ok(body.conversationId, "Expected French conversationId to be returned");
    assert.equal(body.followUpMode, "callback");
    assert.match(body.assistantMessage, /demande de rappel a bien été enregistrée/i);
    assert.match(body.assistantMessage, /514-555-0202/);
    assert.match(body.assistantMessage, /demain après 14 h/i);
    assert.deepEqual(body.citations, []);
    assert.equal(body.persistence.enabled, true);
    assert.equal(body.persistence.saved, true);
    assert.equal(body.persistence.error, null);
    assert.equal(body.callbackPersistence.enabled, true);
    assert.equal(body.callbackPersistence.saved, true);
    assert.ok(
      body.callbackPersistence.requestId,
      "Expected French callbackPersistence.requestId to be returned",
    );
    assert.equal(body.callbackPersistence.error, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          locale: "fr-CA",
          message: "MAA French callback regression passed.",
          conversationId: body.conversationId,
          callbackRequestId: body.callbackPersistence.requestId,
          assistantMessage: body.assistantMessage,
          followUpMode: body.followUpMode,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  await testEnglishCallbackFlow();
  await testFrenchCallbackFlow();

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA callback regression passed for English and French.",
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