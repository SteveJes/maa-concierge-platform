import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
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
    {
      name: "iPhone 14",
      use: { ...devices["iPhone 14"] },
      testMatch: ["**/concierge.spec.ts", "**/mobile.spec.ts"],
    },
    {
      name: "iPhone SE",
      use: { ...devices["iPhone SE"] },
      testMatch: ["**/mobile.spec.ts"],
    },

    // ── Mobile — Android ─────────────────────────────────────────────────────
    {
      name: "Pixel 7",
      use: { ...devices["Pixel 7"] },
      testMatch: ["**/concierge.spec.ts", "**/mobile.spec.ts"],
    },
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
      testMatch: ["**/mobile.spec.ts"],
    },
  ],
});
