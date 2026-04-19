import { test, expect } from "@playwright/test";

test.describe("MAA demo page — visual and layout", () => {
  test("page loads with MAA branding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Club Sportif MAA/i);

    // Header
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("header").getByText("Club Sportif MAA")).toBeVisible();

    // Hero
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Footer has address
    await expect(page.locator("footer").getByText(/2070/)).toBeVisible();
  });

  test("chat widget is visible and has initial message", async ({ page }) => {
    await page.goto("/");

    // Widget card should be present
    const widget = page.locator("[data-testid='chat-widget']").or(
      page.locator("text=Bonjour").first()
    );
    await expect(widget).toBeVisible({ timeout: 10000 });

    // Initial assistant message
    await expect(page.getByText(/Bonjour/i).first()).toBeVisible();
  });
});

test.describe("MAA concierge — chat interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for widget to be ready
    await page.waitForSelector("input[placeholder], textarea", { timeout: 10000 });
  });

  async function sendMessage(page: any, message: string) {
    const input = page.locator("input[placeholder], textarea").first();
    await input.fill(message);
    await input.press("Enter");
    // Wait for sending state to clear (button text changes back from Sending.../Envoi...)
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.every(
          (b) => !b.textContent?.includes("Sending") && !b.textContent?.includes("Envoi...")
        );
      },
      { timeout: 15000 }
    );
  }

  test("greeting in English returns English response", async ({ page }) => {
    await sendMessage(page, "Hello");
    const msgs = page.locator("text=/Hello|How can I help/i");
    await expect(msgs.first()).toBeVisible({ timeout: 8000 });
  });

  test("French greeting returns French response", async ({ page }) => {
    await sendMessage(page, "Bonjour");
    await expect(page.getByText(/comment puis-je vous aider/i).last()).toBeVisible({ timeout: 8000 });
  });

  test("hours question returns call-to-confirm answer", async ({ page }) => {
    await sendMessage(page, "What are your hours?");
    // Should mention calling to confirm, not raw hours
    const response = page.getByText(/call|appel|confirm|heures/i).last();
    await expect(response).toBeVisible({ timeout: 8000 });
  });

  test("pricing question returns pricing info", async ({ page }) => {
    await sendMessage(page, "What are your membership fees?");
    const response = page.getByText(/\$|membership|abonnement/i).last();
    await expect(response).toBeVisible({ timeout: 8000 });
  });

  test("massage policy question returns 24-hour notice", async ({ page }) => {
    await sendMessage(page, "Can I cancel my massage appointment?");
    await expect(page.getByText(/24.hour|24 heure/i)).toBeVisible({ timeout: 8000 });
  });

  test("booking intent shows button not raw URL", async ({ page }) => {
    await sendMessage(page, "I want to book a tour");
    // Should NOT show a raw https:// URL in chat text
    const chatContent = await page.locator("text=/https?:\/\//").count();
    expect(chatContent).toBe(0);
    // Should show button below copy
    await expect(page.getByText(/button below|bouton ci-dessous/i)).toBeVisible({ timeout: 8000 });
  });

  test("phone number answer uses extension 234 not poste 0", async ({ page }) => {
    await sendMessage(page, "What is your phone number?");
    // Should never say poste 0 or extension 0
    const badExtension = await page.getByText(/poste 0|extension 0/i).count();
    expect(badExtension).toBe(0);
    // Should have the real phone number in the chat (not just footer)
    await expect(page.getByText(/845-2233|845.2233/).last()).toBeVisible({ timeout: 8000 });
  });

  test("membership cancellation does not trigger massage policy", async ({ page }) => {
    await sendMessage(page, "What happens if I cancel my membership?");
    // Should NOT say 24-hour notice (that's massage policy)
    const badResponse = await page.getByText(/24.hour notice is required/i).count();
    expect(badResponse).toBe(0);
  });
});

test.describe("MAA concierge — visual checks", () => {
  test("page background is dark (not white)", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    // Should not be white (rgb(255, 255, 255))
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });

  test("no layout overflow on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test("no layout overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });
});
