"use client";

/**
 * Conversations tracker — every visitor thread, every tenant, one place.
 *
 * Steve/Daphné UX: see what each visitor asked, when, language, whether a
 * lead was captured, click to expand the full transcript. Filter by tenant
 * + days. Built for the "client is testing — we need to see what they
 * asked and what went wrong" workflow.
 */
import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "../../../../components/ui/Sidebar";
import { TopBar } from "../../../../components/ui/TopBar";
import { Card, CardHeader, Pill } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import {
  LayoutDashboard, Users, Sparkles, Settings as SettingsIcon,
  Globe, Link as LinkIcon, Sparkle, MessageSquare, RefreshCw,
  ChevronDown, ChevronRight, Calendar, Activity, Mail, Phone,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",            icon: <LayoutDashboard size={16} /> },
  { label: "Conversations",  href: "/admin/portal/conversations", icon: <MessageSquare size={16} /> },
  { label: "Sentinel",       href: "/admin/portal/sentinel",   icon: <Sparkles size={16} /> },
  { label: "Tenants",        href: "/admin/portal/tenants",    icon: <Globe size={16} /> },
  { label: "Onboarding",     href: "/admin/portal/onboarding", icon: <Users size={16} /> },
  { label: "Liens utiles",   href: "/admin/portal/links",      icon: <LinkIcon size={16} /> },
  { label: "Capacités",      href: "/admin/portal/features",   icon: <Sparkle size={16} /> },
  { label: "Réglages",       href: "/admin/settings",          icon: <SettingsIcon size={16} /> },
];

const TENANTS = [
  { id: "maa", label: "Club Sportif MAA" },
  { id: "dubub", label: "DUBUB — SophIA" },
];

interface Conversation {
  uuid: string;
  startedAt: string | null;
  locale: string | null;
  language: string;
  outcome: string;
  messageCount: number | null;
  summary: string | null;
  leadCaptured: boolean;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.dubub.com";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleString("fr-CA", { timeZone: "America/Montreal", dateStyle: "short", timeStyle: "short" });
}

function outcomeTone(outcome: string): "success" | "warning" | "info" | "gold" | "neutral" {
  switch (outcome) {
    case "callback": return "gold";
    case "booking":  return "gold";
    case "answered": return "success";
    case "escalated": return "warning";
    case "phone":    return "info";
    default: return "neutral";
  }
}

const RANGES = [
  { label: "Aujourd'hui", days: 1 },
  { label: "7 derniers jours", days: 7 },
  { label: "30 derniers jours", days: 30 },
  { label: "90 derniers jours", days: 90 },
];

export default function ConversationsTracker() {
  const scopedTenant = typeof window !== "undefined" ? window.localStorage.getItem("dubub_admin_tenant") : null;
  const [tenant, setTenant] = useState(scopedTenant ?? "maa");
  const [days, setDays] = useState(7);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, Message[]>>({});
  const [leadFilter, setLeadFilter] = useState<"all" | "leads">("all");

  const tenantName = TENANTS.find((t) => t.id === tenant)?.label ?? tenant;

  const fetchConversations = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("dubub_admin_token") ?? "" : "";
      const res = await fetch(
        `${API}/v1/admin/conversations?tenant=${encodeURIComponent(tenant)}&days=${days}&limit=100`,
        { headers: { "x-admin-token": token } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { conversations?: Conversation[] };
      setConversations(data.conversations ?? []);
    } catch (e) {
      setError((e as Error).message);
      setConversations([]);
    } finally {
      setRefreshing(false);
    }
  }, [tenant, days]);

  useEffect(() => { void fetchConversations(); }, [fetchConversations]);

  async function toggleExpand(uuid: string) {
    if (expanded === uuid) { setExpanded(null); return; }
    setExpanded(uuid);
    if (transcripts[uuid]) return;
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("dubub_admin_token") ?? "" : "";
      const res = await fetch(`${API}/v1/admin/conversations/${uuid}`, { headers: { "x-admin-token": token } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { messages?: Message[] };
      setTranscripts((t) => ({ ...t, [uuid]: data.messages ?? [] }));
    } catch (e) {
      setTranscripts((t) => ({ ...t, [uuid]: [{ role: "system" as const, content: `Erreur de chargement : ${(e as Error).message}`, createdAt: null }] }));
    }
  }

  const filtered = (conversations ?? []).filter((c) => leadFilter === "all" || c.leadCaptured);
  const totalLeads = (conversations ?? []).filter((c) => c.leadCaptured).length;

  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar items={NAV} footer={<div className="text-xs text-[var(--text-subtle)]"><div className="font-medium text-[var(--text-muted)]">DUBUB Concierge IA</div><div className="mt-0.5">v0.2 · multi-tenant</div></div>} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Conversations"
          subtitle={`${tenantName} · suivi en direct des échanges`}
          tenants={scopedTenant ? TENANTS.filter((t) => t.id === scopedTenant) : TENANTS}
          activeTenant={tenant}
          onTenantChange={setTenant}
          right={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" iconLeft={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />} onClick={() => void fetchConversations()}>
                Rafraîchir
              </Button>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-white/60 backdrop-blur border border-[var(--border)] rounded-full p-1">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    days === r.days
                      ? "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >{r.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white/60 backdrop-blur border border-[var(--border)] rounded-full p-1">
              {(["all", "leads"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setLeadFilter(v)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    leadFilter === v
                      ? "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >{v === "all" ? "Toutes" : `Leads (${totalLeads})`}</button>
              ))}
            </div>
            <div className="ml-auto text-xs text-[var(--text-muted)]">
              {conversations ? `${conversations.length} conversation${conversations.length > 1 ? "s" : ""}` : "—"}
              {totalLeads > 0 ? ` · ${totalLeads} lead${totalLeads > 1 ? "s" : ""}` : ""}
            </div>
          </div>

          {error ? (
            <Card glass>
              <div className="text-sm text-[var(--danger)]">Erreur : {error}</div>
            </Card>
          ) : null}

          {/* Conversation list */}
          <Card glass>
            <CardHeader title="Échanges récents" subtitle="Cliquez sur un échange pour voir la transcription complète" action={<Pill tone="info"><Activity size={11} /> Live</Pill>} />
            {filtered.length === 0 && !error ? (
              <div className="text-center py-12">
                <div className="inline-flex w-12 h-12 rounded-full bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] items-center justify-center mx-auto mb-3">
                  <MessageSquare size={20} />
                </div>
                <h3 className="text-base font-semibold text-[var(--text)] mb-1">Aucune conversation</h3>
                <p className="text-sm text-[var(--text-muted)]">Aucun échange ne correspond à ces filtres.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {filtered.map((c) => (
                  <li key={c.uuid} className="py-3">
                    <button
                      onClick={() => void toggleExpand(c.uuid)}
                      className="w-full text-left flex items-start gap-3 hover:bg-black/[0.02] rounded-md -mx-2 p-2 transition-colors"
                    >
                      <span className="shrink-0 mt-1 text-[var(--text-subtle)]">
                        {expanded === c.uuid ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] flex items-center justify-center">
                        {c.leadCaptured ? <Mail size={14} /> : <MessageSquare size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--text)]">
                            Conversation {c.uuid.slice(0, 8)}
                          </span>
                          <Pill tone={c.language === "fr" ? "gold" : "info"}>{c.language === "fr" ? "FR" : "EN"}</Pill>
                          <Pill tone={outcomeTone(c.outcome)}>{c.outcome}</Pill>
                          {c.leadCaptured ? <Pill tone="success">LEAD</Pill> : null}
                        </div>
                        {c.summary ? (
                          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{c.summary}</p>
                        ) : null}
                        <div className="text-xs text-[var(--text-subtle)] mt-1 flex items-center gap-3">
                          <span><Calendar size={10} className="inline -mt-0.5" /> {fmtTime(c.startedAt)}</span>
                          {c.messageCount ? <span>{c.messageCount} messages</span> : null}
                        </div>
                      </div>
                    </button>

                    {expanded === c.uuid ? (
                      <div className="ml-14 mt-3 mb-2 p-4 rounded-lg bg-black/[0.02] border border-[var(--border)] space-y-2 max-h-96 overflow-y-auto">
                        {transcripts[c.uuid] === undefined ? (
                          <div className="text-xs text-[var(--text-subtle)]">Chargement…</div>
                        ) : transcripts[c.uuid]!.length === 0 ? (
                          <div className="text-xs text-[var(--text-subtle)]">Aucun message trouvé.</div>
                        ) : (
                          transcripts[c.uuid]!.map((m, i) => (
                            <div key={i} className={`text-xs ${m.role === "user" ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                              <div className="font-semibold mb-0.5">
                                {m.role === "user" ? "👤 Visiteur" : m.role === "assistant" ? "✦ Sophie" : "⚙ Système"}
                                {m.createdAt ? <span className="ml-2 font-normal text-[var(--text-subtle)]">{fmtTime(m.createdAt)}</span> : null}
                              </div>
                              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Tests-scheduled card — manual entry placeholder for Steve to fill in */}
          <Card glass>
            <CardHeader title="Tests clients à venir" subtitle="Calendrier des sessions de test prévues" action={<Pill tone="gold">Suivi</Pill>} />
            <div className="text-sm text-[var(--text-muted)] space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/40 border border-[var(--border)]">
                <Calendar size={16} className="shrink-0 mt-0.5 text-[var(--brand-gold-strong)]" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--text)]">Daphné — démo MAA</div>
                  <div className="text-xs mt-0.5">Mardi 2026-06-02 · attendue à 14h00</div>
                  <div className="text-xs mt-2 text-[var(--text-subtle)]">Surveiller les conversations entrantes ce jour-là pour voir en temps réel ce que Daphné teste.</div>
                </div>
              </div>
              <div className="text-xs text-[var(--text-subtle)] pl-3">
                💡 Astuce : pendant une session de test, gardez cette page ouverte et rafraîchissez régulièrement. Chaque nouvel échange apparaît avec son intention détectée et la transcription complète à un clic.
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
