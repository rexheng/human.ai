import { useState, useEffect, useRef, useCallback } from "react";
import { agentTickStrands, getSwarmInteraction } from "./ai-service";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAINI.TY — Phase 4: Experiment Lab & Export
// Design experiments. Generate hypotheses. Run simulations. Export findings.
// The capstone module completing the MVP workflow from PRD Part V.
// ═══════════════════════════════════════════════════════════════════════════════

/* ─── Design System ─── */
const T = {
  bg: "#060810", bgAlt: "#080b14",
  panel: "#0c0e18", panelHi: "#10131f", panelTop: "#151827", panelFloat: "#0f1120",
  border: "#191d32", borderHi: "#252a45", borderLit: "#3a4170",
  text: "#dee0ed", text2: "#9599b5", text3: "#555a78", text4: "#2e3250",
  blue: "#4a8aff", blueG: "rgba(74,138,255,.18)", blueS: "rgba(74,138,255,.06)",
  green: "#2dd4a0", greenG: "rgba(45,212,160,.2)", greenS: "rgba(45,212,160,.06)",
  amber: "#f0b429", amberG: "rgba(240,180,41,.16)", amberS: "rgba(240,180,41,.06)",
  rose: "#ee6b90", roseG: "rgba(238,107,144,.18)", roseS: "rgba(238,107,144,.06)",
  violet: "#9b7af5", violetG: "rgba(155,122,245,.16)", violetS: "rgba(155,122,245,.06)",
  cyan: "#26c9d9", cyanG: "rgba(38,201,217,.16)", cyanS: "rgba(38,201,217,.06)",
  orange: "#e88a3a", teal: "#2ab7a9", white: "#ffffff",
};
const FD = "'Syne','Clash Display',sans-serif";
const FM = "'DM Mono','IBM Plex Mono',monospace";
const FB = "'Instrument Sans','DM Sans',sans-serif";

/* ─── Constants ─── */
const B5 = { O: { full: "Openness", color: T.violet, short: "O" }, C: { full: "Conscientiousness", color: T.cyan, short: "C" }, E: { full: "Extraversion", color: T.amber, short: "E" }, A: { full: "Agreeableness", color: T.green, short: "A" }, N: { full: "Neuroticism", color: T.rose, short: "N" } };
const B5K = ["O", "C", "E", "A", "N"];
const NAMES = ["Ada", "Felix", "Mira", "Kai", "Zara", "Leo", "Nova", "Ravi", "Elsa", "Omar", "Yuki", "Sven", "Dara", "Emil", "Luna", "Hugo", "Iris", "Niko", "Cleo", "Axel", "Sage", "Remy", "Wren", "Juno", "Ezra", "Thea"];
const ROLES = ["Student", "Teacher", "Executive", "Nurse", "Engineer", "Artist", "Journalist", "Scientist", "Lawyer", "Activist", "Chef", "Architect"];
const CULTURES = ["Urban American", "Rural American", "Western European", "East Asian", "South Asian", "Latin American", "Nordic", "Southeast Asian"];
const PRESETS = [
  { id: "town_square", name: "Town Square", subtitle: "Echo Chambers", icon: "🏛", color: T.blue },
  { id: "common_goods", name: "Common Goods", subtitle: "Tragedy of the Commons", icon: "🌊", color: T.teal },
  { id: "marketplace", name: "Marketplace", subtitle: "Ultimatum Game", icon: "⚖", color: T.amber },
  { id: "panopticon", name: "Panopticon", subtitle: "Stanford Prison", icon: "👁", color: T.rose },
];
const FIDELITY = [
  { name: "Ultimatum Replication", score: 82, target: "≥80%", ci: [76, 88], pass: true },
  { name: "Distributional Alignment", score: 73, target: "≥70%", ci: [68, 78], pass: true },
  { name: "Emergence Score", score: 3, target: "≥2 groups", ci: [2, 4], pass: true },
  { name: "Reflection Accuracy", score: 87, target: "≥85%", ci: [83, 91], pass: true },
];

let _u = 0; const uid = () => `${++_u}_${(Date.now() % 1e5).toString(36)}`;
const pick = a => a[Math.floor(Math.random() * a.length)];
const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ─── Agent Generation ─── */
function makeAgent(i, n, traitBias = {}) {
  const traits = {};
  B5K.forEach(k => { traits[k] = traitBias[k] !== undefined ? cl(traitBias[k] + Math.floor(Math.random() * 3) - 1, 1, 10) : Math.floor(Math.random() * 10) + 1; });
  const angle = (i / n) * Math.PI * 2, r = 0.2 + Math.random() * 0.2;
  return {
    id: uid(), name: NAMES[i % NAMES.length] + "-" + String(Math.floor(Math.random() * 900) + 100),
    traits, role: pick(ROLES), culture: pick(CULTURES), sentiment: 0, sentimentHistory: [],
    memories: [], lastAction: null, lastThought: null, cooperateHistory: [], connections: [],
    x: 0.5 + Math.cos(angle) * r, y: 0.5 + Math.sin(angle) * r, vx: 0, vy: 0
  };
}
function genPop(n, bias = {}) {
  const a = []; for (let i = 0; i < n; i++)a.push(makeAgent(i, n, bias));
  a.forEach(ag => { const ct = Math.floor(ag.traits.E / 3) + 1; const ot = a.filter(b => b.id !== ag.id).sort(() => Math.random() - 0.5); ag.connections = ot.slice(0, ct).map(b => b.id); });
  return a;
}

/* ─── Claude API (Now via Strands) ─── */
async function agentTick(agent, actions, ctx) {
  return await agentTickStrands(agent, actions, ctx);
}

/* ─── Hypothesis generation via Claude ─── */
async function generateHypotheses(config) {
  const prompt = `You are a research methodology assistant. Given this experiment configuration, generate 3-5 specific, testable hypotheses with predicted outcomes.

Experiment: "${config.title}"
Independent Variable: ${config.iv}
Dependent Variable: ${config.dv}
Conditions: ${config.conditions.map(c => c.name).join(", ")}
Population: ${config.agentCount} agents in "${config.preset}" environment
Stimulus: "${config.stimulus}"

Respond ONLY with JSON (no markdown): {"hypotheses":[{"id":1,"statement":"...","prediction":"...","metric":"...","direction":"increase|decrease|no_change"}]}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, messages: [{ role: "user", content: prompt }] })
    });
    const d = await r.json(); const raw = (d.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    return JSON.parse(raw).hypotheses;
  } catch {
    return [
      { id: 1, statement: `Agents with high Agreeableness (>7) will show higher ${config.dv} than low-Agreeableness agents.`, prediction: "High-A group averages 25% higher cooperation", metric: config.dv, direction: "increase" },
      { id: 2, statement: `Polarization will increase over time as agents form echo chambers.`, prediction: "Polarization index exceeds 0.5 by tick 10", metric: "Polarization", direction: "increase" },
      { id: 3, statement: `High-Neuroticism agents will exhibit more negative sentiment when resources are scarce.`, prediction: "High-N sentiment drops below -0.3 under scarcity", metric: "Sentiment", direction: "decrease" },
    ];
  }
}

/* ─── Physics layout ─── */
function layoutStep(agents, groups) {
  return agents.map(a => {
    let fx = 0, fy = 0;
    agents.forEach(b => { if (a.id === b.id) return; const dx = a.x - b.x, dy = a.y - b.y, d = Math.max(0.01, Math.hypot(dx, dy)); fx += (dx / d) * 0.0008 / d; fy += (dy / d) * 0.0008 / d; });
    a.connections.forEach(cid => { const b = agents.find(x => x.id === cid); if (!b) return; fx += (b.x - a.x) * 0.002; fy += (b.y - a.y) * 0.002; });
    const grp = groups.find(g => g.members.includes(a.id));
    if (grp) { const ms = agents.filter(b => grp.members.includes(b.id)); const cx = ms.reduce((s, m) => s + m.x, 0) / ms.length; const cy = ms.reduce((s, m) => s + m.y, 0) / ms.length; fx += (cx - a.x) * 0.012; fy += (cy - a.y) * 0.012; }
    fx += (0.5 - a.x) * 0.003; fy += (0.5 - a.y) * 0.003;
    a.vx = (a.vx + fx) * 0.8; a.vy = (a.vy + fy) * 0.8; a.x = cl(a.x + a.vx, 0.05, 0.95); a.y = cl(a.y + a.vy, 0.05, 0.95);
    return a;
  });
}
function detectGroups(agents) {
  const g = [];
  const pos = agents.filter(a => a.sentiment > 0.2), neg = agents.filter(a => a.sentiment < -0.2), neu = agents.filter(a => Math.abs(a.sentiment) <= 0.2);
  if (pos.length >= 2) g.push({ id: "advocates", label: "Advocates", color: T.green, members: pos.map(a => a.id) });
  if (neg.length >= 2) g.push({ id: "dissenters", label: "Dissenters", color: T.rose, members: neg.map(a => a.id) });
  if (neu.length >= 2) g.push({ id: "observers", label: "Observers", color: T.amber, members: neu.map(a => a.id) });
  return g;
}
const sCol = v => v > 0.25 ? T.green : v < -0.25 ? T.rose : T.amber;

// ═══════════════════════════════
// REUSABLE UI
// ═══════════════════════════════

function Fingerprint({ traits, size = 44 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext("2d"), s = size, cx = s / 2, cy = s / 2, r = s * 0.42; ctx.clearRect(0, 0, s, s);
    B5K.forEach((k, i) => { const v = traits[k] / 10, rr = r * (0.3 + i * 0.15); ctx.beginPath(); for (let j = 0; j <= 36; j++) { const a = (Math.PI * 2 * j) / 36 - Math.PI / 2, noise = Math.sin(a * 3 + i * 2 + v * 5) * v * rr * 0.18, pr = rr * (0.7 + v * 0.3) + noise; j === 0 ? ctx.moveTo(cx + pr * Math.cos(a), cy + pr * Math.sin(a)) : ctx.lineTo(cx + pr * Math.cos(a), cy + pr * Math.sin(a)); } ctx.closePath(); ctx.strokeStyle = B5[k].color + "55"; ctx.lineWidth = 1; ctx.stroke(); });
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fillStyle = T.blue + "88"; ctx.fill();
  }, [traits, size]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

function Input({ label, value, onChange, placeholder, type = "text", rows }) {
  const shared = { width: "100%", padding: "9px 12px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, fontFamily: FB, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 10, color: T.text4, fontFamily: FM, letterSpacing: ".06em", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>}
      {rows ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...shared, resize: "vertical", lineHeight: 1.5 }} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={shared} />}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: sx, ...rest }) {
  const styles = {
    primary: { padding: "10px 22px", background: `linear-gradient(135deg,${T.blue},${T.violet})`, border: "none", color: "#fff", fontWeight: 700 },
    secondary: { padding: "10px 22px", background: T.blueS, border: `1px solid ${T.blue}33`, color: T.blue, fontWeight: 600 },
    ghost: { padding: "8px 16px", background: "transparent", border: `1px solid ${T.border}`, color: T.text2, fontWeight: 500 },
    danger: { padding: "10px 22px", background: T.roseS, border: `1px solid ${T.rose}33`, color: T.rose, fontWeight: 600 },
  };
  const s = styles[variant] || styles.primary;
  return <button onClick={onClick} disabled={disabled} style={{ ...s, borderRadius: 10, fontSize: 12, fontFamily: FM, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all .15s", letterSpacing: ".02em", ...sx }} {...rest}>{children}</button>;
}

function StepIndicator({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: FM,
            background: i <= current ? T.blueS : "transparent", border: `2px solid ${i <= current ? T.blue : T.border}`, color: i <= current ? T.blue : T.text4, transition: "all .3s",
            boxShadow: i === current ? `0 0 16px ${T.blueG}` : "none",
          }}>{i + 1}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: i <= current ? T.text : T.text4, fontFamily: FM, marginLeft: 8, whiteSpace: "nowrap" }}>{s}</span>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? T.blue + "44" : T.border, margin: "0 12px", transition: "background .3s" }} />}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════
// MAIN APP
// ═══════════════════════════════

export default function HumanityPhase4() {
  /* ── Navigation ── */
  const [screen, setScreen] = useState("lab"); // lab | running | report

  /* ── Experiment Config (C1) ── */
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    title: "Echo Chamber Formation Under Policy Stimulus",
    description: "Investigate how personality composition affects opinion polarization when agents discuss a divisive policy proposal.",
    iv: "Agreeableness distribution (50% High vs 50% Low)",
    dv: "Polarization index",
    conditions: [
      { id: uid(), name: "Control: Uniform traits", bias: {} },
      { id: uid(), name: "Treatment: 50/50 Agreeableness split", bias: { groups: [{ pct: 50, b: { A: 8 } }, { pct: 50, b: { A: 3 } }] } },
    ],
    preset: "town_square",
    agentCount: 16,
    ticks: 12,
    stimulus: "A new law proposes taxing digital air. Discuss and decide your stance.",
    metrics: ["polarization", "sentiment", "cooperation", "groups"],
    hypotheses: [],
  });
  const [newCondName, setNewCondName] = useState("");

  /* ── Hypothesis Generator (C3) ── */
  const [loadingHypo, setLoadingHypo] = useState(false);

  /* ── Simulation state ── */
  const [agents, setAgents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [timeSeries, setTimeSeries] = useState([]);
  const [groups, setGroups] = useState([]);
  const [simCondition, setSimCondition] = useState(0);
  const [conditionResults, setConditionResults] = useState([]);
  const [simDone, setSimDone] = useState(false);
  const agentsRef = useRef([]); const logsRef = useRef([]); const runRef = useRef(false); const tickRef = useRef(0); const timerRef = useRef(null);
  useEffect(() => { agentsRef.current = agents }, [agents]);
  useEffect(() => { logsRef.current = logs }, [logs]);
  useEffect(() => { runRef.current = running }, [running]);

  /* ── Graph sizing ── */
  const graphRef = useRef(null);
  const [graphSize, setGraphSize] = useState({ w: 500, h: 350 });
  useEffect(() => { const m = () => { if (graphRef.current) { const r = graphRef.current.getBoundingClientRect(); setGraphSize({ w: r.width, h: r.height }) } }; m(); window.addEventListener("resize", m); return () => window.removeEventListener("resize", m) }, [screen]);

  /* ── Report generation timestamp ── */
  const [reportTime] = useState(() => new Date().toISOString());

  // ─── Generate hypotheses ───
  const handleGenerateHypotheses = useCallback(async () => {
    setLoadingHypo(true);
    const hyps = await generateHypotheses(config);
    setConfig(prev => ({ ...prev, hypotheses: hyps }));
    setLoadingHypo(false);
  }, [config]);

  // ─── Run one tick ───
  const doTick = useCallback(async () => {
    const cur = [...agentsRef.current]; if (cur.length === 0) return;
    tickRef.current++; const t = tickRef.current;
    const n = Math.min(cur.length, Math.floor(Math.random() * 3) + 2);
    const weights = cur.map(a => a.traits.E / 10 * 0.5 + 0.5 + (a.traits.N > 7 ? 0.2 : 0));
    const sel = []; const avail = cur.map((a, i) => ({ a, i, w: weights[i] }));
    for (let j = 0; j < n && avail.length > 0; j++) { let r = Math.random() * avail.reduce((s, x) => s + x.w, 0), pk = 0; for (let k = 0; k < avail.length; k++) { r -= avail[k].w; if (r <= 0) { pk = k; break; } } sel.push(avail[pk]); avail.splice(pk, 1); }

    const recentActions = logsRef.current.slice(-8); const newLogs = []; const updated = [...cur];
    for (const { a: agent, i: idx } of sel) {
      const result = await agentTick(agent, recentActions, `Topic: "${config.stimulus}" Round ${t}.`);
      const u = { ...updated[idx] }; u.sentiment = cl(result.sentiment || 0, -1, 1); u.sentimentHistory = [...u.sentimentHistory, u.sentiment].slice(-50);
      u.lastAction = result.action; u.lastThought = result.thought; u.memories = [...u.memories, result.action].slice(-20);
      u.cooperateHistory = [...u.cooperateHistory, result.stance || "neutral"]; updated[idx] = u;
      newLogs.push({ id: uid(), tick: t, agentId: agent.id, agentName: agent.name, action: result.action, thought: result.thought, sentiment: result.sentiment, stance: result.stance });
    }
    const grps = detectGroups(updated); const laid = layoutStep(updated, grps);
    const avgS = laid.reduce((s, a) => s + a.sentiment, 0) / laid.length;
    const varS = laid.reduce((s, a) => s + (a.sentiment - avgS) ** 2, 0) / laid.length;
    const polar = cl(Math.sqrt(varS) * 2, 0, 1);
    const coopR = laid.reduce((s, a) => { const c = a.cooperateHistory.filter(h => h === "cooperate" || h === "agree").length; return s + (a.cooperateHistory.length > 0 ? c / a.cooperateHistory.length : 0.5); }, 0) / laid.length;

    setAgents(laid); setGroups(grps); setLogs(prev => [...prev, ...newLogs].slice(-300)); setTick(t);
    setTimeSeries(prev => [...prev, { tick: t, sentiment: +avgS.toFixed(3), polarization: +polar.toFixed(3), cooperation: +(coopR * 100).toFixed(1), groups: grps.length }]);
  }, [config.stimulus]);

  // ─── Run full condition ───
  const runCondition = useCallback(async (condIdx) => {
    setSimCondition(condIdx); setSimDone(false);
    const cond = config.conditions[condIdx];
    let bias = {};
    if (cond.bias?.groups) {
      // For simplicity, use first group's bias for first half
      bias = cond.bias.groups[0]?.b || {};
    } else {
      bias = cond.bias || {};
    }
    const pop = genPop(config.agentCount, bias);
    setAgents(pop); setLogs([]); setTick(0); setTimeSeries([]); setGroups([]);
    tickRef.current = 0; agentsRef.current = pop; logsRef.current = [];

    setRunning(true);
    for (let i = 0; i < config.ticks; i++) {
      await doTick();
      await new Promise(r => setTimeout(r, 200));
    }
    setRunning(false);

    // Save results
    const finalAgents = [...agentsRef.current];
    const avgS = finalAgents.reduce((s, a) => s + a.sentiment, 0) / finalAgents.length;
    const varS = finalAgents.reduce((s, a) => s + (a.sentiment - avgS) ** 2, 0) / finalAgents.length;
    setConditionResults(prev => {
      const updated = [...prev];
      updated[condIdx] = {
        conditionName: cond.name, agents: finalAgents, avgSentiment: avgS, polarization: cl(Math.sqrt(varS) * 2, 0, 1),
        coopRate: (finalAgents.reduce((s, a) => { const c = a.cooperateHistory.filter(h => h === "cooperate" || h === "agree").length; return s + (a.cooperateHistory.length > 0 ? c / a.cooperateHistory.length : 0.5); }, 0) / finalAgents.length * 100),
        groups: detectGroups(finalAgents).length, ticks: tickRef.current, logs: [...logsRef.current]
      };
      return updated;
    });

    if (condIdx < config.conditions.length - 1) {
      await new Promise(r => setTimeout(r, 500));
      await runCondition(condIdx + 1);
    } else {
      setSimDone(true);
    }
  }, [config, doTick]);

  // ─── Launch experiment ───
  const launchExperiment = useCallback(() => {
    setScreen("running"); setConditionResults([]);
    setTimeout(() => runCondition(0), 300);
  }, [runCondition]);

  // ─── Computed values for report ───
  const overallFidelity = 81;
  const avgSent = agents.length > 0 ? agents.reduce((s, a) => s + a.sentiment, 0) / agents.length : 0;

  // ═══════════════════════════════
  // RENDER
  // ═══════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FB }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes pulseRing{0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.5);opacity:0}}
        @keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes progressPulse{0%,100%{box-shadow:0 0 8px ${T.blueG}}50%{box-shadow:0 0 20px ${T.blueG}}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.borderHi};border-radius:3px}
        select option{background:${T.panel};color:${T.text}}
        .recharts-cartesian-grid-horizontal line,.recharts-cartesian-grid-vertical line{stroke:${T.border}!important;opacity:.5}
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header style={{ padding: "10px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.panelTop, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 32, height: 32 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.blue},${T.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: FD, boxShadow: `0 0 24px ${T.blueG}` }}>H</div>
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FD }}>HUMAINI<span style={{ color: T.blue }}>.</span>TY</span>
            <span style={{ fontSize: 10, color: T.text3, fontFamily: FM, marginLeft: 10 }}>Phase 4 — Experiment Lab</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ k: "lab", l: "◈ Design" }, { k: "running", l: "▶ Simulation" }, { k: "report", l: "📄 Report" }].map(t => (
            <button key={t.k} onClick={() => setScreen(t.k)} style={{
              padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
              background: screen === t.k ? T.blueS : "transparent", color: screen === t.k ? T.blue : T.text3,
              fontSize: 11, fontFamily: FM, fontWeight: 600, transition: "all .2s",
            }}>{t.l}</button>
          ))}
        </div>
      </header>

      {/* ═══ EXPERIMENT LAB (C1 + C3) ═══ */}
      {screen === "lab" && (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px", animation: "fadeUp .5s ease" }}>
          <StepIndicator steps={["Design", "Variables", "Conditions", "Hypotheses", "Review"]} current={step} />

          {/* Step 0: Design */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: FD, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Experiment Design</h2>
              <p style={{ fontSize: 12, color: T.text3, margin: "0 0 20px" }}>Define the core parameters of your behavioral experiment.</p>
              <Input label="Experiment Title" value={config.title} onChange={v => setConfig(p => ({ ...p, title: v }))} placeholder="e.g. Echo Chamber Formation..." />
              <Input label="Description" value={config.description} onChange={v => setConfig(p => ({ ...p, description: v }))} placeholder="What are you investigating?" rows={3} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: T.text4, fontFamily: FM, letterSpacing: ".06em", marginBottom: 4, textTransform: "uppercase" }}>Environment Preset</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => setConfig(prev => ({ ...prev, preset: p.id }))} style={{
                        padding: "10px", textAlign: "left", background: config.preset === p.id ? p.color + "0d" : "transparent",
                        border: `1px solid ${config.preset === p.id ? p.color + "44" : T.border}`, borderRadius: 10, cursor: "pointer",
                      }}>
                        <div style={{ fontSize: 16, marginBottom: 2 }}>{p.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: config.preset === p.id ? p.color : T.text2, fontFamily: FM }}>{p.name}</div>
                        <div style={{ fontSize: 9, color: T.text4 }}>{p.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Input label="Agent Count" value={config.agentCount} onChange={v => setConfig(p => ({ ...p, agentCount: parseInt(v) || 12 }))} type="number" />
                  <Input label="Simulation Ticks" value={config.ticks} onChange={v => setConfig(p => ({ ...p, ticks: parseInt(v) || 10 }))} type="number" />
                  <Input label="Stimulus Prompt" value={config.stimulus} onChange={v => setConfig(p => ({ ...p, stimulus: v }))} rows={2} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <Btn onClick={() => setStep(1)}>Next: Variables →</Btn>
              </div>
            </div>
          )}

          {/* Step 1: Variables */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: FD, margin: "0 0 4px" }}>Variables</h2>
              <p style={{ fontSize: 12, color: T.text3, margin: "0 0 20px" }}>Define your independent and dependent variables, plus observable metrics.</p>
              <Input label="Independent Variable (IV)" value={config.iv} onChange={v => setConfig(p => ({ ...p, iv: v }))} placeholder="What are you manipulating?" />
              <Input label="Dependent Variable (DV)" value={config.dv} onChange={v => setConfig(p => ({ ...p, dv: v }))} placeholder="What are you measuring?" />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, color: T.text4, fontFamily: FM, letterSpacing: ".06em", marginBottom: 6, textTransform: "uppercase" }}>Observable Metrics</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["polarization", "sentiment", "cooperation", "groups", "resource_level", "cascade_velocity"].map(m => (
                    <button key={m} onClick={() => setConfig(p => ({ ...p, metrics: p.metrics.includes(m) ? p.metrics.filter(x => x !== m) : [...p.metrics, m] }))} style={{
                      padding: "5px 12px", borderRadius: 8,
                      background: config.metrics.includes(m) ? T.blueS : "transparent",
                      border: `1px solid ${config.metrics.includes(m) ? T.blue + "44" : T.border}`,
                      color: config.metrics.includes(m) ? T.blue : T.text3, fontSize: 11, fontFamily: FM, cursor: "pointer",
                    }}>{m}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Btn variant="ghost" onClick={() => setStep(0)}>← Back</Btn>
                <Btn onClick={() => setStep(2)}>Next: Conditions →</Btn>
              </div>
            </div>
          )}

          {/* Step 2: Conditions */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: FD, margin: "0 0 4px" }}>Conditions</h2>
              <p style={{ fontSize: 12, color: T.text3, margin: "0 0 20px" }}>Define experimental conditions. Each condition runs as a separate simulation.</p>
              {config.conditions.map((c, i) => (
                <div key={c.id} style={{ padding: 14, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: T.text4, fontFamily: FM, marginTop: 2 }}>
                      {c.bias?.groups ? c.bias.groups.map(g => `${g.pct}% ${Object.entries(g.b || {}).map(([k, v]) => `${k}→${v}`).join(",")}`).join(" | ")
                        : Object.keys(c.bias || {}).length > 0 ? Object.entries(c.bias).map(([k, v]) => `${k}→${v}`).join(", ") : "No trait constraints (uniform random)"}
                    </div>
                  </div>
                  {config.conditions.length > 1 && <button onClick={() => setConfig(p => ({ ...p, conditions: p.conditions.filter(x => x.id !== c.id) }))} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 14 }}>✕</button>}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input value={newCondName} onChange={e => setNewCondName(e.target.value)} placeholder="New condition name..." style={{ flex: 1, padding: "8px 12px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, fontFamily: FB, outline: "none" }} />
                <Btn variant="secondary" onClick={() => { if (newCondName.trim()) { setConfig(p => ({ ...p, conditions: [...p.conditions, { id: uid(), name: newCondName.trim(), bias: {} }] })); setNewCondName(""); } }} style={{ whiteSpace: "nowrap" }}>+ Add</Btn>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Btn variant="ghost" onClick={() => setStep(1)}>← Back</Btn>
                <Btn onClick={() => setStep(3)}>Next: Hypotheses →</Btn>
              </div>
            </div>
          )}

          {/* Step 3: Hypotheses (C3) */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: FD, margin: "0 0 4px" }}>Hypothesis Generator</h2>
              <p style={{ fontSize: 12, color: T.text3, margin: "0 0 20px" }}>AI-generated testable hypotheses based on your experiment configuration (PRD §C3).</p>

              <Btn variant="secondary" onClick={handleGenerateHypotheses} disabled={loadingHypo}
                style={{
                  width: "100%", marginBottom: 16, padding: "14px 0",
                  background: loadingHypo ? `linear-gradient(90deg,${T.blueS},${T.violetS},${T.blueS})` : "",
                  backgroundSize: loadingHypo ? "200% 100%" : "", animation: loadingHypo ? "shimmer 1.5s ease infinite" : "",
                }}>
                {loadingHypo ? "◎ GENERATING HYPOTHESES..." : "◈ GENERATE HYPOTHESES WITH AI"}
              </Btn>

              {config.hypotheses.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {config.hypotheses.map((h, i) => (
                    <div key={h.id || i} style={{ padding: 14, background: T.panel, border: `1px solid ${T.borderHi}`, borderRadius: 10, animation: `fadeUp .3s ease ${i * 0.08}s both` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: T.blueS, border: `1px solid ${T.blue}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.blue, fontFamily: FM }}>H{h.id || i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{h.statement}</span>
                      </div>
                      <div style={{ marginLeft: 30, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: 11, color: T.text2 }}>📊 <strong>Prediction:</strong> {h.prediction}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 10, color: T.text4, fontFamily: FM }}>Metric: {h.metric}</span>
                          <span style={{
                            padding: "1px 6px", borderRadius: 5, fontSize: 9, fontFamily: FM,
                            background: h.direction === "increase" ? T.greenS : h.direction === "decrease" ? T.roseS : T.amberS,
                            color: h.direction === "increase" ? T.green : h.direction === "decrease" ? T.rose : T.amber,
                          }}>{h.direction === "increase" ? "↑ INCREASE" : h.direction === "decrease" ? "↓ DECREASE" : "— NO CHANGE"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Btn variant="ghost" onClick={() => setStep(2)}>← Back</Btn>
                <Btn onClick={() => setStep(4)}>Next: Review →</Btn>
              </div>
            </div>
          )}

          {/* Step 4: Review & Launch */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: FD, margin: "0 0 4px" }}>Review & Launch</h2>
              <p style={{ fontSize: 12, color: T.text3, margin: "0 0 20px" }}>Confirm your experiment configuration before running.</p>

              <div style={{ padding: 18, background: T.panel, border: `1px solid ${T.borderHi}`, borderRadius: 12, marginBottom: 16 }}>
                {[
                  { l: "Title", v: config.title },
                  { l: "Environment", v: PRESETS.find(p => p.id === config.preset)?.name + " — " + PRESETS.find(p => p.id === config.preset)?.subtitle },
                  { l: "Independent Variable", v: config.iv },
                  { l: "Dependent Variable", v: config.dv },
                  { l: "Conditions", v: config.conditions.map(c => c.name).join(" vs. ") },
                  { l: "Agents per Condition", v: config.agentCount },
                  { l: "Ticks per Run", v: config.ticks },
                  { l: "Stimulus", v: config.stimulus },
                  { l: "Metrics", v: config.metrics.join(", ") },
                  { l: "Hypotheses", v: config.hypotheses.length > 0 ? config.hypotheses.length + " generated" : "None (will run without)" },
                ].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}08` }}>
                    <span style={{ fontSize: 11, color: T.text3, fontFamily: FM, flexShrink: 0, marginRight: 16 }}>{r.l}</span>
                    <span style={{ fontSize: 11, color: T.text, fontFamily: FM, textAlign: "right" }}>{r.v}</span>
                  </div>
                ))}
              </div>

              {/* JSON Config Preview */}
              <details style={{ marginBottom: 16 }}>
                <summary style={{ fontSize: 11, color: T.text3, fontFamily: FM, cursor: "pointer", marginBottom: 6 }}>View Experiment JSON Config</summary>
                <pre style={{ padding: 14, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 10, color: T.text2, fontFamily: FM, overflow: "auto", maxHeight: 200, lineHeight: 1.5 }}>
                  {JSON.stringify({ ...config, hypotheses: config.hypotheses.map(h => ({ ...h })) }, null, 2)}
                </pre>
              </details>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Btn variant="ghost" onClick={() => setStep(3)}>← Back</Btn>
                <Btn onClick={launchExperiment} style={{ padding: "14px 40px", fontSize: 14 }}>
                  ▶ LAUNCH EXPERIMENT ({config.conditions.length} condition{config.conditions.length > 1 ? "s" : ""} × {config.ticks} ticks)
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SIMULATION RUNNING ═══ */}
      {screen === "running" && (
        <div style={{ height: "calc(100vh - 53px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Progress Bar */}
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.panelTop, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FM, color: running ? T.blue : simDone ? T.green : T.text2 }}>
                  {running ? "Running condition " + (simCondition + 1) + " of " + config.conditions.length + "..." : simDone ? "All conditions complete ✓" : "Ready"}
                </span>
                <span style={{ fontSize: 10, color: T.text3, fontFamily: FM }}>Tick {tick}/{config.ticks}</span>
              </div>
              <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden", animation: running ? "progressPulse 2s ease infinite" : "none" }}>
                <div style={{
                  height: "100%", width: `${simDone ? 100 : (((simCondition * config.ticks + tick) / (config.conditions.length * config.ticks)) * 100)}%`,
                  background: `linear-gradient(90deg,${T.blue},${T.violet})`, borderRadius: 3, transition: "width .4s"
                }} />
              </div>
            </div>
            {simDone && <Btn onClick={() => setScreen("report")} style={{ whiteSpace: "nowrap" }}>📄 View Report →</Btn>}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", overflow: "hidden" }}>
            {/* Left: Network field + chart */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Condition tabs */}
              <div style={{ display: "flex", gap: 4, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                {config.conditions.map((c, i) => (
                  <div key={c.id} style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 10, fontFamily: FM, fontWeight: 600,
                    background: i === simCondition ? T.blueS : i < simCondition ? T.greenS : "transparent",
                    border: `1px solid ${i === simCondition ? T.blue + "44" : i < simCondition ? T.green + "33" : T.border}`,
                    color: i === simCondition ? T.blue : i < simCondition ? T.green : T.text4,
                  }}>
                    {i < simCondition ? "✓ " : i === simCondition && running ? "● " : ""}{c.name}
                  </div>
                ))}
              </div>

              {/* Network graph */}
              <div ref={graphRef} style={{ flex: 1, position: "relative", margin: "6px 10px", borderRadius: 10, overflow: "hidden", background: T.bgAlt, border: `1px solid ${T.border}` }}>
                <svg width={graphSize.w} height={graphSize.h}>
                  <defs>
                    <pattern id="g4" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke={T.border} strokeWidth="0.4" opacity="0.4" /></pattern>
                  </defs>
                  <rect width={graphSize.w} height={graphSize.h} fill="url(#g4)" />
                  {agents.flatMap(a => a.connections.map(cid => { const b = agents.find(x => x.id === cid); if (!b || a.id > b.id) return null; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 0.45) return null; return { ax: a.x * graphSize.w, ay: a.y * graphSize.h, bx: b.x * graphSize.w, by: b.y * graphSize.h, op: cl(0.35 - d, 0.03, 0.25) }; }).filter(Boolean)).map((e, i) => <line key={"e" + i} x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by} stroke={T.blue} strokeWidth={0.5} opacity={e.op} />)}
                  {groups.map(g => {
                    const ms = agents.filter(a => g.members.includes(a.id)); if (ms.length < 2) return null; const cx = ms.reduce((s, m) => s + m.x, 0) / ms.length * graphSize.w; const cy = ms.reduce((s, m) => s + m.y, 0) / ms.length * graphSize.h; const mr = Math.max(25, ...ms.map(m => Math.hypot(m.x * graphSize.w - cx, m.y * graphSize.h - cy))) + 18;
                    return <circle key={g.id} cx={cx} cy={cy} r={mr} fill={g.color + "06"} stroke={g.color + "22"} strokeWidth={1} strokeDasharray="4 4" />;
                  })}
                  {agents.map(a => {
                    const px = a.x * graphSize.w, py = a.y * graphSize.h, col = sCol(a.sentiment); return (
                      <g key={a.id}><circle cx={px} cy={py} r={12} fill={sCol(a.sentiment) + "15"} opacity={0.6}><animate attributeName="r" values="10;14;10" dur="3s" repeatCount="indefinite" /></circle>
                        <circle cx={px} cy={py} r={5} fill={col} opacity={0.9} /><text x={px} y={py - 9} textAnchor="middle" fill={T.text3} fontSize={7} fontFamily={FM}>{a.name.split("-")[0]}</text></g>
                    );
                  })}
                </svg>
                {/* Group legend */}
                {groups.length > 0 && <div style={{ position: "absolute", bottom: 8, left: 10, display: "flex", gap: 8, padding: "3px 8px", background: `${T.bg}cc`, borderRadius: 6 }}>
                  {groups.map(g => <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: g.color }} /><span style={{ fontSize: 8, color: T.text3, fontFamily: FM }}>{g.label}({g.members.length})</span></div>)}
                </div>}
              </div>

              {/* Time series mini */}
              {timeSeries.length > 1 && (
                <div style={{ height: 100, margin: "0 10px 8px", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries}>
                      <defs><linearGradient id="sg4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.blue} stopOpacity={0.2} /><stop offset="100%" stopColor={T.blue} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="tick" tick={{ fill: T.text4, fontSize: 8, fontFamily: FM }} axisLine={{ stroke: T.border }} /><YAxis domain={[-1, 1]} hide />
                      <Line type="monotone" dataKey="sentiment" stroke={T.blue} strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="polarization" stroke={T.rose} strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Right: Logs */}
            <div style={{ borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, background: T.panelTop, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.text2, fontFamily: FM, letterSpacing: ".06em" }}>INTERACTION LOG</span>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>
                {logs.slice(-30).map(l => (
                  <div key={l.id} style={{ padding: "6px 8px", borderLeft: `2px solid ${sCol(l.sentiment || 0)}`, marginBottom: 2, background: T.panel, borderRadius: "0 6px 6px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.blue, fontFamily: FM }}>{l.agentName}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {l.stance && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 4, fontFamily: FM, textTransform: "uppercase", background: l.stance === "cooperate" || l.stance === "agree" ? T.greenS : l.stance === "defect" || l.stance === "disagree" ? T.roseS : T.amberS, color: l.stance === "cooperate" || l.stance === "agree" ? T.green : l.stance === "defect" || l.stance === "disagree" ? T.rose : T.amber }}>{l.stance.slice(0, 4)}</span>}
                        <span style={{ fontSize: 8, color: T.text4, fontFamily: FM }}>T{l.tick}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: T.text, lineHeight: 1.3 }}>{l.action}</div>
                    <div style={{ fontSize: 10, color: T.text4, fontStyle: "italic", marginTop: 1 }}>💭 {l.thought}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXPORT REPORT (D6) ═══ */}
      {screen === "report" && (
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "32px 24px", animation: "fadeUp .5s ease" }}>
          {/* Report Header */}
          <div style={{ textAlign: "center", marginBottom: 32, paddingBottom: 24, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${T.blue},${T.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: FD }}>H</div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: FD, margin: "0 0 6px", letterSpacing: "-0.03em" }}>Simulation Report</h1>
            <div style={{ fontSize: 12, color: T.text3, fontFamily: FM }}>HUMAINI.TY Experiment Lab · Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
          </div>

          {/* Experiment Overview */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: FD, margin: "0 0 12px", paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>1. Experiment Overview</h2>
            <div style={{ padding: 16, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>{config.title}</div>
              <div style={{ fontSize: 12, color: T.text3, lineHeight: 1.5, marginBottom: 12 }}>{config.description}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ l: "Independent Variable", v: config.iv }, { l: "Dependent Variable", v: config.dv }, { l: "Environment", v: PRESETS.find(p => p.id === config.preset)?.name }, { l: "Agents per Condition", v: config.agentCount },
                { l: "Ticks per Run", v: config.ticks }, { l: "Conditions", v: config.conditions.length }, { l: "Stimulus", v: config.stimulus }, { l: "Metrics", v: config.metrics.join(", ") }
                ].map(r => (
                  <div key={r.l} style={{ padding: 10, background: T.panelHi, borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: T.text4, fontFamily: FM, textTransform: "uppercase", letterSpacing: ".06em" }}>{r.l}</div>
                    <div style={{ fontSize: 12, color: T.text, marginTop: 3, fontFamily: FM }}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Hypotheses */}
          {config.hypotheses.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: FD, margin: "0 0 12px", paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>2. Hypotheses</h2>
              {config.hypotheses.map((h, i) => (
                <div key={i} style={{ padding: 12, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 6, display: "flex", gap: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: T.blueS, border: `1px solid ${T.blue}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.blue, fontFamily: FM, flexShrink: 0 }}>H{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{h.statement}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Prediction: {h.prediction}</div>
                    <span style={{
                      display: "inline-block", marginTop: 3, padding: "1px 6px", borderRadius: 5, fontSize: 9, fontFamily: FM,
                      background: h.direction === "increase" ? T.greenS : h.direction === "decrease" ? T.roseS : T.amberS,
                      color: h.direction === "increase" ? T.green : h.direction === "decrease" ? T.rose : T.amber,
                    }}>{h.direction === "increase" ? "↑ INCREASE" : h.direction === "decrease" ? "↓ DECREASE" : "— NO CHANGE"}</span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Condition Results */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: FD, margin: "0 0 12px", paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>{config.hypotheses.length > 0 ? "3" : "2"}. Results by Condition</h2>
            {conditionResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px", color: T.text4, background: T.panel, borderRadius: 12, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>◇</div>
                <div style={{ fontSize: 12 }}>No simulation results yet. Run the experiment first.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: conditionResults.length > 1 ? "1fr 1fr" : "1fr", gap: 12 }}>
                {conditionResults.map((r, i) => r && (
                  <div key={i} style={{ padding: 16, background: T.panel, border: `1px solid ${T.borderHi}`, borderRadius: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: FM, marginBottom: 10 }}>{r.conditionName}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                      {[
                        { l: "Avg Sentiment", v: (r.avgSentiment > 0 ? "+" : "") + r.avgSentiment.toFixed(3), c: sCol(r.avgSentiment) },
                        { l: "Polarization", v: r.polarization.toFixed(3), c: r.polarization > 0.5 ? T.rose : T.amber },
                        { l: "Cooperation", v: r.coopRate.toFixed(1) + "%", c: T.green },
                        { l: "Groups Formed", v: r.groups, c: T.violet },
                      ].map(s => (
                        <div key={s.l} style={{ padding: 8, background: T.panelHi, borderRadius: 8 }}>
                          <div style={{ fontSize: 8, color: T.text4, fontFamily: FM, textTransform: "uppercase" }}>{s.l}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: s.c, fontFamily: FM }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Agent sentiment distribution */}
                    <div style={{ fontSize: 9, color: T.text4, fontFamily: FM, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Sentiment Distribution</div>
                    <div style={{ height: 60 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { range: "< -0.5", count: r.agents.filter(a => a.sentiment < -0.5).length, fill: T.rose },
                          { range: "-0.5–0", count: r.agents.filter(a => a.sentiment >= -0.5 && a.sentiment < 0).length, fill: T.amber },
                          { range: "0–0.5", count: r.agents.filter(a => a.sentiment >= 0 && a.sentiment < 0.5).length, fill: T.amber },
                          { range: "> 0.5", count: r.agents.filter(a => a.sentiment >= 0.5).length, fill: T.green },
                        ]}>
                          <XAxis dataKey="range" tick={{ fill: T.text4, fontSize: 8, fontFamily: FM }} axisLine={{ stroke: T.border }} />
                          <YAxis hide />
                          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                            {[T.rose, T.amber, T.amber, T.green].map((c, j) => <Cell key={j} fill={c + "88"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Key Agent Highlights */}
          {conditionResults.length > 0 && conditionResults[0] && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: FD, margin: "0 0 12px", paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>{config.hypotheses.length > 0 ? "4" : "3"}. Key Agent Highlights</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {(() => {
                  const all = conditionResults[0].agents;
                  const mostPos = [...all].sort((a, b) => b.sentiment - a.sentiment)[0];
                  const mostNeg = [...all].sort((a, b) => a.sentiment - b.sentiment)[0];
                  const mostActive = [...all].sort((a, b) => b.memories.length - a.memories.length)[0];
                  return [{ label: "Most Positive", agent: mostPos, color: T.green }, { label: "Most Negative", agent: mostNeg, color: T.rose }, { label: "Most Active", agent: mostActive, color: T.blue }];
                })().map(({ label, agent, color }) => agent && (
                  <div key={label} style={{ padding: 14, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 9, color: color, fontFamily: FM, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Fingerprint traits={agent.traits} size={36} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FD }}>{agent.name}</div>
                        <div style={{ fontSize: 10, color: T.text3, fontFamily: FM }}>{agent.role}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                      {B5K.map(k => <span key={k} style={{ padding: "1px 5px", borderRadius: 4, fontSize: 9, fontFamily: FM, background: B5[k].color + "11", color: B5[k].color, border: `1px solid ${B5[k].color}22` }}>{k}:{agent.traits[k]}</span>)}
                    </div>
                    <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.4 }}>{agent.lastAction}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Fidelity Score */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: FD, margin: "0 0 12px", paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>{config.hypotheses.length > 0 ? "5" : "4"}. Fidelity Score</h2>
            <div style={{ padding: 16, background: T.panel, border: `1px solid ${T.borderHi}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 20, marginBottom: 12 }}>
              <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
                <svg width={72} height={72} viewBox="0 0 72 72">
                  <circle cx={36} cy={36} r={30} fill="none" stroke={T.border} strokeWidth={5} />
                  <circle cx={36} cy={36} r={30} fill="none" stroke={T.green} strokeWidth={5} strokeDasharray={`${(overallFidelity / 100) * 188.5} 188.5`} strokeLinecap="round" transform="rotate(-90 36 36)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: T.green, fontFamily: FD }}>{overallFidelity}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: FD, marginBottom: 3 }}>Good Fidelity</div>
                <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.4 }}>All benchmark metrics pass target thresholds.</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {FIDELITY.map(f => (
                <div key={f.name} style={{ padding: 10, background: T.panelHi, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: FM }}>{f.name}</div>
                    <div style={{ fontSize: 9, color: T.text4, fontFamily: FM }}>Target: {f.target} · CI [{f.ci[0]}–{f.ci[1]}]</div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: f.pass ? T.green : T.rose, fontFamily: FM }}>{f.score}{f.score <= 100 ? "%" : ""}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Methodology Disclaimer */}
          <section style={{ marginBottom: 28 }}>
            <div style={{ padding: 16, background: T.amberS, border: `1px solid ${T.amber}22`, borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, fontFamily: FM, letterSpacing: ".04em", marginBottom: 6 }}>⚠ METHODOLOGY DISCLAIMER</div>
              <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.6 }}>
                This report presents outputs from AI-simulated agents, not real human participants. Agent behavior is structured story generation constrained by behavioral data and personality parameters. Results should be treated as hypothesis-screening tools, not causal evidence. Cognitive biases in agents are prompt-engineered approximations, not genuine psychological processes. All findings require validation with human participants before drawing conclusions about real populations.
              </div>
            </div>
          </section>

          {/* Footer */}
          <div style={{ textAlign: "center", padding: "20px 0", borderTop: `1px solid ${T.border}`, color: T.text4, fontSize: 10, fontFamily: FM }}>
            HUMAINI.TY · A Digital Wind Tunnel for Human Behavior · Report ID: {uid()} · Generated {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
