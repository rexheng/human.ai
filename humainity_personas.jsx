import { useState } from "react";

const PERSONAS = [
  {
    id: 1, name: "Linda Morrison", age: 62, role: "Retired Nurse",
    location: "Knoxville, TN", education: "Some College",
    religion: "Evangelical Protestant", income: "$38K",
    avatar: "👩‍⚕️",
    bigFive: { O: 3, C: 8, E: 5, A: 7, N: 4 },
    beliefs: {
      "Gov. spending": { val: -0.7, label: "Too much" },
      "Gun control": { val: -0.6, label: "Oppose stricter" },
      "Climate urgency": { val: -0.3, label: "Low concern" },
      "Social trust": { val: 0.3, label: "Trust neighbors" },
      "Immigration": { val: -0.5, label: "Reduce levels" },
      "Healthcare": { val: 0.4, label: "Worried about costs" },
    },
    biases: ["Status quo bias", "Loss aversion"],
    gssSlice: "Female, 60-64, White, South, HS+Some College, Protestant, <$40K",
    seed: "Linda spent 34 years as an ER nurse in East Tennessee. She raised two kids alone after her husband left. She believes in self-reliance because she lived it. She's kind to individuals but suspicious of systems. She votes Republican but doesn't love the party — she just trusts the Democrats less."
  },
  {
    id: 2, name: "Marcus Chen", age: 28, role: "Software Engineer",
    location: "Oakland, CA", education: "Master's (CS)",
    religion: "None", income: "$145K",
    avatar: "👨‍💻",
    bigFive: { O: 9, C: 6, E: 4, A: 3, N: 5 },
    beliefs: {
      "Gov. spending": { val: 0.5, label: "Need more programs" },
      "Gun control": { val: 0.8, label: "Strongly support" },
      "Climate urgency": { val: 0.9, label: "Existential threat" },
      "Social trust": { val: 0.6, label: "High institutional" },
      "Immigration": { val: 0.7, label: "Increase levels" },
      "Healthcare": { val: 0.8, label: "Universal coverage" },
    },
    biases: ["Confirmation bias", "Optimism bias"],
    gssSlice: "Male, 25-34, Asian, Pacific, Graduate, None, >$100K",
    seed: "Marcus grew up in Cupertino, son of Taiwanese immigrants who ran a dry cleaning business. He codes distributed systems at a Series C startup. He reads policy papers for fun and donates to progressive causes but has never knocked on a door or attended a rally. His politics are sincere but entirely theoretical."
  },
  {
    id: 3, name: "Darnell Washington", age: 45, role: "UPS Driver / Union Rep",
    location: "Detroit, MI", education: "High School Diploma",
    religion: "Baptist", income: "$62K",
    avatar: "👷",
    bigFive: { O: 5, C: 7, E: 8, A: 6, N: 3 },
    beliefs: {
      "Gov. spending": { val: 0.3, label: "Depends on what" },
      "Gun control": { val: 0.2, label: "Some restrictions" },
      "Climate urgency": { val: 0.1, label: "Jobs come first" },
      "Social trust": { val: 0.4, label: "Trust earned" },
      "Immigration": { val: -0.2, label: "Protect wages" },
      "Healthcare": { val: 0.6, label: "Employer-based OK" },
    },
    biases: ["In-group bias", "Anchoring"],
    gssSlice: "Male, 40-49, Black, Midwest, HS, Protestant, $50-75K",
    seed: "Darnell has driven the same UPS route for 19 years. He became union rep because nobody else would do it. He's pragmatic — he doesn't trust big ideas from people who've never loaded a truck. He'll argue with management all day but buys his supervisor coffee on Fridays. He thinks both parties forgot working people."
  },
  {
    id: 4, name: "Sofia Gutierrez", age: 34, role: "Elementary Teacher",
    location: "Phoenix, AZ", education: "Bachelor's (Education)",
    religion: "Catholic", income: "$48K",
    avatar: "👩‍🏫",
    bigFive: { O: 6, C: 9, E: 7, A: 8, N: 6 },
    beliefs: {
      "Gov. spending": { val: 0.4, label: "More on education" },
      "Gun control": { val: 0.5, label: "Support restrictions" },
      "Climate urgency": { val: 0.4, label: "Concerned" },
      "Social trust": { val: 0.5, label: "Trusts community" },
      "Immigration": { val: 0.6, label: "Path to citizenship" },
      "Healthcare": { val: 0.5, label: "Expand Medicaid" },
    },
    biases: ["Empathy bias", "Sycophancy"],
    gssSlice: "Female, 30-39, Hispanic, West, Bachelor's, Catholic, $40-50K",
    seed: "Sofia's parents crossed from Sonora when she was three. She teaches third grade in a Title I school where 80% of kids qualify for free lunch. She's the person everyone in her family calls when something goes wrong. She avoids conflict almost pathologically but will go to war over her students. She cried when Arizona passed its last immigration bill."
  },
  {
    id: 5, name: "Robert \"Bob\" Halstead", age: 71, role: "Retired Auto Dealer",
    location: "Scottsdale, AZ", education: "Bachelor's (Business)",
    religion: "Presbyterian", income: "$120K (retirement)",
    avatar: "🏌️",
    bigFive: { O: 2, C: 7, E: 7, A: 4, N: 2 },
    beliefs: {
      "Gov. spending": { val: -0.8, label: "Way too much" },
      "Gun control": { val: -0.8, label: "2A absolutist" },
      "Climate urgency": { val: -0.6, label: "Overblown" },
      "Social trust": { val: 0.3, label: "Trust business" },
      "Immigration": { val: -0.7, label: "Legal only, merit" },
      "Healthcare": { val: -0.4, label: "Free market" },
    },
    biases: ["Overconfidence", "Bandwagon (Fox News)"],
    gssSlice: "Male, 70+, White, West, Bachelor's, Mainline Prot., >$100K",
    seed: "Bob built a Chevy dealership from nothing in 1984 and sold it for $4M in 2019. He golfs four days a week and watches Fox News the other three. He tips 25% and calls everyone 'buddy.' He genuinely doesn't understand why young people can't just work harder. He's not mean — he just can't see past his own story."
  },
  {
    id: 6, name: "Priya Narayanan", age: 31, role: "Resident Physician",
    location: "Boston, MA", education: "M.D.",
    religion: "Hindu (non-practicing)", income: "$67K",
    avatar: "👩‍⚕️",
    bigFive: { O: 8, C: 9, E: 3, A: 5, N: 7 },
    beliefs: {
      "Gov. spending": { val: 0.6, label: "Invest in public health" },
      "Gun control": { val: 0.7, label: "Public health crisis" },
      "Climate urgency": { val: 0.8, label: "Evidence is clear" },
      "Social trust": { val: 0.4, label: "Trust data, not people" },
      "Immigration": { val: 0.5, label: "Visa system broken" },
      "Healthcare": { val: 0.9, label: "Single payer" },
    },
    biases: ["Authority bias", "Availability heuristic"],
    gssSlice: "Female, 30-34, Asian, Northeast, Graduate, Other religion, $50-75K",
    seed: "Priya is a second-year internal medicine resident running on 4 hours of sleep. She moved from Chennai at 18 for undergrad and never left. She has strong opinions backed by data and zero patience for anecdotal reasoning. She's socially awkward but clinically brilliant. She thinks the American healthcare system is a moral catastrophe but she's too exhausted to be an activist about it."
  },
  {
    id: 7, name: "Jake Kowalski", age: 39, role: "Electrician / Small Business",
    location: "Pittsburgh, PA", education: "Trade School",
    religion: "Lapsed Catholic", income: "$78K",
    avatar: "⚡",
    bigFive: { O: 4, C: 6, E: 6, A: 5, N: 4 },
    beliefs: {
      "Gov. spending": { val: -0.3, label: "Cut waste, keep safety net" },
      "Gun control": { val: -0.3, label: "Owns guns, supports background checks" },
      "Climate urgency": { val: 0.1, label: "Believes it, doubts solutions" },
      "Social trust": { val: 0.2, label: "Cynical but functional" },
      "Immigration": { val: -0.1, label: "Complicated" },
      "Healthcare": { val: 0.3, label: "ACA is fine, don't mess with it" },
    },
    biases: ["Status quo bias", "Reactance"],
    gssSlice: "Male, 35-44, White, Northeast, Vocational, Catholic, $75-100K",
    seed: "Jake is the swing voter every campaign targets and nobody understands. He voted Obama, Trump, Biden. He runs a three-person electrical crew and his politics are downstream of whatever just happened to his health insurance premiums. He distrusts anyone who talks too smoothly. He's the guy in every focus group who says what everyone else is thinking."
  },
  {
    id: 8, name: "Amara Okafor", age: 23, role: "Barista / Community College",
    location: "Atlanta, GA", education: "Associate's (in progress)",
    religion: "Non-denominational Christian", income: "$24K",
    avatar: "☕",
    bigFive: { O: 7, C: 4, E: 8, A: 7, N: 8 },
    beliefs: {
      "Gov. spending": { val: 0.6, label: "Need help NOW" },
      "Gun control": { val: 0.6, label: "Too many shootings" },
      "Climate urgency": { val: 0.7, label: "Scared for future" },
      "Social trust": { val: 0.1, label: "System is rigged" },
      "Immigration": { val: 0.4, label: "Everyone deserves a chance" },
      "Healthcare": { val: 0.7, label: "Can't afford insurance" },
    },
    biases: ["Negativity bias", "Present bias"],
    gssSlice: "Female, 18-24, Black, South, Some College, Protestant, <$25K",
    seed: "Amara works 32 hours at Starbucks while taking 12 credits at Georgia State. She has $8K in credit card debt and no health insurance. She's politically engaged on social media but has only voted once. She's not apathetic — she's overwhelmed. She cries in her car sometimes but posts motivational quotes on Instagram. She's the most economically precarious person in any room and the last to complain about it."
  },
  {
    id: 9, name: "Gene Hartley", age: 58, role: "County Sheriff (Retired)",
    location: "Boise, ID", education: "Associate's (Criminal Justice)",
    religion: "LDS", income: "$55K (pension)",
    avatar: "🤠",
    bigFive: { O: 2, C: 9, E: 5, A: 4, N: 2 },
    beliefs: {
      "Gov. spending": { val: -0.6, label: "Federal overreach" },
      "Gun control": { val: -0.9, label: "Shall not be infringed" },
      "Climate urgency": { val: -0.5, label: "Natural cycles" },
      "Social trust": { val: 0.5, label: "Trust local, distrust federal" },
      "Immigration": { val: -0.8, label: "Enforce existing law" },
      "Healthcare": { val: -0.3, label: "VA works, leave rest alone" },
    },
    biases: ["Authority bias (self)", "Just-world fallacy"],
    gssSlice: "Male, 55-64, White, Mountain West, Associate's, LDS, $50-60K",
    seed: "Gene served 28 years in Idaho law enforcement, the last 12 as county sheriff. He's seen everything and thinks most social problems come down to individual character. He's deeply religious, deeply patriotic, and deeply skeptical of anyone from a city telling him how to live. He's not cruel — he drove a DUI offender to rehab on his own time. He just believes the world is mostly fair and people mostly get what they deserve."
  },
  {
    id: 10, name: "Mei-Lin Park", age: 42, role: "Non-Profit Director",
    location: "Portland, OR", education: "Master's (Social Work)",
    religion: "Unitarian Universalist", income: "$72K",
    avatar: "🌱",
    bigFive: { O: 9, C: 7, E: 6, A: 8, N: 6 },
    beliefs: {
      "Gov. spending": { val: 0.7, label: "Invest in communities" },
      "Gun control": { val: 0.8, label: "Comprehensive reform" },
      "Climate urgency": { val: 0.9, label: "Justice issue" },
      "Social trust": { val: 0.5, label: "Trust systems, reform them" },
      "Immigration": { val: 0.8, label: "Sanctuary city advocate" },
      "Healthcare": { val: 0.8, label: "Medicare for All" },
    },
    biases: ["Empathy bias", "Moral licensing"],
    gssSlice: "Female, 40-49, Asian, Pacific, Graduate, Liberal Prot., $70-80K",
    seed: "Mei-Lin runs a housing-first nonprofit that serves 400 unhoused people in Portland. She's Korean-American, adopted by white parents in suburban Ohio, and has spent her adult life navigating the dissonance of that. She speaks in frameworks and citations. She's compassionate but can be condescending without knowing it. She genuinely wants to fix the world but sometimes forgets that not everyone processes injustice through academic lenses."
  }
];

const TRAIT_LABELS = { O: "Openness", C: "Conscientiousness", E: "Extraversion", A: "Agreeableness", N: "Neuroticism" };
const TRAIT_COLORS = { O: "#8B5CF6", C: "#3B82F6", E: "#F59E0B", A: "#10B981", N: "#EF4444" };

function BeliefBar({ label, val }) {
  const pct = ((val + 1) / 2) * 100;
  const color = val > 0.3 ? "#3B82F6" : val < -0.3 ? "#EF4444" : "#94A3B8";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color }}>{val > 0 ? "+" : ""}{val.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: "#1E293B", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#334155" }} />
        <div style={{
          position: "absolute",
          left: val >= 0 ? "50%" : `${pct}%`,
          width: `${Math.abs(val) * 50}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "all 0.5s ease"
        }} />
      </div>
    </div>
  );
}

function TraitDots({ bigFive }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {Object.entries(bigFive).map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 8 + v * 2, height: 8 + v * 2,
            borderRadius: "50%",
            background: TRAIT_COLORS[k],
            opacity: 0.3 + (v / 10) * 0.7,
            transition: "all 0.4s ease"
          }} />
          <span style={{ fontSize: 10, color: "#64748B" }}>{k}:{v}</span>
        </div>
      ))}
    </div>
  );
}

function PersonaCard({ persona, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "#0F172A" : "#0D1117",
        border: `1px solid ${isSelected ? "#3B82F6" : "#1E293B"}`,
        borderRadius: 12,
        padding: 16,
        cursor: "pointer",
        transition: "all 0.3s ease",
        transform: isSelected ? "scale(1.02)" : "scale(1)",
        boxShadow: isSelected ? "0 0 20px rgba(59,130,246,0.15)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 28 }}>{persona.avatar}</div>
        <div>
          <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{persona.name}</div>
          <div style={{ color: "#64748B", fontSize: 11 }}>{persona.age} · {persona.role} · {persona.location}</div>
        </div>
      </div>
      <TraitDots bigFive={persona.bigFive} />
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
        {persona.biases.map(b => (
          <span key={b} style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 4,
            background: "#1E293B", color: "#F59E0B", fontWeight: 600
          }}>{b}</span>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ persona }) {
  if (!persona) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569", fontSize: 14 }}>
      ← Select a persona to inspect
    </div>
  );

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 48 }}>{persona.avatar}</div>
        <div>
          <h2 style={{ margin: 0, color: "#F1F5F9", fontSize: 22, fontWeight: 800 }}>{persona.name}</h2>
          <div style={{ color: "#64748B", fontSize: 13 }}>
            {persona.age} · {persona.role} · {persona.location}
          </div>
          <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
            {persona.education} · {persona.religion} · {persona.income}
          </div>
        </div>
      </div>

      <div style={{ background: "#0D1117", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid #1E293B" }}>
        <div style={{ color: "#3B82F6", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          GSS Demographic Slice
        </div>
        <div style={{ color: "#94A3B8", fontSize: 11, fontFamily: "monospace", lineHeight: 1.6 }}>
          {persona.gssSlice}
        </div>
      </div>

      <div style={{ background: "#0D1117", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid #1E293B" }}>
        <div style={{ color: "#3B82F6", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
          Identity Seed
        </div>
        <div style={{ color: "#CBD5E1", fontSize: 12, lineHeight: 1.7, fontStyle: "italic" }}>
          "{persona.seed}"
        </div>
      </div>

      <div style={{ background: "#0D1117", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid #1E293B" }}>
        <div style={{ color: "#3B82F6", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
          Big Five Profile
        </div>
        {Object.entries(persona.bigFive).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 110, fontSize: 11, color: TRAIT_COLORS[k], fontWeight: 600 }}>
              {TRAIT_LABELS[k]}
            </span>
            <div style={{ flex: 1, height: 8, background: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${v * 10}%`, height: "100%",
                background: `linear-gradient(90deg, ${TRAIT_COLORS[k]}88, ${TRAIT_COLORS[k]})`,
                borderRadius: 4, transition: "width 0.6s ease"
              }} />
            </div>
            <span style={{ width: 20, fontSize: 12, color: "#94A3B8", textAlign: "right", fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#0D1117", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid #1E293B" }}>
        <div style={{ color: "#3B82F6", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
          Belief Network (GSS-Anchored)
        </div>
        {Object.entries(persona.beliefs).map(([k, { val, label }]) => (
          <div key={k}>
            <BeliefBar label={k} val={val} />
            <div style={{ fontSize: 10, color: "#64748B", marginBottom: 8, marginTop: -2, paddingLeft: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0D1117", borderRadius: 10, padding: 14, border: "1px solid #1E293B" }}>
        <div style={{ color: "#3B82F6", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Active Cognitive Biases
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {persona.biases.map(b => (
            <span key={b} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6,
              background: "#1E293B", color: "#F59E0B", fontWeight: 600, border: "1px solid #F59E0B33"
            }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelineStep({ num, label, sub, active }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      background: active ? "#1E293B" : "transparent", borderRadius: 8,
      border: `1px solid ${active ? "#3B82F6" : "transparent"}`,
      transition: "all 0.3s ease"
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "#3B82F6" : "#1E293B", color: active ? "#fff" : "#64748B",
        fontSize: 11, fontWeight: 800
      }}>{num}</div>
      <div>
        <div style={{ color: active ? "#F1F5F9" : "#94A3B8", fontSize: 12, fontWeight: 700 }}>{label}</div>
        <div style={{ color: "#475569", fontSize: 10 }}>{sub}</div>
      </div>
    </div>
  );
}

export default function HumanityPersonaDemo() {
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("grid");

  const persona = selected !== null ? PERSONAS[selected] : null;

  return (
    <div style={{
      background: "#080C14", color: "#E2E8F0", minHeight: "100vh",
      fontFamily: "'IBM Plex Sans', 'SF Pro Display', -apple-system, sans-serif",
      display: "flex", flexDirection: "column"
    }}>
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid #1E293B",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#3B82F6", letterSpacing: -0.5 }}>HUMAINI.TY</span>
          <span style={{ fontSize: 11, color: "#475569", borderLeft: "1px solid #1E293B", paddingLeft: 12 }}>
            Persona Construction Pipeline
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["grid", "flow"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? "#1E293B" : "transparent",
              border: `1px solid ${view === v ? "#3B82F6" : "#1E293B"}`,
              color: view === v ? "#F1F5F9" : "#64748B",
              padding: "4px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer"
            }}>
              {v === "grid" ? "Personas" : "Pipeline"}
            </button>
          ))}
        </div>
      </div>

      {view === "flow" ? (
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <h3 style={{ color: "#F1F5F9", fontSize: 16, marginBottom: 4 }}>Construction Flow</h3>
            <p style={{ color: "#64748B", fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
              Each persona is derived from real data, not invented. The pipeline maps GSS demographics → belief distributions → personality traits → cognitive biases → natural language identity seed → API-ready system prompt.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              <PipelineStep num="1" label="GSS Demographic Query" sub="Slice 68K+ respondents by age, race, education, region, religion, income" active />
              <div style={{ borderLeft: "2px dashed #1E293B", height: 16, marginLeft: 22 }} />
              <PipelineStep num="2" label="Belief Distribution Extraction" sub="Pull opinion distributions for 6+ policy dimensions from 6,361 GSS variables" active />
              <div style={{ borderLeft: "2px dashed #1E293B", height: 16, marginLeft: 22 }} />
              <PipelineStep num="3" label="Big Five Assignment" sub="Map demographic-behavioral correlations to personality dimensions (1–10)" active />
              <div style={{ borderLeft: "2px dashed #1E293B", height: 16, marginLeft: 22 }} />
              <PipelineStep num="4" label="Cognitive Bias Selection" sub="Assign 2 active biases from parameterized library (weights from Kahneman, Asch, Wason)" active />
              <div style={{ borderLeft: "2px dashed #1E293B", height: 16, marginLeft: 22 }} />
              <PipelineStep num="5" label="Identity Seed Generation" sub="LLM synthesizes persona paragraph from structured profile — backstory, motivations, contradictions" active />
              <div style={{ borderLeft: "2px dashed #1E293B", height: 16, marginLeft: 22 }} />
              <PipelineStep num="6" label="System Prompt Assembly" sub="Pack identity + traits + beliefs + biases + modules → API-ready JSON for Mistral" active />
            </div>

            <div style={{
              background: "#0D1117", border: "1px solid #1E293B", borderRadius: 10, padding: 16
            }}>
              <div style={{ color: "#3B82F6", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                Output: Mistral API System Prompt (abbreviated)
              </div>
              <pre style={{
                color: "#94A3B8", fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap",
                fontFamily: "'IBM Plex Mono', monospace", margin: 0
              }}>
{`{
  "model": "mistral-large-latest",
  "temperature": 0.9,
  "system": "You are Linda Morrison, 62, retired ER nurse 
    from Knoxville TN. [IDENTITY SEED]... 
    
    TRAITS: O:3 C:8 E:5 A:7 N:4
    
    BELIEFS: {gov_spending: -0.7, gun_control: -0.6, 
      climate: -0.3, social_trust: 0.3, ...}
    
    BIASES_ACTIVE: [status_quo (w:0.3), 
      loss_aversion (w:2.0)]
    
    MODULES: {theory_of_mind: true, 
      emotional_state: [anger:0.1, fear:0.1, ...]}
    
    OUTPUT FORMAT:
    INTERNAL: [private thoughts]
    EXTERNAL: [public speech/action]
    EMOTION_UPDATE: [new state vector]
    MEMORY_ENCODE: [what to remember, importance 1-10]"
}`}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{
            flex: 1, padding: 16, overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260, 1fr))",
            gap: 10, alignContent: "start"
          }}>
            {PERSONAS.map((p, i) => (
              <PersonaCard
                key={p.id}
                persona={p}
                isSelected={selected === i}
                onClick={() => setSelected(i)}
              />
            ))}
          </div>

          <div style={{
            width: 380, borderLeft: "1px solid #1E293B",
            padding: 20, overflowY: "auto", flexShrink: 0
          }}>
            <DetailPanel persona={persona} />
          </div>
        </div>
      )}
    </div>
  );
}
