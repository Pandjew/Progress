import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { initAuth, getUserId, linkDevice, saveData, loadData, subscribeData, COLLECTIONS } from './firebase.js';

// ─── STORAGE (Firebase-backed) ───────────────────────────────
async function load(collection) { return await loadData(collection); }
async function save(collection, data) { await saveData(collection, data); }

// ─── CONSTANTS ───────────────────────────────────────────────
const C = {
  bg: "#07090f", card: "#0f1219", card2: "#161c28", border: "#1c2536", borderLight: "#253046",
  accent: "#f97316", accentDim: "#c2410c", green: "#22c55e", blue: "#3b82f6",
  purple: "#a855f7", red: "#ef4444", yellow: "#eab308", cyan: "#06b6d4", pink: "#ec4899",
  text: "#f1f5f9", textDim: "#94a3b8", textMuted: "#64748b",
};

const SESSION_TYPES = ["EF", "Sortie longue", "Fractionné", "Tempo", "Seuil", "Fartlek", "EF récup", "Course (compétition)", "Cali A", "Cali B", "Renfo salle", "Stretching / Mobilité"];
const DISCIPLINES = ["Course", "Renfo", "Mobilité", "Autre"];
const METEO_OPTIONS = ["Ensoleillé", "Nuageux", "Pluie", "Pluie + vent", "Vent léger", "Vent 25km/h", "Vent 30km/h", "Vent 35km/h", "Vent 50km/h+", "Plein soleil", "Intérieur", "Froid", "Chaleur"];
const MEAL_TYPES = ["Petit-déjeuner", "Déjeuner", "Dîner", "Snack / Collation", "Intra-effort", "Post-effort"];

const today = () => new Date().toISOString().slice(0, 10);
const fmtD = (d) => { const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); };
const fmtShort = (d) => { const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }); };
const getWeekNum = (d) => {
  const start = new Date("2026-03-08");
  const current = new Date(d + "T12:00:00");
  const diff = Math.floor((current - start) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
};

function formatSessionText(w) {
  let t = `📝 **SÉANCE — ${fmtD(w.date)} (S${w.week})**\n\n`;
  t += `**Type :** ${w.sessionType} | **Discipline :** ${w.discipline}\n`;
  if (w.duration) t += `**Durée :** ${w.duration}\n`;
  if (w.distance) t += `**Distance :** ${w.distance} km\n`;
  if (w.allure) t += `**Allure moy. :** ${w.allure}\n`;
  if (w.fcMoy) t += `**FC moy :** ${w.fcMoy} bpm\n`;
  if (w.fcMax) t += `**FC max :** ${w.fcMax} bpm\n`;
  t += `**Ressenti :** ${w.ressenti}/10 | **Fatigue :** ${w.fatigue}/10 | **Qualité :** ${w.quality}/10\n`;
  if (w.meteo) t += `**Météo :** ${w.meteo}\n`;
  if (w.exercises) t += `**Exercices :** ${w.exercises}\n`;
  if (w.comments) t += `**Commentaires :** ${w.comments}\n`;
  t += `\n_Tracker Pro — ${fmtD(today())}_`;
  return t;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
  }
}

// ─── STYLE COMPONENTS ────────────────────────────────────────
const font = "'DM Sans', sans-serif";
const mono = "'JetBrains Mono', 'Space Mono', monospace";

function Tab({ active, onClick, children, icon, count }) {
  return <button onClick={onClick} style={{
    padding: "8px 16px", border: "none", borderRadius: 8,
    background: active ? C.accent : "transparent", color: active ? "#fff" : C.textDim,
    fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", transition: "all .15s",
    fontFamily: font, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
  }}>
    <span style={{ fontSize: 15 }}>{icon}</span>
    <span>{children}</span>
    {count !== undefined && <span style={{
      background: active ? "rgba(255,255,255,.2)" : C.border, borderRadius: 10,
      padding: "1px 7px", fontSize: 11, fontWeight: 700,
    }}>{count}</span>}
  </button>;
}

function Card({ children, style, title, sub, action }) {
  return <div style={{ background: C.card, borderRadius: 14, padding: 20, border: `1px solid ${C.border}`, ...style }}>
    {(title || action) && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: sub ? 2 : 14 }}>
      {title && <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{title}</div>}
      {action}
    </div>}
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>{sub}</div>}
    {children}
  </div>;
}

function Inp({ label, ...p }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{label}</label>}
    <input {...p} style={{
      padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
      background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none",
      transition: "border .15s", width: "100%", boxSizing: "border-box", ...p.style,
    }} onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
  </div>;
}

function Sel({ label, options, placeholder = "— Choisir —", ...p }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{label}</label>}
    <select {...p} style={{
      padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
      background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", width: "100%",
    }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>;
}

function Btn({ children, v = "primary", ...p }) {
  const s = { primary: { background: C.accent, color: "#fff" }, secondary: { background: C.border, color: C.text },
    ghost: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}33` },
    success: { background: C.green, color: "#fff" } };
  return <button {...p} style={{
    padding: "9px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13,
    cursor: p.disabled ? "not-allowed" : "pointer", fontFamily: font, transition: "all .15s",
    opacity: p.disabled ? .4 : 1, display: "inline-flex", alignItems: "center", gap: 6,
    ...s[v], ...p.style,
  }}>{children}</button>;
}

function Badge({ children, color = C.accent }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: color + "1a", color, fontSize: 11, fontWeight: 700 }}>{children}</span>;
}

function Stat({ label, value, unit, color = C.accent, icon }) {
  return <div style={{ background: C.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, flex: "1 1 130px", minWidth: 130 }}>
    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>{icon && <span>{icon}</span>}{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: mono }}>{value}<span style={{ fontSize: 12, fontWeight: 500, color: C.textDim, marginLeft: 3 }}>{unit}</span></div>
  </div>;
}

function Slider3({ label, value, onChange, max = 10, low = "Facile", high = "Max", invert = false }) {
  const normalCol = value <= 3 ? C.green : value <= 6 ? C.yellow : value <= 8 ? C.accent : C.red;
  const invertCol = value >= 8 ? C.green : value >= 5 ? C.yellow : value >= 3 ? C.accent : C.red;
  const col = invert ? invertCol : normalCol;
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>
      {label} : <span style={{ color: col, fontWeight: 800, fontFamily: mono }}>{value}/{max}</span>
    </label>
    <input type="range" min={1} max={max} value={value} onChange={e => onChange(+e.target.value)} style={{ width: "100%", accentColor: col }} />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted }}><span>{low}</span><span>{high}</span></div>
  </div>;
}

function Grid({ cols = 2, gap = 14, children, style }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, ...style }}>{children}</div>;
}

// ─── MAIN APP ────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [workouts, setWorkouts] = useState([]);
  const [nutrition, setNutrition] = useState([]);
  const [body, setBody] = useState([]);
  const [shoes, setShoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    (async () => {
      const uid = await initAuth();
      setUserId(uid);
      const [w, n, b, s] = await Promise.all([
        load(COLLECTIONS.workouts), load(COLLECTIONS.nutrition),
        load(COLLECTIONS.body), load(COLLECTIONS.shoes),
      ]);
      setWorkouts(w); setNutrition(n); setBody(b);
      if (s.length === 0) {
        const def = [
          { id: "shoe1", name: "NB FuelCell Rebel V5", startDate: "2026-03-22", startKm: 0, alertKm: 600, notes: "Chaussure principale" },
          { id: "shoe2", name: "Anciennes chaussures", startDate: "2025-10-01", startKm: 350, alertKm: 600, notes: "Récup uniquement" },
        ];
        setShoes(def); await save(COLLECTIONS.shoes, def);
      } else { setShoes(s); }
      setLoading(false);

      // Real-time sync — si tu modifies sur un appareil, l'autre se met à jour
      subscribeData(COLLECTIONS.workouts, setWorkouts);
      subscribeData(COLLECTIONS.nutrition, setNutrition);
      subscribeData(COLLECTIONS.body, setBody);
      subscribeData(COLLECTIONS.shoes, (s) => { if (s.length > 0) setShoes(s); });
    })();
  }, []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const add = async (col, setter, data, item) => { const n = [item, ...data]; setter(n); await save(col, n); };
  const del = async (col, setter, data, id) => { const n = data.filter(x => x.id !== id); setter(n); await save(col, n); };

  const shoeKm = useMemo(() => {
    const map = {};
    shoes.forEach(s => { map[s.id] = s.startKm || 0; });
    workouts.forEach(w => { if (w.shoeId && map[w.shoeId] !== undefined && w.distance) map[w.shoeId] += parseFloat(w.distance) || 0; });
    return map;
  }, [workouts, shoes]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.accent, fontFamily: font }}>
    <div style={{ textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div><div style={{ fontWeight: 700 }}>Chargement…</div></div>
  </div>;

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "workout", icon: "💪", label: "Séance", count: workouts.length },
    { id: "nutrition", icon: "🥗", label: "Nutrition", count: nutrition.length },
    { id: "body", icon: "📏", label: "Physique", count: body.length },
    { id: "shoes", icon: "👟", label: "Chaussures" },
    { id: "summary", icon: "📋", label: "Résumé Coach" },
    { id: "settings", icon: "⚙️", label: "Sync" },
  ];

  return <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: font }}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

    {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", padding: "8px 20px", borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 999, boxShadow: "0 8px 32px #0008" }}>{toast}</div>}

    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div><div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.4px" }}>Tracker Pro</div><div style={{ fontSize: 11, color: C.textMuted }}>Marathon × Calisthénie</div></div>
      </div>
      <div style={{ display: "flex", gap: 3, background: C.bg, padding: 3, borderRadius: 10, flexWrap: "wrap" }}>
        {tabs.map(t => <Tab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} count={t.count}>{t.label}</Tab>)}
      </div>
    </div>

    <div style={{ padding: "20px 20px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {tab === "dashboard" && <DashboardView workouts={workouts} nutrition={nutrition} body={body} shoes={shoes} shoeKm={shoeKm} />}
      {tab === "workout" && <WorkoutView workouts={workouts} shoes={shoes}
        onAdd={w => { add(COLLECTIONS.workouts, setWorkouts, workouts, w); flash("Séance enregistrée ✓"); }}
        onDel={id => { del(COLLECTIONS.workouts, setWorkouts, workouts, id); flash("Supprimée"); }} />}
      {tab === "nutrition" && <NutritionView nutrition={nutrition}
        onAdd={n => { add(COLLECTIONS.nutrition, setNutrition, nutrition, n); flash("Nutrition enregistrée ✓"); }}
        onDel={id => { del(COLLECTIONS.nutrition, setNutrition, nutrition, id); flash("Supprimée"); }} />}
      {tab === "body" && <BodyView body={body}
        onAdd={b => { add(COLLECTIONS.body, setBody, body, b); flash("Mesure enregistrée ✓"); }}
        onDel={id => { del(COLLECTIONS.body, setBody, body, id); flash("Supprimée"); }} />}
      {tab === "shoes" && <ShoesView shoes={shoes} shoeKm={shoeKm} setShoes={setShoes} flash={flash} />}
      {tab === "summary" && <SummaryView workouts={workouts} nutrition={nutrition} body={body} shoes={shoes} shoeKm={shoeKm} />}
      {tab === "settings" && <SettingsView userId={userId} />}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardView({ workouts, nutrition, body, shoes, shoeKm }) {
  const last7 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); const cut = d.toISOString().slice(0, 10);
    return { w: workouts.filter(w => w.date >= cut), n: nutrition.filter(n => n.date >= cut) };
  }, [workouts, nutrition]);

  const runs = last7.w.filter(w => w.discipline === "Course");
  const weekKm = runs.reduce((s, w) => s + (parseFloat(w.distance) || 0), 0);
  const weekSessions = last7.w.length;
  const avgCal = last7.n.length ? Math.round(last7.n.reduce((s, n) => s + (n.totalCalories || 0), 0) / last7.n.length) : 0;
  const avgProt = last7.n.length ? Math.round(last7.n.reduce((s, n) => s + (n.totalProtein || 0), 0) / last7.n.length) : 0;
  const avgFatigue = last7.w.length ? (last7.w.reduce((s, w) => s + (w.fatigue || 0), 0) / last7.w.length).toFixed(1) : "—";
  const avgQuality = last7.w.length ? (last7.w.reduce((s, w) => s + (w.quality || 0), 0) / last7.w.length).toFixed(1) : "—";

  const chart14 = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10);
      const dw = workouts.filter(w => w.date === k);
      const dn = nutrition.filter(n => n.date === k);
      days.push({
        date: fmtShort(k),
        km: Math.round(dw.filter(w => w.discipline === "Course").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0) * 10) / 10,
        cal: dn.reduce((s, n) => s + (n.totalCalories || 0), 0),
        prot: dn.reduce((s, n) => s + (n.totalProtein || 0), 0),
        fatigue: dw.length ? Math.round(dw.reduce((s, w) => s + (w.fatigue || 0), 0) / dw.length * 10) / 10 : null,
        quality: dw.length ? Math.round(dw.reduce((s, w) => s + (w.quality || 0), 0) / dw.length * 10) / 10 : null,
        fcMoy: dw.filter(w => w.fcMoy).length ? Math.round(dw.filter(w => w.fcMoy).reduce((s, w) => s + (+w.fcMoy || 0), 0) / dw.filter(w => w.fcMoy).length) : null,
      });
    }
    return days;
  }, [workouts, nutrition]);

  if (workouts.length === 0 && nutrition.length === 0) return <Card style={{ textAlign: "center", padding: 40 }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Bienvenue dans Tracker Pro</div>
    <div style={{ color: C.textMuted, maxWidth: 380, margin: "0 auto" }}>Commence par enregistrer ta première séance ou tes données nutrition.</div>
  </Card>;

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Stat label="Km (7j)" value={weekKm.toFixed(1)} unit="km" color={C.accent} icon="🏃" />
      <Stat label="Séances (7j)" value={weekSessions} unit="" color={C.blue} icon="💪" />
      <Stat label="Fatigue moy." value={avgFatigue} unit="/10" color={parseFloat(avgFatigue) > 6 ? C.red : C.green} icon="😴" />
      <Stat label="Qualité moy." value={avgQuality} unit="/10" color={C.cyan} icon="⭐" />
      <Stat label="Cal moy./j" value={avgCal} unit="kcal" color={C.green} icon="🔥" />
      <Stat label="Prot moy./j" value={avgProt} unit="g" color={C.purple} icon="🥩" />
    </div>

    <Grid cols={2} gap={16}>
      <Card title="Volume running (14j)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chart14}><CartesianGrid strokeDasharray="3 3" stroke={C.border} /><XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 10 }} /><YAxis tick={{ fill: C.textMuted, fontSize: 10 }} /><Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }} /><Bar dataKey="km" fill={C.accent} radius={[4, 4, 0, 0]} name="Km" /></BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Fatigue vs Qualité (14j)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chart14}><CartesianGrid strokeDasharray="3 3" stroke={C.border} /><XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 10 }} /><YAxis domain={[0, 10]} tick={{ fill: C.textMuted, fontSize: 10 }} /><Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }} /><Line type="monotone" dataKey="fatigue" stroke={C.red} strokeWidth={2} dot={false} name="Fatigue" connectNulls /><Line type="monotone" dataKey="quality" stroke={C.cyan} strokeWidth={2} dot={false} name="Qualité" connectNulls /></LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Calories & Protéines (14j)">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chart14}><CartesianGrid strokeDasharray="3 3" stroke={C.border} /><XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 10 }} /><YAxis yAxisId="c" tick={{ fill: C.textMuted, fontSize: 10 }} /><YAxis yAxisId="p" orientation="right" tick={{ fill: C.textMuted, fontSize: 10 }} /><Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }} /><Area yAxisId="c" type="monotone" dataKey="cal" stroke={C.green} fill={C.green + "22"} name="Kcal" /><Area yAxisId="p" type="monotone" dataKey="prot" stroke={C.purple} fill={C.purple + "22"} name="Prot (g)" /></AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card title="FC moyenne par séance (14j)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chart14}><CartesianGrid strokeDasharray="3 3" stroke={C.border} /><XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 10 }} /><YAxis domain={[100, 190]} tick={{ fill: C.textMuted, fontSize: 10 }} /><Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }} /><Line type="monotone" dataKey="fcMoy" stroke={C.pink} strokeWidth={2} dot={{ r: 3 }} name="FC moy (bpm)" connectNulls /></LineChart>
        </ResponsiveContainer>
      </Card>
    </Grid>

    <Card title="5 dernières séances">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {workouts.slice(0, 5).map(w => <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>{w.discipline === "Course" ? "🏃" : w.discipline === "Renfo" ? "💪" : "🧘"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{w.sessionType}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{fmtD(w.date)} • S{w.week || "?"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {w.distance && <Badge color={C.accent}>{w.distance} km</Badge>}
            {w.duration && <Badge color={C.blue}>{w.duration}</Badge>}
            {w.fcMoy && <Badge color={C.pink}>FC {w.fcMoy}</Badge>}
            {w.fcMax && <Badge color={C.red}>Max {w.fcMax}</Badge>}
            <Badge color={w.fatigue >= 7 ? C.red : w.fatigue >= 4 ? C.yellow : C.green}>Fat {w.fatigue}</Badge>
            <Badge color={w.quality >= 8 ? C.green : w.quality >= 5 ? C.yellow : C.red}>Qual {w.quality}</Badge>
          </div>
        </div>)}
        {workouts.length === 0 && <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>Aucune séance</div>}
      </div>
    </Card>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT FORM — all columns from 📝 Journal Séances
// ═══════════════════════════════════════════════════════════════
function WorkoutView({ workouts, shoes, onAdd, onDel }) {
  const [f, setF] = useState({
    date: today(), week: "", sessionType: "", discipline: "Course",
    duration: "", distance: "", fcMoy: "", fcMax: "", allure: "",
    ressenti: 5, fatigue: 3, quality: 7, meteo: "", shoeId: "",
    exercises: "", comments: "",
  });
  const [copiedId, setCopiedId] = useState(null);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const isRun = f.discipline === "Course";

  const handleSave = () => {
    if (!f.sessionType) return;
    const week = f.week || getWeekNum(f.date);
    onAdd({ id: Date.now().toString(), ...f, week, distance: f.distance ? parseFloat(f.distance) : null });
    setF(p => ({ ...p, sessionType: "", duration: "", distance: "", fcMoy: "", fcMax: "", allure: "", exercises: "", comments: "", ressenti: 5, fatigue: 3, quality: 7 }));
  };

  const handleCopySession = async (w) => {
    await copyText(formatSessionText(w));
    setCopiedId(w.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card title="📝 Nouvelle séance" sub="Colonnes identiques au Journal Séances Excel : Semaine, Date, Type, Discipline, Durée, Distance, FC moy, FC max, Allure, Ressenti, Fatigue, Qualité, Météo, Exercices, Commentaires">
      <Grid cols={4} gap={12} style={{ marginBottom: 14 }}>
        <Inp label="Date" type="date" value={f.date} onChange={e => set("date", e.target.value)} />
        <Inp label="Semaine" type="number" placeholder={`Auto (S${getWeekNum(f.date)})`} value={f.week} onChange={e => set("week", e.target.value)} />
        <Sel label="Type de séance" options={SESSION_TYPES} value={f.sessionType} onChange={e => set("sessionType", e.target.value)} />
        <Sel label="Discipline" options={DISCIPLINES} value={f.discipline} onChange={e => set("discipline", e.target.value)} />
      </Grid>
      <Grid cols={isRun ? 5 : 3} gap={12} style={{ marginBottom: 14 }}>
        <Inp label="Durée" value={f.duration} onChange={e => set("duration", e.target.value)} placeholder="56 min / 1h52" />
        {isRun && <Inp label="Distance (km)" type="number" step="0.01" value={f.distance} onChange={e => set("distance", e.target.value)} placeholder="17.03" />}
        <Inp label="FC moy. (bpm)" type="number" value={f.fcMoy} onChange={e => set("fcMoy", e.target.value)} placeholder="142" />
        <Inp label="FC max (bpm)" type="number" value={f.fcMax} onChange={e => set("fcMax", e.target.value)} placeholder="174" />
        {isRun && <Inp label="Allure moy. (/km)" value={f.allure} onChange={e => set("allure", e.target.value)} placeholder="8:34/km" />}
      </Grid>
      <Grid cols={3} gap={12} style={{ marginBottom: 14 }}>
        <Slider3 label="Ressenti" value={f.ressenti} onChange={v => set("ressenti", v)} low="Excellent" high="Très dur" />
        <Slider3 label="Fatigue" value={f.fatigue} onChange={v => set("fatigue", v)} low="Frais" high="Épuisé" />
        <Slider3 label="Qualité séance" value={f.quality} onChange={v => set("quality", v)} low="Mauvaise" high="Parfaite" invert />
      </Grid>
      <Grid cols={isRun ? 2 : 1} gap={12} style={{ marginBottom: 14 }}>
        <Sel label="Météo" options={METEO_OPTIONS} value={f.meteo} onChange={e => set("meteo", e.target.value)} />
        {isRun && <Sel label="Chaussures" options={shoes.map(s => s.name)} value={shoes.find(s => s.id === f.shoeId)?.name || ""} onChange={e => { const sh = shoes.find(s => s.name === e.target.value); set("shoeId", sh?.id || ""); }} />}
      </Grid>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <Inp label="Exercices / Détails" value={f.exercises} onChange={e => set("exercises", e.target.value)} placeholder="Pompes 4×15 + Pike 3×10 + Dips 4×10 + Gainage 3×1min + …" />
        <Inp label="Commentaires" value={f.comments} onChange={e => set("comments", e.target.value)} placeholder="Sensations, notes, progressions, alertes…" />
      </div>
      <Btn onClick={handleSave} disabled={!f.sessionType}>Enregistrer la séance</Btn>
    </Card>

    <Card title="Historique" sub={`${workouts.length} séances enregistrées`}>
      {workouts.length === 0 ? <div style={{ color: C.textMuted, textAlign: "center", padding: 24 }}>Aucune séance</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {workouts.slice(0, 30).map(w => <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.bg, borderRadius: 8, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <span>{w.discipline === "Course" ? "🏃" : w.discipline === "Renfo" ? "💪" : "🧘"}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>S{w.week} — {w.sessionType}</div>
                <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtD(w.date)}{w.meteo ? ` • ${w.meteo}` : ""}{w.exercises ? ` • ${w.exercises.slice(0, 40)}…` : ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
              {w.distance && <Badge color={C.accent}>{w.distance} km</Badge>}
              {w.duration && <Badge color={C.blue}>{w.duration}</Badge>}
              {w.fcMoy && <Badge color={C.pink}>FC{w.fcMoy}</Badge>}
              {w.fcMax && <Badge color={C.red}>Max{w.fcMax}</Badge>}
              <Badge color={w.ressenti <= 3 ? C.green : w.ressenti <= 6 ? C.yellow : C.red}>R{w.ressenti}</Badge>
              <Badge color={w.fatigue >= 7 ? C.red : w.fatigue >= 4 ? C.yellow : C.green}>F{w.fatigue}</Badge>
              <Badge color={w.quality >= 8 ? C.green : w.quality >= 5 ? C.yellow : C.red}>Q{w.quality}</Badge>
              <button onClick={() => handleCopySession(w)} title="Copier pour le Coach" style={{ background: "none", border: "none", color: copiedId === w.id ? C.green : C.textMuted, cursor: "pointer", fontSize: 14, padding: 2 }}>{copiedId === w.id ? "✅" : "📋"}</button>
              <button onClick={() => onDel(w.id)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, padding: 2 }}>🗑</button>
            </div>
          </div>)}
        </div>}
    </Card>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// NUTRITION
// ═══════════════════════════════════════════════════════════════
function NutritionView({ nutrition, onAdd, onDel }) {
  const [mode, setMode] = useState("macros");
  const [date, setDate] = useState(today());
  const [m, setM] = useState({ calories: "", protein: "", carbs: "", fat: "", water: "", notes: "" });
  const [meals, setMeals] = useState([{ type: "Petit-déjeuner", desc: "", cal: "", prot: "", carb: "", fat: "" }]);

  const setMF = (k, v) => setM(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (mode === "macros") {
      if (!m.calories && !m.protein) return;
      onAdd({ id: Date.now().toString(), date, mode, totalCalories: +m.calories || 0, totalProtein: +m.protein || 0, totalCarbs: +m.carbs || 0, totalFat: +m.fat || 0, water: +m.water || 0, notes: m.notes });
      setM({ calories: "", protein: "", carbs: "", fat: "", water: "", notes: "" });
    } else {
      const valid = meals.filter(x => x.desc);
      if (!valid.length) return;
      const tot = valid.reduce((a, x) => ({ cal: a.cal + (+x.cal || 0), prot: a.prot + (+x.prot || 0), carb: a.carb + (+x.carb || 0), fat: a.fat + (+x.fat || 0) }), { cal: 0, prot: 0, carb: 0, fat: 0 });
      onAdd({ id: Date.now().toString(), date, mode: "meals", meals: valid, totalCalories: tot.cal, totalProtein: tot.prot, totalCarbs: tot.carb, totalFat: tot.fat, water: +m.water || 0 });
      setMeals([{ type: "Petit-déjeuner", desc: "", cal: "", prot: "", carb: "", fat: "" }]);
      setMF("water", "");
    }
  };

  const updateMeal = (i, k, v) => { const n = [...meals]; n[i] = { ...n[i], [k]: v }; setMeals(n); };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card title="🥗 Saisie nutrition">
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <Btn v={mode === "macros" ? "primary" : "ghost"} onClick={() => setMode("macros")}>🔢 Macros du jour</Btn>
        <Btn v={mode === "meals" ? "primary" : "ghost"} onClick={() => setMode("meals")}>🍽 Repas par repas</Btn>
      </div>
      <Grid cols={2} gap={12} style={{ marginBottom: 14 }}>
        <Inp label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Inp label="Eau (litres)" type="number" step="0.1" value={m.water} onChange={e => setMF("water", e.target.value)} placeholder="2.5" />
      </Grid>
      {mode === "macros" ? <>
        <Grid cols={4} gap={12} style={{ marginBottom: 14 }}>
          <Inp label="Calories (kcal)" type="number" value={m.calories} onChange={e => setMF("calories", e.target.value)} placeholder="2200" />
          <Inp label="Protéines (g)" type="number" value={m.protein} onChange={e => setMF("protein", e.target.value)} placeholder="160" />
          <Inp label="Glucides (g)" type="number" value={m.carbs} onChange={e => setMF("carbs", e.target.value)} placeholder="260" />
          <Inp label="Lipides (g)" type="number" value={m.fat} onChange={e => setMF("fat", e.target.value)} placeholder="70" />
        </Grid>
        <Inp label="Notes" value={m.notes} onChange={e => setMF("notes", e.target.value)} placeholder="Compléments, écarts…" style={{ marginBottom: 14 }} />
      </> : <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {meals.map((ml, i) => <div key={i} style={{ padding: 12, background: C.bg, borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <Sel options={MEAL_TYPES} value={ml.type} onChange={e => updateMeal(i, "type", e.target.value)} />
            {meals.length > 1 && <button onClick={() => setMeals(meals.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>✕</button>}
          </div>
          <Inp placeholder="Poulet grillé + riz basmati + brocolis" value={ml.desc} onChange={e => updateMeal(i, "desc", e.target.value)} style={{ marginBottom: 8 }} />
          <Grid cols={4} gap={8}>
            <Inp label="Kcal" type="number" value={ml.cal} onChange={e => updateMeal(i, "cal", e.target.value)} />
            <Inp label="Prot" type="number" value={ml.prot} onChange={e => updateMeal(i, "prot", e.target.value)} />
            <Inp label="Gluc" type="number" value={ml.carb} onChange={e => updateMeal(i, "carb", e.target.value)} />
            <Inp label="Lip" type="number" value={ml.fat} onChange={e => updateMeal(i, "fat", e.target.value)} />
          </Grid>
        </div>)}
        <Btn v="ghost" onClick={() => setMeals([...meals, { type: "", desc: "", cal: "", prot: "", carb: "", fat: "" }])} style={{ alignSelf: "flex-start" }}>+ Repas</Btn>
      </div>}
      <Btn onClick={handleSave}>Enregistrer</Btn>
    </Card>
    <Card title="Historique nutrition" sub={`${nutrition.length} entrées`}>
      {nutrition.length === 0 ? <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>Aucune entrée</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {nutrition.slice(0, 20).map(n => <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>🥗</span><div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtD(n.date)}</div><div style={{ fontSize: 11, color: C.textMuted }}>{n.mode === "meals" ? `${n.meals?.length} repas` : "Macros"}</div></div></div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <Badge color={C.green}>{n.totalCalories} kcal</Badge><Badge color={C.purple}>{n.totalProtein}g P</Badge>
              <button onClick={() => onDel(n.id)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14 }}>🗑</button>
            </div>
          </div>)}
        </div>}
    </Card>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// BODY / PHYSIQUE — 📊 Poids & Physique sheet
// ═══════════════════════════════════════════════════════════════
function BodyView({ body, onAdd, onDel }) {
  const [f, setF] = useState({ date: today(), week: "", poids: "", taille: "", poitrine: "", cuisse: "", gras: "", ressenti: 5, photo: false, comments: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.poids && !f.taille) return;
    onAdd({ id: Date.now().toString(), ...f, week: f.week || getWeekNum(f.date) });
    setF(p => ({ ...p, poids: "", taille: "", poitrine: "", cuisse: "", gras: "", comments: "" }));
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card title="📏 Mesures physiques" sub="Poids, tours, composition — conforme à l'onglet 📊 Poids & Physique">
      <Grid cols={4} gap={12} style={{ marginBottom: 14 }}>
        <Inp label="Date" type="date" value={f.date} onChange={e => set("date", e.target.value)} />
        <Inp label="Semaine" type="number" value={f.week} onChange={e => set("week", e.target.value)} placeholder={`Auto (S${getWeekNum(f.date)})`} />
        <Inp label="Poids (kg)" type="number" step="0.1" value={f.poids} onChange={e => set("poids", e.target.value)} placeholder="74.0" />
        <Inp label="% Gras estimé" value={f.gras} onChange={e => set("gras", e.target.value)} placeholder="~20%" />
      </Grid>
      <Grid cols={3} gap={12} style={{ marginBottom: 14 }}>
        <Inp label="Tour de taille (cm)" type="number" step="0.5" value={f.taille} onChange={e => set("taille", e.target.value)} />
        <Inp label="Tour de poitrine (cm)" type="number" step="0.5" value={f.poitrine} onChange={e => set("poitrine", e.target.value)} />
        <Inp label="Tour de cuisse (cm)" type="number" step="0.5" value={f.cuisse} onChange={e => set("cuisse", e.target.value)} />
      </Grid>
      <Grid cols={2} gap={12} style={{ marginBottom: 14 }}>
        <Slider3 label="Ressenti physique" value={f.ressenti} onChange={v => set("ressenti", v)} low="Pas en forme" high="Au top" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Photo prise ?</label>
          <button onClick={() => set("photo", !f.photo)} style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${f.photo ? C.green : C.border}`, background: f.photo ? C.green + "22" : "transparent", color: f.photo ? C.green : C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font }}>
            {f.photo ? "✅ Oui" : "📷 Non"}
          </button>
        </div>
      </Grid>
      <Inp label="Commentaires" value={f.comments} onChange={e => set("comments", e.target.value)} placeholder="Notes composition corporelle…" style={{ marginBottom: 14 }} />
      <Btn onClick={handleSave} disabled={!f.poids && !f.taille}>Enregistrer</Btn>
    </Card>

    {body.length > 0 && <Card title="Courbe de poids">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={[...body].reverse()}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="date" tickFormatter={d => fmtShort(d)} tick={{ fill: C.textMuted, fontSize: 10 }} />
          <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }} />
          <Line type="monotone" dataKey="poids" stroke={C.accent} strokeWidth={2} dot={{ r: 4 }} name="Poids (kg)" />
        </LineChart>
      </ResponsiveContainer>
    </Card>}

    <Card title="Historique" sub={`${body.length} mesures`}>
      {body.length === 0 ? <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>Aucune mesure</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {body.slice(0, 20).map(b => <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtD(b.date)} — S{b.week}</div>{b.comments && <div style={{ fontSize: 11, color: C.textMuted }}>{b.comments}</div>}</div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {b.poids && <Badge color={C.accent}>{b.poids} kg</Badge>}
              {b.taille && <Badge color={C.blue}>Taille {b.taille}</Badge>}
              {b.gras && <Badge color={C.yellow}>{b.gras}</Badge>}
              <button onClick={() => onDel(b.id)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14 }}>🗑</button>
            </div>
          </div>)}
        </div>}
    </Card>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// SHOES — 👟 Chaussures sheet
// ═══════════════════════════════════════════════════════════════
function ShoesView({ shoes, shoeKm, setShoes, flash }) {
  const [f, setF] = useState({ name: "", startDate: today(), alertKm: 600, notes: "" });

  const addShoe = async () => {
    if (!f.name) return;
    const n = [...shoes, { id: Date.now().toString(), ...f, startKm: 0 }];
    setShoes(n); await save(COLLECTIONS.shoes, n);
    flash("Chaussure ajoutée ✓");
    setF({ name: "", startDate: today(), alertKm: 600, notes: "" });
  };

  const delShoe = async (id) => {
    const n = shoes.filter(s => s.id !== id);
    setShoes(n); await save(COLLECTIONS.shoes, n); flash("Supprimée");
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card title="👟 Suivi kilométrage chaussures" sub="Le km se calcule automatiquement à partir de tes séances running">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shoes.map(s => {
          const km = shoeKm[s.id] || 0;
          const pct = Math.min(100, (km / (s.alertKm || 600)) * 100);
          const col = pct > 80 ? C.red : pct > 50 ? C.yellow : C.green;
          return <div key={s.id} style={{ padding: 14, background: C.bg, borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div><div style={{ fontWeight: 700, fontSize: 14 }}>👟 {s.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>Depuis {fmtD(s.startDate)}{s.notes ? ` • ${s.notes}` : ""}</div></div>
              <button onClick={() => delShoe(s.id)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>🗑</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 4, transition: "width .3s" }} />
              </div>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: col }}>{km.toFixed(0)} / {s.alertKm} km</span>
            </div>
          </div>;
        })}
      </div>
    </Card>
    <Card title="Ajouter une paire">
      <Grid cols={4} gap={12} style={{ marginBottom: 14 }}>
        <Inp label="Nom" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Nike Vaporfly…" />
        <Inp label="Date début" type="date" value={f.startDate} onChange={e => setF(p => ({ ...p, startDate: e.target.value }))} />
        <Inp label="Alerte km" type="number" value={f.alertKm} onChange={e => setF(p => ({ ...p, alertKm: +e.target.value }))} />
        <Inp label="Notes" value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} />
      </Grid>
      <Btn onClick={addShoe} disabled={!f.name}>Ajouter</Btn>
    </Card>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY — copy-paste for Coach conversation
// ═══════════════════════════════════════════════════════════════
function SummaryView({ workouts, nutrition, body, shoes, shoeKm }) {
  const [range, setRange] = useState(7);
  const [copied, setCopied] = useState(false);

  const data = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - range); const cut = d.toISOString().slice(0, 10);
    return {
      w: workouts.filter(w => w.date >= cut).sort((a, b) => a.date.localeCompare(b.date)),
      n: nutrition.filter(n => n.date >= cut).sort((a, b) => a.date.localeCompare(b.date)),
      b: body.filter(b => b.date >= cut).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [workouts, nutrition, body, range]);

  const summary = useMemo(() => {
    let t = `📊 **RAPPORT D'ENTRAÎNEMENT & NUTRITION — ${range} derniers jours**\n`;
    t += `📅 Du ${data.w.length ? fmtD(data.w[0].date) : "—"} au ${fmtD(today())}\n\n`;

    const runs = data.w.filter(w => w.discipline === "Course");
    const renfo = data.w.filter(w => w.discipline === "Renfo");
    const totalKm = runs.reduce((s, w) => s + (parseFloat(w.distance) || 0), 0);
    const avgFatigue = data.w.length ? (data.w.reduce((s, w) => s + (w.fatigue || 0), 0) / data.w.length).toFixed(1) : "—";
    const avgQuality = data.w.length ? (data.w.reduce((s, w) => s + (w.quality || 0), 0) / data.w.length).toFixed(1) : "—";
    const avgRessenti = data.w.length ? (data.w.reduce((s, w) => s + (w.ressenti || 0), 0) / data.w.length).toFixed(1) : "—";

    t += `## 🏃 RUNNING (${runs.length} séances — ${totalKm.toFixed(1)} km total)\n`;
    if (!runs.length) t += "Aucune séance running.\n";
    runs.forEach(r => {
      t += `- **${fmtD(r.date)}** (S${r.week}) | ${r.sessionType}`;
      if (r.distance) t += ` | ${r.distance} km`;
      if (r.duration) t += ` | ${r.duration}`;
      if (r.allure) t += ` | ${r.allure}`;
      if (r.fcMoy) t += ` | FC moy ${r.fcMoy}`;
      if (r.fcMax) t += ` | FC max ${r.fcMax}`;
      t += ` | Ressenti ${r.ressenti}/10 | Fatigue ${r.fatigue}/10 | Qualité ${r.quality}/10`;
      if (r.meteo) t += ` | ${r.meteo}`;
      if (r.exercises) t += `\n  Détail : ${r.exercises}`;
      if (r.comments) t += `\n  → ${r.comments}`;
      t += "\n";
    });

    t += `\n## 💪 CALISTHÉNIE / RENFO (${renfo.length} séances)\n`;
    if (!renfo.length) t += "Aucune séance renfo.\n";
    renfo.forEach(r => {
      t += `- **${fmtD(r.date)}** (S${r.week}) | ${r.sessionType}`;
      if (r.duration) t += ` | ${r.duration}`;
      if (r.fcMoy) t += ` | FC moy ${r.fcMoy}`;
      if (r.fcMax) t += ` | FC max ${r.fcMax}`;
      t += ` | Ressenti ${r.ressenti}/10 | Fatigue ${r.fatigue}/10 | Qualité ${r.quality}/10`;
      if (r.meteo) t += ` | ${r.meteo}`;
      if (r.exercises) t += `\n  Exercices : ${r.exercises}`;
      if (r.comments) t += `\n  → ${r.comments}`;
      t += "\n";
    });

    t += `\n**Moyennes période :** Ressenti ${avgRessenti}/10 | Fatigue ${avgFatigue}/10 | Qualité ${avgQuality}/10\n`;

    t += `\n## 🥗 NUTRITION (${data.n.length} jours)\n`;
    if (data.n.length) {
      const ac = Math.round(data.n.reduce((s, n) => s + (n.totalCalories || 0), 0) / data.n.length);
      const ap = Math.round(data.n.reduce((s, n) => s + (n.totalProtein || 0), 0) / data.n.length);
      const ag = Math.round(data.n.reduce((s, n) => s + (n.totalCarbs || 0), 0) / data.n.length);
      const al = Math.round(data.n.reduce((s, n) => s + (n.totalFat || 0), 0) / data.n.length);
      const aw = (data.n.reduce((s, n) => s + (n.water || 0), 0) / data.n.length).toFixed(1);
      t += `**Moy./jour :** ${ac} kcal | ${ap}g P | ${ag}g G | ${al}g L | ${aw}L eau\n\n`;
      t += `| Date | Kcal | P(g) | G(g) | L(g) | Eau | Détail |\n|------|------|------|------|------|-----|--------|\n`;
      data.n.forEach(n => {
        const det = n.mode === "meals" && n.meals ? n.meals.map(m => `${m.type}: ${m.desc}`).join(" / ") : (n.notes || "—");
        t += `| ${fmtD(n.date)} | ${n.totalCalories} | ${n.totalProtein} | ${n.totalCarbs} | ${n.totalFat} | ${n.water || "—"}L | ${det.slice(0, 50)} |\n`;
      });
    } else t += "Aucune donnée.\n";

    if (data.b.length) {
      t += `\n## 📏 PHYSIQUE\n`;
      data.b.forEach(b => {
        t += `- **${fmtD(b.date)}** (S${b.week})`;
        if (b.poids) t += ` | ${b.poids} kg`;
        if (b.taille) t += ` | Taille ${b.taille} cm`;
        if (b.poitrine) t += ` | Poitrine ${b.poitrine} cm`;
        if (b.cuisse) t += ` | Cuisse ${b.cuisse} cm`;
        if (b.gras) t += ` | Gras ${b.gras}`;
        if (b.comments) t += ` | ${b.comments}`;
        t += "\n";
      });
    }

    t += `\n## 👟 CHAUSSURES\n`;
    shoes.forEach(s => {
      const km = shoeKm[s.id] || 0;
      t += `- ${s.name} : ${km.toFixed(0)} km / ${s.alertKm} km${s.notes ? ` (${s.notes})` : ""}\n`;
    });

    t += `\n---\n_Généré par Tracker Pro le ${fmtD(today())}_`;
    return t;
  }, [data, range, shoes, shoeKm]);

  const handleCopy = async () => {
    await copyText(summary);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📋 Résumé pour le Coach</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>Colle ce rapport dans "Programme marathon et calisthénie personnalisé"</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30].map(d => <Btn key={d} v={range === d ? "primary" : "ghost"} onClick={() => setRange(d)}>{d}j</Btn>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Stat label="Séances" value={data.w.length} unit="" color={C.accent} icon="🎯" />
        <Stat label="Km running" value={data.w.filter(w => w.discipline === "Course").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0).toFixed(1)} unit="km" color={C.blue} icon="🏃" />
        <Stat label="Jours nutrition" value={data.n.length} unit="" color={C.green} icon="🥗" />
      </div>
      <Btn onClick={handleCopy} v={copied ? "success" : "primary"} style={{ width: "100%", padding: "14px 20px", fontSize: 15, justifyContent: "center" }}>
        {copied ? "✅ Copié ! Colle dans la conversation Coach →" : "📋 Copier le résumé complet"}
      </Btn>
    </Card>
    <Card title="Aperçu du résumé">
      <div style={{ background: C.bg, borderRadius: 10, padding: 16, fontFamily: mono, fontSize: 11, lineHeight: 1.7, color: C.textDim, whiteSpace: "pre-wrap", maxHeight: 450, overflowY: "auto" }}>{summary}</div>
    </Card>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS — Device sync & linking
// ═══════════════════════════════════════════════════════════════
function SettingsView({ userId }) {
  const [linkCode, setLinkCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    await copyText(userId || "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = () => {
    if (linkCode.trim().length > 10) {
      linkDevice(linkCode.trim());
    }
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card title="⚙️ Synchronisation multi-appareils" sub="Tes données sont stockées dans Firebase et synchronisées en temps réel entre tous tes appareils.">
      <div style={{ padding: 16, background: C.bg, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>📱 Ton identifiant de sync</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
          Copie ce code et colle-le sur ton autre appareil pour lier les données.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            flex: 1, padding: "10px 14px", background: C.card, borderRadius: 8,
            border: `1px solid ${C.border}`, fontFamily: mono, fontSize: 12,
            color: C.accent, wordBreak: "break-all",
          }}>{userId || "Chargement…"}</div>
          <Btn onClick={handleCopyId} v={copied ? "success" : "primary"}>
            {copied ? "✅ Copié" : "📋 Copier"}
          </Btn>
        </div>
      </div>

      <div style={{ padding: 16, background: C.bg, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔗 Lier un autre appareil</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
          Colle ici le code copié depuis ton premier appareil pour partager les mêmes données.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Inp placeholder="Colle le code ici…" value={linkCode} onChange={e => setLinkCode(e.target.value)} style={{ flex: 1 }} />
          <Btn onClick={handleLink} disabled={linkCode.trim().length < 10}>Lier</Btn>
        </div>
      </div>
    </Card>

    <Card title="📖 Comment ça marche">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: C.textDim, lineHeight: 1.7 }}>
        <div style={{ padding: 12, background: C.bg, borderRadius: 10 }}>
          <span style={{ fontWeight: 700, color: C.accent }}>1.</span> Sur ton <span style={{ fontWeight: 700, color: C.text }}>premier appareil</span> (celui où tu as déjà des données), copie le code ci-dessus.
        </div>
        <div style={{ padding: 12, background: C.bg, borderRadius: 10 }}>
          <span style={{ fontWeight: 700, color: C.accent }}>2.</span> Sur ton <span style={{ fontWeight: 700, color: C.text }}>deuxième appareil</span> (iPhone, autre PC…), ouvre Tracker Pro, va dans Sync, et colle le code dans "Lier un autre appareil".
        </div>
        <div style={{ padding: 12, background: C.bg, borderRadius: 10 }}>
          <span style={{ fontWeight: 700, color: C.accent }}>3.</span> Les deux appareils partagent maintenant les <span style={{ fontWeight: 700, color: C.green }}>mêmes données en temps réel</span>. Toute modification sur l'un apparaît instantanément sur l'autre.
        </div>
      </div>
    </Card>

    <Card title="📲 Installer comme app">
      <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7 }}>
        <div style={{ padding: 12, background: C.bg, borderRadius: 10, marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: C.text }}>iPhone :</span> Safari → bouton Partager (⬆️) → "Sur l'écran d'accueil"
        </div>
        <div style={{ padding: 12, background: C.bg, borderRadius: 10, marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: C.text }}>Android :</span> Chrome → menu ⋮ → "Installer l'application"
        </div>
        <div style={{ padding: 12, background: C.bg, borderRadius: 10 }}>
          <span style={{ fontWeight: 700, color: C.text }}>PC/Mac :</span> Chrome → icône d'installation dans la barre d'adresse
        </div>
      </div>
    </Card>
  </div>;
}
