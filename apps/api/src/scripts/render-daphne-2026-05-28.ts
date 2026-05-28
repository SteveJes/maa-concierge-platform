/**
 * Render Daphné's 2026-05-28 batch to images + extract the annotated xlsx.
 *
 * Steve's instruction: "read every single pixel" — so we RENDER the PDFs to PNG
 * (the earlier text-only extraction missed embedded screenshots + visual tables)
 * and pull the xlsx cell COMMENTS (Daphné annotated a conversation).
 *
 * Output: apps/api/_inbox/daphne-2026-05-28/
 *   - <pdf>-pXX.png      (one PNG per PDF page, high DPI)
 *   - <xlsx>.md          (rows + per-cell comments)
 *
 * Usage: cd apps/api && npx tsx src/scripts/render-daphne-2026-05-28.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional CLI arg: --src "<folder name under apps/web/public>" --out "<out subdir>"
const srcArgIdx = process.argv.indexOf("--src");
const outArgIdx = process.argv.indexOf("--out");
const SRC_FOLDER = srcArgIdx >= 0 ? process.argv[srcArgIdx + 1]! : "DAPHNE 28 05 2026";
const OUT_SUBDIR = outArgIdx >= 0 ? process.argv[outArgIdx + 1]! : "daphne-2026-05-28";
const SRC_DIR = path.resolve(__dirname, `../../../../apps/web/public/${SRC_FOLDER}`);
const OUT_DIR = path.resolve(__dirname, `../../_inbox/${OUT_SUBDIR}`);

function safeName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "_").toLowerCase();
}

async function renderPdf(absPath: string, filename: string): Promise<void> {
  const base = safeName(filename);
  const fileBuf = await fs.readFile(absPath);
  // numPages from one fresh copy (getDocumentProxy detaches the buffer it's given).
  const total = (await getDocumentProxy(new Uint8Array(fileBuf))).numPages;
  for (let pageNum = 1; pageNum <= total; pageNum++) {
    // Fresh copy per render — pdfjs transfers/detaches the underlying buffer.
    // Local-only tooling: @napi-rs/canvas is not a prod dependency. The
    // specifier is held in a variable so tsc doesn't try to resolve it during
    // the prod typecheck/build (the module is present only on dev machines
    // where this render script is run). Install it with:
    //   pnpm --filter @platform/api add -D @napi-rs/canvas
    const canvasPkg = "@napi-rs/canvas";
    const png = await renderPageAsImage(new Uint8Array(fileBuf), pageNum, {
      scale: 2.5,
      canvasImport: () => import(/* @vite-ignore */ canvasPkg) as never,
    });
    const outPath = path.join(OUT_DIR, `${base}-p${String(pageNum).padStart(2, "0")}.png`);
    await fs.writeFile(outPath, Buffer.from(png));
  }
  console.log(`[pdf]  ${filename} → ${total} page(s)`);
}

async function extractXlsxWithComments(absPath: string, filename: string): Promise<void> {
  const buf = await fs.readFile(absPath);
  const wb = XLSX.read(buf, { type: "buffer", cellStyles: true });
  const base = safeName(filename);
  let md = `# ${filename}\n\n`;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const ref = ws["!ref"];
    md += `\n## Sheet: ${sheetName}\n\n`;
    if (!ref) { md += "_(empty)_\n"; continue; }

    const range = XLSX.utils.decode_range(ref);
    // Render as rows; flag any cell that carries a comment.
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowCells: string[] = [];
      const rowComments: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as (XLSX.CellObject & { c?: Array<{ t: string; a?: string }> }) | undefined;
        if (!cell) continue;
        const val = cell.w ?? (cell.v != null ? String(cell.v) : "");
        if (val) rowCells.push(`[${XLSX.utils.encode_col(c)}] ${val}`);
        if (cell.c && cell.c.length) {
          for (const cmt of cell.c) {
            rowComments.push(`💬 (cell ${addr}${cmt.a ? `, ${cmt.a}` : ""}): ${cmt.t}`);
          }
        }
      }
      if (rowCells.length === 0 && rowComments.length === 0) continue;
      md += `### Row ${r + 1}\n`;
      for (const rc of rowCells) md += `- ${rc}\n`;
      for (const cm of rowComments) md += `- ${cm}\n`;
      md += "\n";
    }
  }

  const outPath = path.join(OUT_DIR, `${base}.md`);
  await fs.writeFile(outPath, md, "utf8");
  console.log(`[xlsx] ${filename} → ${path.relative(process.cwd(), outPath)}`);
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const entries = (await fs.readdir(SRC_DIR)).sort();
  for (const entry of entries) {
    const abs = path.join(SRC_DIR, entry);
    if (!(await fs.stat(abs)).isFile()) continue;
    if (entry.toLowerCase().endsWith(".pdf")) await renderPdf(abs, entry);
    else if (entry.toLowerCase().endsWith(".xlsx")) await extractXlsxWithComments(abs, entry);
  }
  console.log(`\nDone. Output: ${OUT_DIR}`);
  const out = (await fs.readdir(OUT_DIR)).sort();
  console.log(out.join("\n"));
}

main().catch((err) => { console.error(err); process.exit(1); });
