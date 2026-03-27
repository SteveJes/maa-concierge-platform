import { discoverMaaSources } from "../discovery/maa-discover.js";

async function main(): Promise<void> {
  const audit = await discoverMaaSources();

  console.log("MAA discovery preview");
  console.log(`- discoveredCount: ${audit.discoveredCount}`);
  console.log(`- approvedCandidateCount: ${audit.approvedCandidateCount}`);
  console.log(`- pageCount: ${audit.pageCount}`);
  console.log(`- pdfCount: ${audit.pdfCount}`);
  console.log("- output: apps/api/.data/maa/source-audit.json");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});