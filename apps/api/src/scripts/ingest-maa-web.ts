import { runMaaWebIngestion } from "../ingestion/maa-web.js";

async function main(): Promise<void> {
  const smoke = process.argv.includes("--smoke");
  await runMaaWebIngestion({ smoke });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});