"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatShell } from "@platform/ui-chat";

interface DemoConfig {
  tenantId: string;
  name: string;
  websiteUrl: string | null;
  conciergeName: string;
}

// Hardcoded known tenants — no API call needed for these
const KNOWN_CONFIGS: Record<string, DemoConfig> = {
  "maa": { tenantId: "maa", name: "Club Sportif MAA", websiteUrl: "https://www.clubsportifmaa.com/fr/", conciergeName: "Sophie" },
  "club-sportif-maa": { tenantId: "maa", name: "Club Sportif MAA", websiteUrl: "https://www.clubsportifmaa.com/fr/", conciergeName: "Sophie" },
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.dubub.com";

export default function DemoSlugPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [chatOpen, setChatOpen] = useState(false);
  const [labelDismissed, setLabelDismissed] = useState(false);
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [notFound, setNotFound] = useState(false);
  const vpHeightRef = useRef<number | null>(null);

  // Android-only keyboard fix: on iOS, 100dvh already shrinks with the keyboard natively.
  // On Android (Chrome + Samsung Internet), 100dvh does NOT update — we use visualViewport.
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) return; // iOS handles dvh natively — no JS needed, no override

    function update() {
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (h !== vpHeightRef.current) {
        vpHeightRef.current = h;
        document.documentElement.style.setProperty("--vp-h", `${h}px`);
      }
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update); // Samsung Internet fallback
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    // 1. Known slug — instant, no network
    if (KNOWN_CONFIGS[slug]) { setConfig(KNOWN_CONFIGS[slug]!); return; }
    // 2. Query params: ?name=Club+Name&site=https://...
    const qp = new URLSearchParams(window.location.search);
    const siteName = qp.get("name");
    const siteUrl = qp.get("site");
    if (siteName) { setConfig({ tenantId: slug, name: siteName, websiteUrl: siteUrl, conciergeName: "Sophie" }); return; }
    // 3. API fallback for dynamically created tenants
    fetch(`${API}/v1/demo-config/${slug}`)
      .then((r) => { if (!r.ok) throw new Error("not_found"); return r.json() as Promise<DemoConfig>; })
      .then((d) => setConfig(d))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Démo introuvable</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Le slug « {slug} » ne correspond à aucun client configuré.</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(201,168,76,0.3)", borderTopColor: "#c9a84c", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow: hidden; overflow-x: hidden; height: 100%; max-width: 100%; }
        @keyframes bubblePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.55), 0 8px 32px rgba(0,0,0,0.4); }
          55%       { box-shadow: 0 0 0 16px rgba(201,168,76,0), 0 8px 32px rgba(0,0,0,0.4); }
        }
        @keyframes ripple {
          0%   { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes arrowBounce {
          0%, 100% { transform: translate(0, 0) rotate(-30deg); }
          50%       { transform: translate(4px, 6px) rotate(-30deg); }
        }
        .bubble-label {
          position: relative;
          background: #fff;
          color: #1a1a1a;
          font-size: 13.5px;
          font-weight: 600;
          padding: 9px 16px;
          border-radius: 22px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          white-space: nowrap;
          font-family: 'Inter', system-ui, sans-serif;
          border: 1px solid rgba(0,0,0,0.06);
          animation: fadeUp 0.5s ease 0.2s both;
          cursor: pointer;
        }
        .bubble-label::after {
          content: '';
          position: absolute;
          bottom: -8px;
          right: 22px;
          width: 0; height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 9px solid #fff;
          filter: drop-shadow(0 3px 4px rgba(0,0,0,0.12));
        }
        .bubble-btn {
          width: 62px; height: 62px;
          border-radius: 50%;
          background: linear-gradient(135deg, #c9a84c 0%, #8b6010 100%);
          border: none; cursor: pointer;
          box-shadow: 0 0 0 0 rgba(201,168,76,0.55), 0 8px 32px rgba(0,0,0,0.4);
          animation: bubblePulse 3s ease-in-out infinite, fadeUp 0.5s ease 0.3s both;
          position: relative; display: flex; align-items: center; justify-content: center;
        }
        .bubble-ripple, .bubble-ripple-2 {
          position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid rgba(201,168,76,0.35);
          animation: ripple 2.2s ease-out 0.8s infinite;
          pointer-events: none;
        }
        .bubble-ripple-2 { animation-delay: 1.4s; }
        .chat-panel {
          position: fixed; bottom: 24px; right: 24px; z-index: 1001;
          animation: panelIn 0.38s cubic-bezier(0.16,1,0.3,1) both;
          width: 400px;
          height: min(680px, calc(100vh - 40px));
          border-radius: 20px; overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1);
          display: flex; flex-direction: column;
        }
        .chat-panel > * { flex: 1; min-height: 0; }
        .demo-badge {
          position: fixed; top: 10px; left: 0; right: 0;
          width: fit-content; margin: 0 auto; z-index: 1002;
          background: rgba(6,10,6,0.82); backdrop-filter: blur(12px);
          border: 1px solid rgba(201,168,76,0.28); border-radius: 100px;
          padding: 7px 20px; color: rgba(255,255,255,0.82); font-size: 12px;
          font-family: 'Inter', system-ui, sans-serif; letter-spacing: 0.025em;
          white-space: nowrap; display: flex; align-items: center; gap: 8px;
          animation: fadeUp 0.5s ease 0.1s both;
        }
        .badge-short { display: none; }
        @media (max-width: 480px) {
          .badge-full { display: none; }
          .badge-short { display: inline; }
          .chat-panel {
            bottom: 0; right: 0; left: 0; width: 100%;
            height: calc(var(--vp-h, 100dvh) - 40px); top: 40px; border-radius: 0;
            overflow-x: hidden;
          }
          .arrow-hint { display: none; }
          .bubble-label { display: none; }
        }
      `}</style>

      <div className="demo-badge">
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d68a", flexShrink: 0, display: "inline-block" }} />
        <span className="badge-full">Démonstration client · {config.name} — propulsé par DUBUB</span>
        <span className="badge-short">Démo · {config.name}</span>
      </div>

      {/* Client website background */}
      {config.websiteUrl ? (
        <iframe
          src={config.websiteUrl}
          title={config.name}
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", zIndex: 0, pointerEvents: "none" }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "linear-gradient(135deg, #0d0d14 0%, #1a1a2a 100%)" }} />
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }} />

      {chatOpen ? (
        <div className="chat-panel">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 10,
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(255,255,255,0.18)", border: "none",
              color: "#fff", fontSize: 17, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
              transition: "background 0.15s",
            }}
            aria-label="Réduire"
          >
            ×
          </button>
          <ChatShell mode="inline" tenantId={config.tenantId} />
        </div>
      ) : (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {!labelDismissed && (
            <div className="bubble-label" onClick={() => { setChatOpen(true); setLabelDismissed(true); }}>
              💬 Bonjour ! Je suis votre concierge {config.name}
              <span onClick={(e) => { e.stopPropagation(); setLabelDismissed(true); }} style={{ marginLeft: 8, opacity: 0.4, cursor: "pointer", fontSize: 12 }}>✕</span>
            </div>
          )}
          <button className="bubble-btn" onClick={() => { setChatOpen(true); setLabelDismissed(true); }} aria-label={`Ouvrir le Concierge ${config.name}`}>
            <span className="bubble-ripple" />
            <span className="bubble-ripple-2" />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 1 }}>
              <path d="M12 2C6.48 2 2 6.04 2 11c0 2.7 1.18 5.13 3.07 6.84L4 22l4.36-1.45C9.51 20.84 10.72 21 12 21c5.52 0 10-4.04 10-9s-4.48-9-10-9z" fill="white" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
