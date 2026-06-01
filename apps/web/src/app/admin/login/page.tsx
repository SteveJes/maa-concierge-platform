"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = typeof window !== "undefined" && window.location.hostname === "clients.dubub.com"
  ? "https://api.dubub.com"
  : "http://localhost:4000";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setError("Session expirée — veuillez vous reconnecter.");
    }
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) { setError("Identifiants invalides."); setLoading(false); return; }
      const data = await res.json() as { token: string; tenant?: string };
      localStorage.setItem("dubub_admin_token", data.token);
      if (data.tenant) localStorage.setItem("dubub_admin_tenant", data.tenant);
      else localStorage.removeItem("dubub_admin_tenant");
      router.replace("/admin/portal");
    } catch {
      setError("Connection error. Is the API running?");
      setLoading(false);
    }
  }

  return (
    <div style={{ width: 380, background: "#ffffff", border: "1px solid rgba(20,16,8,0.08)", borderRadius: 18, padding: "44px 38px", boxShadow: "0 24px 64px rgba(20,16,8,0.10), 0 2px 6px rgba(20,16,8,0.04)" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "linear-gradient(135deg,#c9a84c,#8b6010)", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 18, color: "#111", letterSpacing: "0.08em", marginBottom: 14 }}>DUBUB</div>
        <div style={{ color: "#1a1610", fontWeight: 700, fontSize: 20 }}>Admin Console</div>
        <div style={{ color: "rgba(20,16,8,0.50)", fontSize: 12, marginTop: 4 }}>Concierge Platform — Internal</div>
      </div>

      <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          value={username} onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          style={inputStyle}
        />
        <input
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" type="password"
          autoComplete="current-password"
          style={inputStyle}
        />
        {error && <div style={{ color: "#ff5252", fontSize: 12, textAlign: "center" }}>{error}</div>}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(120% 80% at 20% 0%, #ffffff 0%, #f7f4ea 45%, #efe9d6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Suspense fallback={<div style={{ color: "rgba(20,16,8,0.45)", fontSize: 14 }}>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(20,16,8,0.10)",
  borderRadius: 10,
  color: "#1a1610",
  fontSize: 14,
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 2px rgba(20,16,8,0.04)",
  colorScheme: "light",
};

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg,#c9a84c,#8b6010)",
  border: "none",
  borderRadius: 8,
  color: "#111",
  fontWeight: 700,
  fontSize: 14,
  padding: "12px",
  cursor: "pointer",
  marginTop: 4,
};
