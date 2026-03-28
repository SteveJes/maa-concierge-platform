import { runMaaPdfIngestion } from "../ingestion/maa-pdf.js";

async function main(): Promise<void> {
  const smoke = process.argv.includes("--smoke");
  await runMaaPdfIngestion({ smoke });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});