import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Regression tests hit the live OpenAI API and take ~30s each — keep timeout high.
    testTimeout: 600_000,
    // Sequential — these aren't unit tests, they're end-to-end against OpenAI/NocoDB.
    pool: "forks",
    isolate: false,
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});
