import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Candidate = {
  final_url: string;
  content_type: "page" | "pdf";
  locale: "fr-CA" | "en-CA";
  approved_candidate: boolean;
};

type Audit = {
  candidates: Candidate[];
};

function makeKey(urlString: string, locale: "fr-CA" | "en-CA"): string {
  const url = new URL(urlString);
  let slug = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "_");
  if (!slug) slug = "homepage";
  return `maa_${slug}_${locale === "en-CA" ? "en" : "fr"}`;
}

function detectPdfLocale(urlString: string): "fr-CA" | "en-CA" {
  const lower = urlString.toLowerCase();

  if (
    lower.includes("_en.") ||
    lower.includes("_english.") ||
    lower.includes("-en.") ||
    lower.includes("_en_")
  ) {
    return "en-CA";
  }

  return "fr-CA";
}

function guessSection(urlString: string): string {
  const p = new URL(urlString).pathname.toLowerCase();

  if (p === "/fr" || p === "/en") return "homepage";
  if (p.includes("abonnement") || p.includes("membership")) return "membership";
  if (p.includes("nous-joindre") || p.includes("contact-us")) return "contact";
  if (p.includes("planifier-une-visite") || p.includes("book-a-tour")) return "book_a_tour";
  if (p.includes("cours") || p.includes("classes")) return "classes";
  if (p.includes("entrainement") || p.includes("training-and-sports")) return "training";
  if (p.includes("spa")) return "spa";
  if (p.includes("physiotherapie") || p.includes("physiotherapy")) return "physiotherapy";
  if (p.includes("massotherapie") || p.includes("massage-therapy")) return "massage_therapy";
  if (p.includes("therapie-sportive") || p.includes("athletic-therapy")) return "athletic_therapy";
  if (p.includes("services-medicaux") || p.includes("physician-services")) return "medical_services";
  if (p.includes("service-soins-infirmiers") || p.includes("nursing-services")) return "nursing_services";
  if (p.includes("nutrition")) return "nutrition";
  if (p.includes("pilates")) return "pilates";
  if (p.includes("restaurant-le-1881")) return "restaurant";
  if (p.includes("clubs-affilies") || p.includes("reciprocal-clubs")) return "reciprocal_clubs";
  if (p.includes("politique-de-confidentialite") || p.includes("privacy-policy")) return "policies";
  if (p.includes("salle-de-detente") || p.includes("relaxation-room")) return "relaxation_room";
  return "general";
}

function shouldKeepPdf(urlString: string): boolean {
  const lower = urlString.toLowerCase();

  if (lower.includes("1881_menu")) return false;
  if (lower.includes("menu_cartedesvins")) return false;
  if (lower.includes("_bio_")) return false;
  if (lower.includes("bio_")) return false;

  return true;
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../../../");

  const auditPath = path.join(repoRoot, "apps/api/.data/maa/source-audit.json");
  const outPath = path.join(repoRoot, "clients/maa/approved-sources.generated.json");

  const raw = await fs.readFile(auditPath, "utf8");
  const audit = JSON.parse(raw) as Audit;

  const sources = audit.candidates
  .filter((c) => c.approved_candidate)
  .filter((c) => c.content_type === "page" || shouldKeepPdf(c.final_url))
  .map((c) => {
    const locale = c.content_type === "pdf" ? detectPdfLocale(c.final_url) : c.locale;
    const sourceKind = c.content_type === "pdf" ? "pdf_document" : "website_page";

    return {
      key: makeKey(c.final_url, locale),
      locale,
      section: guessSection(c.final_url),
      sourceKind,
      sourceUrl: c.final_url,
      enabled: true,
      priority: sourceKind === "pdf_document" ? 4 : 5,
      updateStrategy: "manual",
      parsingMode: sourceKind === "pdf_document" ? "pdf_text" : "html_readability",
      normalizationHints: {},
      uploadBatchHints: {
        preferredBatchTag: guessSection(c.final_url),
      },
      tags: [],
    };
  });

  const output = {
  tenantId: "maa",
  tenantName: "Club Sportif MAA",
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA", "en-CA"],
  sources,
};

await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        output: outPath,
        count: sources.length,
        preview: sources.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});