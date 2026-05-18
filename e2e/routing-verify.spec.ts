import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("per-staff routing: restaurant question routes the lead form to Restaurant Le 1881", async ({ page, context }) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "maa_concierge_user",
      JSON.stringify({ name: "Steve Tester", locale: "fr-CA" }),
    );
  });
  await page.goto("http://localhost:3000/demo/club-sportif-maa");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /Ouvrir le concierge|Open the concierge/i }).click();
  await page.waitForTimeout(1200);

  // Ask a restaurant-flavored question — should set routing → restaurant_1881
  await page.getByPlaceholder(/Votre message|Your message/i).fill("J'aimerais réserver une table au restaurant Le 1881.");
  await page.locator('[data-send-btn]').click();

  await page.waitForTimeout(14000);
  await page.screenshot({ path: "e2e/routing-after-reply.png", fullPage: false });

  const routingMeta = await page.evaluate(() => {
    const w = window as unknown as { __lastResponseRouting?: unknown };
    return w.__lastResponseRouting ?? null;
  });
  console.log("Routing (from window):", routingMeta);

  // Open the persistent lead form via the footer "Mes coordonnées" button
  await page.getByRole("button", { name: /Mes coordonnées|Leave my info/i }).first().click();
  await page.waitForTimeout(800);

  // Look for the routing chip — locate the "Transmis à" label, then walk to
  // its parent and assert the contact name is in the same chip.
  const chipScope = page.locator("text=/^Transmis à$|^Routed to$/i").first().locator("..");
  await expect(chipScope).toContainText(/Restaurant Le 1881/i, { timeout: 4000 });

  await page.screenshot({ path: "e2e/routing-leadform.png", fullPage: false });
});
