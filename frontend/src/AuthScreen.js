import { useState } from "react";

const GOOGLE_AUTH_URL = "http://localhost:8080/oauth2/authorization/google";

export default function AuthScreen({ onAuth, onBack, apiRegister, apiLogin, dark, setDark }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const d = dark;
  const t = {
    bg: d ? "linear-gradient(160deg, #0f0a2e 0%, #1a1145 45%, #0f0a2e 100%)" : "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 45%, #f5f3ff 100%)",
    card: d ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)",
    cardBorder: d ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.15)",
    text: d ? "#fff" : "#1e1b4b",
    textMuted: d ? "rgba(255,255,255,0.5)" : "rgba(30,27,75,0.55)",
    inputBg: d ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
    inputBorder: d ? "rgba(255,255,255,0.15)" : "rgba(139,92,246,0.2)",
    placeholder: d ? "rgba(255,255,255,0.35)" : "rgba(30,27,75,0.35)",
    googleBg: d ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)",
    googleBorder: d ? "rgba(255,255,255,0.15)" : "rgba(139,92,246,0.2)",
    divider: d ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.15)",
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = mode === "login" ? await apiLogin(email, password) : await apiRegister(name, email, password);
      onAuth(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGoogleAuth = () => {
    window.location.href = GOOGLE_AUTH_URL;
  };

  return (
    <div style={{
      minHeight: "100vh", background: t.bg,
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", padding: 20, transition: "background 0.3s",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        button, input { font-family: inherit; }
      `}</style>

      <div style={{ position: "absolute", top: "-10%", right: "15%", width: 450, height: 450, background: d ? "radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)" : "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "10%", width: 350, height: 350, background: d ? "radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)" : "radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

      {onBack && (
        <button onClick={onBack} style={{
          position: "absolute", top: 28, left: 28, background: "none", border: "none",
          color: t.textMuted, fontSize: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
        }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 16 }} /> Back
        </button>
      )}

      <button onClick={() => setDark(!d)} style={{
        position: "absolute", top: 24, right: 28, width: 38, height: 38, borderRadius: 10,
        background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ti-${d ? "sun" : "moon"}`} style={{ fontSize: 17 }} />
      </button>

      <div style={{
        position: "relative", zIndex: 10, width: "100%", maxWidth: 420,
        background: t.card, border: `1px solid ${t.cardBorder}`,
        borderRadius: 20, padding: 36, backdropFilter: "blur(20px)",
        boxShadow: d ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(139,92,246,0.15)",
        animation: "fadeUp 0.4s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <i className="ti ti-shield-check" style={{ fontSize: 28, color: "#fff" }} />
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: t.text }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: t.textMuted }}>
            {mode === "login" ? "Sign in to continue analyzing contracts" : "Start analyzing contracts in seconds"}
          </p>
        </div>

        <button onClick={handleGoogleAuth} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "12px 0", borderRadius: 12, border: `1px solid ${t.googleBorder}`,
          background: t.googleBg, color: t.text, fontSize: 14, fontWeight: 600, marginBottom: 18,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 18px" }}>
          <div style={{ flex: 1, height: 1, background: t.divider }} />
          <span style={{ fontSize: 12, color: t.textMuted }}>or continue with email</span>
          <div style={{ flex: 1, height: 1, background: t.divider }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required
              style={{ padding: "13px 16px", borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14 }} />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" required
            style={{ padding: "13px 16px", borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14 }} />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password (min 6 characters)" required minLength={6}
            style={{ padding: "13px 16px", borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14 }} />

          {error && <p style={{ fontSize: 13, color: "#ef4444", margin: 0, padding: "10px 14px", background: d ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{
            padding: "13px 0", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 14.5,
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", marginTop: 4,
            opacity: loading ? 0.7 : 1, boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
          }}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13.5, color: t.textMuted }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ background: "none", border: "none", color: "#8b5cf6", fontWeight: 700, fontSize: 13.5, padding: 0 }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}