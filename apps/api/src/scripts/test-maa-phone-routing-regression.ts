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
    handoffToken: string | null;
  };
};

async function main(): Promise<void> {
  loadEnvFiles();

  const app = createServer();
  await app.ready();

  try {
    const englishPhoneNumberResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Do you have a phone number?",
        locale: "en-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(englishPhoneNumberResponse.statusCode, 200);

    const englishPhoneNumberBody = JSON.parse(
      englishPhoneNumberResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(englishPhoneNumberBody.followUpMode, "vapi");
    assert.equal(englishPhoneNumberBody.vapi.enabled, false);
    assert.equal(englishPhoneNumberBody.vapi.handoffToken, null);
    assert.match(englishPhoneNumberBody.assistantMessage, /(?:\(?514\)?[\s-]*845-2233)/i);
    assert.doesNotMatch(englishPhoneNumberBody.assistantMessage, /nursing service/i);
    assert.ok(englishPhoneNumberBody.conversationId);

    const englishTypoPhoneResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "do you have a phone numbre",
        locale: "en-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(englishTypoPhoneResponse.statusCode, 200);

    const englishTypoPhoneBody = JSON.parse(
      englishTypoPhoneResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(englishTypoPhoneBody.followUpMode, "vapi");
    assert.equal(englishTypoPhoneBody.vapi.enabled, false);
    assert.match(englishTypoPhoneBody.assistantMessage, /(?:\(?514\)?[\s-]*845-2233)/i);

    const englishLocationResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Where are you located?",
        locale: "en-CA",
        conversationId: englishPhoneNumberBody.conversationId,
        dryRunPersistence: true,
      },
    });

    assert.equal(englishLocationResponse.statusCode, 200);

    const englishLocationBody = JSON.parse(
      englishLocationResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(englishLocationBody.followUpMode, "vapi");
    assert.equal(englishLocationBody.vapi.enabled, false);
    assert.match(englishLocationBody.assistantMessage, /2070 Peel Street/i);

    const englishTypoLocationResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "were are you locatd",
        locale: "en-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(englishTypoLocationResponse.statusCode, 200);

    const englishTypoLocationBody = JSON.parse(
      englishTypoLocationResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(englishTypoLocationBody.followUpMode, "vapi");
    assert.equal(englishTypoLocationBody.vapi.enabled, false);
    assert.match(englishTypoLocationBody.assistantMessage, /2070 Peel Street/i);

    const englishDescriptionResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "What kind of gym are you?",
        locale: "en-CA",
        conversationId: englishPhoneNumberBody.conversationId,
        dryRunPersistence: true,
      },
    });

    assert.equal(englishDescriptionResponse.statusCode, 200);

    const englishDescriptionBody = JSON.parse(
      englishDescriptionResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(englishDescriptionBody.followUpMode, "vapi");
    assert.equal(englishDescriptionBody.vapi.enabled, false);
    assert.match(englishDescriptionBody.assistantMessage, /premium sports club/i);

    const englishTypoDescriptionResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "what kind of gim are you",
        locale: "en-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(englishTypoDescriptionResponse.statusCode, 200);

    const englishTypoDescriptionBody = JSON.parse(
      englishTypoDescriptionResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(englishTypoDescriptionBody.followUpMode, "vapi");
    assert.equal(englishTypoDescriptionBody.vapi.enabled, false);
    assert.match(englishTypoDescriptionBody.assistantMessage, /premium sports club/i);

    const englishTypoTransferResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "can we contnue by phone",
        locale: "en-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(englishTypoTransferResponse.statusCode, 200);

    const englishTypoTransferBody = JSON.parse(
      englishTypoTransferResponse.body,
    ) as ChatResponseBody;

    assert.equal(englishTypoTransferBody.followUpMode, "vapi");
    assert.equal(englishTypoTransferBody.vapi.enabled, true);
    assert.ok(englishTypoTransferBody.vapi.handoffToken);

    const englishTransferResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Can we continue this by phone now?",
        locale: "en-CA",
        conversationId: englishPhoneNumberBody.conversationId,
        dryRunPersistence: true,
      },
    });

    assert.equal(englishTransferResponse.statusCode, 200);

    const englishTransferBody = JSON.parse(
      englishTransferResponse.body,
    ) as ChatResponseBody;

    assert.equal(englishTransferBody.followUpMode, "vapi");
    assert.equal(englishTransferBody.vapi.enabled, true);
    assert.ok(englishTransferBody.vapi.handoffToken);

    const frenchPhoneNumberResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Avez-vous un numéro de téléphone ?",
        locale: "fr-CA",
        dryRunPersistence: true,
      },
    });

    assert.equal(frenchPhoneNumberResponse.statusCode, 200);

    const frenchPhoneNumberBody = JSON.parse(
      frenchPhoneNumberResponse.body,
    ) as ChatResponseBody;

    assert.notEqual(frenchPhoneNumberBody.followUpMode, "vapi");
    assert.equal(frenchPhoneNumberBody.vapi.enabled, false);
    assert.equal(frenchPhoneNumberBody.vapi.handoffToken, null);
    assert.match(frenchPhoneNumberBody.assistantMessage, /514 845-2233/i);
    assert.doesNotMatch(frenchPhoneNumberBody.assistantMessage, /directeur des ventes/i);
    assert.ok(frenchPhoneNumberBody.conversationId);

    const frenchTransferResponse = await app.inject({
      method: "POST",
      url: "/v1/tenants/maa/chat",
      payload: {
        message: "Peut-on continuer par téléphone maintenant ?",
        locale: "fr-CA",
        conversationId: frenchPhoneNumberBody.conversationId,
        dryRunPersistence: true,
      },
    });

    assert.equal(frenchTransferResponse.statusCode, 200);

    const frenchTransferBody = JSON.parse(
      frenchTransferResponse.body,
    ) as ChatResponseBody;

    assert.equal(frenchTransferBody.followUpMode, "vapi");
    assert.equal(frenchTransferBody.vapi.enabled, true);
    assert.ok(frenchTransferBody.vapi.handoffToken);

    console.log(
      JSON.stringify(
        {
          ok: true,
          message: "MAA phone routing regression passed.",
          english: {
            phoneNumberFollowUpMode: englishPhoneNumberBody.followUpMode,
            transferFollowUpMode: englishTransferBody.followUpMode,
            typoTransferFollowUpMode: englishTypoTransferBody.followUpMode,
          },
          french: {
            phoneNumberFollowUpMode: frenchPhoneNumberBody.followUpMode,
            transferFollowUpMode: frenchTransferBody.followUpMode,
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