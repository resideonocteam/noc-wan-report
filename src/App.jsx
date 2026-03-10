import { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { db, loadReport, saveReport, subscribeReport, saveArchive, loadArchives, deleteArchive } from "./firebase.js";
import { getSession, logout } from "./auth.js";
import Login from "./Login.jsx";

const ENGINEERS = [
  { name: "Alic Antunez",         email: "Alic.Antunez@resideo.com"         },
  { name: "Jorge Torres",         email: "Jorge.Torres@resideo.com"         },
  { name: "Guillermo Cerda",      email: "Guillermo.Cerda@resideo.com"      },
  { name: "Adrian.Pliego",      email: "Adrian.Pliego@resideo.com"      },
  { name: "Thomas Pelkas",        email: "Thomas.Pelkas@resideo.com"        },
  { name: "Sachin Balachandran",  email: "Sachin.Balachandran@resideo.com"  },
];
const ENGINEER_EMAIL = Object.fromEntries(ENGINEERS.map(e => [e.name, e.email]));

// ── THEME ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0d1117", bgCard: "#161c27", bgCardAlt: "#1a2030", bgInput: "#1e2636",
  border: "#252d3d", borderLight: "#2e3a4e",
  textPrimary: "#e8edf5", textSecondary: "#7a8499", textMuted: "#4a5568",
  navBg: "#0a0e17", pillBg: "#161c27",
};
const LIGHT = {
  bg: "#f0f2f7", bgCard: "#ffffff", bgCardAlt: "#f4f6fb", bgInput: "#ffffff",
  border: "#dde1eb", borderLight: "#c8cdd8",
  textPrimary: "#0f1623", textSecondary: "#4a5568", textMuted: "#8a94a6",
  navBg: "#ffffff", pillBg: "#f4f6fb",
};

const SHARED = {
  accent: "#5b5ef4", accentHover: "#6c6ef8",
  orange: "#e8730a", orangeBg_dark: "#2a1a08", orangeBg_light: "#fff4ec",
  green: "#00b86b", greenBg_dark: "#082018", greenBg_light: "#edfaf4",
  yellow: "#d4890a", yellowBg_dark: "#261d08", yellowBg_light: "#fffbec",
  red: "#e84040", redBg_dark: "#260808", redBg_light: "#fff0f0",
  mono: "'Inter', sans-serif",
  head: "'Inter', sans-serif",
  body: "'Inter', sans-serif",
};

function theme(dark) {
  const t = dark ? DARK : LIGHT;
  return {
    ...t, ...SHARED,
    orangeBg: dark ? SHARED.orangeBg_dark : SHARED.orangeBg_light,
    greenBg:  dark ? SHARED.greenBg_dark  : SHARED.greenBg_light,
    yellowBg: dark ? SHARED.yellowBg_dark : SHARED.yellowBg_light,
    redBg:    dark ? SHARED.redBg_dark    : SHARED.redBg_light,
    handoverText: dark ? SHARED.yellow : SHARED.orange,
  };
}

const SEV_CFG = {
  "DEGRADED RESILIENCE": { getColor: () => SHARED.orange, getBg: (dark) => dark ? SHARED.orangeBg_dark : SHARED.orangeBg_light },
  "HARD DOWN":           { getColor: () => SHARED.red,    getBg: (dark) => dark ? SHARED.redBg_dark    : SHARED.redBg_light    },
  "RESOLVED":            { getColor: () => SHARED.green,  getBg: (dark) => dark ? SHARED.greenBg_dark  : SHARED.greenBg_light  },
};

const CIRC_STATUS = {
  "Healthy (UP)": { label: "UP",       color: SHARED.green  },
  "Degraded":     { label: "DEGRADED", color: SHARED.orange },
  "Down":         { label: "DOWN",     color: SHARED.red    },
};

// ── SEED DATA ─────────────────────────────────────────────────────────────────
const SEED = {
  engineerName: "Alic Antunez", // overridden at login reportDate: "2026-02-21",
  recipientEmail: "DL-DailyNetworkUpdates@resideo.com; resideonocteam@resideo.com",
  incidents: [
    { id: "ok07", siteCode: "OK07", siteName: "Oklahoma City Hub", internalTicket: "INC0928374", severity: "DEGRADED RESILIENCE",
      description: "[14:28]: High latency observed on primary MPLS circuit. ISP-A investigating router hop 4 congestion.\n[15:45]: Congestion persists, traffic routed to secondary fiber.",
      userImpact: "Staff reporting 2-3 second delays in SAP and internal ERP tools.",
      handover: "Monitor ISP-A ticket #CONG-992 and request root cause analysis.",
      bwAvailable: "1 / 1 Gbps", bwAvg: "800 Mbps", bwPeak: "950 Mbps",
      circuits: [
        { carrier: "ISP-A (Fiber)",  status: "Degraded",     circuitId: "CKT-992831", bw: "1Gbps"   },
        { carrier: "ISP-B (Direct)", status: "Healthy (UP)", circuitId: "CKT-001292", bw: "500Mbps" },
      ] },
    { id: "tx12", siteCode: "TX12", siteName: "Dallas Logistics", internalTicket: "INC0921102", severity: "DEGRADED RESILIENCE",
      description: "[10:15]: WAN2 circuit reporting intermittent packet loss (5-8%).\n[11:00]: ISP-C confirms line noise at local CO. Technician dispatched.",
      userImpact: "VOIP calls reporting robotic voice symptoms during peak hours.",
      handover: "Awaiting technician arrival at CO (ETA 17:30). Shift hand-off required.",
      bwAvailable: "300 / 300 Mbps", bwAvg: "130 Mbps", bwPeak: "188 Mbps",
      circuits: [
        { carrier: "ISP-B",             status: "Healthy (UP)", circuitId: "CKT-445102", bw: "200Mbps" },
        { carrier: "ISP-C (Broadband)", status: "Degraded",     circuitId: "CKT-882731", bw: "100Mbps" },
      ] },
    { id: "ca01", siteCode: "CA01", siteName: "San Francisco", internalTicket: "INC0911552", severity: "RESOLVED",
      description: "[08:00]: Fiber cut reported at 3rd & Mission St. Primary WAN1 down.\n[16:20]: Fiber splicing complete. Link stable and passing traffic.",
      userImpact: "Resolved. Site was running on backup 5G resilience for 8 hours.",
      handover: "RCA scheduled for Friday. No further action needed.",
      circuits: [{ carrier: "ISP-A", status: "Healthy (UP)", circuitId: "CKT-112233", bw: "2Gbps", avgUsed: "200Mbps" }] },
    { id: "ny05", siteCode: "NY05", siteName: "Manhattan East", internalTicket: "INC0919921", severity: "RESOLVED",
      description: "[13:00]: Local power outage triggered UPS alerts. Routers rebooted.\n[14:15]: Power restored. All network interfaces confirmed green.",
      userImpact: "Full site connectivity restored. Verified with local point of contact.",
      handover: "Check UPS health logs during next maintenance window.",
      circuits: [{ carrier: "ISP-D", status: "Healthy (UP)", circuitId: "CKT-553829", bw: "500Mbps", avgUsed: "100Mbps" }] },
  ],
};



// ── PRIMITIVES ────────────────────────────────────────────────────────────────
function Label({ children, style: s = {}, C }) {
  return <div style={{ fontFamily: C.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.textSecondary, textTransform: "uppercase", marginBottom: 6, ...s }}>{children}</div>;
}

function Btn({ children, onClick, variant = "primary", style: s = {}, C: tc }) {
  const C2 = tc || { accent: SHARED.accent, bgCardAlt: "#1a2030", textSecondary: "#7a8499", border: "#252d3d", body: SHARED.body };
  const vars = {
    primary: { background: SHARED.accent, color: "#fff", border: "none" },
    ghost:   { background: "transparent", color: C2.textSecondary, border: `1px solid ${C2.border}` },
  };
  return (
    <button onClick={onClick} style={{ fontFamily: C2.body || SHARED.body, fontWeight: 700, letterSpacing: "0.08em", fontSize: 12, cursor: "pointer", borderRadius: 6, padding: "9px 18px", textTransform: "uppercase", transition: "opacity 0.15s", ...vars[variant], ...s }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.82"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {children}
    </button>
  );
}

function FInput({ value, onChange, placeholder, type = "text", style: s = {}, C }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPrimary, fontFamily: C.body, fontSize: 14, padding: "10px 14px", outline: "none", width: "100%", ...s }}
      onFocus={e => e.target.style.borderColor = SHARED.accent}
      onBlur={e => e.target.style.borderColor = C.border} />
  );
}

function FSelect({ value, onChange, options, style: s = {}, C }) {
  const isLight = C.bgInput === "#ffffff";
  return (
    <select value={value} onChange={onChange}
      style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPrimary, fontFamily: C.body, fontSize: 14, padding: "10px 14px", outline: "none", width: "100%", cursor: "pointer", appearance: "none", colorScheme: isLight ? "light" : "dark", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%237a8499' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36, ...s }}>
      {options.map(o => <option key={o} value={o} style={{ background: C.bgInput, color: C.textPrimary }}>{o}</option>)}
    </select>
  );
}

function SiteAvatar({ code, sev, dark }) {
  const cfg = SEV_CFG[sev] || SEV_CFG["RESOLVED"];
  return (
    <div style={{ width: 56, height: 56, borderRadius: 12, background: cfg.getBg(dark), border: `1.5px solid ${cfg.getColor()}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 18, color: cfg.getColor() }}>{code.slice(0, 2)}</span>
    </div>
  );
}

function CircuitTable({ circuits, inc, C }) {
  const tdStyle = { padding: "11px 14px", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 400, color: C.textPrimary };
  const thStyle = { padding: "9px 14px", textAlign: "left", fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` };
  return (
    <div>
      {/* Circuit rows table */}
      <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgCardAlt }}>
              {["WAN","ISP","CIRCUIT ID","BW","STATUS"].map(h => (
                <th key={h} style={{ ...thStyle }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {circuits.map((c, i) => {
              const sc = CIRC_STATUS[c.status] || CIRC_STATUS["Healthy (UP)"];
              return (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...tdStyle, color: C.textSecondary }}>{i + 1}</td>
                  <td style={{ ...tdStyle }}>{c.carrier || "—"}</td>
                  <td style={{ ...tdStyle }}>{c.circuitId || "—"}</td>
                  <td style={{ ...tdStyle }}>{c.bw || "—"}</td>
                  <td style={{ ...tdStyle }}>
                    <span style={{ display: "inline-block", background: sc.color + "22", color: sc.color, border: `1px solid ${sc.color}55`, fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 5, textTransform: "uppercase" }}>{sc.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Site-level BW Utilization bar */}
      {(inc.bwAvailable || inc.bwAvg || inc.bwPeak) && (
        <div style={{ background: SHARED.accent + "0d", border: `1px solid ${SHARED.accent}33`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 0 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: SHARED.accent, textTransform: "uppercase", marginRight: 24, whiteSpace: "nowrap" }}>Bandwidth Utilization</div>
          {[["BW Available", inc.bwAvailable], ["BW Used Avg", inc.bwAvg], ["BW Used Peak", inc.bwPeak]].map(([label, val], i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {i > 0 && <div style={{ width: 1, height: 32, background: SHARED.accent + "33", margin: "0 20px" }} />}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: SHARED.accent + "99", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{val || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── INCIDENT MODAL ────────────────────────────────────────────────────────────
function IncidentModal({ incident, onSave, onDiscard, C }) {
  const blank = { id: String(Date.now()), siteCode: "", siteName: "", internalTicket: "", severity: "DEGRADED RESILIENCE", description: "", userImpact: "", handover: "", bwAvailable: "", bwAvg: "", bwPeak: "", circuits: [{ carrier: "", status: "Healthy (UP)", circuitId: "", bw: "" }] };
  const [form, setForm] = useState(incident || blank);
  const [aiLoading, setAiLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCirc = (i, k, v) => setForm(f => ({ ...f, circuits: f.circuits.map((c, idx) => idx === i ? { ...c, [k]: v } : c) }));
  const addCirc = () => setForm(f => ({ ...f, circuits: [...f.circuits, { carrier: "", status: "Healthy (UP)", circuitId: "", bw: "" }] }));
  const delCirc = (i) => setForm(f => ({ ...f, circuits: f.circuits.filter((_, idx) => idx !== i) }));
  const addTimestamp = () => {
    const now = new Date();
    set("description", (form.description ? form.description + "\n" : "") + `[${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}]: `);
  };
  const handleAI = async () => {
    if (!form.description) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: `Summarize this NOC technical log in one concise sentence for executives. Plain English:\n\n${form.description}` }] }) });
      const data = await res.json();
      set("userImpact", data.content?.[0]?.text || form.userImpact);
    } catch {}
    setAiLoading(false);
  };
  const iStyle = { background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPrimary, fontFamily: C.body, fontSize: 14, padding: "10px 14px", outline: "none", width: "100%" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 740, maxHeight: "92vh", overflowY: "auto", padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <h2 style={{ fontFamily: C.head, fontWeight: 900, fontSize: 26, color: C.textPrimary }}>{incident ? "Edit Incident" : "Create Incident"}</h2>
          <span style={{ background: SHARED.accent + "22", border: `1px solid ${SHARED.accent}44`, borderRadius: 6, padding: "4px 12px", fontFamily: C.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: SHARED.accent, textTransform: "uppercase" }}>{form.siteCode || "NEW_SITE_ID"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16, marginBottom: 20 }}>
          <div><Label C={C}>Site Code</Label><FInput C={C} value={form.siteCode} onChange={e => set("siteCode", e.target.value)} placeholder="e.g. OK07" /></div>
          <div><Label C={C}>Internal Ticket</Label><FInput C={C} value={form.internalTicket} onChange={e => set("internalTicket", e.target.value)} placeholder="INC-XXXXXX" /></div>
          <div><Label C={C}>Severity Category</Label><FSelect C={C} value={form.severity} onChange={e => set("severity", e.target.value)} options={["DEGRADED RESILIENCE","HARD DOWN","RESOLVED"]} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Label C={C} style={{ margin: 0 }}>Description</Label>
              <button onClick={addTimestamp} style={{ fontFamily: C.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: C.textMuted, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", textTransform: "uppercase" }}>+ Timestamp</button>
            </div>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Enter technical updates and logs..." style={{ ...iStyle, fontFamily: C.mono, fontSize: 12, resize: "vertical", minHeight: 120 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Label C={C} style={{ margin: 0 }}>Impact Report</Label>
                <button onClick={handleAI} disabled={aiLoading} style={{ fontFamily: C.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: SHARED.accent, background: "transparent", border: "none", cursor: "pointer", textTransform: "uppercase" }}>{aiLoading ? "⟳ Generating..." : "✦ AI Summary"}</button>
              </div>
              <textarea value={form.userImpact} onChange={e => set("userImpact", e.target.value)} placeholder="No reported staff impact" style={{ ...iStyle, resize: "vertical", minHeight: 80 }} />
            </div>
            <div style={{ background: C.orangeBg, border: `1px solid ${SHARED.orange}33`, borderRadius: 10, padding: 16 }}>
              <Label C={C} style={{ color: SHARED.orange }}>Handover Instructions</Label>
              <textarea value={form.handover} onChange={e => set("handover", e.target.value)} placeholder="What needs attention in the next shift?" style={{ ...iStyle, background: "transparent", border: "none", color: C.handoverText, fontStyle: "italic", fontWeight: 600, fontSize: 13, resize: "none", minHeight: 60, padding: 0 }} />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Label C={C} style={{ margin: 0 }}>Interface Management</Label>
            <Btn C={C} onClick={addCirc} style={{ fontSize: 11, padding: "6px 14px" }}>+ Add Circuit</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {form.circuits.map((c, i) => (
              <div key={i} style={{ background: C.bgCardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.5fr 0.9fr auto", gap: 12, alignItems: "end" }}>
                  <div><Label C={C}>ISP</Label><FInput C={C} value={c.carrier} onChange={e => setCirc(i,"carrier",e.target.value)} placeholder="ISP-A" /></div>
                  <div><Label C={C}>Status</Label><FSelect C={C} value={c.status} onChange={e => setCirc(i,"status",e.target.value)} options={["Healthy (UP)","Degraded","Down"]} /></div>
                  <div><Label C={C}>Circuit ID</Label><FInput C={C} value={c.circuitId} onChange={e => setCirc(i,"circuitId",e.target.value)} placeholder="CKT-000000" /></div>
                  <div><Label C={C}>BW</Label><FInput C={C} value={c.bw} onChange={e => setCirc(i,"bw",e.target.value)} placeholder="1 Gbps" /></div>
                  {form.circuits.length > 1 && <button onClick={() => delCirc(i)} style={{ background: "none", border: "none", cursor: "pointer", color: SHARED.red, fontSize: 18, paddingBottom: 4 }}>🗑</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Site-level BW Utilization */}
        <div style={{ background: SHARED.accent + "0d", border: `1px solid ${SHARED.accent}33`, borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
          <Label C={C} style={{ color: SHARED.accent, marginBottom: 14 }}>Site Bandwidth Utilization</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div><Label C={C}>BW Available</Label><FInput C={C} value={form.bwAvailable} onChange={e => set("bwAvailable", e.target.value)} placeholder="1 / 1 Gbps" /></div>
            <div><Label C={C}>BW Used Average</Label><FInput C={C} value={form.bwAvg} onChange={e => set("bwAvg", e.target.value)} placeholder="200 Mbps" /></div>
            <div><Label C={C}>BW Used Peak</Label><FInput C={C} value={form.bwPeak} onChange={e => set("bwPeak", e.target.value)} placeholder="500 Mbps" /></div>
          </div>
        </div>
        <div style={{ height: 1, background: C.border, marginBottom: 20 }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Btn C={C} variant="ghost" onClick={onDiscard}>Discard</Btn>
          <Btn C={C} onClick={() => onSave(form)}>Save</Btn>
        </div>
      </div>
    </div>
  );
}

// ── HTML EMAIL BUILDER (always light mode for email clients) ──────────────────
function buildHtmlEmail(data) {
  const { incidents, engineerName, reportDate, recipientEmail } = data;
  const hardDown = incidents.filter(i => i.severity === "HARD DOWN").length;
  const degraded = incidents.filter(i => i.severity === "DEGRADED RESILIENCE").length;
  const resolved = incidents.filter(i => i.severity === "RESOLVED").length;
  const impacted = hardDown + degraded; // only active issues
  const overall = hardDown > 0 ? "CRITICAL" : degraded > 0 ? "WARNING" : "HEALTHY";
  const overallColor = hardDown > 0 ? "#e84040" : degraded > 0 ? "#d4890a" : "#00b86b";
  const sevColor = { "HARD DOWN": "#e84040", "DEGRADED RESILIENCE": "#e8730a", "RESOLVED": "#00b86b" };
  const circColor = { "Healthy (UP)": "#00b86b", "Degraded": "#e8730a", "Down": "#e84040" };
  const circLabel = { "Healthy (UP)": "UP", "Degraded": "DEGRADED", "Down": "DOWN" };

  const groups = [
    { label: "HARD DOWN",           items: incidents.filter(i => i.severity === "HARD DOWN") },
    { label: "DEGRADED RESILIENCE", items: incidents.filter(i => i.severity === "DEGRADED RESILIENCE") },
    { label: "RESOLVED",            items: incidents.filter(i => i.severity === "RESOLVED") },
  ].filter(g => g.items.length > 0);

  const incidentRows = groups.map(group => {
    const sc = sevColor[group.label] || "#666";
    const cards = group.items.map(inc => {
      const circRows = inc.circuits.map((c, idx) => {
        const cc = circColor[c.status] || "#666";
        return `<tr style="border-top:1px solid #e8edf5;">
          <td style="padding:10px 14px;font-family:monospace;font-size:13px;color:#8a94a6;">${idx+1}</td>
          <td style="padding:10px 14px;font-size:14px;color:#0f1623;font-weight:500;">${c.carrier||"—"}</td>
          <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#8a94a6;">${c.circuitId||"—"}</td>
          <td style="padding:10px 14px;font-size:14px;color:#0f1623;">${c.bw||"—"}</td>
          <td style="padding:10px 14px;"><span style="display:inline-block;background:${cc}18;color:${cc};border:1px solid ${cc}44;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;">${circLabel[c.status]||c.status}</span></td>
          <td style="padding:10px 14px;font-size:14px;color:#0f1623;">${c.avgUsed||"—"}</td>
        </tr>`;
      }).join("");
      const circTable = inc.circuits.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;border:1px solid #dde1eb;border-radius:8px;overflow:hidden;margin-top:14px;">
          <thead><tr style="background:#f4f6fb;">${["WAN","ISP","CIRCUIT ID","BW","STATUS","AVG USED"].map(h=>`<th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;border-bottom:1px solid #dde1eb;">${h}</th>`).join("")}</tr></thead>
          <tbody>${circRows}</tbody>
        </table>` : "";
      const logLines = (inc.description||"").split("\n").map(l=>`<div>${l}</div>`).join("");
      return `
        <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #dde1eb;border-radius:10px;margin-bottom:14px;overflow:hidden;">
          <tr><td style="padding:22px 24px 0;">
            <div style="margin-bottom:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sc};margin-right:8px;"></span><strong style="font-size:20px;color:#0f1623;">${inc.siteCode} ${inc.siteName}</strong></div>
            <span style="display:inline-block;font-family:monospace;font-size:11px;color:#5b5ef4;background:#5b5ef410;padding:2px 9px;border-radius:4px;margin-bottom:16px;">${inc.internalTicket}</span>
          </td></tr>
          <tr><td style="padding:0 24px 22px;">
            <table style="width:100%;border-collapse:collapse;"><tr>
              <td style="width:38%;vertical-align:top;padding-right:18px;">
                <div style="background:#f4f6fb;border:1px solid #dde1eb;border-radius:8px;padding:12px;margin-bottom:10px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">IMPACT</div>
                  <p style="font-style:italic;font-size:13px;color:#0f1623;line-height:1.5;margin:0;">"${inc.userImpact||"No reported staff impact."}"</p>
                </div>
                ${inc.handover ? `<div style="background:#fff8f0;border:1px solid #e8730a33;border-radius:8px;padding:12px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#e8730a;text-transform:uppercase;margin-bottom:6px;">HANDOVER NOTES</div>
                  <p style="font-style:italic;font-weight:600;font-size:13px;color:#d4890a;line-height:1.5;margin:0;">${inc.handover}</p>
                </div>` : ""}
              </td>
              <td style="width:62%;vertical-align:top;">
                ${inc.description ? `<div style="margin-bottom:14px;"><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">TECHNICAL NOC LOG</div><div style="background:#f8f9fc;border:1px solid #dde1eb;border-radius:6px;padding:12px;font-family:monospace;font-size:12px;color:#4a5568;line-height:1.8;">${logLines}</div></div>` : ""}
                ${circTable}
              </td>
            </tr></table>
          </td></tr>
        </table>`;
    }).join("");
    return `
      <div style="margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
          <tr>
            <td><span style="display:inline-block;background:${sc};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.08em;padding:7px 18px;border-radius:5px;text-transform:uppercase;">${group.label}</span></td>
            <td style="text-align:right;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#8a94a6;text-transform:uppercase;">${group.items.length} NODE${group.items.length!==1?"S":""} IMPACTED</td>
          </tr>
        </table>
        ${cards}
      </div>`;
  }).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>NOC WAN Health Report — ${reportDate}</title></head>
  <body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,Helvetica,sans-serif;">
  <table style="width:100%;max-width:860px;margin:0 auto;border-collapse:collapse;">
    <tr><td style="padding:32px 28px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;">
            <div style="border-left:4px solid #5b5ef4;padding-left:14px;margin-bottom:8px;">
              <div style="font-size:34px;font-weight:900;color:#0f1623;letter-spacing:-0.01em;line-height:1;">NOC WAN HEALTH</div>
            </div>
            <p style="font-size:12px;color:#8a94a6;margin:0 0 0 18px;">CYCLE: ${reportDate} &bull; TO: ${recipientEmail}</p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <table style="border-collapse:collapse;margin-left:auto;"><tr>
              <td style="padding-right:10px;vertical-align:top;">
                <div style="background:#fff;border:1px solid #dde1eb;border-radius:8px;padding:12px 16px;">
                  <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">NETWORK ENGINEER</div>
                  <div style="font-size:15px;font-weight:700;color:#0f1623;">${engineerName}</div>
                </div>
              </td>
              <td style="vertical-align:top;">
                <div style="background:${overallColor}12;border:1px solid ${overallColor}44;border-radius:8px;padding:12px 16px;">
                  <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${overallColor};text-transform:uppercase;margin-bottom:6px;">OVERALL CONDITION</div>
                  <div style="font-size:20px;font-weight:900;color:${overallColor};">${overall}</div>
                </div>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 28px;">
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #dde1eb;border-radius:12px;">
        <tr><td style="padding:22px 28px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-bottom:16px;">EXECUTIVE METRICS</div>
          <table style="border-collapse:collapse;"><tr>
            <td style="padding-right:36px;"><div style="font-size:42px;font-weight:900;color:#e84040;line-height:1;">${hardDown}</div><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-top:4px;">SITES DOWN</div></td>
            <td style="padding-right:36px;"><div style="font-size:42px;font-weight:900;color:#e8730a;line-height:1;">${degraded}</div><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-top:4px;">DEGRADED</div></td>
            <td style="padding-right:36px;"><div style="font-size:42px;font-weight:900;color:#00b86b;line-height:1;">${resolved}</div><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#8a94a6;text-transform:uppercase;margin-top:4px;">RESOLVED</div></td>
            <td style="border-left:1px solid #dde1eb;padding-left:28px;vertical-align:middle;">
              <div style="font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;">⬤ &nbsp;Total Sites Impacted</div>
              <div style="font-size:28px;font-weight:900;color:#0f1623;margin-top:4px;">${impacted} <span style="font-size:14px;font-weight:500;color:#8a94a6;">active sites</span></div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 28px 36px;">${incidentRows}</td></tr>
    <tr><td style="padding:16px 28px 32px;border-top:1px solid #dde1eb;">
      <p style="font-size:11px;color:#8a94a6;text-align:center;margin:0;">Generated by WAN Insight Network Ops Pro &bull; ${reportDate}</p>
    </td></tr>
  </table></body></html>`;
}


// ── NOTIFICATION EMAIL BUILDER ────────────────────────────────────────────────
function buildNotifEmail(data) {
  const { engineerName, reportDate, recipientEmail } = data;
  const incidents = data.incidents || [];
  const hardDown = incidents.filter(i => i.severity === "HARD DOWN").length;
  const degraded = incidents.filter(i => i.severity === "DEGRADED RESILIENCE").length;
  const resolved = incidents.filter(i => i.severity === "RESOLVED").length;
  const impacted = hardDown + degraded;
  const overall = hardDown > 0 ? "CRITICAL" : degraded > 0 ? "WARNING" : "HEALTHY";
  const overallColor = hardDown > 0 ? "#e84040" : degraded > 0 ? "#d4890a" : "#00b86b";
  const overallBg = hardDown > 0 ? "#fff0f0" : degraded > 0 ? "#fffbec" : "#edfaf4";
  const greeting = impacted === 0
    ? "Great news — the Resideo network is running at full capacity with no active incidents to report."
    : `The NOC team has published today\'s WAN health report. There ${impacted === 1 ? "is" : "are"} currently <strong>${impacted} site${impacted !== 1 ? "s" : ""}</strong> requiring attention.`;
  const azureUrl = "https://noc-wan-report.azurestaticapps.net";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Resideo Network Health Report — ${reportDate}</title></head>
  <body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,Helvetica,sans-serif;">
  <table style="width:100%;max-width:620px;margin:0 auto;border-collapse:collapse;">

    <!-- Top accent bar -->
    <tr><td style="background:#5b5ef4;height:5px;border-radius:5px 5px 0 0;"></td></tr>

    <!-- Header -->
    <tr><td style="background:#ffffff;padding:36px 40px 28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Resideo · Network Operations</div>
            <div style="font-size:28px;font-weight:900;color:#0f1623;letter-spacing:-0.01em;line-height:1.1;">WAN Health Report</div>
            <div style="font-size:13px;color:#8a94a6;margin-top:6px;">Cycle: ${reportDate}</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <div style="background:${overallBg};border:1.5px solid ${overallColor}44;border-radius:10px;padding:12px 18px;display:inline-block;">
              <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:${overallColor};text-transform:uppercase;margin-bottom:4px;">Network Status</div>
              <div style="font-size:20px;font-weight:900;color:${overallColor};">${overall}</div>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Divider -->
    <tr><td style="background:#ffffff;padding:0 40px;"><div style="height:1px;background:#f0f2f7;"></div></td></tr>

    <!-- Body -->
    <tr><td style="background:#ffffff;padding:28px 40px 32px;">
      <p style="font-size:15px;color:#0f1623;line-height:1.7;margin:0 0 24px;">Hello team,</p>
      <p style="font-size:15px;color:#0f1623;line-height:1.7;margin:0 0 24px;">${greeting}</p>

      <!-- KPI chips -->
      <table style="border-collapse:collapse;margin-bottom:28px;">
        <tr>
          <td style="padding-right:10px;">
            <div style="background:#fff0f0;border:1px solid #e8404033;border-radius:8px;padding:12px 20px;text-align:center;min-width:90px;">
              <div style="font-size:28px;font-weight:900;color:#e84040;line-height:1;">${hardDown}</div>
              <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:#8a94a6;text-transform:uppercase;margin-top:4px;">Hard Down</div>
            </div>
          </td>
          <td style="padding-right:10px;">
            <div style="background:#fffbec;border:1px solid #d4890a33;border-radius:8px;padding:12px 20px;text-align:center;min-width:90px;">
              <div style="font-size:28px;font-weight:900;color:#d4890a;line-height:1;">${degraded}</div>
              <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:#8a94a6;text-transform:uppercase;margin-top:4px;">Degraded</div>
            </div>
          </td>
          <td>
            <div style="background:#edfaf4;border:1px solid #00b86b33;border-radius:8px;padding:12px 20px;text-align:center;min-width:90px;">
              <div style="font-size:28px;font-weight:900;color:#00b86b;line-height:1;">${resolved}</div>
              <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:#8a94a6;text-transform:uppercase;margin-top:4px;">Resolved</div>
            </div>
          </td>
        </tr>
      </table>

      <p style="font-size:14px;color:#4a5568;line-height:1.7;margin:0 0 28px;">For the full incident breakdown, circuit-level details, and engineer handover notes, please access the live report using the button below.</p>

      <!-- CTA Button -->
      <table style="border-collapse:collapse;margin-bottom:28px;">
        <tr>
          <td style="background:#5b5ef4;border-radius:8px;padding:14px 32px;text-align:center;">
            <a href="${azureUrl}" style="font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase;">View Full Report →</a>
          </td>
        </tr>
      </table>

      <p style="font-size:12px;color:#8a94a6;margin:0;">Or copy this link: <a href="${azureUrl}" style="color:#5b5ef4;">${azureUrl}</a></p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#f8f9fc;border-top:1px solid #dde1eb;padding:20px 40px;">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td>
          <div style="font-size:12px;color:#8a94a6;">Prepared by <strong style="color:#4a5568;">${engineerName}</strong> · NOC Team</div>
          <div style="font-size:11px;color:#8a94a6;margin-top:2px;">This is an automated notification from WAN Insight Network Ops Pro</div>
        </td>
        <td style="text-align:right;">
          <div style="width:28px;height:28px;background:#5b5ef4;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">⚡</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Bottom accent bar -->
    <tr><td style="background:#5b5ef4;height:3px;border-radius:0 0 5px 5px;"></td></tr>

  </table></body></html>`;
}

// ── EMAIL PREVIEW MODAL ───────────────────────────────────────────────────────
function EmailPreviewModal({ html, notifHtml, onClose }) {
  const [tab, setTab] = useState("notify"); // "notify" | "full" | "source"
  const [copied, setCopied] = useState(false);

  const copyHtml = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = html; ta.style.position = "fixed"; ta.style.top = "-9999px";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const activeHtml = tab === "source" ? html : tab === "notify" ? notifHtml : html;

  const copyActive = () => {
    const content = tab === "notify" ? notifHtml : html;
    try {
      const ta = document.createElement("textarea");
      ta.value = content; ta.style.position = "fixed"; ta.style.top = "-9999px";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const tabs = [
    { id: "notify", label: "📨 Notification Email" },
    { id: "full",   label: "📋 Full Report HTML" },
    { id: "source", label: "</> HTML Source" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{ background: "#0a0e17", borderBottom: "1px solid #252d3d", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ fontFamily: SHARED.body, fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", padding: "7px 16px", borderRadius: 6, background: tab === t.id ? SHARED.accent : "#1a2030", color: tab === t.id ? "#fff" : "#7a8499", border: `1px solid ${tab === t.id ? SHARED.accent : "#252d3d"}`, transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={copyActive}
            style={{ fontFamily: SHARED.body, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", padding: "7px 16px", borderRadius: 6, background: copied ? "#00b86b" : "#1a2030", color: copied ? "#fff" : "#7a8499", border: `1px solid ${copied ? "#00b86b" : "#252d3d"}`, transition: "all 0.15s" }}>
            {copied ? "✓ Copied!" : "Copy HTML"}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a5568", fontSize: 26, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
      </div>

      {/* Hint bar */}
      <div style={{ background: "#1a1f4e", borderBottom: "1px solid #3030a0", padding: "9px 24px", flexShrink: 0 }}>
        <span style={{ fontFamily: SHARED.body, fontSize: 12, color: "#8888cc" }}>
          {tab === "notify" && <><strong style={{ color: "#e8edf5" }}>📨 Notification Email</strong> — a polished invite email with the Azure report link. Copy HTML and paste into Gmail <em>(⋮ → Insert HTML)</em> or Outlook <em>(Format Text → HTML)</em>.</>}
          {tab === "full"   && <><strong style={{ color: "#e8edf5" }}>📋 Full Report</strong> — the complete incident report. Copy HTML and paste into your email client's HTML editor.</>}
          {tab === "source" && <><strong style={{ color: "#e8edf5" }}>Source</strong> — click inside → <kbd style={{ background: "#252d3d", color: "#9aa3b5", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>Ctrl+A</kbd> → <kbd style={{ background: "#252d3d", color: "#9aa3b5", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>Ctrl+C</kbd></>}
        </span>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "source" ? (
          <textarea readOnly value={html} onClick={e => e.target.select()}
            style={{ width: "100%", height: "100%", background: "#0a0e17", color: "#7dd3fc", fontFamily: SHARED.mono, fontSize: 12, lineHeight: 1.6, padding: 24, border: "none", outline: "none", resize: "none" }} />
        ) : (
          <iframe srcDoc={tab === "notify" ? notifHtml : html} style={{ width: "100%", height: "100%", border: "none" }} title="Email Preview" sandbox="allow-same-origin" />
        )}
      </div>
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function NavBar({ view, setView, onEmail, darkMode, setDarkMode, C, session, syncing, onLogout }) {
  return (
    <div style={{ background: C.navBg, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, height: 52 }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: SHARED.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <div>
            <div style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 16, color: C.textPrimary, letterSpacing: "0.05em", lineHeight: 1 }}>WANINSIGHT</div>
            <div style={{ fontFamily: SHARED.body, fontSize: 9, color: C.textMuted, letterSpacing: "0.15em" }}>NETWORK OPS PRO</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {["WORKSPACE","REPORT","ARCHIVE"].map(v => (
            <button key={v} onClick={() => setView(v.toLowerCase())}
              style={{ fontFamily: SHARED.body, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", padding: "6px 16px", borderRadius: 6, cursor: "pointer", textTransform: "uppercase", background: view === v.toLowerCase() ? C.bgCard : "transparent", color: view === v.toLowerCase() ? C.textPrimary : C.textSecondary, border: `1px solid ${view === v.toLowerCase() ? C.borderLight : "transparent"}`, transition: "all 0.15s" }}>
              {v}
            </button>
          ))}
          {/* Light/Dark toggle */}
          <button onClick={() => setDarkMode(d => !d)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: SHARED.body, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", padding: "6px 14px", borderRadius: 6, cursor: "pointer", textTransform: "uppercase", background: C.bgCard, color: C.textSecondary, border: `1px solid ${C.border}`, transition: "all 0.15s" }}>
            {darkMode ? "☀ Light" : "☾ Dark"}
          </button>
          <Btn C={C} onClick={onEmail} style={{ marginLeft: 4 }}>Draft Email</Btn>
          {/* Sync indicator */}
          {syncing && <span style={{ fontFamily: SHARED.body, fontSize: 11, color: SHARED.accent, marginLeft: 4 }}>⟳ Syncing...</span>}
          {/* User + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, paddingLeft: 12, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: SHARED.accent + "22", border: `1px solid ${SHARED.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SHARED.body, fontWeight: 800, fontSize: 11, color: SHARED.accent }}>
              {session?.name?.split(" ").map(w => w[0]).join("").toUpperCase()}
            </div>
            <span style={{ fontFamily: SHARED.body, fontSize: 12, fontWeight: 600, color: C.textSecondary }}>{session?.name?.split(" ")[0]}</span>
            <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMuted, fontFamily: SHARED.body, fontSize: 11, fontWeight: 600, padding: "3px 10px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}>Out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WORKSPACE ─────────────────────────────────────────────────────────────────
function WorkspaceView({ data, setData, onAdd, onEdit, onDelete, onEmail, onSend, darkMode, C }) {
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const [sent, setSent] = useState(false);
  const doSend = () => onSend(setSent);
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, marginBottom: 40, alignItems: "start" }}>
        <div>
          <h1 style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 38, color: C.textPrimary, letterSpacing: "-0.01em", marginBottom: 24 }}>Resideo Network Health Report</h1>
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div><Label C={C}>Network Engineer</Label><FSelect C={C} value={data.engineerName} onChange={e => set("engineerName", e.target.value)} options={ENGINEERS.map(e => e.name)} /></div>
            <div><Label C={C}>Date</Label><FInput C={C} type="date" value={data.reportDate} onChange={e => set("reportDate", e.target.value)} /></div>
          </div>
        </div>
        <div style={{ background: darkMode ? "linear-gradient(135deg,#1a1f4e,#0f1235)" : "linear-gradient(135deg,#eef0ff,#f5f6ff)", border: darkMode ? "1px solid #3030a0" : "1px solid #c0c4f8", borderRadius: 16, padding: 28, minWidth: 280 }}>
          <Label C={C} style={{ color: darkMode ? "#8888dd" : "#5b5ef4", marginBottom: 16 }}>Sent Report To:</Label>
          <Label C={C}>Recipient Mailbox</Label>
          <FInput C={C} value={data.recipientEmail} onChange={e => set("recipientEmail", e.target.value)} placeholder="email@company.com" style={{ marginBottom: 16 }} />
          {/* Engineer from address */}
          <div style={{ background: C.bgCardAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>📤</span>
            <div>
              <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase" }}>Sending from</div>
              <div style={{ fontFamily: SHARED.body, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{ENGINEER_EMAIL[data.engineerName] || "—"}</div>
            </div>
          </div>


          <Btn C={C} onClick={doSend} style={{ width: "100%", padding: "12px 0", fontSize: 13, background: sent ? SHARED.green : SHARED.accent, transition: "background 0.3s" }}>{sent ? "✓ Sent & Archived!" : "Send Report"}</Btn>
        </div>
      </div>

      <div onClick={onAdd} style={{ border: `1.5px dashed ${C.borderLight}`, borderRadius: 16, padding: "40px 24px", textAlign: "center", cursor: "pointer", marginBottom: 32, transition: "border-color 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = SHARED.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.borderLight}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.bgCard, border: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, color: C.textSecondary }}>+</div>
        <div style={{ fontFamily: SHARED.body, fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: C.textMuted, textTransform: "uppercase" }}>Create Incident Entry</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {data.incidents.map(inc => {
          const cfg = SEV_CFG[inc.severity] || SEV_CFG["RESOLVED"];
          return (
            <div key={inc.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, transition: "border-color 0.15s", cursor: "default" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = cfg.getColor() + "66"}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <SiteAvatar code={inc.siteCode} sev={inc.severity} dark={darkMode} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 22, color: C.textPrimary }}>{inc.siteCode}</div>
                <div style={{ fontFamily: SHARED.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase", marginTop: 3 }}>{inc.severity} · {inc.internalTicket}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => onEdit(inc)} style={{ background: "none", border: "none", cursor: "pointer", color: SHARED.accent, fontSize: 16, padding: 6 }}>✎</button>
                <button onClick={() => onDelete(inc.id)} style={{ background: "none", border: "none", cursor: "pointer", color: SHARED.red, fontSize: 16, padding: 6 }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── REPORT VIEW ───────────────────────────────────────────────────────────────
function ReportView({ data, darkMode, C }) {
  const { incidents, engineerName, reportDate, recipientEmail } = data;
  const hardDown = incidents.filter(i => i.severity === "HARD DOWN").length;
  const degraded = incidents.filter(i => i.severity === "DEGRADED RESILIENCE").length;
  const resolved = incidents.filter(i => i.severity === "RESOLVED").length;
  const impacted = hardDown + degraded;
  const total = incidents.length;
  const healthPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const overall = hardDown > 0 ? "CRITICAL" : degraded > 0 ? "WARNING" : "HEALTHY";
  const overallColor = hardDown > 0 ? SHARED.red : degraded > 0 ? SHARED.yellow : SHARED.green;
  const overallBg = hardDown > 0 ? C.redBg : degraded > 0 ? C.yellowBg : C.greenBg;
  const initials = engineerName ? engineerName.split(" ").map(w => w[0]).join("").toUpperCase() : "??";

  const pieData = [
    { name: "Hard Down", value: hardDown, color: SHARED.red },
    { name: "Degraded",  value: degraded, color: SHARED.orange },
    { name: "Resolved",  value: resolved, color: SHARED.green },
  ].filter(d => d.value > 0);
  if (pieData.length === 0) pieData.push({ name: "No Data", value: 1, color: C.border });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px" }}>
        <div style={{ fontFamily: SHARED.body, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{d.name}</div>
        <div style={{ fontFamily: SHARED.head, fontSize: 22, fontWeight: 900, color: d.color }}>{d.value}</div>
      </div>
    );
  };

  const groups = [
    { label: "HARD DOWN",           items: incidents.filter(i => i.severity === "HARD DOWN") },
    { label: "DEGRADED RESILIENCE", items: incidents.filter(i => i.severity === "DEGRADED RESILIENCE") },
    { label: "RESOLVED",            items: incidents.filter(i => i.severity === "RESOLVED") },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, marginBottom: 36 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
            <div style={{ width: 4, height: 52, background: SHARED.accent, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 44, color: C.textPrimary, letterSpacing: "-0.02em" }}>NOC WAN HEALTH</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 20 }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>📅</span>
            <span style={{ fontFamily: SHARED.body, fontSize: 13, color: C.textSecondary }}>CYCLE: {reportDate} • DISTRIBUTION: {recipientEmail}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", minWidth: 140 }}>
            <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: C.textMuted, textTransform: "uppercase", marginBottom: 10 }}>Network Engineer</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.bgCardAlt, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SHARED.head, fontWeight: 800, fontSize: 13, color: SHARED.accent }}>{initials}</div>
              <div style={{ fontFamily: SHARED.head, fontWeight: 800, fontSize: 15, color: C.textPrimary, lineHeight: 1.2 }}>{engineerName.split(" ").map((w, i) => <div key={i}>{w}</div>)}</div>
            </div>
          </div>
          <div style={{ background: overallBg, border: `1px solid ${overallColor}44`, borderRadius: 12, padding: "16px 20px", minWidth: 140 }}>
            <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: overallColor + "aa", textTransform: "uppercase", marginBottom: 4 }}>Overall</div>
            <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: overallColor + "aa", textTransform: "uppercase", marginBottom: 10 }}>Condition</div>
            <div style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 22, color: overallColor }}>{overall}</div>
          </div>
        </div>
      </div>

      {/* Executive Metrics */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 32 }}>
        <Label C={C} style={{ marginBottom: 20 }}>Summary</Label>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 48, marginBottom: 24 }}>
              {[[hardDown,"SITES DOWN",SHARED.red],[degraded,"DEGRADED",SHARED.orange],[resolved,"RESOLVED",SHARED.green]].map(([val,lbl,col]) => (
                <div key={lbl}>
                  <div style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 48, color: col, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: C.textMuted, marginTop: 4, textTransform: "uppercase" }}>{lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: C.border, marginBottom: 14 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: SHARED.accent, display: "inline-block" }} />
              <span style={{ fontFamily: SHARED.body, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSecondary, textTransform: "uppercase" }}>
                Total Sites Impacted: <strong style={{ color: C.textPrimary }}>{impacted}</strong> active site{impacted !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div style={{ width: 140, height: 140, position: "relative", flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={62} startAngle={90} endAngle={-270} paddingAngle={3} strokeWidth={0}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>HEALTH</div>
              <div style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 22, color: C.textPrimary }}>{healthPct}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Incident groups */}
      {groups.map(group => {
        const cfg = SEV_CFG[group.label];
        return (
          <div key={group.label} style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "inline-flex", alignItems: "center", padding: "8px 20px", background: cfg.getColor(), borderRadius: 6, fontFamily: SHARED.body, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase" }}>{group.label}</div>
              <span style={{ fontFamily: SHARED.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.textMuted, textTransform: "uppercase" }}>{group.items.length} Node{group.items.length !== 1 ? "s" : ""} Impacted</span>
            </div>
            {group.items.map(inc => (
              <div key={inc.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 32 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.getColor(), flexShrink: 0, display: "inline-block" }} />
                      <h3 style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 26, color: C.textPrimary, lineHeight: 1.1 }}>{inc.siteCode} {inc.siteName}</h3>
                    </div>
                    <div style={{ display: "inline-block", fontFamily: SHARED.mono, fontSize: 12, color: SHARED.accent, background: SHARED.accent + "18", padding: "3px 10px", borderRadius: 6, marginBottom: 20 }}>{inc.internalTicket}</div>
                    <div style={{ background: C.bgCardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                      <Label C={C} style={{ marginBottom: 8 }}>Impact</Label>
                      <p style={{ fontFamily: SHARED.body, fontStyle: "italic", fontSize: 14, color: C.textPrimary, lineHeight: 1.5 }}>"{inc.userImpact || "No reported staff impact."}"</p>
                    </div>
                    {inc.handover && (
                      <div style={{ background: C.orangeBg, border: `1px solid ${SHARED.orange}33`, borderRadius: 10, padding: "14px 16px" }}>
                        <Label C={C} style={{ color: SHARED.orange, marginBottom: 8 }}>Engineer Handover Notes</Label>
                        <p style={{ fontFamily: SHARED.body, fontWeight: 600, fontStyle: "italic", fontSize: 14, color: C.handoverText, lineHeight: 1.5 }}>{inc.handover}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    {inc.description && (
                      <div style={{ marginBottom: 20 }}>
                        <Label C={C}>Technical NOC Log</Label>
                        <div style={{ background: darkMode ? "#0a0e17" : "#f4f6fb", border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, fontFamily: SHARED.mono, fontSize: 12, color: C.textSecondary, lineHeight: 1.8 }}>
                          {inc.description.split("\n").map((line, i) => <div key={i}>{line}</div>)}
                        </div>
                      </div>
                    )}
                    {inc.circuits.length > 0 && <CircuitTable circuits={inc.circuits} inc={inc} C={C} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {impacted === 0 && incidents.length > 0 && (
        <div style={{ background: `linear-gradient(135deg, ${C.greenBg}, ${C.bgCard})`, border: `1.5px solid ${SHARED.green}44`, borderRadius: 20, padding: "48px 40px", textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🟢</div>
          <div style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 32, color: SHARED.green, letterSpacing: "-0.01em", marginBottom: 12 }}>All Systems Operational</div>
          <div style={{ fontFamily: SHARED.body, fontSize: 16, color: C.textPrimary, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 20px" }}>
            Congratulations — every node across the Resideo network is running at full capacity.<br/>
            <strong>Zero active incidents. Zero degraded links. 100% resilience.</strong>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: SHARED.green + "18", border: `1px solid ${SHARED.green}44`, borderRadius: 10, padding: "10px 24px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: SHARED.green, display: "inline-block" }} />
            <span style={{ fontFamily: SHARED.body, fontWeight: 700, fontSize: 13, color: SHARED.green, letterSpacing: "0.06em" }}>NETWORK HEALTH: 100% · NO ACTION REQUIRED</span>
          </div>
        </div>
      )}
      {incidents.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div style={{ fontFamily: SHARED.body, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>No incidents logged for this cycle</div>
        </div>
      )}
    </div>
  );
}




// ── ARCHIVE VIEW ─────────────────────────────────────────────────────────────
function ArchiveView({ archives, onRestore, onDelete, darkMode, C }) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    const arc = archives.find(a => a.id === selected);
    if (!arc) { setSelected(null); return null; }
    return (
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <button onClick={() => setSelected(null)} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textSecondary, fontFamily: SHARED.body, fontWeight: 600, fontSize: 13, padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>← Back to Archive</button>
          <div>
            <div style={{ fontFamily: SHARED.head, fontWeight: 800, fontSize: 22, color: C.textPrimary }}>{arc.reportDate}</div>
            <div style={{ fontFamily: SHARED.body, fontSize: 12, color: C.textMuted }}>Saved by {arc.engineerName} · {new Date(arc.savedAt).toLocaleString()}</div>
          </div>
        </div>
        <ReportView data={arc} darkMode={darkMode} C={C} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: SHARED.head, fontWeight: 900, fontSize: 34, color: C.textPrimary, marginBottom: 8 }}>Report Archive</h1>
        <p style={{ fontFamily: SHARED.body, fontSize: 14, color: C.textSecondary }}>Historical snapshots of all published WAN health reports.</p>
      </div>

      {archives.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗂️</div>
          <div style={{ fontFamily: SHARED.head, fontWeight: 700, fontSize: 18, color: C.textMuted, marginBottom: 8 }}>No archived reports yet</div>
          <div style={{ fontFamily: SHARED.body, fontSize: 14, color: C.textMuted }}>Each time you send a report, a snapshot is automatically saved here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...archives].reverse().map(arc => {
            const hd = arc.incidents.filter(i => i.severity === "HARD DOWN").length;
            const dg = arc.incidents.filter(i => i.severity === "DEGRADED RESILIENCE").length;
            const rs = arc.incidents.filter(i => i.severity === "RESOLVED").length;
            const impacted = hd + dg;
            const overall = hd > 0 ? "CRITICAL" : dg > 0 ? "WARNING" : "HEALTHY";
            const overallColor = hd > 0 ? SHARED.red : dg > 0 ? SHARED.yellow : SHARED.green;
            const overallBg = hd > 0 ? C.redBg : dg > 0 ? C.yellowBg : C.greenBg;
            return (
              <div key={arc.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, transition: "border-color 0.15s", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = SHARED.accent + "66"}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                onClick={() => setSelected(arc.id)}>
                {/* Date */}
                <div style={{ minWidth: 110 }}>
                  <div style={{ fontFamily: SHARED.head, fontWeight: 800, fontSize: 18, color: C.textPrimary }}>{arc.reportDate}</div>
                  <div style={{ fontFamily: SHARED.body, fontSize: 11, color: C.textMuted, marginTop: 2 }}>{new Date(arc.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                {/* Engineer */}
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontFamily: SHARED.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>Engineer</div>
                  <div style={{ fontFamily: SHARED.body, fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{arc.engineerName}</div>
                  <div style={{ fontFamily: SHARED.body, fontSize: 11, color: C.textMuted }}>{ENGINEER_EMAIL[arc.engineerName] || ""}</div>
                </div>
                {/* KPIs */}
                <div style={{ display: "flex", gap: 10, flex: 1 }}>
                  {[[hd, "Down", SHARED.red], [dg, "Degraded", SHARED.orange], [rs, "Resolved", SHARED.green]].map(([val, lbl, col]) => (
                    <div key={lbl} style={{ background: col + "14", border: `1px solid ${col}33`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 72 }}>
                      <div style={{ fontFamily: SHARED.head, fontWeight: 800, fontSize: 22, color: col, lineHeight: 1 }}>{val}</div>
                      <div style={{ fontFamily: SHARED.body, fontSize: 10, fontWeight: 600, color: C.textMuted, marginTop: 2, textTransform: "uppercase" }}>{lbl}</div>
                    </div>
                  ))}
                </div>
                {/* Status badge */}
                <div style={{ background: overallBg, border: `1px solid ${overallColor}44`, borderRadius: 8, padding: "8px 16px", textAlign: "center", minWidth: 100 }}>
                  <div style={{ fontFamily: SHARED.head, fontWeight: 800, fontSize: 14, color: overallColor }}>{overall}</div>
                  <div style={{ fontFamily: SHARED.body, fontSize: 10, color: overallColor + "99", marginTop: 1 }}>{arc.incidents.length} incident{arc.incidents.length !== 1 ? "s" : ""}</div>
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onDelete(arc.id)} title="Delete snapshot" style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, cursor: "pointer", padding: "6px 10px", fontSize: 14, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = SHARED.red; e.currentTarget.style.color = SHARED.red; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,      setSession]      = useState(getSession);
  const [data,         setData]         = useState(SEED);
  const [view,         setView]         = useState("workspace");
  const [modal,        setModal]        = useState(null);
  const [emailPreview, setEmailPreview] = useState(false);
  const [darkMode,     setDarkMode]     = useState(true);
  const [archives,     setArchives]     = useState([]);
  const [syncing,      setSyncing]      = useState(false);
  const C = useMemo(() => theme(darkMode), [darkMode]);

  // Load from Firestore + subscribe to real-time changes
  useEffect(() => {
    if (!session) return;
    setSyncing(true);
    loadReport().then(remote => {
      if (remote) setData(remote);
      else setData(d => ({ ...d, engineerName: session.name }));
      setSyncing(false);
    });
    loadArchives().then(list => setArchives(list.sort((a,b) => b.savedAt.localeCompare(a.savedAt))));
    const unsub = subscribeReport(remote => setData(remote));
    return () => unsub();
  }, [session]);

  // Auto-save to Firestore (debounced 800ms)
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => saveReport(data), 800);
    return () => clearTimeout(t);
  }, [data, session]);

  const saveIncident = (inc) => {
    setData(d => ({ ...d, incidents: d.incidents.find(i => i.id === inc.id) ? d.incidents.map(i => i.id === inc.id ? inc : i) : [...d.incidents, inc] }));
    setModal(null);
  };

  const handleSend = (setSent) => {
    const snapshot = { ...data, id: Date.now().toString(), savedAt: new Date().toISOString() };
    saveArchive(snapshot);
    setArchives(prev => [snapshot, ...prev]);

    // Build mailto with notification email as plain-text fallback
    const { recipientEmail, reportDate, engineerName } = data;
    const hd = data.incidents.filter(i => i.severity === "HARD DOWN").length;
    const dg = data.incidents.filter(i => i.severity === "DEGRADED RESILIENCE").length;
    const rs = data.incidents.filter(i => i.severity === "RESOLVED").length;
    const impacted = hd + dg;
    const overall = hd > 0 ? "CRITICAL" : dg > 0 ? "WARNING" : "HEALTHY";
    const subj = encodeURIComponent(`[${overall}] Resideo WAN Health Report — ${reportDate}`);
    const azureUrl = "https://noc-wan-report.azurestaticapps.net";
    const greeting = impacted === 0
      ? "Great news — the Resideo network is running at full capacity with no active incidents to report."
      : `The NOC team has published today's WAN health report. There are currently ${impacted} site${impacted !== 1 ? "s" : ""} requiring attention.`;
    const body = encodeURIComponent(
`Hello team,

${greeting}

Network Status: ${overall}
━━━━━━━━━━━━━━━━━━━━━━━
  Hard Down : ${hd}
  Degraded  : ${dg}
  Resolved  : ${rs}
━━━━━━━━━━━━━━━━━━━━━━━

View the full live report here:
${azureUrl}

For circuit-level details, engineer handover notes, and incident logs, please access the report at the link above.

—
${engineerName} · NOC Team
Prepared with WAN Insight Network Ops Pro
Report Cycle: ${reportDate}`
    );

    const emails = recipientEmail.split(/[;,]/).map(e => e.trim()).filter(Boolean).join(",");
    const fromEmail = ENGINEER_EMAIL[engineerName] || "";
    const replyTo = fromEmail ? `&reply-to=${encodeURIComponent(fromEmail)}` : "";
    const a = document.createElement("a");
    a.href = `mailto:${emails}?subject=${subj}${replyTo}&body=${body}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Flash sent state
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  if (!session) return <Login onLogin={setSession} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.textPrimary, fontFamily: SHARED.body, transition: "background 0.2s, color 0.2s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 3px; }
        option { background: #1e2636; }
      `}</style>

      <NavBar view={view} setView={setView} onEmail={() => setEmailPreview(true)} darkMode={darkMode} setDarkMode={setDarkMode} C={C}
        session={session} syncing={syncing}
        onLogout={() => { logout(); setSession(null); }} />

      {view === "workspace" && (
        <WorkspaceView data={data} setData={setData} onAdd={() => setModal("new")} onEdit={inc => setModal(inc)}
          onDelete={id => setData(d => ({ ...d, incidents: d.incidents.filter(i => i.id !== id) }))}
          onEmail={() => setEmailPreview(true)} onSend={handleSend} darkMode={darkMode} C={C} />
      )}
      {view === "report" && <ReportView data={data} darkMode={darkMode} C={C} />}
      {view === "archive" && <ArchiveView archives={archives} onDelete={id => { deleteArchive(id); setArchives(prev => prev.filter(a => a.id !== id)); }} darkMode={darkMode} C={C} />}
      {modal && <IncidentModal incident={modal === "new" ? null : modal} onSave={saveIncident} onDiscard={() => setModal(null)} C={C} />}
      {emailPreview && <EmailPreviewModal html={buildHtmlEmail(data)} notifHtml={buildNotifEmail(data)} onClose={() => setEmailPreview(false)} />}
    </div>
  );
}
