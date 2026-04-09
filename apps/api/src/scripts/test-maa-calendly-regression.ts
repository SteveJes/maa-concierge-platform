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

type CalendlyResponse = {
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
  booking: {
    enabled: boolean;
    configured: boolean;
    source: string | null;
    mode: string | null;
    bookingUrl: string | null;
    calendlyEventTypeUri: string | null;
    allowCallbackFallback: boolean;
    confirmationTemplateKey: string | null;
    error: string | null;
  };
};

async function testEnglishCalendlyFlow(): Promise<void> {
  const app = createServer();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "I want to book a tour with the sales team.",
        locale: "en",
        dryRunPersistence: true,
      },
    });

    assert.equal(response.statusCode, 200, "Expected HTTP 200 from English Calendly flow");

    const body = response.json() as CalendlyResponse;

    assert.equal(body.tenantId, "maa");
    assert.ok(body.conversationId, "Expected English conversationId");
    assert.equal(body.followUpMode, "calendly");
    assert.match(body.assistantMessage, /please use this link/i);
    assert.match(body.assistantMessage, /calendly\.com\/example\/maa-demo/i);
    assert.deepEqual(body.citations, []);
    assert.equal(body.persistence.enabled, true);
    assert.equal(body.persistence.saved, true);
    assert.equal(body.persistence.error, null);
    assert.equal(body.booking.enabled, true);
    assert.equal(body.booking.configured, true);
    assert.equal(body.booking.source, "env");
    assert.equal(body.booking.bookingUrl, "https://calendly.com/example/maa-demo");
    assert.equal(body.booking.error, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          locale: "en",
          message: "MAA English Calendly regression passed.",
          conversationId: body.conversationId,
          assistantMessage: body.assistantMessage,
          followUpMode: body.followUpMode,
          booking: body.booking,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

async function testFrenchCalendlyFlow(): Promise<void> {
  const app = createServer();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Je veux réserver une visite avec l’équipe des ventes.",
        locale: "fr-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(response.statusCode, 200, "Expected HTTP 200 from French Calendly flow");

    const body = response.json() as CalendlyResponse;

    assert.equal(body.tenantId, "maa");
    assert.ok(body.conversationId, "Expected French conversationId");
    assert.equal(body.followUpMode, "calendly");
    assert.match(body.assistantMessage, /utilisez ce lien/i);
    assert.match(body.assistantMessage, /calendly\.com\/example\/maa-demo/i);
    assert.deepEqual(body.citations, []);
    assert.equal(body.persistence.enabled, true);
    assert.equal(body.persistence.saved, true);
    assert.equal(body.persistence.error, null);
    assert.equal(body.booking.enabled, true);
    assert.equal(body.booking.configured, true);
    assert.equal(body.booking.source, "env");
    assert.equal(body.booking.bookingUrl, "https://calendly.com/example/maa-demo");
    assert.equal(body.booking.error, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          locale: "fr-CA",
          message: "MAA French Calendly regression passed.",
          conversationId: body.conversationId,
          assistantMessage: body.assistantMessage,
          followUpMode: body.followUpMode,
          booking: body.booking,
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
  process.env.CALENDLY_URL = "https://calendly.com/example/maa-demo";

  await testEnglishCalendlyFlow();
  await testFrenchCalendlyFlow();

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA Calendly regression passed for English and French.",
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