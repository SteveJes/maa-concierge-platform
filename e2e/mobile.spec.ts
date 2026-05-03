import { test, expect } from "@playwright/test";

/**
 * Mobile-specific tests — run against iPhone 14, Pixel 7, Galaxy S23 projects.
 * These verify that the chat widget is fully usable on touch/mobile viewports,
 * including input focus when the keyboard appears.
 */

const DEMO_URL = "/demo/maa";

test.describe("Mobile — chat widget usability", () => {
  test("demo page loads on mobile", async ({ page }) => {
    await page.goto(DEMO_URL);
    await expect(page.locator(".demo-badge")).toBeVisible({ timeout: 8000 });
  });

  test("bubble button is visible and tappable", async ({ page }) => {
    await page.goto(DEMO_URL);
    const bubble = page.locator(".bubble-btn");
    await expect(bubble).toBeVisible({ timeout: 8000 });
    await bubble.tap();
    // Chat panel should appear
    await expect(page.locator(".chat-panel")).toBeVisible({ timeout: 5000 });
  });

  test("input field is visible after opening chat", async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator(".bubble-btn").tap();
    await page.waitForTimeout(600);
    const input = page.locator("input[placeholder]").last();
    await expect(input).toBeVisible({ timeout: 8000 });
  });

  test("input field is focusable on mobile", async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator(".bubble-btn").tap();
    await page.waitForTimeout(600);
    const input = page.locator("input[placeholder]").last();
    await input.tap();
    // Input should be focused
    const isFocused = await input.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
  });

  test("user can type and send a message on mobile", async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator(".bubble-btn").tap();
    await page.waitForTimeout(600);

    const input = page.locator("input[placeholder]").last();
    await input.tap();
    await input.fill("Bonjour");

    // Verify text entered
    await expect(input).toHaveValue("Bonjour");

    // Send by tapping the send button
    const sendBtn = page.locator("[data-send-btn]");
    if (await sendBtn.isVisible()) {
      await sendBtn.tap();
    } else {
      await input.press("Enter");
    }

    // Message should appear in chat
    await expect(page.getByText("Bonjour").first()).toBeVisible({ timeout: 5000 });
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await page.goto(DEMO_URL);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test("chat panel does not overflow viewport height", async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator(".bubble-btn").tap();
    await page.waitForTimeout(400);

    const panelHeight = await page.locator(".chat-panel").evaluate((el) => el.getBoundingClientRect().bottom);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    // Panel bottom should not exceed viewport
    expect(panelHeight).toBeLessThanOrEqual(viewportHeight + 2); // +2px tolerance
  });

  test("input area is within visible viewport (keyboard simulation)", async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator(".bubble-btn").tap();
    await page.waitForTimeout(600);

    // Simulate keyboard by shrinking viewport (Android keyboard effect)
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) });
    await page.waitForTimeout(400);

    const inputRect = await page.locator("input[placeholder]").last().boundingBox();
    const newVpHeight = Math.round(vp.height * 0.55);
    if (inputRect) {
      // Input bottom should be within the shrunk viewport
      expect(inputRect.y + inputRect.height).toBeLessThanOrEqual(newVpHeight + 40);
    }
  });
});

test.describe("Mobile — response quality on small screen", () => {
  async function openChatAndSend(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[0] : never, msg: string) {
    await page.goto(DEMO_URL);
    await page.locator(".bubble-btn").tap();
    await page.waitForTimeout(600);
    const input = page.locator("input[placeholder]").last();
    await input.tap();
    await input.fill(msg);
    const sendBtn = page.locator("[data-send-btn]");
    if (await sendBtn.isVisible()) {
      await sendBtn.tap();
    } else {
      await input.press("Enter");
    }
    // Wait for AI response
    await page.waitForFunction(
      () => {
        const btn = document.querySelector("[data-send-btn]");
        return !btn || !(btn as HTMLButtonElement).disabled;
      },
      { timeout: 30000 }
    );
    await page.waitForTimeout(200);
  }

  test("concierge responds to pricing question on mobile", async ({ page }) => {
    await openChatAndSend(page, "What are your membership fees?");
    const allText = await page.locator("body").innerText();
    expect(/\$|abonnement|tarif|membership/i.test(allText)).toBe(true);
  });

  test("concierge responds in French on mobile", async ({ page }) => {
    await openChatAndSend(page, "Bonjour, quels sont vos horaires ?");
    const allText = await page.locator("body").innerText();
    expect(/heure|lundi|vendredi|samedi|ouvert/i.test(allText)).toBe(true);
  });
});
