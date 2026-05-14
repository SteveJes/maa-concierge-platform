/**
 * Dump full text of a page range from the extracted PDF, for Claude to read.
 * Usage: pnpm.cmd --filter @platform/api tsx src/scripts/dump-daphne-pages.ts 1-10
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface PageRecord { pageNumber: number; text: string; charCount: number; links: string[]; }
interface ExtractionFile { totalPages: number; pages: PageRecord[]; }

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const apiRoot = path.resolve(__dirname, "../../");
  const data = JSON.parse(await readFile(path.join(apiRoot, "_inbox", "_extracted", "extraction.json"), "utf8")) as ExtractionFile;

  const arg = process.argv[2] ?? "1-10";
  const [s, e] = arg.split("-").map(Number);
  const start = s ?? 1;
  const end = e ?? start;

  for (const p of data.pages) {
    if (p.pageNumber < start || p.pageNumber > end) continue;
    console.log(`\n========== PAGE ${p.pageNumber} (${p.charCount}c, ${p.links.length} links) ==========`);
    console.log(p.text);
    if (p.links.length > 0) {
      console.log(`\n-- LINKS ON THIS PAGE --`);
      for (const l of p.links) console.log(`  ${l}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
