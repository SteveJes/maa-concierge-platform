import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INTERNAL_HOSTS = new Set(["clubsportifmaa.com", "www.clubsportifmaa.com"]);

const BLOCKED_PATH_PATTERNS = [
  "/feed",
  "/comments",
  "/wp-json",
  "/xmlrpc.php",
  "/wp-content/",
  "/wp-includes/",
  "/category/",
  "/class-category/",
  "/class-type/",
  "/type-of-expert/",
  "/our-experts/",
] as const;

const ASSET_EXT_RE =
  /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|zip|rar|7z|tar|gz)$/i;

const PDF_EXT_RE = /\.pdf$/i;

const DEFAULT_SEEDS = [
  "https://www.clubsportifmaa.com/",
  "https://www.clubsportifmaa.com/en/",
  "https://www.clubsportifmaa.com/sitemap.xml",
  "https://www.clubsportifmaa.com/en/sitemap.xml",
  "https://www.clubsportifmaa.com/sitemap_index.xml",
];

const ALLOWED_PAGE_PATHS = new Set([
  "/fr",
  "/en",
  "/fr/abonnement-gym-montreal",
  "/en/membership",
  "/fr/nous-joindre-gym-montreal",
  "/en/contact-us",
  "/fr/planifier-une-visite-gym-montreal",
  "/en/book-a-tour-gym-montreal",
  "/fr/spa",
  "/en/spa",
  "/fr/physiotherapie",
  "/en/physiotherapy",
  "/fr/massotherapie",
  "/en/massage-therapy",
  "/fr/therapie-sportive",
  "/en/athletic-therapy",
  "/fr/services-medicaux",
  "/en/physician-services",
  "/fr/service-soins-infirmiers",
  "/en/nursing-services",
  "/fr/nutrition",
  "/en/nutrition",
  "/fr/pilates-sur-appareils",
  "/en/pilates-on-apparatus",
  "/fr/restaurant-le-1881",
  "/en/restaurant-le-1881",
  "/fr/clubs-affilies",
  "/en/reciprocal-clubs",
  "/fr/politique-de-confidentialite",
  "/en/privacy-policy",
  "/fr/entrainement",
  "/en/training-and-sports",
  "/fr/cours",
  "/en/classes",
  "/fr/salle-de-detente",
  "/en/relaxation-room",
]);

export interface DiscoverMaaOptions {
  repoRoot?: string;
  maxPages?: number;
}

export interface MaaDiscoveryCandidate {
  url: string;
  final_url: string;
  status_code: number | null;
  discovered_from: string | null;
  content_type: "page" | "pdf";
  locale: "fr-CA" | "en-CA";
  approved_candidate: boolean;
  exclusion_reason: string | null;
}

export interface MaaDiscoveryAudit {
  generatedAt: string;
  tenantId: "maa";
  discoveredCount: number;
  approvedCandidateCount: number;
  pageCount: number;
  pdfCount: number;
  candidates: MaaDiscoveryCandidate[];
}

function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.hash = "";

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

function detectLocale(urlString: string): "fr-CA" | "en-CA" {
  const { pathname } = new URL(urlString);
  return pathname === "/en" || pathname.startsWith("/en/") ? "en-CA" : "fr-CA";
}

function isInternal(urlString: string): boolean {
  const parsed = new URL(urlString);
  return INTERNAL_HOSTS.has(parsed.hostname);
}

function isPdfUrl(urlString: string): boolean {
  return PDF_EXT_RE.test(new URL(urlString).pathname);
}

function shouldExclude(urlString: string): string | null {
  const parsed = new URL(urlString);
  const lowerPath = parsed.pathname.toLowerCase();

  if (parsed.searchParams.has("p")) return "wordpress_post_id";
  if (/^\/(?:fr|en)(?:\/\d{4}\/\d{2}\/\d{2})\/?$/.test(lowerPath)) return "date_archive";
  if (lowerPath === "/feed" || lowerPath.endsWith("/feed")) return "blocked_path";

  if (lowerPath.includes("itemdataobject.url")) return "placeholder_slug";
  if (/^\/(?:en\/)?\d{4}\/\d{2}\/\d{2}$/.test(lowerPath)) return "date_archive";
  if (lowerPath === "/fr") return null;
  if (lowerPath === "/en") return null;

  if (!isInternal(urlString)) return "external_link";
  if (BLOCKED_PATH_PATTERNS.some((segment) => lowerPath === segment || lowerPath.includes(segment))) {
    return "blocked_path";
  }
  if (ASSET_EXT_RE.test(lowerPath)) return "asset_url";
  if (parsed.search) return "query_string";
  if (lowerPath.includes("%7b") || lowerPath.includes("{{")) return "template_placeholder";
  if (/\/page\/\d+$/i.test(lowerPath)) return "pagination";
  return null;
}

function isAllowedCustomerServiceCandidate(candidate: MaaDiscoveryCandidate): boolean {
  if (candidate.content_type === "pdf") {
    return true;
  }

  const parsed = new URL(candidate.final_url);
  const cleanPath = parsed.pathname.replace(/\/+$/, "") || "/";

  return ALLOWED_PAGE_PATHS.has(cleanPath);
}

function extractHrefLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefRe = /href\s*=\s*(["'])(.*?)\1/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    const rawHref = match[2]?.trim();
    if (!rawHref) continue;
    if (rawHref.startsWith("#")) continue;
    if (rawHref.startsWith("mailto:")) continue;
    if (rawHref.startsWith("tel:")) continue;
    if (rawHref.startsWith("javascript:")) continue;

    try {
      const resolved = normalizeUrl(new URL(rawHref, baseUrl).toString());
      links.add(resolved);
    } catch {
      // ignore bad links
    }
  }

  return [...links];
}

function extractSitemapLinks(xml: string): string[] {
  const links = new Set<string>();
  const locRe = /<loc>([\s\S]*?)<\/loc>/gi;

  let match: RegExpExecArray | null;
  while ((match = locRe.exec(xml)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      links.add(normalizeUrl(raw));
    } catch {
      // ignore bad loc values
    }
  }

  return [...links];
}

export async function discoverMaaSources(
  options: DiscoverMaaOptions = {},
): Promise<MaaDiscoveryAudit> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = options.repoRoot ?? path.resolve(__dirname, "../../../../");
  const maxPages = options.maxPages ?? 120;

  const queue = [...DEFAULT_SEEDS];
  const visited = new Set<string>();
  const discovered = new Map<string, MaaDiscoveryCandidate>();

  while (queue.length > 0 && visited.size < maxPages) {
    const current = queue.shift();
    if (!current) break;

    let normalizedCurrent: string;
    try {
      normalizedCurrent = normalizeUrl(current);
    } catch {
      continue;
    }

    if (visited.has(normalizedCurrent)) continue;
    visited.add(normalizedCurrent);

    const exclusionReason = shouldExclude(normalizedCurrent);
    const pdf = isPdfUrl(normalizedCurrent);

    if (exclusionReason && !pdf) {
      discovered.set(normalizedCurrent, {
        url: normalizedCurrent,
        final_url: normalizedCurrent,
        status_code: null,
        discovered_from: null,
        content_type: "page",
        locale: detectLocale(normalizedCurrent),
        approved_candidate: false,
        exclusion_reason: exclusionReason,
      });
      continue;
    }

    try {
      const response = await fetch(normalizedCurrent, { redirect: "follow" });
      const finalUrl = normalizeUrl(response.url);
      const statusCode = response.status;

      let contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      let candidateType: "page" | "pdf" = isPdfUrl(finalUrl) ? "pdf" : "page";

      if (contentType.includes("application/pdf")) {
        candidateType = "pdf";
      }

      const finalExclusionReason = shouldExclude(finalUrl);

      const approved =
        response.ok &&
        isInternal(finalUrl) &&
        !finalExclusionReason &&
        (candidateType === "pdf" || contentType.includes("text/html") || contentType.includes("xml"));

      discovered.set(finalUrl, {
        url: normalizedCurrent,
        final_url: finalUrl,
        status_code: statusCode,
        discovered_from: null,
        content_type: candidateType,
        locale: detectLocale(finalUrl),
        approved_candidate: approved && candidateType === "pdf"
          ? true
          : approved && !finalUrl.endsWith(".xml"),
        exclusion_reason: approved ? null : finalExclusionReason ?? `status_${statusCode}`,
      });

      if (!response.ok) continue;

      if (contentType.includes("xml")) {
        const xml = await response.text();
        const sitemapLinks = extractSitemapLinks(xml);

        for (const nextUrl of sitemapLinks) {
          if (!visited.has(nextUrl)) {
            queue.push(nextUrl);
          }
        }
        continue;
      }

      if (candidateType === "pdf") {
        continue;
      }

      if (!contentType.includes("text/html")) {
        continue;
      }

      const html = await response.text();
      const hrefLinks = extractHrefLinks(html, finalUrl);

      for (const nextUrl of hrefLinks) {
        const nextExclusionReason = shouldExclude(nextUrl);
        const nextPdf = isPdfUrl(nextUrl);

        if (!discovered.has(nextUrl)) {
          discovered.set(nextUrl, {
            url: nextUrl,
            final_url: nextUrl,
            status_code: null,
            discovered_from: finalUrl,
            content_type: nextPdf ? "pdf" : "page",
            locale: detectLocale(nextUrl),
            approved_candidate: !nextExclusionReason || nextPdf,
            exclusion_reason: nextExclusionReason,
          });
        }

        if (isInternal(nextUrl) && (!nextExclusionReason || nextPdf) && !visited.has(nextUrl)) {
          queue.push(nextUrl);
        }
      }
    } catch {
      discovered.set(normalizedCurrent, {
        url: normalizedCurrent,
        final_url: normalizedCurrent,
        status_code: null,
        discovered_from: null,
        content_type: pdf ? "pdf" : "page",
        locale: detectLocale(normalizedCurrent),
        approved_candidate: false,
        exclusion_reason: "fetch_failed",
      });
    }
  }

  const candidates = [...discovered.values()]
  .filter((candidate) => candidate.content_type === "page" || candidate.content_type === "pdf")
  .filter((candidate) => candidate.final_url.startsWith("http://") || candidate.final_url.startsWith("https://"))
  .filter((candidate) => !candidate.final_url.endsWith(".xml"))
  .filter((candidate) => {
    const parsed = new URL(candidate.final_url);
    const lowerPath = parsed.pathname.toLowerCase();

    if (candidate.content_type === "page" && parsed.searchParams.has("p")) {
      return false;
    }

    if (
      candidate.content_type === "page" &&
      /^\/(?:fr|en)(?:\/\d{4}\/\d{2}\/\d{2})\/?$/.test(lowerPath)
    ) {
      return false;
    }

    if (candidate.content_type === "page" && (lowerPath === "/feed" || lowerPath.endsWith("/feed"))) {
      return false;
    }

    return true;
  })
  .sort((a, b) => a.final_url.localeCompare(b.final_url));

  const approved = candidates.filter(
  (candidate) => candidate.approved_candidate && isAllowedCustomerServiceCandidate(candidate),
);
  const pageCount = approved.filter((candidate) => candidate.content_type === "page").length;
  const pdfCount = approved.filter((candidate) => candidate.content_type === "pdf").length;

  const filteredCandidates = candidates.map((candidate) => {
  const allowed = candidate.approved_candidate && isAllowedCustomerServiceCandidate(candidate);

  return {
    ...candidate,
    approved_candidate: allowed,
    exclusion_reason: allowed
      ? null
      : candidate.exclusion_reason ?? "not_in_customer_service_whitelist",
  };
});

const audit: MaaDiscoveryAudit = {
  generatedAt: new Date().toISOString(),
  tenantId: "maa",
  discoveredCount: filteredCandidates.length,
  approvedCandidateCount: approved.length,
  pageCount,
  pdfCount,
  candidates: filteredCandidates,
};

  const outputPath = path.join(repoRoot, "apps", "api", ".data", "maa", "source-audit.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  return audit;
}