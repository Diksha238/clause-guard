import { useState, useRef, useCallback, useEffect } from "react";

const API = "http://localhost:8000/api/v1";
const USER_ID = "user123";
const hdrs = (extra = {}) => ({ "X-User-Id": USER_ID, ...extra });

async function apiUpload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API}/upload`, { method: "POST", headers: hdrs(), body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiAnalyze(docId) {
  const r = await fetch(`${API}/documents/${docId}/analyze`, { method: "POST", headers: hdrs({ "Content-Type": "application/json" }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiChat(docId, question) {
  const r = await fetch(`${API}/chat`, {
    method: "POST",
    headers: hdrs({ "Content-Type": "application/json" }),
    body: JSON.stringify({ document_id: docId, question }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const RISK = {
  HIGH:   { color: "#ef4444", bg: "#fef2f2", border: "#fca5a5", darkBg: "#2d1515", darkBorder: "#7f1d1d" },
  MEDIUM: { color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", darkBg: "#2d2515", darkBorder: "#78350f" },
  LOW:    { color: "#22c55e", bg: "#f0fdf4", border: "#86efac", darkBg: "#152d1c", darkBorder: "#14532d" },
};

export default function App() {
  const [dark, setDark] = useState(false);
  const [doc, setDoc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [tab, setTab] = useState("risk");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [animScore, setAnimScore] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const chatEnd = useRef();
  const drag = useRef(false);

  const d = dark;
  const t = {
    bg: d ? "#0f172a" : "#f1f5f9",
    card: d ? "#1e293b" : "#ffffff",
    cardBorder: d ? "#334155" : "#e2e8f0",
    text: d ? "#f1f5f9" : "#0f172a",
    textMuted: d ? "#94a3b8" : "#64748b",
    textSub: d ? "#64748b" : "#94a3b8",
    input: d ? "#0f172a" : "#f8fafc",
    inputBorder: d ? "#334155" : "#e2e8f0",
    navBg: d ? "#1e293b" : "#ffffff",
    navBorder: d ? "#334155" : "#e2e8f0",
    tabActive: d ? "#f1f5f9" : "#0f172a",
    tabInactive: d ? "#64748b" : "#94a3b8",
    quickBtn: d ? "#334155" : "#f1f5f9",
    quickBtnBorder: d ? "#475569" : "#e2e8f0",
    userBubble: "#3b82f6",
    aiBubble: d ? "#334155" : "#f1f5f9",
    aiText: d ? "#f1f5f9" : "#1e293b",
    accent: "#3b82f6",
    danger: "#ef4444",
  };

  useEffect(() => {
    if (analysis) {
      setAnimScore(0);
      const target = analysis.overall_risk_score;
      let current = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        setAnimScore(current);
        if (current >= target) clearInterval(timer);
      }, 16);
      return () => clearInterval(timer);
    }
  }, [analysis]);

  const handleUpload = async (file) => {
    if (!file || file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setError(""); setLoading(true); setDoc(null); setAnalysis(null); setMessages([]); setAnimScore(0);
    try {
      const d = await apiUpload(file);
      setDoc(d);
      setMessages([{ role: "ai", content: `📄 Processed **${d.filename}** — ${d.total_pages} pages, ${d.total_chunks} chunks indexed.\n\nRunning risk analysis…`, time: new Date() }]);
      const risk = await apiAnalyze(d.document_id);
      setAnalysis(risk);
      setHistory(prev => [{ ...d, risk_score: risk.overall_risk_score, risk_breakdown: risk.risk_breakdown, timestamp: new Date() }, ...prev.slice(0, 9)]);
      const hi = risk.risk_breakdown.HIGH, med = risk.risk_breakdown.MEDIUM, lo = risk.risk_breakdown.LOW;
      setMessages(prev => [...prev, {
        role: "ai",
        content: `✅ Risk scan complete!\n\n**Score: ${Math.round(risk.overall_risk_score)}/100** · ${hi} HIGH · ${med} MEDIUM · ${lo} LOW risks found.\n\nAsk me anything about this contract 👇`,
        time: new Date(),
      }]);
    } catch (e) { setError("Upload failed: " + e.message); }
    finally { setLoading(false); }
  };

  const handleChat = async (e) => {
    e?.preventDefault();
    if (!question.trim() || !doc || chatLoading) return;
    const q = question.trim(); setQuestion("");
    setMessages(prev => [...prev, { role: "user", content: q, time: new Date() }]);
    setChatLoading(true);
    try {
      const res = await apiChat(doc.document_id, q);
      setMessages(prev => [...prev, { role: "ai", content: res.answer, sources: res.source_chunks, time: new Date() }]);
    } catch { setMessages(prev => [...prev, { role: "ai", content: "Something went wrong. Please try again.", time: new Date() }]); }
    finally { setChatLoading(false); setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  };

  const copyMsg = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const exportReport = () => {
    if (!analysis || !doc) return;
    const lines = [
      `CLAUSEGUARD RISK REPORT`,
      `========================`,
      `Document: ${doc.filename}`,
      `Pages: ${doc.total_pages} | Chunks: ${doc.total_chunks}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `OVERALL RISK SCORE: ${Math.round(analysis.overall_risk_score)}/100`,
      `HIGH: ${analysis.risk_breakdown.HIGH} | MEDIUM: ${analysis.risk_breakdown.MEDIUM} | LOW: ${analysis.risk_breakdown.LOW}`,
      ``,
      `SUMMARY`,
      `-------`,
      analysis.summary,
      ``,
      `RISKY CLAUSES`,
      `-------------`,
      ...analysis.risky_clauses.map((c, i) =>
        `\n[${i+1}] ${c.risk_label} — ${c.risk_category?.replace(/_/g," ")} (Page ${c.page_number})\n${c.risk_explanation}\n\nClause text: "${c.text.slice(0,200)}..."`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clauseguard-report-${doc.filename.replace(".pdf","")}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filteredClauses = analysis?.risky_clauses.filter(c =>
    !search || c.text.toLowerCase().includes(search.toLowerCase()) ||
    c.risk_category?.toLowerCase().includes(search.toLowerCase()) ||
    c.risk_explanation?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const scoreColor = animScore >= 60 ? "#ef4444" : animScore >= 30 ? "#f59e0b" : "#22c55e";
  const scoreLabel = animScore >= 60 ? "High Risk" : animScore >= 30 ? "Medium Risk" : "Low Risk";
  const circ = 2 * Math.PI * 40;
  const dash = (animScore / 100) * circ;

  const QUICK = ["What is the notice period?", "Any non-compete clauses?", "What are the penalty terms?", "Key obligations of each party?", "What happens on default?", "Is there an auto-renewal clause?"];

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Inter', -apple-system, sans-serif", transition: "background 0.3s, color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#475569;border-radius:2px}
        input:focus,textarea:focus{outline:none}
        button{cursor:pointer}
      `}</style>

      {/* NAV */}
      <nav style={{ background: t.navBg, borderBottom: `1px solid ${t.navBorder}`, padding: "0 24px", display: "flex", alignItems: "center", height: 58, gap: 12, position: "sticky", top: 0, zIndex: 100, transition: "background 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-shield-check" style={{ fontSize: 18, color: "#fff" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: t.text }}>ClauseGuard</span>
          <span style={{ fontSize: 12, color: t.textMuted, background: d ? "#334155" : "#f1f5f9", padding: "2px 8px", borderRadius: 20, border: `1px solid ${t.cardBorder}` }}>AI Beta</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {doc && (
            <span style={{ fontSize: 12, color: t.textMuted, background: t.input, padding: "4px 12px", borderRadius: 6, border: `1px solid ${t.inputBorder}` }}>
              <i className="ti ti-file-text" style={{ fontSize: 12, marginRight: 5, verticalAlign: -1 }} />{doc.filename}
            </span>
          )}
          {history.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, background: showHistory ? "#3b82f6" : t.input, color: showHistory ? "#fff" : t.textMuted, border: `1px solid ${showHistory ? "#3b82f6" : t.inputBorder}`, fontWeight: 500 }}>
              <i className="ti ti-history" style={{ marginRight: 5, fontSize: 13, verticalAlign: -1 }} />{history.length}
            </button>
          )}
          {analysis && (
            <button onClick={exportReport} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, background: t.input, color: t.textMuted, border: `1px solid ${t.inputBorder}`, fontWeight: 500 }}>
              <i className="ti ti-download" style={{ marginRight: 5, fontSize: 13, verticalAlign: -1 }} />Export
            </button>
          )}
          <button onClick={() => setDark(!d)} style={{ width: 36, height: 36, borderRadius: 8, background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className={`ti ti-${d ? "sun" : "moon"}`} style={{ fontSize: 16 }} />
          </button>
        </div>
      </nav>

      {/* HISTORY PANEL */}
      {showHistory && (
        <div style={{ background: t.card, borderBottom: `1px solid ${t.cardBorder}`, padding: "14px 24px", animation: "fadeIn 0.2s ease" }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 13, color: t.text }}>Recent contracts</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {history.map((h, i) => (
              <div key={i} style={{ minWidth: 200, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.bg, cursor: "pointer" }}
                onClick={() => { setShowHistory(false); }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.filename}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: h.risk_score >= 60 ? "#ef4444" : h.risk_score >= 30 ? "#f59e0b" : "#22c55e" }}>{Math.round(h.risk_score)}/100</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{h.timestamp.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px" }}>
        {!doc && !loading ? (
          /* UPLOAD SCREEN */
          <div style={{ maxWidth: 600, margin: "60px auto", animation: "fadeIn 0.4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <i className="ti ti-shield-check" style={{ fontSize: 32, color: "#fff" }} />
              </div>
              <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: t.text }}>Analyze any contract</h1>
              <p style={{ margin: 0, fontSize: 15, color: t.textMuted }}>Upload a PDF — get instant risk analysis, plain English explanations, and AI Q&A</p>
            </div>

            <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 28, marginBottom: 20 }}>
              <UploadZone onUpload={handleUpload} loading={false} t={t} />
              {error && <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444", padding: "10px 14px", background: d ? "#2d1515" : "#fef2f2", borderRadius: 8 }}>{error}</p>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { icon: "ti-file-search", title: "Risk Detection", desc: "Auto-detects HIGH/MEDIUM/LOW risk clauses" },
                { icon: "ti-message-circle", title: "AI Q&A", desc: "Ask anything in plain English" },
                { icon: "ti-download", title: "Export Report", desc: "Download full risk analysis" },
              ].map((f, i) => (
                <div key={i} style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.cardBorder}`, padding: "14px 16px" }}>
                  <i className={`ti ${f.icon}`} style={{ fontSize: 22, color: "#3b82f6", display: "block", marginBottom: 8 }} />
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 13, color: t.text }}>{f.title}</p>
                  <p style={{ margin: 0, fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div style={{ maxWidth: 600, margin: "60px auto" }}>
            <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 32 }}>
              <UploadZone onUpload={handleUpload} loading={true} t={t} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeIn 0.4s ease" }}>
            {/* LEFT PANEL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Score Card */}
              {analysis && (
                <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 22, animation: "slideIn 0.4s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18 }}>
                    <svg width={96} height={96}>
                      <circle cx={48} cy={48} r={40} fill="none" stroke={d ? "#334155" : "#f1f5f9"} strokeWidth={7} />
                      <circle cx={48} cy={48} r={40} fill="none" stroke={scoreColor} strokeWidth={7}
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                        transform="rotate(-90 48 48)" style={{ transition: "stroke-dasharray 0.05s linear, stroke 0.5s" }} />
                      <text x={48} y={44} textAnchor="middle" fontSize={22} fontWeight={700} fill={scoreColor}>{Math.round(animScore)}</text>
                      <text x={48} y={58} textAnchor="middle" fontSize={11} fill={d ? "#64748b" : "#94a3b8"}>/100</text>
                    </svg>
                    <div>
                      <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 22, color: scoreColor }}>{scoreLabel}</p>
                      <p style={{ margin: "0 0 12px", fontSize: 13, color: t.textMuted }}>{doc.total_pages} pages · {doc.total_chunks} chunks analyzed</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        {["HIGH","MEDIUM","LOW"].map(l => (
                          <div key={l} style={{ padding: "8px 14px", borderRadius: 10, background: d ? RISK[l].darkBg : RISK[l].bg, border: `1px solid ${d ? RISK[l].darkBorder : RISK[l].border}`, textAlign: "center", minWidth: 60 }}>
                            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: RISK[l].color }}>{analysis.risk_breakdown[l]}</p>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: RISK[l].color, letterSpacing: "0.05em" }}>{l}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDoc(null); setAnalysis(null); setMessages([]); setSearch(""); }} style={{ width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "none", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
                    <i className="ti ti-upload" style={{ marginRight: 6, fontSize: 13, verticalAlign: -1 }} />Upload new contract
                  </button>
                </div>
              )}

              {/* Tabs */}
              {analysis && (
                <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", borderBottom: `1px solid ${t.cardBorder}`, padding: "0 4px" }}>
                    {[
                      { key: "risk", label: `⚠️ Clauses (${analysis.risky_clauses.length})` },
                      { key: "summary", label: "📋 Summary" },
                    ].map(tab2 => (
                      <button key={tab2.key} onClick={() => setTab(tab2.key)} style={{
                        flex: 1, padding: "13px 0", fontSize: 13, fontWeight: tab === tab2.key ? 600 : 400,
                        background: "none", border: "none", color: tab === tab2.key ? t.tabActive : t.tabInactive,
                        borderBottom: tab === tab2.key ? "2px solid #3b82f6" : "2px solid transparent",
                        transition: "all 0.15s",
                      }}>{tab2.label}</button>
                    ))}
                  </div>

                  {tab === "risk" && (
                    <div style={{ padding: "12px 14px 0" }}>
                      <div style={{ position: "relative", marginBottom: 12 }}>
                        <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: t.textSub }} />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                          placeholder="Search clauses…"
                          style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.input, color: t.text, fontSize: 13 }} />
                      </div>
                    </div>
                  )}

                  <div style={{ padding: "0 14px 14px", overflowY: "auto", maxHeight: 380 }}>
                    {tab === "risk" ? (
                      filteredClauses.length === 0
                        ? <p style={{ textAlign: "center", color: t.textMuted, fontSize: 13, padding: "40px 0" }}>{search ? "No clauses match your search" : "✅ No risky clauses detected"}</p>
                        : filteredClauses.map(c => <ClauseCard key={c.chunk_id} clause={c} t={t} d={d} />)
                    ) : (
                      <div style={{ fontSize: 13, lineHeight: 1.9, color: t.text, paddingTop: 8 }}>
                        {analysis.summary.split("\n").filter(Boolean).map((line, i) => (
                          <div key={i} style={{ marginBottom: 10, padding: "10px 14px", background: d ? "#1e3a5f20" : "#eff6ff", borderRadius: 8, borderLeft: "3px solid #3b82f6", color: t.text }}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT PANEL — CHAT */}
            <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", position: "sticky", top: 76 }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.cardBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-message-circle" style={{ fontSize: 16, color: "#fff" }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: t.text }}>Contract AI</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#22c55e" }}>● Online</p>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px", animation: "fadeIn 0.4s ease" }}>
                    <i className="ti ti-message-circle" style={{ fontSize: 36, color: t.textSub, display: "block", marginBottom: 12 }} />
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: t.text }}>Upload a contract to start</p>
                    <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>I'll analyze risks and answer your questions</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ marginBottom: 14, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.3s ease" }}>
                    <div style={{
                      maxWidth: "82%", padding: "10px 14px", fontSize: 13, lineHeight: 1.75,
                      borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: m.role === "user" ? t.userBubble : t.aiBubble,
                      color: m.role === "user" ? "#fff" : t.aiText,
                      whiteSpace: "pre-wrap",
                    }}>{m.content.replace(/\*\*(.*?)\*\*/g, "$1")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      {m.sources?.filter(s => s.page_number).map((s, j) => (
                        <span key={j} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: t.input, border: `1px solid ${t.inputBorder}`, color: t.textMuted }}>pg {s.page_number}</span>
                      ))}
                      {m.role === "ai" && (
                        <button onClick={() => copyMsg(m.content, i)} style={{ background: "none", border: "none", color: t.textSub, fontSize: 11, padding: "2px 6px", borderRadius: 4 }}>
                          <i className={`ti ti-${copiedIdx === i ? "check" : "copy"}`} style={{ fontSize: 12 }} /> {copiedIdx === i ? "Copied!" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: t.aiBubble, borderRadius: "16px 16px 16px 4px", width: "fit-content", marginBottom: 14 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: t.textSub, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
                  </div>
                )}
                <div ref={chatEnd} />
              </div>

              <div style={{ padding: "10px 14px", borderTop: `1px solid ${t.cardBorder}` }}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  {QUICK.map(q => (
                    <button key={q} onClick={() => { setQuestion(q); }} style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 20,
                      background: t.quickBtn, border: `1px solid ${t.quickBtnBorder}`,
                      color: t.textMuted, transition: "all 0.1s",
                    }}>{q}</button>
                  ))}
                </div>
                <form onSubmit={handleChat} style={{ display: "flex", gap: 8 }}>
                  <input value={question} onChange={e => setQuestion(e.target.value)}
                    placeholder={doc ? "Ask anything about this contract…" : "Upload a contract first…"}
                    disabled={!doc}
                    style={{ flex: 1, fontSize: 13, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.input, color: t.text, transition: "border 0.15s" }} />
                  <button type="submit" disabled={!question.trim() || chatLoading || !doc} style={{
                    width: 42, height: 42, borderRadius: 10, border: "none",
                    background: question.trim() && doc ? "linear-gradient(135deg, #3b82f6, #6366f1)" : t.input,
                    color: question.trim() && doc ? "#fff" : t.textMuted,
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}>
                    <i className="ti ti-send" style={{ fontSize: 16 }} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadZone({ onUpload, loading, t }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = useCallback((file) => { if (file?.type === "application/pdf") onUpload(file); }, [onUpload]);
  return (
    <div onClick={() => !loading && ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{ border: `2px dashed ${drag ? "#3b82f6" : t.inputBorder}`, borderRadius: 14, padding: "44px 32px", textAlign: "center", cursor: loading ? "default" : "pointer", background: drag ? "#eff6ff20" : "transparent", transition: "all 0.15s" }}>
      <input ref={ref} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => handle(e.target.files[0])} />
      {loading ? (
        <>
          <div style={{ width: 44, height: 44, border: "3px solid #e2e8f0", borderTop: "3px solid #3b82f6", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 15, color: t.text }}>Processing your contract…</p>
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>Extracting text · generating embeddings · running risk scan</p>
        </>
      ) : (
        <>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <i className="ti ti-file-upload" style={{ fontSize: 28, color: "#fff" }} />
          </div>
          <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 15, color: t.text }}>Drop your contract PDF here</p>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: t.textMuted }}>Employment · Loan · Rental · NDA · any PDF contract</p>
          <span style={{ fontSize: 13, padding: "8px 20px", borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", fontWeight: 600 }}>Choose file</span>
        </>
      )}
    </div>
  );
}

function ClauseCard({ clause, t, d }) {
  const [open, setOpen] = useState(false);
  const r = RISK[clause.risk_label];
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${d ? r.darkBorder : r.border}`, borderLeft: `4px solid ${r.color}`, marginBottom: 10, background: d ? r.darkBg + "40" : "#fff", overflow: "hidden", transition: "all 0.2s", animation: "slideIn 0.3s ease" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: d ? r.darkBg : r.bg, color: r.color, border: `1px solid ${d ? r.darkBorder : r.border}`, letterSpacing: "0.05em" }}>{clause.risk_label}</span>
        <span style={{ fontSize: 12, color: t.textMuted, flex: 1, textTransform: "capitalize" }}>{clause.risk_category?.replace(/_/g, " ")} · page {clause.page_number}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 14, color: t.textSub }} />
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${d ? r.darkBorder : r.border}`, animation: "fadeIn 0.2s ease" }}>
          <p style={{ margin: "12px 0 8px", fontSize: 12, color: t.textMuted, fontStyle: "italic", lineHeight: 1.6, background: d ? r.darkBg : r.bg, padding: "8px 10px", borderRadius: 6 }}>
            "{clause.text.slice(0, 220)}{clause.text.length > 220 ? "…" : ""}"
          </p>
          <p style={{ margin: 0, fontSize: 13, color: t.text, lineHeight: 1.7 }}>⚠️ {clause.risk_explanation}</p>
        </div>
      )}
    </div>
  );
}