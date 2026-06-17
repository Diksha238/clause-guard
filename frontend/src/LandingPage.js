import { useState } from "react";

export default function LandingPage({ onGetStarted, dark, setDark }) {
  const [hoverBtn, setHoverBtn] = useState(false);
  const d = dark;

  const t = {
    bg: d ? "linear-gradient(160deg, #0f0a2e 0%, #1a1145 45%, #0f0a2e 100%)" : "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 45%, #f5f3ff 100%)",
    text: d ? "#fff" : "#1e1b4b",
    textMuted: d ? "rgba(255,255,255,0.65)" : "rgba(30,27,75,0.6)",
    textFaint: d ? "rgba(255,255,255,0.5)" : "rgba(30,27,75,0.45)",
    navBorder: d ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.15)",
    navBtnBg: d ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
    navBtnBorder: d ? "rgba(255,255,255,0.2)" : "rgba(139,92,246,0.25)",
    badgeBg: d ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)",
    badgeBorder: d ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.25)",
    badgeText: d ? "#c4b5fd" : "#7c3aed",
    cardBg: d ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)",
    cardBorder: d ? "rgba(255,255,255,0.08)" : "rgba(139,92,246,0.15)",
    mockupBg: d ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
    mockupBorder: d ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.2)",
    mockupHeaderBorder: d ? "rgba(255,255,255,0.08)" : "rgba(139,92,246,0.12)",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      fontFamily: "'Inter', -apple-system, sans-serif",
      position: "relative",
      overflow: "hidden",
      transition: "background 0.3s",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      <div style={{ position: "absolute", top: "-10%", right: "10%", width: 500, height: 500, background: d ? "radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)" : "radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "5%", width: 400, height: 400, background: d ? "radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)" : "radial-gradient(circle, rgba(99,102,241,0.1), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

      <nav style={{ position: "relative", zIndex: 10, maxWidth: 1280, margin: "0 auto", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-shield-check" style={{ fontSize: 20, color: "#fff" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: t.text }}>ClauseGuard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="#features" style={{ color: t.textMuted, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Features</a>
          <a href="#how" style={{ color: t.textMuted, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>How it works</a>
          <button onClick={() => setDark(!d)} style={{
            width: 38, height: 38, borderRadius: 10, border: `1px solid ${t.navBtnBorder}`,
            background: t.navBtnBg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ti ti-${d ? "sun" : "moon"}`} style={{ fontSize: 17 }} />
          </button>
          <button onClick={onGetStarted} style={{
            padding: "10px 22px", borderRadius: 10, border: `1px solid ${t.navBtnBorder}`,
            background: t.navBtnBg, color: t.text, fontSize: 14, fontWeight: 600,
          }}>Login / Signup</button>
        </div>
      </nav>

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1280, margin: "0 auto", padding: "60px 32px 100px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 60, alignItems: "center" }}>
        <div style={{ animation: "fadeUp 0.6s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: t.badgeBg, border: `1px solid ${t.badgeBorder}`, marginBottom: 24 }}>
            <i className="ti ti-sparkles" style={{ fontSize: 14, color: t.badgeText }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: t.badgeText }}>AI-powered contract intelligence</span>
          </div>

          <h1 style={{ fontSize: 56, fontWeight: 800, color: t.text, lineHeight: 1.1, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Upload. Analyze.
          </h1>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, margin: "0 0 24px", letterSpacing: "-0.02em", background: "linear-gradient(90deg, #8b5cf6, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Stay Protected.
          </h1>

          <p style={{ fontSize: 17, color: t.textMuted, lineHeight: 1.7, margin: "0 0 36px", maxWidth: 480 }}>
            Upload any contract and let AI flag risky clauses, explain them in plain English, and give you an instant risk score — before you sign.
          </p>

          <div style={{ display: "flex", gap: 14 }}>
            <button
              onClick={onGetStarted}
              onMouseEnter={() => setHoverBtn(true)}
              onMouseLeave={() => setHoverBtn(false)}
              style={{
                padding: "15px 30px", borderRadius: 12, border: "none", fontSize: 15.5, fontWeight: 700,
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff",
                boxShadow: hoverBtn ? "0 8px 30px rgba(139,92,246,0.4)" : "0 4px 20px rgba(139,92,246,0.25)",
                transform: hoverBtn ? "translateY(-2px)" : "translateY(0)",
                transition: "all 0.2s ease",
              }}>
              Get Started Free <i className="ti ti-arrow-right" style={{ marginLeft: 6, fontSize: 16, verticalAlign: -2 }} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 28, marginTop: 40 }}>
            {[
              { num: "60s", label: "Avg. analysis time" },
              { num: "8+", label: "Risk categories" },
              { num: "100%", label: "Plain English" },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: t.text }}>{s.num}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: t.textFaint }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ animation: "float 5s ease-in-out infinite" }}>
          <div style={{
            background: t.mockupBg, border: `1px solid ${t.mockupBorder}`,
            borderRadius: 20, padding: 0, backdropFilter: "blur(20px)", overflow: "hidden",
            boxShadow: d ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(139,92,246,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 20px", borderBottom: `1px solid ${t.mockupHeaderBorder}` }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#f59e0b" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: t.textFaint, fontWeight: 600 }}>ClauseGuard</span>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <svg width={72} height={72}>
                  <circle cx={36} cy={36} r={30} fill="none" stroke={d ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.12)"} strokeWidth={6} />
                  <circle cx={36} cy={36} r={30} fill="none" stroke="#ef4444" strokeWidth={6} strokeDasharray="113 188" strokeLinecap="round" transform="rotate(-90 36 36)" />
                  <text x={36} y={32} textAnchor="middle" fontSize={16} fontWeight={700} fill={t.text}>60</text>
                  <text x={36} y={45} textAnchor="middle" fontSize={9} fill={t.textFaint}>/100</text>
                </svg>
                <div>
                  <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 16, color: "#ef4444" }}>High Risk</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: t.textFaint }}>3 pages · 8 chunks analyzed</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[{l:"HIGH",c:"#ef4444",n:3},{l:"MEDIUM",c:"#f59e0b",n:0},{l:"LOW",c:"#22c55e",n:0}].map(b => (
                  <div key={b.l} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 8, background: `${b.c}1A`, border: `1px solid ${b.c}40` }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: b.c }}>{b.n}</p>
                    <p style={{ margin: 0, fontSize: 9.5, fontWeight: 600, color: b.c }}>{b.l}</p>
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>HIGH</span>
                <p style={{ margin: "8px 0 0", fontSize: 12.5, color: t.textMuted, lineHeight: 1.6 }}>Interest rate of 40% per month is unusually high and may cause financial hardship.</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: d ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
                <i className="ti ti-message-circle" style={{ fontSize: 16, color: "#8b5cf6" }} />
                <span style={{ fontSize: 12.5, color: t.textMuted }}>Ask anything about this contract…</span>
                <i className="ti ti-send" style={{ marginLeft: "auto", fontSize: 14, color: "#8b5cf6" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="features" style={{ position: "relative", zIndex: 10, maxWidth: 1280, margin: "0 auto", padding: "20px 32px 100px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            { icon: "ti-file-search", title: "Risk Detection", desc: "Auto-flags non-compete, penalty, termination, and auto-renewal clauses" },
            { icon: "ti-message-circle", title: "AI Q&A", desc: "Ask any question about your contract and get instant plain-English answers" },
            { icon: "ti-arrows-diff", title: "Compare Contracts", desc: "Upload two contracts and see exactly which terms are more favorable" },
          ].map((f, i) => (
            <div key={i} style={{ padding: "24px 22px", borderRadius: 16, background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 22, color: "#fff" }} />
              </div>
              <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16, color: t.text }}>{f.title}</p>
              <p style={{ margin: 0, fontSize: 13.5, color: t.textMuted, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}