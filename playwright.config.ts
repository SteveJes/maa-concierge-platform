import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    // ── Desktop ──────────────────────────────────────────────────────────────
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Desktop Firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "Desktop Safari",
      use: { ...devices["Desktop Safari"] },
    },

    // ── Mobile — iOS ─────────────────────────────────────────────────────────
    // Newer (2024+) — iPhone 15 Pro Max
    {
      name: "iPhone 15 Pro Max",
      use: {
        ...devices["iPhone 14 Pro Max"],
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ["**/concierge.spec.ts", "**/mobile.spec.ts", "**/daphne-regression.spec.ts"],
    },
    {
      name: "iPhone 14",
      use: { ...devices["iPhone 14"] },
      testMatch: ["**/concierge.spec.ts", "**/mobile.spec.ts", "**/daphne-regression.spec.ts"],
    },
    // Older (2020) — iPhone SE 2nd gen
    {
      name: "iPhone SE",
      use: { ...devices["iPhone SE"] },
      testMatch: ["**/mobile.spec.ts", "**/daphne-regression.spec.ts"],
    },

    // ── Mobile — Android (Google) ────────────────────────────────────────────
    {
      name: "Pixel 7",
      use: { ...devices["Pixel 7"] },
      testMatch: ["**/concierge.spec.ts", "**/mobile.spec.ts", "**/daphne-regression.spec.ts"],
    },
    // Older Pixel — checks low-density viewport handling
    {
      name: "Pixel 5",
      use: { ...devices["Pixel 5"] },
      testMatch: ["**/mobile.spec.ts"],
    },

    // ── Mobile — Android (Samsung) ───────────────────────────────────────────
    {
      name: "Galaxy S23",
      use: {
        ...devices["Galaxy S9+"], // closest available Playwright device
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ["**/mobile.spec.ts", "**/daphne-regression.spec.ts"],
    },
    // Older Samsung
    {
      name: "Galaxy S9+",
      use: { ...devices["Galaxy S9+"] },
      testMatch: ["**/mobile.spec.ts"],
    },

    // ── Mobile — Android (Xiaomi) ────────────────────────────────────────────
    {
      name: "Xiaomi Redmi Note 12",
      use: {
        ...devices["Pixel 5"], // baseline Android device
        viewport: { width: 393, height: 851 },
        deviceScaleFactor: 2.75,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; 22111317I) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ["**/mobile.spec.ts"],
    },
  ],
});
