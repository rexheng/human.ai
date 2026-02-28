import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import SwarmGraph from "./SwarmGraph";
import { generateSwarmIdentities, getSwarmInteraction } from "./ai-service";
import { Users, Network, Cpu, Sliders } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// HUMAINI.TY — Phase 1: Agent Architect & Population Generator
// Build synthetic minds. Configure psychology. Generate swarms.
// ═══════════════════════════════════════════════════════════════════════

/* ─── Design Tokens ─── */
const T = {
  bg: "#060810", bgGrain: "#080a14",
  panel: "#0c0e18", panelHi: "#10131f", panelTop: "#151827",
  border: "#191d32", borderHi: "#252a45", borderLit: "#3a4170",
  text: "#dee0ed", text2: "#9599b5", text3: "#555a78", text4: "#2e3250",
  blue: "#4a8aff", blueG: "rgba(74,138,255,.18)", blueS: "rgba(74,138,255,.06)",
  green: "#2dd4a0", greenG: "rgba(45,212,160,.18)", greenS: "rgba(45,212,160,.06)",
  amber: "#f0b429", amberG: "rgba(240,180,41,.16)", amberS: "rgba(240,180,41,.06)",
  rose: "#ee6b90", roseG: "rgba(238,107,144,.16)", roseS: "rgba(238,107,144,.06)",
  violet: "#9b7af5", violetG: "rgba(155,122,245,.16)", violetS: "rgba(155,122,245,.06)",
  cyan: "#26c9d9", cyanG: "rgba(38,201,217,.16)", cyanS: "rgba(38,201,217,.06)",
  orange: "#e88a3a", teal: "#2ab7a9",
};

/* ─── Typography: Syne (display) + DM Mono (data) ─── */
const FONT_DISPLAY = "'Syne', 'Clash Display', sans-serif";
const FONT_MONO = "'DM Mono', 'IBM Plex Mono', monospace";
const FONT_BODY = "'Instrument Sans', 'DM Sans', sans-serif";

/* ─── Big Five Personality System ─── */
const BIG5 = {
  O: { key: "O", full: "Openness", color: T.violet, icon: "◈", lo: "Conventional", hi: "Inventive", loDesc: "Prefers routine, practical, traditional approaches", hiDesc: "Seeks novelty, abstract thinking, creative exploration" },
  C: { key: "C", full: "Conscientiousness", color: T.cyan, icon: "◇", lo: "Spontaneous", hi: "Meticulous", loDesc: "Flexible, improvises, prioritises in-the-moment", hiDesc: "Organised, disciplined, plans carefully ahead" },
  E: { key: "E", full: "Extraversion", color: T.amber, icon: "◆", lo: "Reserved", hi: "Outgoing", loDesc: "Energised by solitude, reflective, listens more", hiDesc: "Energised by groups, talkative, seeks stimulation" },
  A: { key: "A", full: "Agreeableness", color: T.green, icon: "○", lo: "Competitive", hi: "Altruistic", loDesc: "Questions motives, values self-interest, skeptical", hiDesc: "Trusting, cooperative, puts others first" },
  N: { key: "N", full: "Neuroticism", color: T.rose, icon: "△", lo: "Resilient", hi: "Sensitive", loDesc: "Emotionally steady, handles stress calmly", hiDesc: "Reactive to stress, experiences emotions intensely" },
};
const B5_KEYS = ["O", "C", "E", "A", "N"];

/* ─── Cognitive Biases ─── */
const BIASES = [
  { id: "confirmation", name: "Confirmation Bias", desc: "Favours information confirming existing beliefs", weight: 0.35, source: "Nickerson (1998)" },
  { id: "lossAversion", name: "Loss Aversion", desc: "Losses weigh ~2× heavier than equivalent gains", weight: 0.45, source: "Kahneman & Tversky (1979)" },
  { id: "anchoring", name: "Anchoring", desc: "Over-relies on first piece of information received", weight: 0.40, source: "Tversky & Kahneman (1974)" },
  { id: "sycophancy", name: "Sycophancy", desc: "Tendency to agree with perceived authority", weight: 0.30, source: "Milgram (1963)" },
  { id: "statusQuo", name: "Status Quo Bias", desc: "Preference for current state of affairs", weight: 0.32, source: "Samuelson & Zeckhauser (1988)" },
  { id: "bandwagon", name: "Bandwagon Effect", desc: "Adopting beliefs proportional to group adoption", weight: 0.28, source: "Asch (1951)" },
];

/* ─── Agent Names ─── */
const FIRST = ["Ada", "Felix", "Mira", "Kai", "Zara", "Leo", "Nova", "Ravi", "Elsa", "Omar", "Yuki", "Sven", "Dara", "Emil", "Luna", "Hugo", "Iris", "Niko", "Cleo", "Axel", "Sage", "Remy", "Wren", "Juno", "Ezra", "Thea", "Idris", "Priya", "Malik", "Freya", "Hana", "Cyrus", "Lyra", "Tomas", "Nia", "Soren", "Vera", "Arlo", "Mei", "Dante"];
const ROLES = ["Student", "Teacher", "Executive", "Nurse", "Engineer", "Artist", "Farmer", "Journalist", "Retiree", "Social Worker", "Activist", "Scientist", "Chef", "Musician", "Lawyer", "Architect", "Librarian", "Paramedic"];
const CULTURES = ["Urban American", "Rural American", "Western European", "East Asian", "South Asian", "Latin American", "Middle Eastern", "Nordic", "Southeast Asian", "Caribbean", "Sub-Saharan African", "Oceanian"];
const EDUCATION = ["High School", "Some College", "Bachelor's", "Master's", "Doctorate", "Trade School"];
const INCOME = ["Low ($0–30k)", "Lower-Mid ($30–60k)", "Middle ($60–100k)", "Upper-Mid ($100–200k)", "High ($200k+)"];
const MEMORY_MODES = [
  { id: "short", label: "Short-Term", desc: "Session only. No cross-interaction recall.", icon: "⚡" },
  { id: "medium", label: "Medium-Term", desc: "Vector memory with exponential decay.", icon: "◎" },
  { id: "persistent", label: "Persistent", desc: "Full Memory Stream with reflections.", icon: "∞" },
];

let _uid = 0;
const uid = () => `ag_${++_uid}_${(Date.now() % 1e6).toString(36)}`;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ─── Generate random traits respecting bias config ─── */
function randomTraits(biasConfig = {}) {
  const t = {};
  B5_KEYS.forEach(k => {
    const bias = biasConfig[k];
    if (bias !== undefined) {
      t[k] = clamp(bias + Math.floor(Math.random() * 3) - 1, 1, 10);
    } else {
      t[k] = Math.floor(Math.random() * 10) + 1;
    }
  });
  return t;
}

/* ─── Generate one agent ─── */
function makeAgent(traitBias = {}) {
  const traits = randomTraits(traitBias);
  return {
    id: uid(),
    name: pick(FIRST) + "-" + (Math.floor(Math.random() * 900) + 100),
    traits,
    role: pick(ROLES),
    culture: pick(CULTURES),
    education: pick(EDUCATION),
    income: pick(INCOME),
    memoryMode: "persistent",
    biases: {},
    preview: null,
  };
}

/* ─── Claude API: generate persona preview ─── */
async function generatePreview(agent) {
  const td = B5_KEYS.map(k => `${BIG5[k].full}: ${agent.traits[k]}/10`).join(", ");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 300,
        messages: [{
          role: "user", content: `Generate a vivid 2-sentence personality sketch for this synthetic agent. Then list 3 likely behavioral tendencies as single short phrases.

Name: ${agent.name} | Role: ${agent.role} | Culture: ${agent.culture} | Education: ${agent.education}
Big Five: ${td}

Respond ONLY with JSON (no markdown): {"sketch":"...","tendencies":["...","...","..."]}`}],
      }),
    });
    const data = await res.json();
    const raw = (data.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch {
    const o = agent.traits.O, c = agent.traits.C, e = agent.traits.E, a = agent.traits.A, n = agent.traits.N;
    return {
      sketch: `${agent.name} is a ${e > 6 ? "socially energetic" : "quietly observant"} ${agent.role.toLowerCase()} with ${o > 6 ? "a deep creative streak" : "practical sensibilities"}. Their ${a > 6 ? "cooperative nature" : "independent streak"} and ${n > 6 ? "emotional sensitivity" : "calm steadiness"} define how they navigate ${agent.culture.toLowerCase()} social dynamics.`,
      tendencies: [
        e > 6 ? "Initiates group discussions readily" : "Prefers one-on-one exchanges",
        c > 6 ? "Plans meticulously before acting" : "Acts on impulse and adapts",
        a > 6 ? "Seeks consensus and harmony" : "Challenges assumptions directly",
      ],
    };
  }
}

// ═══════════════════════════════════════════════════
// ─── COMPONENTS ───
// ═══════════════════════════════════════════════════

/* ─── Personality Fingerprint: unique SVG per agent ─── */
function Fingerprint({ traits, size = 64, animate = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const s = size, cx = s / 2, cy = s / 2, r = s * 0.42;
    ctx.clearRect(0, 0, s, s);

    // Outer ring glow
    const grd = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.1);
    grd.addColorStop(0, "transparent");
    grd.addColorStop(1, T.blue + "08");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);

    // Concentric trait rings
    B5_KEYS.forEach((k, i) => {
      const v = traits[k] / 10;
      const ringR = r * (0.3 + i * 0.15);
      const segs = 36;
      ctx.beginPath();
      for (let j = 0; j <= segs; j++) {
        const a = (Math.PI * 2 * j) / segs - Math.PI / 2;
        const noise = Math.sin(a * 3 + i * 2 + v * 5) * v * ringR * 0.18 + Math.cos(a * 5 - i) * v * ringR * 0.08;
        const pr = ringR * (0.7 + v * 0.3) + noise;
        const x = cx + pr * Math.cos(a);
        const y = cy + pr * Math.sin(a);
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = BIG5[k].color + (animate ? "aa" : "55");
      ctx.lineWidth = animate ? 1.5 : 1;
      ctx.stroke();
    });

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = T.blue + "88";
    ctx.fill();
  }, [traits, size, animate]);

  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* ─── Trait Slider with gradient track ─── */
function TraitSlider({ traitKey, value, onChange, expanded, onToggle }) {
  const b = BIG5[traitKey];
  const pct = ((value - 1) / 9) * 100;
  return (
    <div style={{ marginBottom: expanded ? 14 : 10, transition: "margin 0.2s" }}>
      {/* Header row */}
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: b.color, fontFamily: FONT_MONO, fontWeight: 600 }}>{b.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: b.color, fontFamily: FONT_MONO, letterSpacing: "0.03em", flex: 1 }}>{b.full}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: b.color, fontFamily: FONT_MONO, lineHeight: 1 }}>{value}</span>
      </div>
      {/* Slider track */}
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: T.border, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${b.color}33, ${b.color})`, borderRadius: 4, transition: "width 0.15s" }} />
        <input type="range" min={1} max={10} value={value} onChange={e => onChange(parseInt(e.target.value))}
          style={{ position: "absolute", top: -6, left: 0, width: "100%", height: 20, opacity: 0, cursor: "pointer" }} />
        <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: b.color, boxShadow: `0 0 10px ${b.color}55`, transition: "left 0.15s", pointerEvents: "none" }} />
      </div>
      {/* Expanded description */}
      {expanded && (
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", animation: "revealDown .25s ease" }}>
          <span style={{ fontSize: 10, color: T.text3, fontFamily: FONT_MONO, maxWidth: "48%" }}>{b.loDesc}</span>
          <span style={{ fontSize: 10, color: T.text3, fontFamily: FONT_MONO, maxWidth: "48%", textAlign: "right" }}>{b.hiDesc}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Bias Toggle Tile ─── */
function BiasTile({ bias, active, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px",
      background: active ? T.violetS : "transparent",
      border: `1px solid ${active ? T.violet + "44" : T.border}`,
      borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all .2s",
      boxShadow: active ? `0 0 16px ${T.violetG}` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? T.violet : T.text2, fontFamily: FONT_MONO }}>{bias.name}</span>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: active ? T.violet : T.border, transition: "background .2s", boxShadow: active ? `0 0 6px ${T.violet}66` : "none" }} />
      </div>
      <span style={{ fontSize: 10, color: T.text3, lineHeight: 1.3 }}>{bias.desc}</span>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, color: T.text4, fontFamily: FONT_MONO }}>Weight: {(bias.weight * 100).toFixed(0)}%</span>
        <span style={{ fontSize: 9, color: T.text4, fontFamily: FONT_MONO }}>{bias.source}</span>
      </div>
    </button>
  );
}

/* ─── Agent Card in Gallery ─── */
function AgentCard({ agent, index, onClick, isSelected }) {
  const dominant = B5_KEYS.reduce((best, k) => agent.traits[k] > (agent.traits[best] || 0) ? k : best, "O");
  const domColor = BIG5[dominant].color;

  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", padding: 0, overflow: "hidden",
      background: T.panel, border: `1px solid ${isSelected ? domColor + "55" : T.border}`,
      borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "all .25s",
      boxShadow: isSelected ? `0 0 24px ${domColor}18, inset 0 0 20px ${domColor}06` : "none",
      animation: `materialize .4s ease ${index * 0.04}s both`,
      position: "relative",
    }}>
      {/* Top strip with fingerprint */}
      <div style={{ display: "flex", gap: 10, padding: "12px 12px 8px", alignItems: "center" }}>
        <Fingerprint traits={agent.traits} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT_DISPLAY, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</div>
          <div style={{ fontSize: 10, color: T.text3, fontFamily: FONT_MONO }}>{agent.role} · {agent.culture.split(" ")[0]}</div>
        </div>
      </div>
      {/* Trait bar mini-viz */}
      <div style={{ display: "flex", gap: 2, padding: "0 12px 10px" }}>
        {B5_KEYS.map(k => (
          <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: "100%", height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${agent.traits[k] * 10}%`, background: BIG5[k].color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 8, color: BIG5[k].color, fontFamily: FONT_MONO, fontWeight: 600 }}>{k}</span>
          </div>
        ))}
      </div>
      {/* Dominant trait badge */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        padding: "2px 6px", borderRadius: 6,
        background: domColor + "15", border: `1px solid ${domColor}33`,
        fontSize: 9, fontFamily: FONT_MONO, color: domColor, fontWeight: 600,
      }}>{BIG5[dominant].full.slice(0, 4).toUpperCase()}</div>
    </button>
  );
}

/* ─── Distribution Preset Chips ─── */
const DIST_PRESETS = [
  { label: "Uniform Random", config: {} },
  { label: "50/50 Agree Split", config: { groups: [{ pct: 50, bias: { A: 8 } }, { pct: 50, bias: { A: 3 } }] } },
  { label: "High Extraversion", config: { bias: { E: 8 } } },
  { label: "Polarised (O↑ vs O↓)", config: { groups: [{ pct: 50, bias: { O: 9 } }, { pct: 50, bias: { O: 2 } }] } },
  { label: "Neurotic Population", config: { bias: { N: 8, E: 4 } } },
  { label: "Cooperative Leaders", config: { bias: { A: 8, C: 8, E: 7 } } },
];

/* ─── Population Generator ─── */
function generatePopulation(count, distConfig = {}) {
  const agents = [];
  if (distConfig.groups) {
    let idx = 0;
    distConfig.groups.forEach(g => {
      const n = Math.round(count * g.pct / 100);
      for (let i = 0; i < n && idx < count; i++, idx++) {
        agents.push(makeAgent(g.bias || {}));
      }
    });
    while (agents.length < count) agents.push(makeAgent({}));
  } else {
    for (let i = 0; i < count; i++) agents.push(makeAgent(distConfig.bias || {}));
  }
  return agents;
}

// ═══════════════════════════════════════════════════
// ─── MAIN APPLICATION ───
// ═══════════════════════════════════════════════════

export default function HumanityPhase1() {
  /* ─ State: Single Agent Architect ─ */
  const [traits, setTraits] = useState({ O: 7, C: 5, E: 6, A: 4, N: 5 });
  const [expandedTrait, setExpandedTrait] = useState(null);
  const [role, setRole] = useState("Journalist");
  const [culture, setCulture] = useState("Urban American");
  const [education, setEducation] = useState("Bachelor's");
  const [income, setIncome] = useState("Middle ($60–100k)");
  const [memoryMode, setMemoryMode] = useState("persistent");
  const [activeBiases, setActiveBiases] = useState({});
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  /* ─ State: Population Generator ─ */
  const [view, setView] = useState("architect"); // architect | generator | gallery
  const [popCount, setPopCount] = useState(16);
  const [distPreset, setDistPreset] = useState(0);
  const [population, setPopulation] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [gallerySort, setGallerySort] = useState("name"); // name | dominant | sentiment

  /* ─ State: Swarm Network (Strand Pattern) ─ */
  const [swarmAgents, setSwarmAgents] = useState([]);
  const [swarmLinks, setSwarmLinks] = useState([]);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [swarmCount, setSwarmCount] = useState(25);
  const [activeTask, setActiveTask] = useState("Coordinate resources for emergency response");

  /* ─ Preview generation ─ */
  const requestPreview = useCallback(async () => {
    setLoadingPreview(true);
    const ag = { name: "Prototype-X", traits, role, culture, education, income };
    const result = await generatePreview(ag);
    setPreview(result);
    setLoadingPreview(false);
  }, [traits, role, culture, education, income]);

  /* ─ Population generation ─ */
  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const dist = DIST_PRESETS[distPreset]?.config || {};
      const pop = generatePopulation(popCount, dist);
      setPopulation(pop);
      setGenerating(false);
      setView("gallery");
    }, 600);
  }, [popCount, distPreset]);

  /* ─ Swarm: Identity Allocation (Mistral) ─ */
  const handleAllocateIdentities = useCallback(async () => {
    setIsAllocating(true);
    try {
      const identities = await generateSwarmIdentities(swarmCount);
      setSwarmAgents(identities);
      // Initialize with zero links
      setSwarmLinks([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAllocating(false);
    }
  }, [swarmCount]);

  /* ─ Swarm: Strand Simulation (Bedrock) ─ */
  const handleSimulateStrand = useCallback(async () => {
    if (swarmAgents.length === 0) return;
    setIsSimulating(true);
    try {
      const links = await getSwarmInteraction(swarmAgents, activeTask);
      setSwarmLinks(links);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  }, [swarmAgents, activeTask]);

  /* ─ Stats for gallery header ─ */
  const popStats = useMemo(() => {
    if (population.length === 0) return null;
    const avg = {};
    B5_KEYS.forEach(k => { avg[k] = (population.reduce((s, a) => s + a.traits[k], 0) / population.length).toFixed(1); });
    const dominant = B5_KEYS.reduce((best, k) => parseFloat(avg[k]) > parseFloat(avg[best]) ? k : best, "O");
    return { avg, dominant, count: population.length };
  }, [population]);

  /* ─ Sorted gallery ─ */
  const sortedPop = useMemo(() => {
    const copy = [...population];
    if (gallerySort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
    if (gallerySort === "dominant") {
      return copy.sort((a, b) => {
        const da = B5_KEYS.reduce((best, k) => a.traits[k] > a.traits[best] ? k : best, "O");
        const db = B5_KEYS.reduce((best, k) => b.traits[k] > b.traits[best] ? k : best, "O");
        return da.localeCompare(db);
      });
    }
    return copy;
  }, [population, gallerySort]);

  // ═══════════ RENDER ═══════════
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap');
        
        @keyframes revealDown { from { opacity:0; max-height:0; } to { opacity:1; max-height:80px; } }
        @keyframes materialize {
          0% { opacity:0; transform: scale(0.92) translateY(8px); filter: blur(4px); }
          60% { opacity:1; filter: blur(0); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes shimmerLine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes breathe {
          0%,100% { opacity:.6; } 50% { opacity:1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity:0.6; }
          100% { transform: scale(1.4); opacity:0; }
        }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${T.borderHi}; border-radius:3px; }
        select option { background:${T.panel}; color:${T.text}; }
        input[type=range] { accent-color: ${T.blue}; }
        
        /* Noise overlay */
        .noise::before {
          content:''; position:fixed; inset:0; z-index:9999; pointer-events:none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          background-size: 256px; opacity:0.4;
        }
      `}</style>

      <div className="noise" />

      {/* ═══ HEADER ═══ */}
      <header style={{
        padding: "14px 28px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: `linear-gradient(180deg, ${T.panelTop}ee, ${T.bg}00)`,
        backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Logo mark */}
          <div style={{ position: "relative", width: 38, height: 38 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 19, fontWeight: 800, color: "#fff", fontFamily: FONT_DISPLAY,
              boxShadow: `0 0 28px ${T.blueG}`,
            }}>H</div>
            <div style={{ position: "absolute", inset: -3, borderRadius: 13, border: `1px solid ${T.blue}22`, animation: "pulseRing 3s ease infinite" }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: FONT_DISPLAY }}>
              HUMAINI<span style={{ color: T.blue }}>.</span>TY
            </div>
            <div style={{ fontSize: 10, color: T.text3, fontFamily: FONT_MONO, letterSpacing: "0.1em" }}>PHASE 1 — AGENT ARCHITECT</div>
          </div>
        </div>

        {/* Nav Tabs */}
        <div style={{ display: "flex", gap: 2, background: T.panel, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
          {[
            { key: "architect", label: "Architect", icon: "◈" },
            { key: "generator", label: "Population", icon: "◇" },
            { key: "swarm", label: "Swarm Network", icon: "🕸" },
            { key: "gallery", label: `Gallery${population.length > 0 ? ` (${population.length})` : ""}`, icon: "▦" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)} style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              background: view === tab.key ? T.blueS : "transparent",
              color: view === tab.key ? T.blue : T.text3,
              fontSize: 12, fontWeight: 600, fontFamily: FONT_MONO, letterSpacing: "0.02em",
              transition: "all .2s",
            }}>
              <span style={{ marginRight: 5, opacity: 0.7 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ ARCHITECT VIEW ═══ */}
      {view === "architect" && (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr 340px", minHeight: "calc(100vh - 63px)" }}>

          {/* ── Left: Big Five Sliders ── */}
          <div style={{ borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_DISPLAY, margin: 0, letterSpacing: "-0.02em" }}>Personality Configuration</h2>
              <p style={{ fontSize: 11, color: T.text3, margin: "4px 0 0", fontFamily: FONT_MONO }}>Big Five trait dimensions (OCEAN model)</p>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              {/* Live Fingerprint */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ position: "relative" }}>
                  <Fingerprint traits={traits} size={120} animate />
                  <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `1px dashed ${T.borderHi}` }} />
                </div>
              </div>

              {/* Sliders */}
              {B5_KEYS.map(k => (
                <TraitSlider key={k} traitKey={k} value={traits[k]}
                  onChange={v => setTraits(prev => ({ ...prev, [k]: v }))}
                  expanded={expandedTrait === k}
                  onToggle={() => setExpandedTrait(expandedTrait === k ? null : k)}
                />
              ))}

              {/* Quick Presets */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Quick Presets</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {[
                    { label: "The Leader", t: { O: 7, C: 8, E: 8, A: 6, N: 3 } },
                    { label: "The Rebel", t: { O: 9, C: 3, E: 7, A: 2, N: 6 } },
                    { label: "The Empath", t: { O: 6, C: 5, E: 5, A: 9, N: 7 } },
                    { label: "The Analyst", t: { O: 8, C: 9, E: 3, A: 4, N: 2 } },
                    { label: "The Mediator", t: { O: 5, C: 6, E: 5, A: 8, N: 4 } },
                  ].map(p => (
                    <button key={p.label} onClick={() => setTraits(p.t)} style={{
                      padding: "4px 10px", background: "transparent", border: `1px solid ${T.border}`,
                      borderRadius: 8, color: T.text2, fontSize: 10, fontFamily: FONT_MONO, cursor: "pointer",
                      transition: "all .2s",
                    }}
                      onMouseEnter={e => { e.target.style.borderColor = T.blue + "44"; e.target.style.color = T.text; }}
                      onMouseLeave={e => { e.target.style.borderColor = T.border; e.target.style.color = T.text2; }}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Center: Preview + Biases ── */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "auto" }}>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_DISPLAY, margin: 0 }}>Persona Preview</h2>
              <p style={{ fontSize: 11, color: T.text3, margin: "4px 0 0", fontFamily: FONT_MONO }}>AI-generated behavioral sketch from configured traits</p>
            </div>

            <div style={{ flex: 1, padding: "20px 24px" }}>
              {/* Generate Preview Button */}
              <button onClick={requestPreview} disabled={loadingPreview} style={{
                width: "100%", padding: "14px 0", marginBottom: 20,
                background: loadingPreview
                  ? `linear-gradient(90deg, ${T.blueS}, ${T.violetS}, ${T.blueS})`
                  : T.blueS,
                backgroundSize: loadingPreview ? "200% 100%" : "100% 100%",
                animation: loadingPreview ? "shimmerLine 1.5s ease infinite" : "none",
                border: `1px solid ${T.blue}33`,
                borderRadius: 12, color: T.blue, fontSize: 13, fontWeight: 600,
                fontFamily: FONT_MONO, cursor: loadingPreview ? "wait" : "pointer",
                transition: "background .3s",
              }}>
                {loadingPreview ? "◎ GENERATING PREVIEW..." : "◈ GENERATE PERSONA PREVIEW"}
              </button>

              {/* Preview Card */}
              {preview && (
                <div style={{
                  padding: 20, background: T.panel, border: `1px solid ${T.borderHi}`,
                  borderRadius: 14, marginBottom: 24, animation: "slideUp .4s ease",
                  boxShadow: `0 4px 30px ${T.bg}88`,
                }}>
                  <div style={{ fontSize: 14, color: T.text, lineHeight: 1.65, marginBottom: 14 }}>
                    {preview.sketch}
                  </div>
                  <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Behavioral Tendencies</div>
                  {preview.tendencies.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: [T.blue, T.green, T.amber][i], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: T.text2, lineHeight: 1.4 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Cognitive Bias Toggles (A3) ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT_DISPLAY, margin: 0 }}>Cognitive Bias Layer</h3>
                  <span style={{ padding: "2px 8px", borderRadius: 6, background: T.amberS, border: `1px solid ${T.amber}22`, fontSize: 9, color: T.amber, fontFamily: FONT_MONO, fontWeight: 600 }}>POST-MVP</span>
                </div>
                <p style={{ fontSize: 11, color: T.text3, margin: "0 0 12px", lineHeight: 1.4 }}>Toggle cognitive biases derived from peer-reviewed effect sizes. Each bias applies weighted decision-modification prompts per interaction.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {BIASES.map(b => (
                    <BiasTile key={b.id} bias={b} active={!!activeBiases[b.id]}
                      onToggle={() => setActiveBiases(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                    />
                  ))}
                </div>
                {Object.values(activeBiases).some(Boolean) && (
                  <div style={{ marginTop: 10, padding: 10, background: T.amberS, border: `1px solid ${T.amber}22`, borderRadius: 8, animation: "slideUp .3s ease" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: T.amber, fontFamily: FONT_MONO, letterSpacing: "0.06em", marginBottom: 3 }}>⚠ METHODOLOGY NOTE</div>
                    <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.4 }}>Biases are prompt-engineered approximations with effect-size weights from published research. They are not genuine cognitive processes.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Demographics + Memory ── */}
          <div style={{ borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_DISPLAY, margin: 0 }}>Socio-Demographics</h2>
              <p style={{ fontSize: 11, color: T.text3, margin: "4px 0 0", fontFamily: FONT_MONO }}>Identity context layer (A2)</p>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
              {/* Selects */}
              {[
                { label: "Role", value: role, options: ROLES, set: setRole },
                { label: "Cultural Background", value: culture, options: CULTURES, set: setCulture },
                { label: "Education", value: education, options: EDUCATION, set: setEducation },
                { label: "Income Bracket", value: income, options: INCOME, set: setIncome },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>{s.label}</label>
                  <select value={s.value} onChange={e => s.set(e.target.value)} style={{
                    width: "100%", padding: "9px 12px", background: T.panel, border: `1px solid ${T.border}`,
                    borderRadius: 8, color: T.text, fontSize: 13, fontFamily: FONT_BODY,
                    outline: "none", cursor: "pointer", appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23555a78'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                  }}>{s.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
                </div>
              ))}

              {/* ── Memory Depth Config (A4) ── */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" }}>Memory Configuration (A4)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {MEMORY_MODES.map(m => (
                    <button key={m.id} onClick={() => setMemoryMode(m.id)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      background: memoryMode === m.id ? T.blueS : "transparent",
                      border: `1px solid ${memoryMode === m.id ? T.blue + "44" : T.border}`,
                      borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all .2s",
                    }}>
                      <span style={{ fontSize: 16, color: memoryMode === m.id ? T.blue : T.text3, transition: "color .2s" }}>{m.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: memoryMode === m.id ? T.blue : T.text2, fontFamily: FONT_MONO, transition: "color .2s" }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Identity Summary ── */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" }}>Agent DNA Summary</div>
                <div style={{ padding: 14, background: T.panelHi, borderRadius: 10, border: `1px solid ${T.border}` }}>
                  {[
                    { label: "Personality", value: B5_KEYS.map(k => `${k}:${traits[k]}`).join(" ") },
                    { label: "Role", value: role },
                    { label: "Culture", value: culture },
                    { label: "Education", value: education },
                    { label: "Income", value: income },
                    { label: "Memory", value: MEMORY_MODES.find(m => m.id === memoryMode)?.label },
                    { label: "Active Biases", value: BIASES.filter(b => activeBiases[b.id]).map(b => b.name).join(", ") || "None" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.border}08` }}>
                      <span style={{ fontSize: 10, color: T.text3, fontFamily: FONT_MONO }}>{r.label}</span>
                      <span style={{ fontSize: 10, color: T.text, fontFamily: FONT_MONO, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ POPULATION GENERATOR VIEW ═══ */}
      {view === "generator" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px", animation: "slideUp .4s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: "-0.03em", margin: "0 0 8px" }}>
              Population<span style={{ color: T.blue }}>.</span>Generator
            </h2>
            <p style={{ fontSize: 13, color: T.text3, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
              Batch-create agent populations with configurable trait distributions. Each agent receives randomised secondary traits while respecting distribution constraints.
            </p>
          </div>

          {/* Agent Count */}
          <div style={{ padding: 20, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT_MONO, color: T.text2 }}>AGENT COUNT</span>
              <span style={{ fontSize: 32, fontWeight: 800, color: T.blue, fontFamily: FONT_DISPLAY }}>{popCount}</span>
            </div>
            <input type="range" min={4} max={100} value={popCount} onChange={e => setPopCount(parseInt(e.target.value))} style={{ width: "100%", height: 4, cursor: "pointer", accentColor: T.blue }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: T.text4, fontFamily: FONT_MONO }}>
              <span>4</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
            {/* Quick buttons */}
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {[8, 16, 25, 50, 100].map(n => (
                <button key={n} onClick={() => setPopCount(n)} style={{
                  flex: 1, padding: "6px 0", background: popCount === n ? T.blueS : "transparent",
                  border: `1px solid ${popCount === n ? T.blue + "44" : T.border}`,
                  borderRadius: 8, color: popCount === n ? T.blue : T.text3,
                  fontSize: 12, fontFamily: FONT_MONO, fontWeight: 600, cursor: "pointer", transition: "all .2s",
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Distribution Presets */}
          <div style={{ padding: 20, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT_MONO, color: T.text2, marginBottom: 12 }}>TRAIT DISTRIBUTION</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {DIST_PRESETS.map((dp, i) => (
                <button key={i} onClick={() => setDistPreset(i)} style={{
                  padding: "10px 14px", textAlign: "left",
                  background: distPreset === i ? T.blueS : "transparent",
                  border: `1px solid ${distPreset === i ? T.blue + "44" : T.border}`,
                  borderRadius: 10, cursor: "pointer", transition: "all .2s",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: distPreset === i ? T.blue : T.text2, fontFamily: FONT_MONO }}>{dp.label}</div>
                  <div style={{ fontSize: 10, color: T.text4, marginTop: 2 }}>
                    {dp.config.groups
                      ? dp.config.groups.map(g => `${g.pct}% ${Object.entries(g.bias).map(([k, v]) => `${k}→${v}`).join(",")}`).join(" | ")
                      : dp.config.bias
                        ? Object.entries(dp.config.bias).map(([k, v]) => `${k}→${v}`).join(", ")
                        : "No trait constraints"
                    }
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button onClick={handleGenerate} disabled={generating} style={{
            width: "100%", padding: "18px 0",
            background: generating
              ? `linear-gradient(90deg, ${T.blueS}, ${T.violetS}, ${T.blueS})`
              : `linear-gradient(135deg, ${T.blue}, ${T.violet})`,
            backgroundSize: generating ? "200% 100%" : "100% 100%",
            animation: generating ? "shimmerLine 1.2s ease infinite" : "none",
            border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: FONT_DISPLAY, letterSpacing: "0.02em", cursor: generating ? "wait" : "pointer",
            boxShadow: `0 4px 30px ${T.blueG}`,
            transition: "transform .1s",
          }}
            onMouseDown={e => !generating && (e.target.style.transform = "scale(0.98)")}
            onMouseUp={e => e.target.style.transform = "scale(1)"}
          >
            {generating ? "◎ GENERATING POPULATION..." : `◈ GENERATE ${popCount} AGENTS`}
          </button>

          {/* PRD spec reminder */}
          <div style={{ marginTop: 16, padding: 12, background: T.greenS, border: `1px solid ${T.green}22`, borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.green, fontFamily: FONT_MONO, marginBottom: 3 }}>✓ PRD SPEC: A5</div>
            <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.4 }}>Batch generation target: &lt;30 seconds for 100 agents with correct trait distributions.</div>
          </div>
        </div>
      )}

      {/* ═══ GALLERY VIEW ═══ */}
      {view === "gallery" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 63px)" }}>
          {/* Gallery Header */}
          <div style={{ padding: "12px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: T.panelTop }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Agent Gallery</span>
                <span style={{ fontSize: 12, color: T.text3, fontFamily: FONT_MONO, marginLeft: 8 }}>{population.length} agents</span>
              </div>
              {popStats && (
                <div style={{ display: "flex", gap: 8 }}>
                  {B5_KEYS.map(k => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: BIG5[k].color }} />
                      <span style={{ fontSize: 10, color: T.text3, fontFamily: FONT_MONO }}>{k}:{popStats.avg[k]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO }}>SORT</span>
              {["name", "dominant"].map(s => (
                <button key={s} onClick={() => setGallerySort(s)} style={{
                  padding: "4px 10px", background: gallerySort === s ? T.blueS : "transparent",
                  border: `1px solid ${gallerySort === s ? T.blue + "33" : "transparent"}`,
                  borderRadius: 6, color: gallerySort === s ? T.blue : T.text3,
                  fontSize: 10, fontFamily: FONT_MONO, cursor: "pointer", textTransform: "uppercase",
                }}>{s}</button>
              ))}
              <div style={{ width: 1, height: 20, background: T.border, margin: "0 4px" }} />
              <button onClick={() => { setView("generator"); }} style={{
                padding: "5px 12px", background: "transparent", border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text2, fontSize: 11, fontFamily: FONT_MONO, cursor: "pointer",
              }}>↻ Regenerate</button>
            </div>
          </div>

          {/* Gallery Grid + Spotlight */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Grid */}
            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              {population.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: T.text4 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>◇</div>
                  <div style={{ fontSize: 14 }}>No agents generated yet.</div>
                  <button onClick={() => setView("generator")} style={{
                    marginTop: 12, padding: "8px 20px", background: T.blueS, border: `1px solid ${T.blue}33`,
                    borderRadius: 10, color: T.blue, fontSize: 12, fontFamily: FONT_MONO, fontWeight: 600, cursor: "pointer",
                  }}>Go to Population Generator</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10 }}>
                  {sortedPop.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i}
                      onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
                      isSelected={selectedAgent?.id === agent.id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Spotlight Sidebar */}
            {selectedAgent && (
              <div style={{
                width: 320, borderLeft: `1px solid ${T.border}`, background: T.panelHi,
                overflow: "auto", flexShrink: 0, animation: "slideUp .3s ease",
              }}>
                {/* Agent Header */}
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Fingerprint traits={selectedAgent.traits} size={56} animate />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT_DISPLAY }}>{selectedAgent.name}</div>
                      <div style={{ fontSize: 11, color: T.text3, fontFamily: FONT_MONO }}>{selectedAgent.role} · {selectedAgent.culture}</div>
                      <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO }}>{selectedAgent.education} · {selectedAgent.income}</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "16px 18px" }}>
                  {/* Full trait bars */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Personality Profile</div>
                    {B5_KEYS.map(k => {
                      const v = selectedAgent.traits[k];
                      const b = BIG5[k];
                      return (
                        <div key={k} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: b.color, fontFamily: FONT_MONO }}>{b.full}</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: b.color, fontFamily: FONT_DISPLAY }}>{v}</span>
                          </div>
                          <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${v * 10}%`, background: `linear-gradient(90deg, ${b.color}44, ${b.color})`, borderRadius: 3 }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                            <span style={{ fontSize: 9, color: T.text4, fontFamily: FONT_MONO }}>{b.lo}</span>
                            <span style={{ fontSize: 9, color: T.text4, fontFamily: FONT_MONO }}>{b.hi}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Behavioral Predictions */}
                  <div style={{ padding: 14, background: T.panel, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Predicted Behavioral Tendencies</div>
                    {B5_KEYS.map(k => {
                      const v = selectedAgent.traits[k];
                      const b = BIG5[k];
                      const desc = v <= 3 ? b.loDesc : v >= 8 ? b.hiDesc : `Balanced ${b.full.toLowerCase()} — adapts to context`;
                      return (
                        <div key={k} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: b.color, flexShrink: 0, marginTop: 5 }} />
                          <span style={{ fontSize: 11, color: T.text2, lineHeight: 1.4 }}>{desc}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ready for simulation badge */}
                  <div style={{ padding: 12, background: T.greenS, border: `1px solid ${T.green}22`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, animation: "breathe 2s ease infinite" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.green, fontFamily: FONT_MONO }}>SIMULATION READY</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.text3, marginTop: 4, lineHeight: 1.3 }}>This agent is configured and can be deployed into any environment preset.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SWARM NETWORK VIEW (Strand Pattern) ═══ */}
      {view === "swarm" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "calc(100vh - 63px)", overflow: "hidden" }}>
          {/* Main Visualizer Area */}
          <div style={{ padding: 20, position: "relative" }}>
            <SwarmGraph
              agents={swarmAgents}
              links={swarmLinks}
              onNodeClick={node => setSelectedAgent(swarmAgents.find(a => a.id === node.id))}
            />

            {/* Simulation Overlay */}
            {isSimulating && (
              <div style={{ position: "absolute", inset: 20, background: "rgba(6, 8, 16, 0.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, zIndex: 10 }}>
                <div style={{ background: T.panel, padding: "12px 24px", borderRadius: 12, border: `1px solid ${T.blue}44`, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 16, height: 16, border: `2px solid ${T.blue}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 13, fontFamily: FONT_MONO, color: T.blue }}>BEDROCK ORCHESTRATING STRAND...</span>
                </div>
              </div>
            )}
          </div>

          {/* Swarm Controls Sidebar */}
          <div style={{ borderLeft: `1px solid ${T.border}`, background: T.panelHi, padding: 20, overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 4 }}>Swarm Controller</h2>
            <p style={{ fontSize: 11, color: T.text3, fontFamily: FONT_MONO, marginBottom: 20 }}>Configure and orchestrate the agentic swarm.</p>

            {/* Config Section */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>1. Swarm Config</div>
              <div style={{ padding: 16, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.text2, fontFamily: FONT_MONO }}>Agent Count</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.blue, fontFamily: FONT_MONO }}>{swarmCount}</span>
                </div>
                <input
                  type="range" min={10} max={50} value={swarmCount}
                  onChange={e => setSwarmCount(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: T.blue, cursor: "pointer" }}
                />

                <button
                  onClick={handleAllocateIdentities}
                  disabled={isAllocating}
                  style={{
                    width: "100%", marginTop: 16, padding: "10px",
                    background: isAllocating ? T.panelHi : T.blueS,
                    border: `1px solid ${T.blue}44`, borderRadius: 8,
                    color: T.blue, fontSize: 11, fontWeight: 600, fontFamily: FONT_MONO,
                    cursor: isAllocating ? "wait" : "pointer", transition: "all .2s"
                  }}
                >
                  {isAllocating ? "◈ ALLOCATING..." : "◈ ALLOCATE IDENTITIES (MISTRAL)"}
                </button>
              </div>
            </div>

            {/* Task Section */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: FONT_MONO, letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>2. Strand Logic</div>
              <div style={{ padding: 16, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <label style={{ display: "block", fontSize: 10, color: T.text3, marginBottom: 8 }}>Global Swarm Task</label>
                <textarea
                  value={activeTask}
                  onChange={e => setActiveTask(e.target.value)}
                  style={{
                    width: "100%", height: 60, padding: 10, background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: 6, color: T.text, fontSize: 11, fontFamily: FONT_BODY, resize: "none"
                  }}
                />

                <button
                  onClick={handleSimulateStrand}
                  disabled={isSimulating || swarmAgents.length === 0}
                  style={{
                    width: "100%", marginTop: 12, padding: "10px",
                    background: isSimulating ? T.panelHi : `linear-gradient(135deg, ${T.blue}, ${T.violet})`,
                    border: "none", borderRadius: 8,
                    color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: FONT_MONO,
                    opacity: swarmAgents.length === 0 ? 0.3 : 1,
                    cursor: (isSimulating || swarmAgents.length === 0) ? "not-allowed" : "pointer",
                    boxShadow: swarmAgents.length > 0 ? `0 4px 12px ${T.blue}33` : "none"
                  }}
                >
                  {isSimulating ? "◎ SIMULATING..." : "🕸 RUN STRAND SIMULATION"}
                </button>
              </div>
            </div>

            {/* Selected Agent Spotlight mini */}
            {selectedAgent && (
              <div style={{ padding: 16, background: T.panelHi, border: `1px solid ${T.borderHi}`, borderRadius: 12, animation: "materialize .3s ease" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <Fingerprint traits={selectedAgent.traits} size={32} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{selectedAgent.name}</div>
                    <div style={{ fontSize: 10, color: T.text3 }}>{selectedAgent.role}</div>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: T.text2, fontStyle: "italic", lineHeight: 1.4 }}>"{selectedAgent.description || selectedAgent.preview?.sketch}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

