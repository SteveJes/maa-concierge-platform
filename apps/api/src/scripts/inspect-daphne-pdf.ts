/**
 * Bird's-eye-view helper: print one short line per page of the extracted PDF
 * so Claude can find the TOC, section boundaries, and high-signal pages
 * without reading the full 400KB extraction.json.
 *
 * Usage: pnpm.cmd --filter @platform/api tsx src/scripts/inspect-daphne-pdf.ts [--range 1-50]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface PageRecord {
  pageNumber: number;
  text: string;
  charCount: number;
  links: string[];
  needsVision: boolean;
  visionReason: string | null;
}

interface ExtractionFile {
  totalPages: number;
  pages: PageRecord[];
}

const HEADER_PATTERN = /^Club Sportif MAA\s*-\s*Base de connaissances/i;

function firstSignificantLine(text: string, maxLen = 110): string {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  // Skip header lines + bare page numbers
  const filtered = lines.filter((l) => !HEADER_PATTERN.test(l) && !/^p\.?\s*\d+\s*\/?\s*\d*$/.test(l) && !/^\d{1,3}$/.test(l));
  const first = filtered[0] ?? lines[0] ?? "";
  if (first.length <= maxLen) return first;
  return first.slice(0, maxLen) + "…";
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const apiRoot = path.resolve(__dirname, "../../");
  const extractionPath = path.join(apiRoot, "_inbox", "_extracted", "extraction.json");

  const raw = await readFile(extractionPath, "utf8");
  const data = JSON.parse(raw) as ExtractionFile;

  const args = process.argv.slice(2);
  const rangeIdx = args.indexOf("--range");
  let start = 1;
  let end = data.totalPages;
  if (rangeIdx >= 0 && args[rangeIdx + 1]) {
    const [s, e] = args[rangeIdx + 1]!.split("-").map(Number);
    if (s) start = s;
    if (e) end = e;
  }

  console.log(`# Daphné PDF — bird's-eye view (pages ${start}-${end} of ${data.totalPages})\n`);
  for (const p of data.pages) {
    if (p.pageNumber < start || p.pageNumber > end) continue;
    const vision = p.needsVision ? `[V:${p.visionReason?.split(":")[0]}]` : "      ";
    const linkN = p.links.length > 0 ? `L${p.links.length}` : "  ";
    const head = firstSignificantLine(p.text);
    console.log(`p.${String(p.pageNumber).padStart(3, "0")} ${String(p.charCount).padStart(5)}c ${linkN.padStart(3)} ${vision} ${head}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
