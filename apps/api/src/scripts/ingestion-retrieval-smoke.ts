import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface ArtifactLine {
  section: string;
  locale: string;
  passage: string;
}

async function loadLatestArtifact(tenantId: string): Promise<ArtifactLine[]> {
  const dir = path.join(process.cwd(), "artifacts", "retrieval", tenantId);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".jsonl")).sort();
  if (files.length === 0) {
    throw new Error(`No retrieval artifact found for tenant ${tenantId}. Run ingest first.`);
  }

  const latest = files[files.length - 1];
  const raw = await readFile(path.join(dir, latest), "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ArtifactLine);
}

function search(lines: ArtifactLine[], query: string): ArtifactLine[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return lines
    .map((line) => {
      const hay = `${line.section} ${line.passage}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0);
      return { line, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.line);
}

async function main() {
  const tenantId = process.argv[2] ?? "maa";
  const lines = await loadLatestArtifact(tenantId);

  const topics = ["membership", "class schedule", "aquatic pool", "contact"];
  const results = topics.map((topic) => ({ topic, matches: search(lines, topic) }));

  console.log(JSON.stringify({ tenantId, topics: results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
