import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiDir, "..", "..");

const envFiles = [
  path.join(apiDir, ".env.local"),
  path.join(apiDir, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
}

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = createServer();

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});