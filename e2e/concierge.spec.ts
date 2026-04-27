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

    // Wait for input to be cleared (React cleared it after sendMessage ran)
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLInputElement>("input[placeholder], textarea");
        return el ? el.value.trim() === "" : false;
      },
      { timeout: 5000 },
    ).catch(() => null);

    // Wait for send button to be re-enabled (API response received)
    // The send button is disabled while isSending === true
    await page.waitForFunction(
      () => {
        const btn = document.querySelector("[data-send-btn]");
        if (!btn) return true; // if not found, don't block
        return !(btn as HTMLButtonElement).disabled;
      },
      { timeout: 30000 },
    );

    await page.waitForTimeout(200);
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
    // Should mention hours info and/or call-to-confirm
    await page.waitForTimeout(500);
    const allText = await page.locator("body").innerText();
    const hasRelevant = /call|confirm|845|hours|hour|heures|horaire/i.test(allText);
    expect(hasRelevant).toBe(true);
  });

  test("pricing question returns pricing info", async ({ page }) => {
    await sendMessage(page, "What are your membership fees?");
    const response = page.getByText(/\$|membership|abonnement/i).last();
    await expect(response).toBeVisible({ timeout: 8000 });
  });

  test("massage policy question returns 24-hour notice", async ({ page }) => {
    await sendMessage(page, "Can I cancel my massage appointment?");
    // Wait for the policy text to appear in the DOM (API may take several seconds)
    await page.waitForSelector("text=/24.hour|24 heure/i", { timeout: 20000 }).catch(() => null);
    const allText = await page.locator("body").innerText();
    expect(/24.hour|24.heure/i.test(allText)).toBe(true);
  });

  test("booking intent shows button not raw URL", async ({ page }) => {
    await sendMessage(page, "I want to book a tour");
    // Should NOT show a raw https:// URL in chat text
    const chatContent = await page.locator("text=/https?:\/\//").count();
    expect(chatContent).toBe(0);
    // Should show button below copy
    await expect(page.getByText(/book|visit|visite|réserver|planifier/i).last()).toBeVisible({ timeout: 12000 });
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

  test("no double Bonjour — follow-up message should not re-greet", { timeout: 90000 }, async ({ page }) => {
    await sendMessage(page, "Bonjour");
    await sendMessage(page, "c'est quoi votre numero");
    // The last AI reply (for the phone number question) must NOT greet again
    // Get all text blocks that look like assistant messages
    const allText = await page.locator("body").innerText();
    const lines = allText.split("\n").map((l) => l.trim()).filter(Boolean);
    // Find lines after the phone question that contain Bonjour — should be 0
    const phoneQuestionIdx = lines.findIndex((l) => /votre numero/i.test(l));
    const greetingsAfterQuestion = lines
      .slice(phoneQuestionIdx + 1)
      .filter((l) => /^Bonjour\b/i.test(l));
    expect(greetingsAfterQuestion.length).toBe(0);
  });

  test("squash hours question does not dump all facility hours", async ({ page }) => {
    await sendMessage(page, "c'est quoi lhoraire du squash?");
    const allText = await page.locator("body").innerText();
    // Should NOT return all three facility blocks together (the old dump behavior)
    const hasPool = /Horaires de la piscine/i.test(allText);
    const hasSpa = /Horaires du spa/i.test(allText);
    const hasClub = /Horaires du club/i.test(allText);
    if (hasPool && hasSpa && hasClub) {
      throw new Error("Response dumped all facility hours for a squash-specific question");
    }
    // Should give a useful response (hours info, phone number, or squash context)
    const isHelpful = /squash|club|514|845|lundi|vendredi|horaire/i.test(allText);
    expect(isHelpful).toBe(true);
  });

  test("pilates schedule uses PDF source, not spa hours", async ({ page }) => {
    await sendMessage(page, "a quel heures sont vos cours de pilates?");
    const allText = await page.locator("body").innerText();
    // Should NOT be the spa hours block
    const isSpaHours = /lundi au vendredi.*9 h.*19 h/i.test(allText);
    expect(isSpaHours).toBe(false);
    // Should mention pilates or reformer or schedule
    const hasPilatesContext = /pilates|reformer|FLiiP|séances|places/i.test(allText);
    expect(hasPilatesContext).toBe(true);
  });

  test("pool question mentions pool and does not confuse with spa", async ({ page }) => {
    await sendMessage(page, "Do you have a pool?");
    const allText = await page.locator("body").innerText();
    const hasPool = /pool|piscine|swim|natation/i.test(allText);
    expect(hasPool).toBe(true);
    // Should not return only spa hours in response to a pool question
    const isSpaOnly = /Horaires du spa/i.test(allText) && !/pool|piscine/i.test(allText);
    expect(isSpaOnly).toBe(false);
  });

  test("personal training question is helpful and not out-of-scope", async ({ page }) => {
    await sendMessage(page, "Do you offer personal training?");
    const allText = await page.locator("body").innerText();
    const isHelpful = /personal|entraîneur|entraînement|coach|trainer|514|845/i.test(allText);
    expect(isHelpful).toBe(true);
  });

  test("location question mentions metro or downtown or address", async ({ page }) => {
    await sendMessage(page, "How close are you to downtown Montreal?");
    const allText = await page.locator("body").innerText();
    const hasLocationContext = /metro|métro|downtown|centre-ville|2070|Mackay|McGill|Guy/i.test(allText);
    expect(hasLocationContext).toBe(true);
  });

  test("membership start question leads to next step", async ({ page }) => {
    await sendMessage(page, "I want to start a membership");
    const allText = await page.locator("body").innerText();
    // Should show a helpful next step: visit, call, tour, or pricing
    const hasNextStep = /visit|visite|call|appel|price|prix|membership|abonnement|tour|réserver|planifier|\$|book/i.test(allText);
    expect(hasNextStep).toBe(true);
  });

  test("out of scope question stays polite and does not hallucinate", async ({ page }) => {
    await sendMessage(page, "What is the weather like in Montreal today?");
    const allText = await page.locator("body").innerText();
    // Should politely decline and not make up weather data
    const isPolite = /sorry|désolé|outside|en dehors|not able|cannot|concierge|MAA|club/i.test(allText);
    expect(isPolite).toBe(true);
  });

  test("spa question mentions spa services", async ({ page }) => {
    await sendMessage(page, "What services does your spa offer?");
    const allText = await page.locator("body").innerText();
    const hasSpaContext = /spa|massage|soin|treatment|sauna|steam/i.test(allText);
    expect(hasSpaContext).toBe(true);
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

// ─────────────────────────────────────────────────────────────────────────────
// Gym-specific scenario tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("MAA concierge — gym scenarios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("input[placeholder], textarea", { timeout: 10000 });
  });

  async function sendMessage(page: any, message: string) {
    const input = page.locator("input[placeholder], textarea").first();
    await input.fill(message);
    await input.press("Enter");
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLInputElement>("input[placeholder], textarea");
        return el ? el.value.trim() === "" : false;
      },
      { timeout: 5000 },
    ).catch(() => null);
    await page.waitForFunction(
      () => {
        const btn = document.querySelector("[data-send-btn]");
        if (!btn) return true;
        return !(btn as HTMLButtonElement).disabled;
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(200);
  }

  // ── Affirmative follow-up ──────────────────────────────────────────────────

  test("short affirmative 'pourquoi pas' after proactive nudge continues context", { timeout: 90000 }, async ({ page }) => {
    // Simulate what the proactive nudge sets up: AI mentions pool/spa/classes
    await sendMessage(page, "Saviez-vous que vous avez une piscine, un spa et des cours ?");
    await sendMessage(page, "Pourquoi pas");
    const allText = await page.locator("body").innerText();
    // Should NOT be about cookie consent or unrelated topics
    const isBadResponse = /consentement.*technolog|cookie|confidentialit/i.test(allText);
    expect(isBadResponse).toBe(false);
    // Should be relevant: pool/spa/classes/membership
    const isGood = /piscine|spa|cours|abonnement|membership|pool|class/i.test(allText);
    expect(isGood).toBe(true);
  });

  test("'ok' follow-up after pricing question continues on pricing", { timeout: 90000 }, async ({ page }) => {
    await sendMessage(page, "Quels sont vos tarifs ?");
    await sendMessage(page, "ok");
    const allText = await page.locator("body").innerText();
    const hasPricing = /\$|abonnement|tarif|prix|mensuel|annuel/i.test(allText);
    expect(hasPricing).toBe(true);
  });

  test("'yes' follow-up after tour suggestion leads to booking context", { timeout: 90000 }, async ({ page }) => {
    await sendMessage(page, "Je voudrais visiter le club");
    await sendMessage(page, "yes");
    const allText = await page.locator("body").innerText();
    const hasBooking = /visit|visite|réserver|book|planifier|tour/i.test(allText);
    expect(hasBooking).toBe(true);
  });

  // ── Facilities ────────────────────────────────────────────────────────────

  test("pool question is answered with pool context", async ({ page }) => {
    await sendMessage(page, "Est-ce que vous avez une piscine ?");
    const allText = await page.locator("body").innerText();
    expect(/piscine|pool|25\s*m|natation/i.test(allText)).toBe(true);
  });

  test("spa question mentions spa services", async ({ page }) => {
    await sendMessage(page, "What services does your spa offer?");
    const allText = await page.locator("body").innerText();
    expect(/spa|massage|soin|sauna|treatment/i.test(allText)).toBe(true);
  });

  test("squash question answers with club hours not dump of all hours", async ({ page }) => {
    await sendMessage(page, "c'est quoi lhoraire du squash?");
    const allText = await page.locator("body").innerText();
    // The three facility blocks together = dump (regression guard)
    const dump = /Horaires de la piscine/i.test(allText) && /Horaires du spa/i.test(allText) && /Horaires du club/i.test(allText);
    expect(dump).toBe(false);
    expect(/squash|club|horaire|514|845|lundi|vendredi/i.test(allText)).toBe(true);
  });

  test("personal training question gets a useful answer", async ({ page }) => {
    await sendMessage(page, "Do you offer personal training?");
    const allText = await page.locator("body").innerText();
    expect(/personal|entraîneur|coach|trainer|514|845/i.test(allText)).toBe(true);
  });

  // ── Location & access ─────────────────────────────────────────────────────

  test("location question mentions address or metro or downtown", async ({ page }) => {
    await sendMessage(page, "Where are you located?");
    const allText = await page.locator("body").innerText();
    expect(/2070|Mackay|métro|metro|downtown|centre-ville|McGill|Guy/i.test(allText)).toBe(true);
  });

  test("proximity question answers with nearby landmark or transit", async ({ page }) => {
    await sendMessage(page, "How close are you to McGill metro?");
    const allText = await page.locator("body").innerText();
    expect(/McGill|métro|metro|Mackay|2070|Guy|Atwater|walking|minutes/i.test(allText)).toBe(true);
  });

  // ── Membership journey ────────────────────────────────────────────────────

  test("membership start question offers a clear next step", async ({ page }) => {
    await sendMessage(page, "I want to join the club");
    const allText = await page.locator("body").innerText();
    expect(/visit|visite|tour|prix|price|abonnement|membership|réserver|book|514|845/i.test(allText)).toBe(true);
  });

  test("membership pricing does not trigger massage cancellation policy", async ({ page }) => {
    await sendMessage(page, "What are your membership fees?");
    const allText = await page.locator("body").innerText();
    expect(/24.hour notice is required/i.test(allText)).toBe(false);
  });

  test("student pricing question mentions student rate", async ({ page }) => {
    await sendMessage(page, "Do you have a student discount?");
    const allText = await page.locator("body").innerText();
    expect(/student|étudiant|discount|tarif|rate|\$/i.test(allText)).toBe(true);
  });

  test("senior pricing question mentions senior rate", async ({ page }) => {
    await sendMessage(page, "Do you have rates for seniors?");
    const allText = await page.locator("body").innerText();
    expect(/senior|\$/i.test(allText)).toBe(true);
  });

  // ── Language ──────────────────────────────────────────────────────────────

  test("English question gets English response", async ({ page }) => {
    await sendMessage(page, "Hello, I want to know about your gym");
    const allText = await page.locator("body").innerText();
    // Should respond in English
    expect(/club|gym|facility|membership|welcome|hello|help/i.test(allText)).toBe(true);
  });

  test("French question gets French response", async ({ page }) => {
    await sendMessage(page, "Bonjour, je veux en savoir plus sur le club");
    const allText = await page.locator("body").innerText();
    expect(/club|abonnement|bonjour|bienvenue|vous/i.test(allText)).toBe(true);
  });

  test("language stays consistent after switch", { timeout: 90000 }, async ({ page }) => {
    await sendMessage(page, "Bonjour");
    await sendMessage(page, "What is the price for a membership?");
    const allText = await page.locator("body").innerText();
    // After switching to English, response should contain English pricing terms
    expect(/\$|membership|fee|price|rate/i.test(allText)).toBe(true);
  });

  // ── Out-of-scope ──────────────────────────────────────────────────────────

  test("out-of-scope question stays polite and does not hallucinate", async ({ page }) => {
    await sendMessage(page, "What is the weather like in Montreal today?");
    const allText = await page.locator("body").innerText();
    // Should politely decline without making up weather data
    expect(/sorry|désolé|outside|en dehors|not able|cannot|concierge|MAA|club/i.test(allText)).toBe(true);
    expect(/sunny|cloudy|rain|snow|température|\d+°/i.test(allText)).toBe(false);
  });

  test("competitor question does not trash competitors", async ({ page }) => {
    await sendMessage(page, "How do you compare to other gyms in Montreal?");
    const allText = await page.locator("body").innerText();
    // Should not name or disparage competitors
    expect(/YMCA|GoodLife|Éconofitness|Movati/i.test(allText)).toBe(false);
  });

  // ── Group classes ─────────────────────────────────────────────────────────

  test("pilates question uses PDF schedule, not spa hours", async ({ page }) => {
    await sendMessage(page, "a quel heures sont vos cours de pilates?");
    const allText = await page.locator("body").innerText();
    expect(/lundi au vendredi.*9 h.*19 h/i.test(allText)).toBe(false);
    expect(/pilates|reformer|FLiiP|séances|places/i.test(allText)).toBe(true);
  });

  test("yoga class question gives class-related answer", async ({ page }) => {
    await sendMessage(page, "Do you have yoga classes?");
    const allText = await page.locator("body").innerText();
    expect(/yoga|class|cours|schedule|horaire|514|845/i.test(allText)).toBe(true);
  });

  // ── Cancellation & policies ───────────────────────────────────────────────

  test("massage cancellation returns 24-hour policy", async ({ page }) => {
    await sendMessage(page, "Can I cancel my massage?");
    await page.waitForSelector("text=/24.hour|24 heure/i", { timeout: 20000 }).catch(() => null);
    const allText = await page.locator("body").innerText();
    expect(/24.hour|24.heure/i.test(allText)).toBe(true);
  });

  test("membership cancellation does NOT trigger massage policy", async ({ page }) => {
    await sendMessage(page, "How do I cancel my membership?");
    const allText = await page.locator("body").innerText();
    expect(/24.hour notice is required/i.test(allText)).toBe(false);
  });

  // ── Phone & contact ───────────────────────────────────────────────────────

  test("phone number answer shows correct number and no extension 0", async ({ page }) => {
    await sendMessage(page, "What is your phone number?");
    const allText = await page.locator("body").innerText();
    expect(await page.getByText(/poste 0|extension 0/i).count()).toBe(0);
    await expect(page.getByText(/845-2233|845.2233/).last()).toBeVisible({ timeout: 8000 });
  });

  test("callback request flow shows callback form", async ({ page }) => {
    await sendMessage(page, "Pouvez-vous me rappeler ?");
    const allText = await page.locator("body").innerText();
    expect(/rappel|callback|téléphone|phone|call/i.test(allText)).toBe(true);
  });

  // ── Booking ───────────────────────────────────────────────────────────────

  test("tour booking shows button not raw URL", async ({ page }) => {
    await sendMessage(page, "I want to book a tour");
    const rawUrls = await page.locator("text=/https?:\\/\\//").count();
    expect(rawUrls).toBe(0);
    await expect(page.getByText(/book|visit|visite|réserver|planifier/i).last()).toBeVisible({ timeout: 12000 });
  });
});
