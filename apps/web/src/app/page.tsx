import { ChatShell } from "@platform/ui-chat";

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0d1f17",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#0d1f17",
          borderBottom: "1px solid #1c3828",
          padding: "0 2rem",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "linear-gradient(135deg, #c9a84c, #a07830)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#0d1f17", fontWeight: 900, fontSize: 13, lineHeight: 1 }}>M</span>
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#ffffff",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Club Sportif MAA
          </span>
        </div>

        <nav className="maa-nav" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {[
            { fr: "Abonnement", en: "Membership" },
            { fr: "Piscine", en: "Pool" },
            { fr: "Spa", en: "Spa" },
            { fr: "Cours", en: "Classes" },
            { fr: "Contact", en: "Contact" },
          ].map((item) => (
            <span
              key={item.en}
              style={{
                color: "#6b8c7a",
                fontSize: 13,
                cursor: "default",
                letterSpacing: "0.03em",
              }}
            >
              {item.fr}
            </span>
          ))}
        </nav>
      </header>

      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(160deg, #0d1f17 0%, #152e20 40%, #0d1f17 100%)",
          padding: "3.5rem 2rem 2.5rem",
          textAlign: "center",
          borderBottom: "1px solid #1c3828",
        }}
      >
        <p
          style={{
            color: "#c9a84c",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin: "0 0 14px",
            fontWeight: 600,
          }}
        >
          Club sportif premium · 2070 rue Peel · Montréal
        </p>
        <h1
          style={{
            color: "#ffffff",
            fontSize: 34,
            fontWeight: 700,
            margin: "0 0 10px",
            letterSpacing: "-0.01em",
          }}
        >
          Votre concierge IA
        </h1>
        <p
          style={{
            color: "#6b8c7a",
            fontSize: 15,
            margin: 0,
            maxWidth: 420,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.5,
          }}
        >
          Posez vos questions en français ou en anglais. Disponible en tout temps.
        </p>
      </div>

      {/* Widget area */}
      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "2rem 1rem 3rem",
          background: "#0d1f17",
        }}
      >
        <div style={{ width: "100%", maxWidth: 860 }}>
          <ChatShell />
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          background: "#080f0a",
          borderTop: "1px solid #1c3828",
          padding: "1.25rem 2rem",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#2d4a38", fontSize: 12, margin: 0, letterSpacing: "0.03em" }}>
          Club Sportif MAA · 2070 rue Peel, Montréal (H3A 1W6) · (514) 845-2233 poste 234
        </p>
      </footer>
    </div>
  );
}
