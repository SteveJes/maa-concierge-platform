"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = typeof window !== "undefined" && window.location.hostname === "clients.dubub.com"
  ? "https://api.dubub.com"
  : "http://localhost:4000";

export default function AdminLogin() {
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
      if (!res.ok) { setError("Invalid credentials."); setLoading(false); return; }
      const { token } = await res.json() as { token: string };
      localStorage.setItem("dubub_admin_token", token);
      router.replace("/admin/dashboard");
    } catch {
      setError("Connection error. Is the API running?");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#06090c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: 360, background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "40px 36px", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "linear-gradient(135deg,#c9a84c,#8b6010)", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 18, color: "#111", letterSpacing: "0.08em", marginBottom: 14 }}>DUBUB</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 20 }}>Admin Console</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 }}>Concierge Platform — Internal</div>
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
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  padding: "11px 14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
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
