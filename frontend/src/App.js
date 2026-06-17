import { useState, useRef, useCallback, useEffect } from "react";
import LandingPage from "./LandingPage";
import AuthScreen from "./AuthScreen";

const API = "http://localhost:8000/api/v1";
const AUTH_API = "http://localhost:8080/api/auth";

const authHdrs = (token, extra = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

// ── API helpers ────────────────────────────────────────────────────────────
async function apiRegister(name, email, password) {
  const r = await fetch(`${AUTH_API}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || data.message || "Registration failed");
  return data;
}
async function apiLogin(email, password) {
  const r = await fetch(`${AUTH_API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || data.message || "Login failed");
  return data;
}
async function apiUpload(file, token) {
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch(`${API}/upload`, { method: "POST", headers: authHdrs(token), body: fd });
  if (!r.ok) throw new Error((await r.json()).detail || "Upload failed");
  return r.json();
}
async function apiAnalyze(docId, token) {
  const r = await fetch(`${API}/documents/${docId}/analyze`, { method: "POST", headers: authHdrs(token, { "Content-Type": "application/json" }) });
  if (!r.ok) throw new Error((await r.json()).detail || "Analysis failed");
  return r.json();
}
async function apiModels(token) {
  const r = await fetch(`${API}/models`, { headers: authHdrs(token) });
  if (!r.ok) throw new Error("Failed to load models");
  return r.json();
}
async function apiChat(docId, question, token, model) {
  const r = await fetch(`${API}/chat`, { method: "POST", headers: authHdrs(token, { "Content-Type": "application/json" }), body: JSON.stringify({ document_id: docId, question, model }), });
  if (!r.ok) throw new Error((await r.json()).detail || "Chat failed");
  return r.json();
}
async function apiListDocuments(token) {
  const r = await fetch(`${API}/documents`, { headers: authHdrs(token) });
  if (!r.ok) throw new Error("Failed to load documents");
  return r.json();
}
async function apiGetMessages(docId, token) {
  const r = await fetch(`${API}/documents/${docId}/messages`, { headers: authHdrs(token) });
  if (!r.ok) throw new Error("Failed to load messages");
  return r.json();
}
async function apiCompare(docIdA, docIdB, token) {
  const r = await fetch(`${API}/compare`, { method: "POST", headers: authHdrs(token, { "Content-Type": "application/json" }), body: JSON.stringify({ document_id_a: docIdA, document_id_b: docIdB }) });
  if (!r.ok) throw new Error((await r.json()).detail || "Comparison failed");
  return r.json();
}
async function apiDownloadReport(docId, token, filename) {
  const r = await fetch(`${API}/documents/${docId}/report`, { headers: authHdrs(token) });
  if (!r.ok) throw new Error((await r.json()).detail || "Report generation failed");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `clauseguard-report-${filename.replace(".pdf", "")}.pdf`;
  a.click(); URL.revokeObjectURL(url);
}
async function apiDeleteDocument(docId, token) {
  const r = await fetch(`${API}/documents/${docId}`, { method: "DELETE", headers: authHdrs(token) });
  if (!r.ok) throw new Error("Delete failed");
  return r.json();
}

const RISK = {
  HIGH:   { color: "#ef4444", bg: "#fef2f2", border: "#fca5a5", darkBg: "#2d1515", darkBorder: "#7f1d1d" },
  MEDIUM: { color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", darkBg: "#2d2515", darkBorder: "#78350f" },
  LOW:    { color: "#22c55e", bg: "#f0fdf4", border: "#86efac", darkBg: "#152d1c", darkBorder: "#14532d" },
};

export default function App() {
  const [dark, setDark] = useState(false);
  const [auth, setAuth] = useState(null);
  const [docs, setDocs] = useState([]); // full document list (sidebar history)
  const [doc, setDoc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [tab, setTab] = useState("risk");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [animScore, setAnimScore] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTargets, setCompareTargets] = useState([]); // selected doc ids for compare
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const chatEnd = useRef();

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
    sidebarBg: d ? "#0b1120" : "#f8fafc",
    sidebarItemHover: d ? "#1e293b" : "#e2e8f0",
    sidebarItemActive: d ? "#1e3a5f" : "#dbeafe",
  };

  // ── Load document list on login ────────────────────────────────────────────
  useEffect(() => {
    if (auth) {
      apiListDocuments(auth.token).then(setDocs).catch(() => {});
    }
  }, [auth]);
  useEffect(() => {
    if (auth) {
      apiModels(auth.token).then(setModels).catch(() => {});
    }
  }, [auth]);

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

  const handleAuth = (data) => setAuth({ token: data.token, name: data.name, email: data.email, userId: data.userId });
  const handleLogout = () => {
    setAuth(null); setDoc(null); setAnalysis(null); setMessages([]); setDocs([]); setShowUserMenu(false);
    setCompareMode(false); setCompareTargets([]); setComparisonResult(null);
  };

  const refreshDocs = async () => {
    try { setDocs(await apiListDocuments(auth.token)); } catch {}
  };

  const handleUpload = async (file) => {
    if (!file || file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setError(""); setLoading(true); setDoc(null); setAnalysis(null); setMessages([]); setAnimScore(0);
    setComparisonResult(null);
    try {
      const d = await apiUpload(file, auth.token);
      setDoc(d);
      setMessages([{ role: "ai", content: `Processed "${d.filename}" — ${d.total_pages} pages, ${d.total_chunks} chunks indexed.\n\nRunning risk analysis…`, time: new Date() }]);
      const risk = await apiAnalyze(d.document_id, auth.token);
      setAnalysis(risk);
      const hi = risk.risk_breakdown.HIGH, med = risk.risk_breakdown.MEDIUM, lo = risk.risk_breakdown.LOW;
      setMessages(prev => [...prev, {
        role: "ai",
        content: `Risk scan complete!\n\nScore: ${Math.round(risk.overall_risk_score)}/100 · ${hi} HIGH · ${med} MEDIUM · ${lo} LOW risks found.\n\nAsk me anything about this contract.`,
        time: new Date(),
      }]);
      await refreshDocs();
    } catch (e) { setError("Upload failed: " + e.message); }
    finally { setLoading(false); }
  };

  // ── Open a document from sidebar history ────────────────────────────────────
  const openDocument = async (docSummary) => {
    if (compareMode) {
      toggleCompareTarget(docSummary.id);
      return;
    }
    setError(""); setLoading(true); setAnalysis(null); setMessages([]); setAnimScore(0);
    setComparisonResult(null);
    setDoc({ document_id: docSummary.id, filename: docSummary.filename, total_pages: docSummary.total_pages, total_chunks: docSummary.total_chunks });
    try {
      // Load chat history
      const msgs = await apiGetMessages(docSummary.id, auth.token);
      const formatted = msgs.map(m => ({ role: m.role, content: m.content, sources: m.sources, time: new Date(m.created_at) }));

      // If already analyzed, re-run analyze to get fresh structured data (cheap since cached in DB mostly via chunks)
      if (docSummary.risk_score !== null && docSummary.risk_score !== undefined) {
        const risk = await apiAnalyze(docSummary.id, auth.token);
        setAnalysis(risk);
      }

      setMessages(formatted.length > 0 ? formatted : [{
        role: "ai",
        content: `Reopened "${docSummary.filename}". Ask me anything about this contract.`,
        time: new Date(),
      }]);
    } catch (e) {
      setError("Failed to open document: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (e) => {
    e?.preventDefault();
    if (!question.trim() || !doc || chatLoading) return;
    const q = question.trim(); setQuestion("");
    setMessages(prev => [...prev, { role: "user", content: q, time: new Date() }]);
    setChatLoading(true);
    try {
      const res = await apiChat(doc.document_id, q, auth.token, selectedModel);
      setMessages(prev => [...prev, { role: "ai", content: res.answer, sources: res.source_chunks, time: new Date() }]);
    } catch { setMessages(prev => [...prev, { role: "ai", content: "Something went wrong. Please try again.", time: new Date() }]); }
    finally { setChatLoading(false); setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  };

  const copyMsg = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const exportPdf = async () => {
    if (!doc) return;
    try { await apiDownloadReport(doc.document_id, auth.token, doc.filename); }
    catch (e) { setError("Export failed: " + e.message); }
  };

  const deleteDoc = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this contract and its chat history?")) return;
    try {
      await apiDeleteDocument(docId, auth.token);
      await refreshDocs();
      if (doc?.document_id === docId) { setDoc(null); setAnalysis(null); setMessages([]); }
    } catch (e) { setError("Delete failed: " + e.message); }
  };

  // ── Compare mode ─────────────────────────────────────────────────────────────
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setCompareTargets([]);
    setComparisonResult(null);
  };
  const toggleCompareTarget = (docId) => {
    setCompareTargets(prev => {
      if (prev.includes(docId)) return prev.filter(x => x !== docId);
      if (prev.length >= 2) return [prev[1], docId];
      return [...prev, docId];
    });
  };
  const runComparison = async () => {
    if (compareTargets.length !== 2) return;
    setComparing(true); setError(""); setComparisonResult(null);
    try {
      const result = await apiCompare(compareTargets[0], compareTargets[1], auth.token);
      setComparisonResult(result);
      setDoc(null); setAnalysis(null); setMessages([]);
    } catch (e) { setError("Comparison failed: " + e.message); }
    finally { setComparing(false); }
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

  const baseStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }
      @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
      ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#475569;border-radius:2px}
      input:focus,textarea:focus{outline:none}
      button{cursor:pointer; font-family: inherit;}
    `}</style>
  );

  const [showAuth, setShowAuth] = useState(false);
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname === "/oauth-success" || params.get("token")) {
    const token = params.get("token");
    const name = params.get("name");
    const email = params.get("email");
    const userId = params.get("userId");
    if (token) {
      setAuth({ token, name, email, userId });
      window.history.replaceState({}, "", "/");
    }
  }
}, []);

  if (!auth) {
    if (showAuth) {
      return (
        <AuthScreen
          onAuth={handleAuth}
          onBack={() => setShowAuth(false)}
          apiRegister={apiRegister}
          apiLogin={apiLogin}
          dark={dark}
          setDark={setDark}
        />
      );
    }
    return <LandingPage onGetStarted={() => setShowAuth(true)} dark={dark} setDark={setDark} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Inter', -apple-system, sans-serif", display: "flex" }}>
      {baseStyles}

      {/* ── SIDEBAR ── */}
      <div style={{
        width: sidebarCollapsed ? 0 : 260, background: t.sidebarBg, borderRight: `1px solid ${t.navBorder}`,
        display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0,
        overflow: "hidden", transition: "width 0.2s ease", flexShrink: 0,
      }}>
        <div style={{ padding: "16px 14px", borderBottom: `1px solid ${t.navBorder}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-shield-check" style={{ fontSize: 16, color: "#fff" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: t.text, whiteSpace: "nowrap" }}>ClauseGuard</span>
        </div>

        <div style={{ padding: "12px 14px" }}>
          <button onClick={() => { setDoc(null); setAnalysis(null); setMessages([]); setComparisonResult(null); setCompareMode(false); setCompareTargets([]); }} style={{
            width: "100%", padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 13,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <i className="ti ti-plus" style={{ fontSize: 15 }} /> New Contract
          </button>
        </div>

        {docs.length > 0 && (
          <div style={{ padding: "0 14px 8px" }}>
            <button onClick={toggleCompareMode} style={{
              width: "100%", padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: compareMode ? "#3b82f6" : "transparent", color: compareMode ? "#fff" : t.textMuted,
              border: `1px solid ${compareMode ? "#3b82f6" : t.cardBorder}`,
            }}>
              <i className="ti ti-arrows-diff" style={{ marginRight: 5, fontSize: 13, verticalAlign: -1 }} />
              {compareMode ? `Comparing (${compareTargets.length}/2)` : "Compare contracts"}
            </button>
            {compareMode && compareTargets.length === 2 && (
              <button onClick={runComparison} disabled={comparing} style={{
                width: "100%", marginTop: 6, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "#22c55e", color: "#fff", border: "none", opacity: comparing ? 0.7 : 1,
              }}>{comparing ? "Comparing…" : "Run Comparison"}</button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 6px 6px" }}>Recent Contracts</p>
          {docs.length === 0 && <p style={{ fontSize: 12, color: t.textSub, padding: "0 6px" }}>No contracts yet</p>}
          {docs.map(item => {
            const isActive = doc?.document_id === item.id;
            const isSelected = compareTargets.includes(item.id);
            return (
              <div key={item.id} onClick={() => openDocument(item)} style={{
                padding: "10px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
                background: isSelected ? t.sidebarItemActive : isActive ? t.sidebarItemHover : "transparent",
                border: isSelected ? "1px solid #3b82f6" : "1px solid transparent",
                display: "flex", alignItems: "center", gap: 8, position: "relative",
              }}
              onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = t.sidebarItemHover; }}
              onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = "transparent"; }}>
                {compareMode && (
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? "#3b82f6" : t.cardBorder}`, background: isSelected ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSelected && <i className="ti ti-check" style={{ fontSize: 10, color: "#fff" }} />}
                  </div>
                )}
                <i className="ti ti-file-text" style={{ fontSize: 14, color: t.textSub, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.filename}</p>
                  {item.risk_score !== null && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: item.risk_score >= 60 ? "#ef4444" : item.risk_score >= 30 ? "#f59e0b" : "#22c55e" }}>{Math.round(item.risk_score)}/100</span>
                  )}
                </div>
                {!compareMode && (
                  <button onClick={(e) => deleteDoc(item.id, e)} style={{ background: "none", border: "none", color: t.textSub, padding: 2, opacity: 0.6, flexShrink: 0 }}>
                    <i className="ti ti-trash" style={{ fontSize: 13 }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 14px", borderTop: `1px solid ${t.navBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {auth.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.email}</p>
          </div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: t.textSub, flexShrink: 0 }}>
            <i className="ti ti-logout" style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* NAV */}
        <nav style={{ background: t.navBg, borderBottom: `1px solid ${t.navBorder}`, padding: "0 24px", display: "flex", alignItems: "center", height: 58, gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ width: 36, height: 36, borderRadius: 8, background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-layout-sidebar" style={{ fontSize: 16 }} />
          </button>

          {doc && (
            <span style={{ fontSize: 12, color: t.textMuted, background: t.input, padding: "4px 12px", borderRadius: 6, border: `1px solid ${t.inputBorder}` }}>
              <i className="ti ti-file-text" style={{ fontSize: 12, marginRight: 5, verticalAlign: -1 }} />{doc.filename}
            </span>
          )}
          {comparisonResult && (
            <span style={{ fontSize: 12, color: t.textMuted, background: t.input, padding: "4px 12px", borderRadius: 6, border: `1px solid ${t.inputBorder}` }}>
              <i className="ti ti-arrows-diff" style={{ fontSize: 12, marginRight: 5, verticalAlign: -1 }} />Comparison
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {analysis && (
              <button onClick={exportPdf} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, background: t.input, color: t.textMuted, border: `1px solid ${t.inputBorder}`, fontWeight: 500 }}>
                <i className="ti ti-download" style={{ marginRight: 5, fontSize: 13, verticalAlign: -1 }} />Export PDF
              </button>
            )}
            <button onClick={() => setDark(!d)} style={{ width: 36, height: 36, borderRadius: 8, background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className={`ti ti-${d ? "sun" : "moon"}`} style={{ fontSize: 16 }} />
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px" }}>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: d ? "#2d1515" : "#fef2f2", borderRadius: 8, color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 16 }} />{error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444" }}><i className="ti ti-x" /></button>
            </div>
          )}

          {/* ── COMPARISON VIEW ── */}
          {comparisonResult ? (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, background: t.input, border: `1px solid ${t.inputBorder}` }}>
                    <p style={{ margin: 0, fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contract A</p>
                    <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: t.text }}>{comparisonResult.document_a.filename}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", color: t.textSub }}><i className="ti ti-arrows-diff" style={{ fontSize: 20 }} /></div>
                  <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, background: t.input, border: `1px solid ${t.inputBorder}` }}>
                    <p style={{ margin: 0, fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contract B</p>
                    <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: t.text }}>{comparisonResult.document_b.filename}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: t.text, lineHeight: 1.7, padding: "12px 14px", background: d ? "#1e3a5f20" : "#eff6ff", borderRadius: 8, borderLeft: "3px solid #3b82f6" }}>{comparisonResult.summary}</p>
              </div>

              <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 20, marginBottom: 16 }}>
                <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 15, color: t.text }}>Key Differences ({comparisonResult.differences.length})</p>
                {comparisonResult.differences.map((diff, i) => {
                  const r = RISK[diff.severity] || RISK.LOW;
                  return (
                    <div key={i} style={{ borderRadius: 10, border: `1px solid ${d ? r.darkBorder : r.border}`, borderLeft: `4px solid ${r.color}`, marginBottom: 12, padding: 14, background: d ? r.darkBg + "30" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: d ? r.darkBg : r.bg, color: r.color, border: `1px solid ${d ? r.darkBorder : r.border}` }}>{diff.severity}</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{diff.aspect}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div style={{ padding: "8px 10px", background: t.input, borderRadius: 6 }}>
                          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 600, color: t.textSub, textTransform: "uppercase" }}>Contract A</p>
                          <p style={{ margin: 0, fontSize: 12.5, color: t.text, lineHeight: 1.6 }}>{diff.contract_a}</p>
                        </div>
                        <div style={{ padding: "8px 10px", background: t.input, borderRadius: 6 }}>
                          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 600, color: t.textSub, textTransform: "uppercase" }}>Contract B</p>
                          <p style={{ margin: 0, fontSize: 12.5, color: t.text, lineHeight: 1.6 }}>{diff.contract_b}</p>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: t.textMuted, lineHeight: 1.6 }}><i className="ti ti-bulb" style={{ marginRight: 5, fontSize: 13, verticalAlign: -2 }} />{diff.impact}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 20 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, color: t.text }}>Recommendation</p>
                <p style={{ margin: 0, fontSize: 13.5, color: t.text, lineHeight: 1.7 }}>{comparisonResult.recommendation}</p>
              </div>
            </div>
          ) : !doc && !loading ? (
            /* ── UPLOAD SCREEN ── */
            <div style={{ maxWidth: 600, margin: "60px auto", animation: "fadeIn 0.4s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 32, color: "#fff" }} />
                </div>
                <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: t.text }}>Welcome, {auth.name?.split(" ")[0]}!</h1>
                <p style={{ margin: 0, fontSize: 15, color: t.textMuted }}>{compareMode ? "Select two contracts from the sidebar to compare" : "Upload a PDF — get instant risk analysis, plain English explanations, and AI Q&A"}</p>
              </div>

              {!compareMode && (
                <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 28, marginBottom: 20 }}>
                  <UploadZone onUpload={handleUpload} loading={false} t={t} />
                </div>
              )}

              {!compareMode && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { icon: "ti-file-search", title: "Risk Detection", desc: "Auto-detects HIGH/MEDIUM/LOW risk clauses" },
                    { icon: "ti-message-circle", title: "AI Q&A", desc: "Ask anything in plain English" },
                    { icon: "ti-arrows-diff", title: "Compare Contracts", desc: "See key differences side by side" },
                  ].map((f, i) => (
                    <div key={i} style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.cardBorder}`, padding: "14px 16px" }}>
                      <i className={`ti ${f.icon}`} style={{ fontSize: 22, color: "#3b82f6", display: "block", marginBottom: 8 }} />
                      <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 13, color: t.text }}>{f.title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{f.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div style={{ maxWidth: 600, margin: "60px auto" }}>
              <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: 32 }}>
                <UploadZone onUpload={handleUpload} loading={true} t={t} />
              </div>
            </div>
          ) : (
            /* ── DOCUMENT VIEW ── */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeIn 0.4s ease" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  </div>
                )}

                {analysis && (
                  <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", borderBottom: `1px solid ${t.cardBorder}`, padding: "0 4px" }}>
                      {[
                        { key: "risk", label: `Clauses (${analysis.risky_clauses.length})` },
                        { key: "summary", label: "Summary" },
                      ].map(tab2 => (
                        <button key={tab2.key} onClick={() => setTab(tab2.key)} style={{
                          flex: 1, padding: "13px 0", fontSize: 13, fontWeight: tab === tab2.key ? 600 : 400,
                          background: "none", border: "none", color: tab === tab2.key ? t.tabActive : t.tabInactive,
                          borderBottom: tab === tab2.key ? "2px solid #3b82f6" : "2px solid transparent",
                        }}>{tab2.label}</button>
                      ))}
                    </div>

                    {tab === "risk" && (
                      <div style={{ padding: "12px 14px 0" }}>
                        <div style={{ position: "relative", marginBottom: 12 }}>
                          <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: t.textSub }} />
                          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clauses…"
                            style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.input, color: t.text, fontSize: 13 }} />
                        </div>
                      </div>
                    )}

                    <div style={{ padding: "0 14px 14px", overflowY: "auto", maxHeight: 380 }}>
                      {tab === "risk" ? (
                        filteredClauses.length === 0
                          ? <p style={{ textAlign: "center", color: t.textMuted, fontSize: 13, padding: "40px 0" }}>{search ? "No clauses match your search" : "No risky clauses detected"}</p>
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

              {/* CHAT */}
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

                <div style={{ padding: "10px 14px", borderTop: `1px solid ${t.cardBorder}`, position: "relative" }}>
  <div style={{ marginBottom: 10 }}>
    <button onClick={() => setShowModelPicker(!showModelPicker)} style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px",
      borderRadius: 8, background: t.quickBtn, border: `1px solid ${t.quickBtnBorder}`, color: t.text,
    }}>
      <i className="ti ti-cpu" style={{ fontSize: 13, color: "#3b82f6" }} />
      {models.find(m => m.id === selectedModel)?.label || "Select model"}
      <i className={`ti ti-chevron-${showModelPicker ? "up" : "down"}`} style={{ fontSize: 12 }} />
    </button>

    {showModelPicker && (
      <div style={{
        position: "absolute", bottom: "100%", left: 14, marginBottom: 8,
        background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10,
        minWidth: 220, padding: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 50,
      }}>
        {models.map(m => (
          <button key={m.id}
            disabled={!m.available}
            onClick={() => { if (m.available) { setSelectedModel(m.id); setShowModelPicker(false); } }}
            style={{
              width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6,
              background: selectedModel === m.id ? (d ? "#1e3a5f" : "#dbeafe") : "transparent",
              border: "none", display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: m.available ? 1 : 0.45, cursor: m.available ? "pointer" : "not-allowed",
            }}>
            <span style={{ fontSize: 13, color: t.text, fontWeight: selectedModel === m.id ? 600 : 400 }}>{m.label}</span>
            {!m.available && <i className="ti ti-lock" style={{ fontSize: 12, color: t.textSub }} />}
            {selectedModel === m.id && <i className="ti ti-check" style={{ fontSize: 13, color: "#3b82f6" }} />}
          </button>
        ))}
      </div>
    )}
  </div>

  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
    {QUICK.map(q => (
                      <button key={q} onClick={() => setQuestion(q)} style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 20,
                        background: t.quickBtn, border: `1px solid ${t.quickBtnBorder}`,
                        color: t.textMuted, transition: "all 0.1s",
                      }}>{q}</button>
                    ))}
                  </div>
                  <form onSubmit={handleChat} style={{ display: "flex", gap: 8 }}>
                    <input value={question} onChange={e => setQuestion(e.target.value)}
                      placeholder={doc ? "Ask anything about this contract…" : "Upload a contract first…"} disabled={!doc}
                      style={{ flex: 1, fontSize: 13, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.input, color: t.text }} />
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
          <p style={{ margin: 0, fontSize: 13, color: t.text, lineHeight: 1.7 }}>{clause.risk_explanation}</p>
        </div>
      )}
    </div>
  );
}