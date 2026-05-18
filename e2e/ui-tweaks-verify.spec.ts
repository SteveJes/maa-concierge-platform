import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("UI tweaks: nudge contrast, avatar inset, link preview panel", async ({ page, context }) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "maa_concierge_user",
      JSON.stringify({ name: "Steve Tester", locale: "fr-CA" }),
    );
  });
  await page.goto("http://localhost:3000/demo/club-sportif-maa");
  await page.waitForLoadState("networkidle");

  // Closed launcher screenshot
  await page.screenshot({ path: "e2e/tweak-closed.png", fullPage: false });

  // Open the slider
  await page.getByRole("button", { name: /Ouvrir le concierge|Open the concierge/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e/tweak-opened.png", fullPage: false });

  // Send a question that returns a URL (restaurant menu or visite club)
  await page.getByPlaceholder(/Votre message|Your message/i).fill("Pouvez-vous m'envoyer le lien du menu du restaurant Le 1881 ?");
  await page.locator('[data-send-btn]').click();

  // Wait for assistant reply with a button (markdown link → button in floating mode)
  await page.waitForTimeout(18000);
  await page.screenshot({ path: "e2e/tweak-after-reply.png", fullPage: false });

  // Dump assistant text payloads for inspection
  const assistantTexts = await page.locator('[data-role="assistant"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).getAttribute("data-message-text")),
  );
  console.log("Assistant texts:", JSON.stringify(assistantTexts, null, 2));

  // Try to find a link button inside the messages
  const linkBtn = page.locator('[data-role="assistant"] button').filter({ hasText: /http|menu|visite|réserver|inscription|consulter|voir/i }).first();
  const linkCount = await linkBtn.count();
  console.log(`Found ${linkCount} link buttons inside assistant replies`);

  if (linkCount > 0) {
    await linkBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/tweak-preview-open.png", fullPage: false });
    const previewDialog = page.locator('[role="dialog"][aria-label*="Aperçu" i], [role="dialog"][aria-label*="preview" i]');
    await expect(previewDialog).toBeVisible({ timeout: 4000 });
  } else {
    console.log("No link button found — preview panel could not be triggered");
  }
});
