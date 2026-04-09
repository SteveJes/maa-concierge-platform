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

type BookingResponse = {
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

async function testEnglishBookingFlow(): Promise<void> {
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

    assert.equal(response.statusCode, 200, "Expected HTTP 200 from English booking flow");

    const body = response.json() as BookingResponse;

    assert.equal(body.tenantId, "maa");
    assert.ok(body.conversationId, "Expected English conversationId");
    assert.equal(body.followUpMode, "calendly");
    assert.match(body.assistantMessage, /open this page/i);
    assert.match(body.assistantMessage, /click "Book a tour"/i);
    assert.match(body.assistantMessage, /callback request/i);
    assert.match(body.assistantMessage, /https:\/\/www\.clubsportifmaa\.com\/en\//i);
    assert.deepEqual(body.citations, []);
    assert.equal(body.persistence.enabled, true);
    assert.equal(body.persistence.saved, true);
    assert.equal(body.persistence.error, null);
    assert.equal(body.callbackPersistence.saved, false);
    assert.equal(body.booking.enabled, true);
    assert.equal(body.booking.configured, true);
    assert.equal(body.booking.source, "nocodb");
    assert.equal(body.booking.mode, "leadconnector_popup");
    assert.equal(body.booking.bookingUrl, "https://www.clubsportifmaa.com/en/");
    assert.equal(body.booking.allowCallbackFallback, true);
    assert.equal(body.booking.error, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          locale: "en",
          message: "MAA English booking-provider regression passed.",
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

async function testFrenchBookingFlow(): Promise<void> {
  const app = createServer();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Je veux reserver une visite avec l'equipe des ventes.",
        locale: "fr-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(response.statusCode, 200, "Expected HTTP 200 from French booking flow");

    const body = response.json() as BookingResponse;

    assert.equal(body.tenantId, "maa");
    assert.ok(body.conversationId, "Expected French conversationId");
    assert.equal(body.followUpMode, "calendly");
    assert.match(body.assistantMessage, /ouvrez cette page/i);
    assert.match(body.assistantMessage, /PLANIFIER UNE VISITE/i);
    assert.match(body.assistantMessage, /demande de rappel/i);
    assert.match(body.assistantMessage, /https:\/\/www\.clubsportifmaa\.com\/fr\//i);
    assert.deepEqual(body.citations, []);
    assert.equal(body.persistence.enabled, true);
    assert.equal(body.persistence.saved, true);
    assert.equal(body.persistence.error, null);
    assert.equal(body.callbackPersistence.saved, false);
    assert.equal(body.booking.enabled, true);
    assert.equal(body.booking.configured, true);
    assert.equal(body.booking.source, "nocodb");
    assert.equal(body.booking.mode, "leadconnector_popup");
    assert.equal(body.booking.bookingUrl, "https://www.clubsportifmaa.com/fr/");
    assert.equal(body.booking.allowCallbackFallback, true);
    assert.equal(body.booking.error, null);

    console.log(
      JSON.stringify(
        {
          ok: true,
          locale: "fr-CA",
          message: "MAA French booking-provider regression passed.",
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

  await testEnglishBookingFlow();
  await testFrenchBookingFlow();

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "MAA booking-provider regression passed for English and French.",
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