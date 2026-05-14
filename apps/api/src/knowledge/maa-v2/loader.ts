/**
 * Typed reader for the MAA v2 knowledge base.
 *
 * Source: Daphné's 203-page PDF + email, encoded into the JSON files in this folder.
 * Loaded ONCE at module init (synchronously). Re-deployment picks up changes.
 *
 * This is the consumption layer for everything in apps/api/src/knowledge/maa-v2/.
 * The new prompt builder + retrieval logic + lead routing all read through here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Bilingual string. Daphné wrote the FR; DUBUB team filled the EN translations.
 * Use `pickLocalized(b, locale)` to pull the right one.
 */
export interface BiString {
  fr: string;
  en: string;
}

export function pickLocalized(b: BiString, locale: string | undefined): string {
  if (locale === "en-CA" || locale?.startsWith("en")) return b.en;
  return b.fr;
}

export type MaaV2ConfidenceLevel = "confirmed" | "toValidate" | "dated" | "contradictory" | "confirmed-but-availability-changes" | "confirmed-schedule-not-availability";

export interface MaaV2ConfidenceDefinition {
  label: string;
  definition: string;
  behaviour: string;
}

export interface MaaV2BlocType {
  label: string;
  nature: string;
  use: string;
}

export interface MaaV2Rules {
  confidenceLevels: Record<"confirmed" | "toValidate" | "dated" | "contradictory", MaaV2ConfidenceDefinition>;
  sourcePriority: string[];
  separationRule: string;
  forbiddenPhrases: string[];
  replacementPhrasesWhenInformationMissing: { fr: string[]; en: string[] };
  blocTypes: Record<string, MaaV2BlocType>;
  globalPrudenceRules: string[];
  masterConversationRule: {
    steps: string[];
    idealReplyTemplate: BiString;
  };
  conciergeIdentity: {
    fr: string[];
    en: string[];
    mustAlways: { fr: string[]; en: string[] };
  };
}

export interface MaaV2Intent {
  id: string;
  label: BiString;
  examples: string[];
  clarificationQuestion: BiString;
  departmentByAnswer: Record<string, string>;
  action: BiString;
  ctaTemplate: BiString;
  fallback: BiString;
}

export interface MaaV2Clarification {
  word: string;
  aliases: string[];
  possibleMeanings: string[];
  clarificationQuestion: BiString;
  prudenceRule: BiString;
}

export interface MaaV2ConfusionZone {
  department: BiString;
  confusion: BiString;
  rule: BiString;
  primaryContact: string;
  secondaryContact: string | null;
  tertiaryContact?: string;
  confidence: MaaV2ConfidenceLevel;
  note: BiString;
}

export interface MaaV2CtaByService {
  service: string;
  intent: string;
  softConversion: string;
  cta: BiString;
}

export interface MaaV2Ctas {
  ctasByService: MaaV2CtaByService[];
  _fallbackUniversalCta: BiString;
  _aiCallFallbackCta: BiString;
}

export interface MaaV2Contact {
  id: string;
  department: string;
  name: string;
  role: string | null;
  location: string;
  phone: string;
  extension: string | null;
  email: string | null;
  recommendationLogic: string;
  confidence: MaaV2ConfidenceLevel;
  isFallback?: boolean;
  notes?: string[];
}

export interface MaaV2Contacts {
  contacts: Record<string, MaaV2Contact>;
  routingRules: {
    ifUncertain: string;
    ifMedicalSensitive: string;
    ifAffiliatedClubAccess: string;
  };
}

export interface MaaV2StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  extension: string | null;
  realEmail: string | null;
  _realEmailMissing?: boolean;
  routingTriggers: string[];
  leadTemplate?: { subject: string; summary: string };
  leadFallback?: string;
  safetyRule?: string;
  isFallback?: boolean;
}

export interface MaaV2Staff {
  routingMode: "shadow" | "live";
  shadowRecipients: string[];
  staff: MaaV2StaffMember[];
  missingContacts: Array<{ name: string; role: string; note: string }>;
}

export interface MaaV2Hour {
  id: string;
  service: string;
  schedule: Record<string, string>;
  source: string;
  confidence: MaaV2ConfidenceLevel;
  responseRule: string;
}

export interface MaaV2PriceItem {
  id: string;
  item: string;
  price: string;
  source: string;
  confidence: MaaV2ConfidenceLevel;
  responseRule: string;
}

export interface MaaV2SourcesVivantes {
  hours: MaaV2Hour[];
  pricing: MaaV2PriceItem[];
  _pendingValidation: string[];
}

export interface MaaV2Link {
  id: string;
  label: string;
  url: string;
  intent: string;
  confidence: MaaV2ConfidenceLevel;
  isPrimaryCta?: boolean;
  openLink?: string;
  note?: string;
}

export interface MaaV2Links {
  schedules: MaaV2Link[];
  pricing: MaaV2Link[];
  reservations: MaaV2Link[];
  appointments: MaaV2Link[];
  bookingPlatforms: Array<{ platform: string; url?: string; note: string }>;
  _uiContract: string;
}

export interface MaaV2Index {
  tenantCode: string;
  version: string;
  status: string;
  source: {
    pdf: string;
    pdfPages: number;
    pdfBytes: number;
    email: string;
    compiledBy: string;
    receivedAt: string | null;
    metaExtractedAt: string | null;
  };
  completion: Record<string, { status: string; sourcePages?: string; files?: string[]; summary?: string; plannedSections?: string[]; flaggedPages?: number }>;
  leadRouting: {
    mode: "shadow" | "live";
    shadowRecipients: string[];
    note: string;
  };
  notes: string;
}

export interface MaaV2Category {
  id: string;
  label: BiString;
  typicalIntent: string;
  expectedAnswer: string;
  resource: string;
  primaryContact: string;
  secondaryContact?: string;
  recommendedAction: string;
  upsellOptions: string[];
  limit: string;
  typeSentence?: string | null;
  extraInstruction?: string | null;
  nonMemberRule?: string;
  commonPolicies?: string[];
  chef?: { name: string; role: string };
}

export interface MaaV2Categories {
  categories: MaaV2Category[];
  siteStructure: {
    topLevelSections: string[];
    programmationSubsections: string[];
    cliniqueSubsections: string[];
    referenceHierarchy: string;
    knownStaleSources: string[];
  };
}

export interface MaaV2VoiceTone {
  register: { level: string; tone: string; formality: string; attitude: string; voiceCue: string };
  vocabulary: { favored: string[]; avoided: string[] };
  styleByResponseLength: { short: BiString; long: BiString };
  softnessRule: BiString;
  nonMemberRule: BiString;
  templateNonMemberReply: BiString;
  upsellRules: { _principle: string; examples: Record<string, string> };
  whenToTransferToHuman: string[];
  whenToProposeAiCall: string[];
  missingInfoStructure: { _principle: string; steps: string[]; template: BiString };
  sourceHierarchy: { _purpose: string; order: string[] };
}

export interface MaaV2Knowledge {
  rules: MaaV2Rules;
  intents: MaaV2Intent[];
  clarifications: MaaV2Clarification[];
  confusionZones: MaaV2ConfusionZone[];
  ctas: MaaV2Ctas;
  contacts: MaaV2Contacts;
  staff: MaaV2Staff;
  sourcesVivantes: MaaV2SourcesVivantes;
  links: MaaV2Links;
  categories: MaaV2Categories;
  voiceTone: MaaV2VoiceTone;
  index: MaaV2Index;
}

// ── Loader (sync, cached) ────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production the API runs from dist/, but tsc doesn't copy JSON files. The
// JSON ships in src/ (deployed via git pull). At runtime, __dirname looks like
// `/var/www/concierge/apps/api/dist/apps/api/src/knowledge/maa-v2`. The
// matching source path is `/var/www/concierge/apps/api/src/knowledge/maa-v2`,
// so we strip the `/dist/apps/api` segment entirely.
const jsonDir = __dirname.replace(/[\\\/]dist[\\\/]apps[\\\/]api(?=[\\\/])/, "");

function readJson<T>(filename: string): T {
  const filePath = path.join(jsonDir, filename);
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

let cached: MaaV2Knowledge | null = null;

export function loadMaaV2(): MaaV2Knowledge {
  if (cached) return cached;

  const rules = readJson<MaaV2Rules>("rules.json");
  const intentsRaw = readJson<{ intents: MaaV2Intent[] }>("intents.json");
  const clarificationsRaw = readJson<{ vagueWords: MaaV2Clarification[] }>("clarifications.json");
  const confusionRaw = readJson<{ zones: MaaV2ConfusionZone[] }>("confusion-zones.json");
  const ctas = readJson<MaaV2Ctas>("ctas.json");
  const contacts = readJson<MaaV2Contacts>("contacts.json");
  const staff = readJson<MaaV2Staff>("staff.json");
  const sourcesVivantes = readJson<MaaV2SourcesVivantes>("sources-vivantes.json");
  const links = readJson<MaaV2Links>("links.json");
  const categories = readJson<MaaV2Categories>("categories.json");
  const voiceTone = readJson<MaaV2VoiceTone>("voice-tone.json");
  const index = readJson<MaaV2Index>("index.json");

  cached = {
    rules,
    intents: intentsRaw.intents,
    clarifications: clarificationsRaw.vagueWords,
    confusionZones: confusionRaw.zones,
    ctas,
    contacts,
    staff,
    sourcesVivantes,
    links,
    categories,
    voiceTone,
    index,
  };
  return cached;
}

/**
 * Force a re-read on next loadMaaV2() call. Used in tests or after editing JSON.
 */
export function invalidateMaaV2Cache(): void {
  cached = null;
}

// ── Lookup helpers ───────────────────────────────────────────────────────────

export function getContactById(id: string): MaaV2Contact | undefined {
  return loadMaaV2().contacts.contacts[id];
}

export function getStaffById(id: string): MaaV2StaffMember | undefined {
  return loadMaaV2().staff.staff.find((s) => s.id === id);
}

export function getIntentById(id: string): MaaV2Intent | undefined {
  return loadMaaV2().intents.find((i) => i.id === id);
}

export function getClarificationForWord(word: string): MaaV2Clarification | undefined {
  const k = loadMaaV2();
  const lower = word.toLowerCase();
  return k.clarifications.find(
    (c) => c.word.toLowerCase() === lower || c.aliases.some((a) => a.toLowerCase() === lower),
  );
}

export function getCtaForService(service: string): MaaV2CtaByService | undefined {
  return loadMaaV2().ctas.ctasByService.find((c) => c.service === service);
}

/**
 * Lead routing helper. Returns the effective recipient(s) for a staff target.
 * In shadow mode, returns shadowRecipients. In live mode, returns the staff's real email.
 */
export function resolveLeadRecipients(staffId: string): string[] {
  const k = loadMaaV2();
  const member = k.staff.staff.find((s) => s.id === staffId);
  if (!member) return k.staff.shadowRecipients;

  if (k.staff.routingMode === "shadow") return k.staff.shadowRecipients;
  if (member.realEmail) return [member.realEmail];

  // Fallback chain
  if (member.leadFallback) {
    return resolveLeadRecipients(member.leadFallback);
  }
  return k.staff.shadowRecipients;
}
