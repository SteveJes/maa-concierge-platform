/**
 * One-shot extractor for Daphné's 2026-05-27 batch.
 *
 * Reads every file in apps/web/public/DAPHNE 27 05 2026/ and writes:
 *   - apps/api/_inbox/daphne-2026-05-27/<file>.txt  (full text dump)
 *   - apps/api/_inbox/daphne-2026-05-27/<file>.pages.json (per-page text for PDFs, per-sheet rows for xlsx)
 *   - apps/api/_inbox/daphne-2026-05-27/_summary.md (page counts, sparse-page flags, xlsx sheet list)
 *
 * Then Claude reads the txt/md/json directly and decides which pages need PNG rendering.
 *
 * Usage: cd apps/api && npx tsx src/scripts/read-daphne-2026-05-27.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(
  __dirname,
  "../../../../apps/web/public/DAPHNE 27 05 2026",
);
const OUT_DIR = path.resolve(__dirname, "../../_inbox/daphne-2026-05-27");

const SPARSE_TEXT_THRESHOLD = 80;

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

function safeName(filename: string) {
  return filename.replace(/[^a-z0-9._-]+/gi, "_").toLowerCase();
}

async function extractPdf(absPath: string, filename: string) {
  const bytes = new Uint8Array(await fs.readFile(absPath));
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text : [text];

  const base = safeName(filename.replace(/\.pdf$/i, ""));
  const txtPath = path.join(OUT_DIR, `${base}.txt`);
  const jsonPath = path.join(OUT_DIR, `${base}.pages.json`);

  const flatText = pages
    .map((p, i) => `\n\n===== PAGE ${i + 1} / ${totalPages} =====\n\n${p ?? ""}`)
    .join("");
  await fs.writeFile(txtPath, flatText, "utf-8");
  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      pages.map((p, i) => ({ page: i + 1, text: (p ?? "").trim(), chars: (p ?? "").length })),
      null,
      2,
    ),
    "utf-8",
  );

  const sparsePages = pages
    .map((p, i) => ({ page: i + 1, chars: (p ?? "").trim().length }))
    .filter((p) => p.chars < SPARSE_TEXT_THRESHOLD)
    .map((p) => p.page);

  return {
    kind: "pdf" as const,
    filename,
    totalPages,
    txtPath: path.relative(process.cwd(), txtPath),
    jsonPath: path.relative(process.cwd(), jsonPath),
    sparsePages,
  };
}

async function extractXlsx(absPath: string, filename: string) {
  const buf = await fs.readFile(absPath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const base = safeName(filename.replace(/\.xlsx$/i, ""));
  const sheets: Array<{ name: string; rows: unknown[][]; csv: string }> = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
    const csv = XLSX.utils.sheet_to_csv(ws);
    sheets.push({ name, rows, csv });
  }

  const jsonPath = path.join(OUT_DIR, `${base}.sheets.json`);
  const mdPath = path.join(OUT_DIR, `${base}.md`);

  await fs.writeFile(jsonPath, JSON.stringify(sheets, null, 2), "utf-8");

  let md = `# ${filename}\n\n`;
  for (const s of sheets) {
    md += `\n## Sheet: ${s.name} (${s.rows.length} rows)\n\n`;
    md += "```csv\n" + s.csv + "\n```\n";
  }
  await fs.writeFile(mdPath, md, "utf-8");

  return {
    kind: "xlsx" as const,
    filename,
    sheets: sheets.map((s) => ({ name: s.name, rows: s.rows.length })),
    jsonPath: path.relative(process.cwd(), jsonPath),
    mdPath: path.relative(process.cwd(), mdPath),
  };
}

async function main() {
  await ensureOutDir();
  const entries = await fs.readdir(SRC_DIR);
  const results: any[] = [];

  for (const entry of entries.sort()) {
    const abs = path.join(SRC_DIR, entry);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;

    if (entry.toLowerCase().endsWith(".pdf")) {
      console.log(`[pdf]  ${entry}`);
      results.push(await extractPdf(abs, entry));
    } else if (entry.toLowerCase().endsWith(".xlsx")) {
      console.log(`[xlsx] ${entry}`);
      results.push(await extractXlsx(abs, entry));
    } else {
      console.log(`[skip] ${entry}`);
    }
  }

  let summary = `# Daphné batch 2026-05-27 — extraction summary\n\nSource: ${SRC_DIR}\nOut: ${OUT_DIR}\n\n`;
  for (const r of results) {
    if (r.kind === "pdf") {
      summary += `## ${r.filename}\n- pages: ${r.totalPages}\n- text dump: \`${r.txtPath}\`\n- per-page JSON: \`${r.jsonPath}\`\n`;
      if (r.sparsePages.length) {
        summary += `- ⚠️ sparse-text pages (likely image/screenshot — need PNG render): ${r.sparsePages.join(", ")}\n`;
      } else {
        summary += `- ✅ text extraction looks complete\n`;
      }
      summary += "\n";
    } else if (r.kind === "xlsx") {
      summary += `## ${r.filename}\n- sheets: ${r.sheets.map((s: any) => `${s.name} (${s.rows} rows)`).join(", ")}\n- markdown: \`${r.mdPath}\`\n- JSON: \`${r.jsonPath}\`\n\n`;
    }
  }
  await fs.writeFile(path.join(OUT_DIR, "_summary.md"), summary, "utf-8");
  console.log("\nDone. Summary:");
  console.log(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
