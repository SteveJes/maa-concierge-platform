"use client";

import { useState } from "react";
import { ChatShell } from "@platform/ui-chat";

export default function DemoPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [labelDismissed, setLabelDismissed] = useState(false);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow: hidden; height: 100%; }

        /* ── Bubble pulse ── */
        @keyframes bubblePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.55), 0 8px 32px rgba(0,0,0,0.4); }
          55%       { box-shadow: 0 0 0 16px rgba(201,168,76,0), 0 8px 32px rgba(0,0,0,0.4); }
        }
        @keyframes ripple {
          0%   { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        /* ── Entrance animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Arrow bounce ── */
        @keyframes arrowBounce {
          0%, 100% { transform: translate(0, 0) rotate(-30deg); }
          50%       { transform: translate(4px, 6px) rotate(-30deg); }
        }
        @keyframes arrowFadeIn {
          from { opacity: 0; transform: translate(-8px, 8px) rotate(-30deg); }
          to   { opacity: 1; transform: translate(0, 0) rotate(-30deg); }
        }

        /* ── Label tail ── */
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
          bottom: -7px;
          right: 22px;
          width: 14px;
          height: 14px;
          background: #fff;
          transform: rotate(45deg);
          border-right: 1px solid rgba(0,0,0,0.06);
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        /* ── Bubble button ── */
        .bubble-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4a840 0%, #8b6010 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          animation: bubblePulse 2.8s ease-in-out infinite, fadeUp 0.4s ease both;
          transition: transform 0.18s ease, filter 0.18s ease;
        }
        .bubble-btn:hover { transform: scale(1.1); filter: brightness(1.1); }
        .bubble-ripple {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(201,168,76,0.65);
          animation: ripple 2.2s ease-out infinite;
          pointer-events: none;
        }
        .bubble-ripple-2 {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(201,168,76,0.35);
          animation: ripple 2.2s ease-out 0.8s infinite;
          pointer-events: none;
        }

        /* ── Chat panel ── */
        .chat-panel {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1001;
          animation: panelIn 0.38s cubic-bezier(0.16,1,0.3,1) both;
          width: 400px;
          /* Fill from bottom to near top of viewport */
          height: min(680px, calc(100vh - 40px));
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
        }
        /* Make ChatShell fill the panel fully */
        .chat-panel > * {
          flex: 1;
          min-height: 0;
        }

        /* ── Demo badge ── */
        .demo-badge {
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1002;
          background: rgba(6,10,6,0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(201,168,76,0.28);
          border-radius: 100px;
          padding: 7px 20px;
          color: rgba(255,255,255,0.82);
          font-size: 12px;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: 0.025em;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: fadeUp 0.5s ease 0.1s both;
        }

        /* ── Badge responsive text ── */
        .badge-short { display: none; }
        @media (max-width: 480px) {
          .badge-full { display: none; }
          .badge-short { display: inline; }
        }

        /* ── DUBUB footer link ── */
        .dubub-link {
          position: fixed;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1500;
          pointer-events: auto;
          color: rgba(255,255,255,0.32);
          font-size: 11px;
          font-family: 'Inter', system-ui, sans-serif;
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: color 0.2s;
          animation: fadeUp 0.5s ease 0.6s both;
        }
        .dubub-link:hover { color: rgba(201,168,76,0.8); }

        /* ── Luxury arrow ── */
        .arrow-hint {
          position: fixed;
          bottom: 102px;
          right: 110px;
          z-index: 1000;
          pointer-events: none;
          animation: arrowFadeIn 0.7s ease 1.2s both;
        }
        .arrow-hint svg {
          animation: arrowBounce 1.8s ease-in-out 2s infinite;
          filter: drop-shadow(0 2px 8px rgba(201,168,76,0.5));
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
          .demo-badge {
            top: 8px;
            left: 12px !important;
            right: 12px !important;
            transform: none !important;
            justify-content: center;
            padding: 6px 16px;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .chat-panel {
            width: 100vw;
            right: 0;
            bottom: 0;
            top: 40px;
            height: calc(100dvh - 40px);
            border-radius: 14px 14px 0 0;
          }
          .arrow-hint { display: none; }
          .bubble-label { display: none; }
        }
      `}</style>

      {/* Demo badge */}
      <div className="demo-badge">
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d68a", flexShrink: 0, display: "inline-block" }} />
        <span className="badge-full">Démonstration client · Club Sportif MAA — propulsé par DUBUB</span>
        <span className="badge-short">Démo · Club Sportif MAA</span>
      </div>

      {/* MAA website — pointer-events:none so our overlay elements remain fully clickable */}
      <iframe
        src="https://www.clubsportifmaa.com/fr/"
        title="Club Sportif MAA"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Shield — visual separator only; pointer-events:none so overlay links/buttons work */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }} />

      {/* Luxury arrow hint — visible until chat opens */}
      {!chatOpen && !labelDismissed && (
        <div className="arrow-hint">
          <svg width="60" height="70" viewBox="0 0 60 70" fill="none">
            {/* Curved arrow body */}
            <path
              d="M10 10 C10 40, 45 45, 50 60"
              stroke="url(#arrowGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="4 3"
            />
            {/* Arrowhead */}
            <path
              d="M42 62 L50 60 L48 52"
              stroke="url(#arrowGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <defs>
              <linearGradient id="arrowGrad" x1="10" y1="10" x2="50" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.95" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}

      {/* Chat panel */}
      {chatOpen ? (
        <div className="chat-panel">
          {/* Close / minimise button */}
          <button
            onClick={() => setChatOpen(false)}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 20,
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(4px)",
              color: "#fff",
              fontSize: 17,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              transition: "background 0.15s",
            }}
            aria-label="Réduire"
          >
            ×
          </button>
          <ChatShell mode="inline" />
        </div>
      ) : (
        /* Floating bubble */
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          {/* Dismissible label */}
          {!labelDismissed && (
            <div
              className="bubble-label"
              onClick={() => { setChatOpen(true); setLabelDismissed(true); }}
            >
              💬 Bonjour ! Je suis votre concierge MAA
              <span
                onClick={(e) => { e.stopPropagation(); setLabelDismissed(true); }}
                style={{ marginLeft: 8, opacity: 0.4, cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </span>
            </div>
          )}

          <button
            className="bubble-btn"
            onClick={() => { setChatOpen(true); setLabelDismissed(true); }}
            aria-label="Ouvrir le Concierge MAA"
          >
            <span className="bubble-ripple" />
            <span className="bubble-ripple-2" />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 1 }}>
              <path
                d="M12 2C6.48 2 2 6.04 2 11c0 2.7 1.18 5.13 3.07 6.84L4 22l4.36-1.45C9.51 20.84 10.72 21 12 21c5.52 0 10-4.04 10-9s-4.48-9-10-9z"
                fill="white"
              />
            </svg>
          </button>
        </div>
      )}

      {/* DUBUB link */}
      <a
        href="https://www.dubub.com"
        target="_blank"
        rel="noopener noreferrer"
        className="dubub-link"
      >
        Intelligence propulsée par DUBUB · dubub.com
      </a>
    </>
  );
}
