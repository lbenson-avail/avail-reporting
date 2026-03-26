import { useState, useEffect, useRef } from "react";

// ─── Styles ───────────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; }
  body { background: #F0F0F2; }
  :root {
    --bg: #F0F0F2; --surface: #FFFFFF; --surface2: #F5F5F8; --surface3: #EDEDF0;
    --border: rgba(0,0,0,0.07); --border-md: rgba(0,0,0,0.11);
    --t1: #111113; --t2: #3C3C44; --t3: #8A8A96; --t4: #BEBEC8;
    --blue: #1561D4; --blue-lt: #EBF1FB; --blue-dk: #0D47A0;
    --green: #0E7A3E; --green-lt: #E6F4ED;
    --amber: #B45309; --amber-lt: #FDF3E3;
    --red: #C0392B; --red-lt: #FDEEEC;
    --slate: #4A5568;
    --r: 12px; --r-sm: 8px; --r-xs: 6px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.05);
    --shadow-md: 0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.09);
    --font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --mono: 'DM Mono', 'SF Mono', monospace;
  }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes barGrow { from{width:0} }
  @keyframes dropIn  { from{opacity:0;transform:translateY(-6px) scale(0.99)} to{opacity:1;transform:translateY(0) scale(1)} }
  .fu  { opacity:0; animation:fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
  .bar { animation:barGrow 0.85s cubic-bezier(0.22,1,0.36,1) forwards; }
  .drop{ animation:dropIn 0.2s cubic-bezier(0.22,1,0.36,1) forwards; }
  table { border-collapse:collapse; width:100%; }
  code  { font-family:var(--mono); background:rgba(0,0,0,0.05); padding:1px 6px; border-radius:4px; font-size:11px; }
  button { cursor:pointer; font-family:var(--font); }
`;

// ─── SVG Icon — path strings only, no JSX in objects ─────────────────────────
const ICON_PATHS = {
  revenue:     "M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  target:      "M22 12A10 10 0 1112 2M12 12m-6 0a6 6 0 1012 0M12 12m-2 0a2 2 0 114 0",
  trending:    "M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6",
  package:     "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01 20.73 6.96M12 22.08V12",
  pipeline:    "M2 7h20a2 2 0 012 2v11a2 2 0 01-2 2H2a2 2 0 01-2-2V9a2 2 0 012-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16",
  trophy:      "M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z",
  search:      "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  mail:        "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
  arrowup:     "M12 19V5M5 12l7-7 7 7",
  users:       "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  barChart:    "M18 20V10M12 20V4M6 20v-6",
  layers:      "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  alert:       "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  calendar:    "M3 4h18a2 2 0 012 2v16a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2zM16 2v4M8 2v4M2 10h20",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight:"M9 18l6-6-6-6",
  x:           "M18 6L6 18M6 6l12 12",
  diamond:     "M12 2l10 10-10 10L2 12z",
};

function Icon({ name, size = 16, color = "currentColor", sw = 1.6 }) {
  const d = ICON_PATHS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const MONTHLY_ERP = {
  "2026-01": { rev_26:1293665, rev_25:536500,  margin:0.381, orders:821  },
  "2026-02": { rev_26:739562,  rev_25:996977,  margin:0.389, orders:512  },
  "2026-03": { rev_26:352815,  rev_25:528054,  margin:0.394, orders:275  },
};
// Per-month counts pulled live from HubSpot 2026-03-12 — static fallback
// MQLs = date_became_marketing_qualified in month | SQLs = date_moved_to_qualified_or_further in month
const STATIC_HS = {
  "2026-01": { mqls:127, sqls:5 },
  "2026-02": { mqls:191, sqls:9 },
  "2026-03": { mqls:72,  sqls:3 },
};
const CSM_DATA = [
  { name:"Rebecca Owens",  "2026-01":839602,"2026-02":317341,"2026-03":145568, margin:0.377, orders:1027 },
  { name:"Zach Martin",    "2026-01":336051,"2026-02":357950,"2026-03":176285, margin:0.392, orders:523  },
  { name:"Jaret Anderson", "2026-01":113297,"2026-02":51734, "2026-03":23720,  margin:0.395, orders:258  },
];
const STATIC = {
  q_targets: { Q1:3200000, Q2:2800000, Q3:2900000, Q4:4500000 },
  pipeline:3385000, won_count:18, won_amount:4420000, lost_count:66,
  pipeline_stages:[
    {name:"Stage 1 – Interest",    count:26, amount:0},
    {name:"Stage 2 – Investigate", count:12, amount:2525000},
    {name:"Stage 3 – Validate",    count:5,  amount:235000},
    {name:"Stage 4 – Justify",     count:3,  amount:125000},
    {name:"Stage 5 – Decide",      count:2,  amount:500000},
  ],
  ae:[
    {name:"Jonathan Hopkins",csm:"Rebecca Owens", open_deals:15,open_amount:2280000,won_qtd:3,won_qtd_amt:380000, lost_qtd:19,win_rate_qtd:14,notable:["McGuireWoods — $750K","King & Spalding — $425K","Boulevard — $250K","ChangeEngine — $600K"]},
    {name:"Steven Santa Ana", csm:"Zach Martin",  open_deals:17,open_amount:1105000,won_qtd:3,won_qtd_amt:2070000,lost_qtd:1, win_rate_qtd:75,notable:["EHE Health — $500K","Pathfinder — $250K","OneDigital Central — $100K"]},
  ],
  channels:[
    {src:"Offline / Direct Sales",mqls:384,sqls:59,pipe:1675000,won:2},
    {src:"Direct Traffic",        mqls:242,sqls:37,pipe:1155000,won:5},
    {src:"Paid Search",           mqls:97, sqls:15,pipe:910000, won:6},
    {src:"Organic Search",        mqls:97, sqls:15,pipe:450000, won:3},
    {src:"Referrals",             mqls:77, sqls:12,pipe:150000, won:1},
    {src:"AI Referrals",          mqls:50, sqls:8, pipe:15000,  won:0},
    {src:"Email Marketing",       mqls:19, sqls:3, pipe:75000,  won:1},
  ],
  icp:[
    {tier:"Strong Fit",   n:3,  pct:12},
    {tier:"Moderate Fit", n:10, pct:40},
    {tier:"Weak Fit",     n:8,  pct:32},
    {tier:"No Fit",       n:4,  pct:16},
  ],
  icp_scored:25, icp_unscored:2275,
};

// ─── Date utils ───────────────────────────────────────────────────────────────
const MONTH_NAMES  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_M      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW          = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const daysInM      = (y,m) => new Date(y, m+1, 0).getDate();
const sameD        = (a,b) => a && b && a.toDateString() === b.toDateString();
const inRange      = (d,s,e) => { if(!s||!e) return false; const [lo,hi]=s<=e?[s,e]:[e,s]; return d>=lo && d<=hi; };

function fmtRange(s,e) {
  if(!s) return "Select period";
  const fmt = d => `${SHORT_M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if(!e || sameD(s,e)) return fmt(s);
  if(s.getFullYear()===e.getFullYear() && s.getMonth()===e.getMonth())
    return `${SHORT_M[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  return `${fmt(s)} – ${fmt(e)}`;
}

function getActiveMonths(start, end) {
  if(!start) return ["2026-01","2026-02","2026-03"];
  const e = end || start;
  const [lo, hi] = start <= e ? [start,e] : [e,start];
  const active = [];
  for(const ym of Object.keys(MONTHLY_ERP).sort()) {
    const [y,m] = ym.split('-').map(Number);
    const mStart = new Date(y, m-1, 1);
    const mEnd   = new Date(y, m, 0);
    if(lo <= mEnd && hi >= mStart) active.push(ym);
  }
  return active.length ? active : ["2026-01","2026-02","2026-03"];
}

function getErp(months) {
  const rows = months.map(m => MONTHLY_ERP[m]).filter(Boolean);
  if(!rows.length) return null;
  const rev_26  = rows.reduce((s,r) => s+r.rev_26, 0);
  const rev_25  = rows.reduce((s,r) => s+r.rev_25, 0);
  const orders  = rows.reduce((s,r) => s+r.orders, 0);
  const margin  = rev_26>0 ? rows.reduce((s,r) => s+r.rev_26*r.margin, 0)/rev_26 : 0;
  const monthly = months.map(m => ({ym:m, label:MONTH_NAMES[parseInt(m.split('-')[1])-1], ...MONTHLY_ERP[m]}));
  const csmRows = CSM_DATA.map(c => ({...c, period_rev: months.reduce((s,m) => s+(c[m]||0), 0)}));
  return { rev_26, rev_25, orders, margin, monthly, csmRows };
}

function getHs(months, hsData) {
  const src = hsData || STATIC_HS;
  const rows = months.map(m => src[m]).filter(Boolean);
  return {
    mqls:  rows.reduce((s,r) => s+r.mqls, 0),
    sqls:  rows.reduce((s,r) => s+r.sqls, 0),
    scale: months.length / 3,
  };
}

// ─── Live data hook ───────────────────────────────────────────────────────────
function useLiveData(start, end) {
  const [hsData, setHsData] = useState(STATIC_HS);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!start) return;
    const e = end || start;
    const pad = d => d.toISOString().slice(0, 10);
    const [lo, hi] = start <= e ? [start, e] : [e, start];
    let cancelled = false;

    fetch("/api/hubspot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateStart: pad(lo), dateEnd: pad(hi) }),
    })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        if (cancelled) return;
        const merged = { ...STATIC_HS };
        for (const [ym, vals] of Object.entries(data)) {
          if (vals && typeof vals.mqls === "number") merged[ym] = vals;
        }
        setHsData(merged);
        setIsLive(true);
        setLastUpdated(new Date());
      })
      .catch(() => {
        if (cancelled) return;
        setHsData(STATIC_HS);
        setIsLive(false);
        setLastUpdated(null);
      });

    return () => { cancelled = true; };
  }, [start?.getTime(), end?.getTime()]);

  return { hsData, isLive, lastUpdated };
}

// ─── Format helpers ───────────────────────────────────────────────────────────
const f$ = (n, compact=false) => {
  if(n==null) return "—";
  if(compact) {
    if(n>=1e6) return `$${(n/1e6).toFixed(n%1e6===0?0:1)}M`;
    if(n>=1e3) return `$${Math.round(n/1e3)}K`;
  }
  return "$"+n.toLocaleString();
};
const fp = n => n!=null ? `${Math.round(n)}%` : "—";
const fn = n => n?.toLocaleString() ?? "—";
const pct = (a,b) => b>0 ? Math.round((a/b)*100) : 0;

// ─── Animated counter ─────────────────────────────────────────────────────────
function Count({ to, fmt=fn, dur=850, delay=0 }) {
  const [v, setV] = useState(0);
  const raf = useRef();
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now() + delay;
    const tick = now => {
      const el = Math.max(0, now-t0);
      const p  = Math.min(1, el/dur);
      const e  = 1 - Math.pow(1-p, 4);
      setV(Math.round(to * e));
      if(p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, dur, delay]);
  return <>{fmt(v)}</>;
}

// ─── Bar ──────────────────────────────────────────────────────────────────────
function Bar({ val, max, color="var(--blue)", h=5, delay=0 }) {
  const width = max > 0 ? Math.min(100, (val/max)*100) : 0;
  return (
    <div style={{background:"var(--surface3)",borderRadius:99,height:h,overflow:"hidden"}}>
      <div className="bar" style={{height:"100%",width:`${width}%`,background:color,borderRadius:99,animationDelay:`${delay}ms`}} />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, val, anim, afmt=fn, sub, icon, accent="var(--blue)", delay=0 }) {
  return (
    <div className="fu" style={{background:"var(--surface)",borderRadius:"var(--r)",boxShadow:"var(--shadow-sm)",border:"1px solid var(--border)",padding:"22px 24px",animationDelay:`${delay}ms`,display:"flex",flexDirection:"column",minHeight:148}}>
      <div style={{width:40,height:40,borderRadius:10,marginBottom:16,background:`${accent}14`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <Icon name={icon} size={18} color={accent} sw={1.8} />
      </div>
      <div style={{fontSize:28,fontWeight:700,color:accent,letterSpacing:"-0.025em",lineHeight:1,marginBottom:5}}>
        {anim!=null ? <Count to={anim} fmt={afmt} delay={delay+80} /> : val}
      </div>
      <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:2}}>{label}</div>
      {sub && <div style={{fontSize:11.5,color:"var(--t3)",marginTop:"auto",paddingTop:6,lineHeight:1.4}}>{sub}</div>}
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Lbl({ children, style }) {
  return <div style={{fontSize:10.5,fontWeight:600,letterSpacing:"0.09em",textTransform:"uppercase",color:"var(--t3)",marginBottom:14,...style}}>{children}</div>;
}
function Bdg({ children, color="var(--blue)" }) {
  return <span style={{display:"inline-flex",alignItems:"center",fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:99,background:`${color}14`,color}}>{children}</span>;
}
function Card({ children, style, delay=0 }) {
  return (
    <div className="fu" style={{background:"var(--surface)",borderRadius:"var(--r)",boxShadow:"var(--shadow-sm)",border:"1px solid var(--border)",padding:24,animationDelay:`${delay}ms`,...style}}>
      {children}
    </div>
  );
}
function HR({ my=14 }) {
  return <div style={{height:1,background:"var(--border)",margin:`${my}px -24px`}} />;
}

// ─── Calendar picker ─────────────────────────────────────────────────────────
function CalMonth({ year, month, startDate, endDate, hoverDate, onDay, onHover, selecting }) {
  const firstDay = new Date(year, month, 1).getDay();
  const days = daysInM(year, month);
  const today = new Date();
  const cells = [];
  for(let i=0; i<firstDay; i++) cells.push(null);
  for(let d=1; d<=days; d++) cells.push(new Date(year, month, d));

  return (
    <div style={{width:238}}>
      <div style={{textAlign:"center",fontWeight:600,fontSize:13,color:"var(--t1)",marginBottom:12}}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
        {DOW.map(d => (
          <div key={d} style={{textAlign:"center",fontSize:10.5,fontWeight:600,color:"var(--t4)",padding:"3px 0",letterSpacing:"0.04em"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
        {cells.map((d, i) => {
          if(!d) return <div key={`b${i}`} />;
          const isStart = sameD(d, startDate);
          const isEnd   = sameD(d, endDate);
          const hEnd    = selecting && hoverDate ? hoverDate : endDate;
          const inR     = inRange(d, startDate, hEnd);
          const isFuture = d > today;
          const isToday  = sameD(d, today);
          const isSel    = isStart || isEnd;
          let bg="transparent", color=isFuture?"var(--t4)":"var(--t1)", fw=400;
          if(isSel)      { bg="var(--blue)"; color="#fff"; fw=600; }
          else if(inR)   { bg="var(--blue-lt)"; color="var(--blue-dk)"; }
          return (
            <div key={d.toISOString()} onClick={() => !isFuture && onDay(d)} onMouseEnter={() => onHover(d)}
              style={{textAlign:"center",fontSize:12.5,fontWeight:fw,padding:"5px 0",borderRadius:6,background:bg,color,cursor:isFuture?"default":"pointer",outline:isToday&&!isSel?"1.5px solid var(--blue)":"none",outlineOffset:-1,transition:"background 0.1s ease"}}>
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DatePicker({ startDate, endDate, onChange }) {
  const [open,   setOpen]  = useState(false);
  const [sel,    setSel]   = useState(false);
  const [tmp,    setTmp]   = useState(null);
  const [hover,  setHover] = useState(null);
  const [vy,     setVy]    = useState(2026);
  const [vm,     setVm]    = useState(0);
  const ref = useRef();

  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const m2y = vm===11 ? vy+1 : vy;
  const m2m = vm===11 ? 0 : vm+1;
  const dStart = sel ? tmp : startDate;
  const dEnd   = sel ? null : endDate;

  const onDay = d => {
    if(!sel) { setTmp(d); setSel(true); }
    else {
      const [s,e] = d>=tmp ? [tmp,d] : [d,tmp];
      onChange(s,e); setSel(false); setTmp(null); setOpen(false);
    }
  };
  const prev = () => { if(vm===0){setVy(y=>y-1);setVm(11);}else setVm(m=>m-1); };
  const next = () => { if(vm===11){setVy(y=>y+1);setVm(0);}else setVm(m=>m+1); };

  const quickRanges = {
    "Q1 2026":     [new Date(2026,0,1), new Date(2026,2,11)],
    "January":     [new Date(2026,0,1), new Date(2026,0,31)],
    "February":    [new Date(2026,1,1), new Date(2026,1,28)],
    "March MTD":   [new Date(2026,2,1), new Date(2026,2,11)],
    "Last 30 days":[new Date(2026,1,9), new Date(2026,2,11)],
  };

  return (
    <div ref={ref} style={{position:"relative",display:"inline-block"}}>
      <button onClick={() => setOpen(o=>!o)} style={{
        display:"flex",alignItems:"center",gap:8,padding:"8px 14px",
        background:open?"var(--blue)":"var(--surface)",
        border:`1px solid ${open?"var(--blue)":"var(--border-md)"}`,
        borderRadius:"var(--r-sm)",fontSize:13,fontWeight:500,
        color:open?"#fff":"var(--t1)",
        boxShadow:open?"0 0 0 3px rgba(21,97,212,0.13)":"var(--shadow-sm)",
        transition:"all 0.15s ease",
      }}>
        <Icon name="calendar" size={14} color={open?"rgba(255,255,255,0.8)":"var(--t3)"} sw={1.8} />
        <span style={{letterSpacing:"-0.01em"}}>{fmtRange(startDate,endDate)}</span>
        <Icon name="chevronDown" size={12} color={open?"rgba(255,255,255,0.6)":"var(--t3)"} sw={2} />
      </button>

      {open && (
        <div className="drop" style={{
          position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:999,
          background:"var(--surface)",borderRadius:"var(--r)",
          boxShadow:"var(--shadow-md)",border:"1px solid var(--border-md)",
          display:"flex",minWidth:572,overflow:"hidden",
        }}>
          {/* Sidebar */}
          <div style={{width:136,borderRight:"1px solid var(--border)",padding:"14px 10px",background:"var(--surface2)",display:"flex",flexDirection:"column",gap:2}}>
            <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.09em",textTransform:"uppercase",color:"var(--t4)",padding:"4px 8px",marginBottom:4}}>Quick Select</div>
            {Object.keys(quickRanges).map(label => (
              <button key={label} onClick={() => { const [s,e]=quickRanges[label]; onChange(s,e); setSel(false); setTmp(null); setOpen(false); }}
                style={{textAlign:"left",padding:"7px 10px",borderRadius:6,fontSize:12.5,fontWeight:500,border:"none",background:"transparent",color:"var(--t2)",transition:"background 0.1s ease"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--blue-lt)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >{label}</button>
            ))}
          </div>
          {/* Calendars */}
          <div style={{padding:"18px 20px",flex:1}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <button onClick={prev} style={{width:28,height:28,borderRadius:6,border:"1px solid var(--border)",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t2)"}}>
                <Icon name="chevronLeft" size={14} sw={2} />
              </button>
              <span style={{fontSize:11.5,color:"var(--t3)",fontWeight:500}}>
                {sel ? "Now select an end date" : "Select a start date"}
              </span>
              <button onClick={next} style={{width:28,height:28,borderRadius:6,border:"1px solid var(--border)",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t2)"}}>
                <Icon name="chevronRight" size={14} sw={2} />
              </button>
            </div>
            <div style={{display:"flex",gap:28}} onMouseLeave={() => setHover(null)}>
              <CalMonth year={vy} month={vm} startDate={dStart} endDate={dEnd} hoverDate={hover} onDay={onDay} onHover={setHover} selecting={sel} />
              <CalMonth year={m2y} month={m2m} startDate={dStart} endDate={dEnd} hoverDate={hover} onDay={onDay} onHover={setHover} selecting={sel} />
            </div>
            {(startDate || sel) && (
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"var(--t3)"}}>{sel ? `From ${fmtRange(tmp,null)} — select end date` : fmtRange(startDate,endDate)}</span>
                <button onClick={() => { onChange(null,null); setSel(false); setTmp(null); }} style={{fontSize:12,color:"var(--t3)",border:"none",background:"transparent",textDecoration:"underline",display:"flex",alignItems:"center",gap:4,padding:"3px 6px"}}>
                  <Icon name="x" size={11} sw={2} /> Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EXEC VIEW ────────────────────────────────────────────────────────────────
function ExecView({ months }) {
  const d = getErp(months);
  if(!d) return null;
  const tgt = STATIC.q_targets.Q1;
  const att = months.length === 3 ? (d.rev_26/tgt)*100 : null;
  const maxRev = Math.max(...d.monthly.map(m => Math.max(m.rev_26, m.rev_25)));
  const yoyPct = d.rev_25 > 0 ? ((d.rev_26/d.rev_25-1)*100) : null;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Invoiced Revenue" anim={d.rev_26} afmt={v=>f$(v,true)} accent="var(--blue)"  icon="revenue"
          sub={att!=null ? `of ${f$(tgt,true)} Q1 target` : `${d.monthly.map(m=>SHORT_M[parseInt(m.ym.split('-')[1])-1]).join(', ')} period`} delay={0} />
        {att!=null
          ? <KPI label="Q1 Attainment" val={`${att.toFixed(1)}%`} accent={att>=75?"var(--green)":"var(--amber)"} icon="target" sub={`${f$(tgt-d.rev_26,true)} remaining`} delay={60} />
          : <KPI label="YoY Change" val={yoyPct!=null?`${yoyPct>0?"+":""}${yoyPct.toFixed(1)}%`:"—"} accent={yoyPct>=0?"var(--green)":"var(--red)"} icon="trending" sub={`vs. ${f$(d.rev_25,true)} prior year`} delay={60} />
        }
        <KPI label="Gross Margin"  val={fp(d.margin*100)}   accent="var(--green)" icon="barChart" sub="Avail Swag LOB"    delay={120} />
        <KPI label="Orders"        anim={d.orders} afmt={fn} accent="var(--slate)" icon="package"  sub="In selected period" delay={180} />
      </div>

      {att!=null && (
        <Card delay={210} style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <Lbl style={{marginBottom:0}}>Q1 Revenue Progress</Lbl>
            <div style={{display:"flex",gap:16,fontSize:11.5,color:"var(--t3)"}}>
              {Object.entries(STATIC.q_targets).map(([q,v]) => (
                <span key={q} style={{fontFamily:"var(--mono)"}}>{q}: {f$(v,true)}</span>
              ))}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:13}}>
            <span style={{fontWeight:600,color:"var(--blue)",fontFamily:"var(--mono)"}}>{f$(d.rev_26,true)} invoiced</span>
            <span style={{color:"var(--t3)"}}>{att.toFixed(1)}% of {f$(tgt,true)}</span>
          </div>
          <div style={{background:"var(--surface3)",borderRadius:99,height:10,overflow:"hidden"}}>
            <div className="bar" style={{height:"100%",width:`${Math.min(100,att)}%`,background:"linear-gradient(90deg,var(--blue),#4A90E2)",borderRadius:99,animationDelay:"300ms"}} />
          </div>
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card delay={250}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <Lbl style={{marginBottom:0}}>Monthly Revenue</Lbl>
            <div style={{display:"flex",gap:14,fontSize:11.5}}>
              <span style={{display:"flex",alignItems:"center",gap:5,color:"var(--blue)",fontWeight:600}}>
                <span style={{width:20,height:4,background:"var(--blue)",borderRadius:99,display:"inline-block"}} />2026
              </span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:"var(--t3)"}}>
                <span style={{width:20,height:4,background:"var(--surface3)",border:"1px solid #C8C8D0",borderRadius:99,display:"inline-block"}} />2025
              </span>
            </div>
          </div>
          {d.monthly.map((m, i) => (
            <div key={m.ym} style={{marginBottom:i<d.monthly.length-1?20:0}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:7}}>
                <span style={{fontWeight:500,color:"var(--t2)"}}>{SHORT_M[parseInt(m.ym.split('-')[1])-1]}</span>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <span style={{fontWeight:700,color:"var(--blue)",fontFamily:"var(--mono)",fontSize:13}}>{f$(m.rev_26,true)}</span>
                  <span style={{color:"var(--t3)",fontFamily:"var(--mono)",fontSize:12}}>{f$(m.rev_25,true)}</span>
                  <span style={{fontSize:11,fontWeight:600,color:m.rev_26>m.rev_25?"var(--green)":"var(--red)",minWidth:52,textAlign:"right"}}>
                    {m.rev_26>m.rev_25?"▲":"▼"} {fp(Math.abs((m.rev_26/m.rev_25-1)*100))}
                  </span>
                </div>
              </div>
              <div style={{marginBottom:3}}><Bar val={m.rev_26} max={maxRev} color="var(--blue)" h={8} delay={280+i*70} /></div>
              <Bar val={m.rev_25} max={maxRev} color="#D4D4DE" h={3} delay={310+i*70} />
            </div>
          ))}
        </Card>

        <Card delay={290}>
          <Lbl>Gross Margin by Month</Lbl>
          {d.monthly.map((m, i) => (
            <div key={m.ym} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                <span style={{fontWeight:500,color:"var(--t2)"}}>{SHORT_M[parseInt(m.ym.split('-')[1])-1]}</span>
                <span style={{fontWeight:600,color:"var(--green)",fontFamily:"var(--mono)"}}>{(m.margin*100).toFixed(1)}%</span>
              </div>
              <Bar val={m.margin*100} max={55} color="var(--green)" h={5} delay={290+i*70} />
            </div>
          ))}
          <HR />
          <Lbl>Orders by Month</Lbl>
          {d.monthly.map((m, i, arr) => (
            <div key={m.ym+"o"} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",fontSize:13}}>
              <span style={{color:"var(--t2)"}}>{SHORT_M[parseInt(m.ym.split('-')[1])-1]}</span>
              <span style={{fontWeight:600,fontFamily:"var(--mono)",color:"var(--t1)"}}>{fn(m.orders)}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card delay={330}>
        <Lbl>Account Revenue by CSM</Lbl>
        <table>
          <thead>
            <tr>
              {["Account Manager","Jan","Feb","Mar MTD","Period Total","Margin","Orders"].map(h => (
                <th key={h} style={{fontSize:10.5,fontWeight:600,color:"var(--t3)",textAlign:h==="Account Manager"?"left":"right",paddingBottom:10,borderBottom:"1px solid var(--border)",letterSpacing:"0.06em",textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.csmRows.map((c, i) => (
              <tr key={c.name}>
                <td style={{padding:"13px 0",fontWeight:600,fontSize:13.5,color:"var(--t1)",borderBottom:i<d.csmRows.length-1?"1px solid var(--border)":"none"}}>{c.name}</td>
                {["2026-01","2026-02","2026-03"].map((m, j) => (
                  <td key={j} style={{textAlign:"right",padding:"13px 0",fontSize:12,fontFamily:"var(--mono)",color:months.includes(m)?"var(--t2)":"var(--t4)",borderBottom:i<d.csmRows.length-1?"1px solid var(--border)":"none"}}>{f$(c[m],true)}</td>
                ))}
                <td style={{textAlign:"right",padding:"13px 0",fontSize:14,fontWeight:700,fontFamily:"var(--mono)",color:"var(--blue)",borderBottom:i<d.csmRows.length-1?"1px solid var(--border)":"none"}}>{f$(c.period_rev,true)}</td>
                <td style={{textAlign:"right",padding:"13px 0",fontSize:12,fontWeight:600,fontFamily:"var(--mono)",color:"var(--green)",borderBottom:i<d.csmRows.length-1?"1px solid var(--border)":"none"}}>{(c.margin*100).toFixed(1)}%</td>
                <td style={{textAlign:"right",padding:"13px 0",fontSize:12,fontFamily:"var(--mono)",color:"var(--t2)",borderBottom:i<d.csmRows.length-1?"1px solid var(--border)":"none"}}>{fn(c.orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── SALES VIEW ───────────────────────────────────────────────────────────────
function SalesView({ months, hsData }) {
  const hs = getHs(months, hsData);
  const maxStg = Math.max(...STATIC.pipeline_stages.filter(s=>s.amount>0).map(s=>s.amount));
  const sqlMqlRate = hs.mqls > 0 ? pct(hs.sqls, hs.mqls) : 0;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Open Pipeline"  anim={STATIC.pipeline} afmt={v=>f$(v,true)} accent="var(--blue)"  icon="pipeline" sub="Account Pipeline — AEs"    delay={0} />
        <KPI label="Win Rate"       val={fp(pct(STATIC.won_count, STATIC.won_count+STATIC.lost_count))} accent="var(--green)" icon="trophy" sub={`${STATIC.won_count} won · ${STATIC.lost_count} lost`} delay={60} />
        <KPI label="SQLs"           anim={hs.sqls} afmt={fn} accent="var(--amber)" icon="search" sub={`${fp(sqlMqlRate)} of ${fn(hs.mqls)} MQLs`} delay={120} />
        <KPI label="MQLs"           anim={hs.mqls} afmt={fn} accent="var(--slate)" icon="users"  sub="In selected period"  delay={180} />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card delay={230}>
          <Lbl>Pipeline by Stage</Lbl>
          {STATIC.pipeline_stages.map((s, i) => (
            <div key={s.name} style={{paddingBottom:i<STATIC.pipeline_stages.length-1?13:0,marginBottom:i<STATIC.pipeline_stages.length-1?13:0,borderBottom:i<STATIC.pipeline_stages.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:s.amount>0?6:0,fontSize:13}}>
                <span style={{fontWeight:500,color:"var(--t2)"}}>{s.name}</span>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{color:"var(--t3)",fontSize:12}}>{s.count} deals</span>
                  {s.amount>0 && <span style={{fontWeight:700,fontFamily:"var(--mono)",color:"var(--blue)"}}>{f$(s.amount,true)}</span>}
                </div>
              </div>
              {s.amount > 0 && <Bar val={s.amount} max={maxStg} h={4} delay={270+i*55} />}
            </div>
          ))}
          <div style={{marginTop:14,background:"var(--blue-lt)",borderRadius:"var(--r-sm)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12.5,fontWeight:600,color:"var(--blue)"}}>Total open pipeline</span>
            <span style={{fontSize:18,fontWeight:700,fontFamily:"var(--mono)",color:"var(--blue)"}}>{f$(STATIC.pipeline,true)}</span>
          </div>
        </Card>

        <Card delay={270}>
          <Lbl>Funnel — Selected Period</Lbl>
          {[
            {lbl:"MQLs",       val:hs.mqls,     color:"var(--slate)"},
            {lbl:"SQLs",       val:hs.sqls,     color:"var(--amber)"},
            {lbl:"Closed Won", val:Math.round(STATIC.won_count * hs.scale), color:"var(--green)"},
          ].map((f, i, arr) => (
            <div key={f.lbl} style={{marginBottom:i<arr.length-1?16:0}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                <span style={{fontWeight:500,color:"var(--t2)"}}>{f.lbl}</span>
                <span style={{fontWeight:700,fontFamily:"var(--mono)",color:f.color}}>{fn(f.val)}</span>
              </div>
              <Bar val={f.val} max={hs.mqls} color={f.color} h={5} delay={290+i*65} />
              {i < arr.length-1 && (
                <div style={{fontSize:11,color:"var(--t3)",textAlign:"right",marginTop:3}}>
                  {arr[i].val>0 ? pct(arr[i+1].val, arr[i].val) : 0}% conversion
                </div>
              )}
            </div>
          ))}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:18}}>
            <div style={{padding:"12px 14px",background:"var(--green-lt)",borderRadius:"var(--r-sm)"}}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--green)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Q1 Won Amount</div>
              <div style={{fontSize:18,fontWeight:700,fontFamily:"var(--mono)",color:"var(--green)"}}>{f$(STATIC.won_amount,true)}</div>
            </div>
            <div style={{padding:"12px 14px",background:"var(--blue-lt)",borderRadius:"var(--r-sm)"}}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--blue)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Win Rate</div>
              <div style={{fontSize:18,fontWeight:700,fontFamily:"var(--mono)",color:"var(--blue)"}}>{fp(pct(STATIC.won_count, STATIC.won_count+STATIC.lost_count))}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card delay={320}>
        <Lbl>Account Executive Performance — Q1 2026</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {STATIC.ae.map(ae => {
            const wc = ae.win_rate_qtd >= 50 ? "var(--green)" : "var(--amber)";
            return (
              <div key={ae.name} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--r-sm)",padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14.5,fontWeight:700,color:"var(--t1)",marginBottom:3,letterSpacing:"-0.02em"}}>{ae.name}</div>
                    <div style={{fontSize:11.5,color:"var(--t3)"}}>CSM partner: <span style={{color:"var(--t2)",fontWeight:600}}>{ae.csm}</span></div>
                  </div>
                  <Bdg color={wc}>{ae.win_rate_qtd}% win rate</Bdg>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                  {[
                    {lbl:"Open Pipeline",val:f$(ae.open_amount,true),sub:`${ae.open_deals} deals`,color:"var(--blue)",bg:"var(--blue-lt)"},
                    {lbl:"Won Q1",val:f$(ae.won_qtd_amt,true),sub:`${ae.won_qtd} won · ${ae.lost_qtd} lost`,color:"var(--green)",bg:"var(--green-lt)"},
                  ].map(s => (
                    <div key={s.lbl} style={{padding:"11px 12px",background:s.bg,borderRadius:"var(--r-xs)"}}>
                      <div style={{fontSize:9.5,fontWeight:600,color:s.color,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>{s.lbl}</div>
                      <div style={{fontSize:18,fontWeight:700,fontFamily:"var(--mono)",color:s.color}}>{s.val}</div>
                      <div style={{fontSize:11,color:s.color,opacity:0.65,marginTop:2}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Notable Open Deals</div>
                {ae.notable.map(deal => (
                  <div key={deal} style={{fontSize:12,color:"var(--t2)",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>{deal}</div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── MARKETING VIEW ───────────────────────────────────────────────────────────
function MarketingView({ months, hsData }) {
  const hs = getHs(months, hsData);
  const sc = hs.scale;
  const ch = STATIC.channels.map(c => ({...c, mqls:Math.round(c.mqls*sc), sqls:Math.round(c.sqls*sc), pipe:Math.round(c.pipe*sc), won:Math.round(c.won*sc)}));
  const maxMql  = Math.max(...ch.map(c=>c.mqls));
  const maxPipe = Math.max(...ch.map(c=>c.pipe));
  const sqlMqlRate = hs.mqls > 0 ? pct(hs.sqls, hs.mqls) : 0;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KPI label="MQLs"         anim={hs.mqls} afmt={fn} accent="var(--slate)"  icon="mail"     sub="In selected period"                       delay={0} />
        <KPI label="MQL → SQL"    val={`${hs.mqls>0?pct(hs.sqls,hs.mqls):0}%`}   accent="var(--green)"  icon="arrowup"  sub={`${fn(hs.sqls)} SQLs generated`}          delay={60} />
        <KPI label="Active SQLs"  anim={hs.sqls} afmt={fn} accent="var(--amber)"  icon="search"   sub="In selected period"                       delay={120} />
        <KPI label="Pipeline"     anim={STATIC.pipeline} afmt={v=>f$(v,true)} accent="var(--blue)" icon="pipeline" sub="Total AE pipeline"        delay={180} />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card delay={230}>
          <Lbl>MQLs by Channel</Lbl>
          {[...ch].sort((a,b)=>b.mqls-a.mqls).map((c, i) => (
            <div key={c.src} style={{marginBottom:i<ch.length-1?13:0}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                <span style={{fontWeight:500,color:"var(--t2)"}}>{c.src}</span>
                <div style={{display:"flex",gap:10}}>
                  <span style={{fontWeight:700,fontFamily:"var(--mono)",color:"var(--slate)"}}>{fn(c.mqls)}</span>
                  <span style={{color:"var(--t3)",fontSize:12,alignSelf:"center"}}>{fn(c.sqls)} SQL</span>
                </div>
              </div>
              <Bar val={c.mqls} max={maxMql} color="var(--slate)" h={4} delay={270+i*40} />
            </div>
          ))}
        </Card>
        <Card delay={270}>
          <Lbl>Pipeline by Channel</Lbl>
          {[...ch].filter(c=>c.pipe>0).sort((a,b)=>b.pipe-a.pipe).map((c, i, arr) => (
            <div key={c.src} style={{marginBottom:i<arr.length-1?13:0}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                <span style={{fontWeight:500,color:"var(--t2)"}}>{c.src}</span>
                <span style={{fontWeight:700,fontFamily:"var(--mono)",color:"var(--blue)"}}>{f$(c.pipe,true)}</span>
              </div>
              <Bar val={c.pipe} max={maxPipe} color="var(--blue)" h={4} delay={270+i*40} />
            </div>
          ))}
        </Card>
      </div>

      <Card delay={330}>
        <Lbl>Full Channel Attribution</Lbl>
        <table>
          <thead>
            <tr>
              {["Channel","MQLs","SQLs","MQL→SQL","Pipeline","Won"].map(h => (
                <th key={h} style={{fontSize:10.5,fontWeight:600,color:"var(--t3)",textAlign:h==="Channel"?"left":"right",paddingBottom:10,borderBottom:"1px solid var(--border)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...ch].sort((a,b)=>b.mqls-a.mqls).map((c, i, arr) => (
              <tr key={c.src}>
                <td style={{padding:"11px 0",fontWeight:500,fontSize:13,color:"var(--t1)",borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}}>{c.src}</td>
                <td style={{textAlign:"right",fontWeight:700,fontFamily:"var(--mono)",color:"var(--slate)",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",padding:"11px 0"}}>{fn(c.mqls)}</td>
                <td style={{textAlign:"right",fontFamily:"var(--mono)",color:"var(--t2)",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",padding:"11px 0",fontSize:12}}>{fn(c.sqls)}</td>
                <td style={{textAlign:"right",fontFamily:"var(--mono)",color:"var(--t3)",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",padding:"11px 0",fontSize:12}}>{c.mqls>0?pct(c.sqls,c.mqls):0}%</td>
                <td style={{textAlign:"right",fontWeight:600,fontFamily:"var(--mono)",color:"var(--t1)",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",padding:"11px 0",fontSize:12}}>{c.pipe?f$(c.pipe,true):"—"}</td>
                <td style={{textAlign:"right",fontWeight:c.won>0?700:400,fontFamily:"var(--mono)",color:c.won>0?"var(--green)":"var(--t4)",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",padding:"11px 0",fontSize:12}}>{c.won||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{marginTop:12,fontSize:11,color:"var(--t3)",lineHeight:1.65,borderTop:"1px solid var(--border)",paddingTop:12}}>
          First-touch attribution from HubSpot contact source field. Pipeline estimated by matching Account Pipeline deal source. Offline/Direct Sales includes rep-entered contacts from events and trade shows.
        </p>
      </Card>
    </div>
  );
}

// ─── ICP VIEW ─────────────────────────────────────────────────────────────────
function IcpView({ months }) {
  const scored = STATIC.icp_scored;
  const total  = scored + STATIC.icp_unscored;
  const colors = { "Strong Fit":"var(--green)", "Moderate Fit":"var(--blue)", "Weak Fit":"var(--amber)", "No Fit":"var(--red)" };
  const icons  = ["diamond","layers","alert","x"];

  return (
    <div>
      <div className="fu" style={{display:"flex",gap:14,background:"var(--amber-lt)",border:"1px solid rgba(180,83,9,0.2)",borderRadius:"var(--r)",padding:"16px 20px",marginBottom:16}}>
        <div style={{width:36,height:36,borderRadius:9,background:"rgba(180,83,9,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
          <Icon name="alert" size={16} color="var(--amber)" sw={1.8} />
        </div>
        <div>
          <div style={{fontSize:13.5,fontWeight:700,color:"var(--amber)",marginBottom:4}}>ICP Field Sparsely Populated</div>
          <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.65}}>
            Only <strong>{scored} of {fn(total)} contacts</strong> have an ICP score ({(scored/total*100).toFixed(1)}% coverage). Data improves as reps complete Lead records. HubSpot property: <code>icp_fit_score_from_lead</code> on Contact object.
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {STATIC.icp.map((t, i) => (
          <KPI key={t.tier} label={t.tier} anim={t.n} afmt={fn} accent={colors[t.tier]} icon={icons[i]} sub={`${t.pct}% of scored`} delay={i*55} />
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card delay={260}>
          <Lbl>ICP Distribution — Scored Leads Only</Lbl>
          {STATIC.icp.map((t, i) => (
            <div key={t.tier} style={{marginBottom:i<STATIC.icp.length-1?16:0}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                <span style={{fontWeight:600,color:colors[t.tier]}}>{t.tier}</span>
                <span style={{fontFamily:"var(--mono)",color:"var(--t2)",fontSize:12}}>{t.n} contacts · {t.pct}%</span>
              </div>
              <Bar val={t.pct} max={100} color={colors[t.tier]} h={7} delay={290+i*65} />
            </div>
          ))}
          <div style={{marginTop:16,padding:"12px 14px",background:"var(--surface2)",borderRadius:"var(--r-sm)",fontSize:12.5,color:"var(--t2)",lineHeight:1.65,borderLeft:"3px solid var(--border-md)"}}>
            Scoring on Lead object via <code>icp_fit_score_from_lead</code>, synced to Contact. "No Fit" contacts excluded from MQL counts.
          </div>
        </Card>

        <Card delay={300}>
          <Lbl>Data Quality Actions</Lbl>
          {[
            {p:"Critical",c:"var(--red)",   a:"Score ICP on all Q1 SQLs",        d:"17 Q1 SQLs in active pipeline — required for win-rate analysis by tier."},
            {p:"High",    c:"var(--amber)", a:"Gate new MQLs at SQL handoff",     d:"Require ICP field before SQL stage advancement."},
            {p:"Medium",  c:"var(--slate)", a:"Backfill Q1 MQLs",                 d:`${fn(390)} Q1 MQLs unscored — work backwards from SQLs first.`},
            {p:"Low",     c:"var(--t3)",    a:"Audit Weak Fit conversions",       d:"8 Weak Fit contacts progressed — validate criteria accuracy."},
          ].map((x, i, arr) => (
            <div key={x.a} style={{paddingBottom:i<arr.length-1?14:0,marginBottom:i<arr.length-1?14:0,borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                <Bdg color={x.c}>{x.p}</Bdg>
                <span style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{x.a}</span>
              </div>
              <p style={{fontSize:12,color:"var(--t3)",lineHeight:1.55}}>{x.d}</p>
            </div>
          ))}
          <div style={{marginTop:16,background:"var(--green-lt)",borderRadius:"var(--r-sm)",padding:"14px 16px",borderLeft:"3px solid var(--green)"}}>
            <div style={{fontSize:10,fontWeight:600,color:"var(--green)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Coverage Target</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--green)",marginBottom:3}}>Score all 17 SQLs first</div>
            <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.6}}>ICP data on SQLs unlocks win-rate by tier and channel × ICP cross-tab analysis.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"exec",      label:"Executive Summary", icon:"revenue",  View:ExecView},
  {id:"sales",     label:"Sales Funnel",      icon:"pipeline", View:SalesView},
  {id:"marketing", label:"Attribution",       icon:"barChart", View:MarketingView},
  {id:"icp",       label:"ICP & Lead Quality",icon:"layers",   View:IcpView},
];

export default function App() {
  const [tab,   setTab]   = useState("exec");
  const [start, setStart] = useState(new Date(2026,0,1));
  const [end,   setEnd]   = useState(new Date(2026,2,11));
  const [rk,    setRk]    = useState(0);

  const { hsData, isLive, lastUpdated } = useLiveData(start, end);
  const months = getActiveMonths(start, end);
  const Active = TABS.find(t => t.id===tab)?.View;

  const switchTab = id => { setTab(id); setRk(k=>k+1); };
  const onDate    = (s,e) => { setStart(s); setEnd(e); setRk(k=>k+1); };

  return (
    <>
      <style>{G}</style>
      <div style={{fontFamily:"var(--font)",background:"var(--bg)",minHeight:"100vh",color:"var(--t1)"}}>

        {/* Header */}
        <header style={{position:"sticky",top:0,zIndex:200,background:"rgba(255,255,255,0.92)",backdropFilter:"saturate(180%) blur(20px)",WebkitBackdropFilter:"saturate(180%) blur(20px)",borderBottom:"1px solid var(--border)"}}>
          <div style={{maxWidth:1220,margin:"0 auto",padding:"0 28px",height:58,display:"flex",alignItems:"center",justifyContent:"space-between",gap:24}}>
            {/* Brand */}
            <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
              <div style={{width:32,height:32,borderRadius:8,background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="package" size={16} color="#fff" sw={1.8} />
              </div>
              <div>
                <div style={{fontSize:13.5,fontWeight:700,color:"var(--t1)",letterSpacing:"-0.02em",lineHeight:1}}>Avail Swag</div>
                <div style={{fontSize:10.5,color:"var(--t3)",marginTop:1}}>Revenue Intelligence</div>
              </div>
            </div>

            {/* Nav tabs */}
            <nav style={{display:"flex",gap:1,background:"var(--surface2)",borderRadius:"var(--r-sm)",padding:3,border:"1px solid var(--border)"}}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => switchTab(t.id)} style={{
                  display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
                  fontSize:12.5,fontWeight:600,borderRadius:6,border:"none",
                  fontFamily:"var(--font)",letterSpacing:"-0.01em",
                  background:tab===t.id?"var(--surface)":"transparent",
                  color:tab===t.id?"var(--t1)":"var(--t3)",
                  boxShadow:tab===t.id?"0 1px 3px rgba(0,0,0,0.09)":"none",
                  transition:"all 0.15s cubic-bezier(0.22,1,0.36,1)",
                }}>
                  <Icon name={t.icon} size={13} color={tab===t.id?"var(--blue)":"var(--t3)"} sw={1.9} />
                  {t.label}
                </button>
              ))}
            </nav>

            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--t3)",flexShrink:0,fontFamily:"var(--mono)"}}>
              <div style={{width:6,height:6,borderRadius:99,background:isLive?"var(--green)":"var(--amber)"}} />
              {isLive
                ? `Live · ${lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`
                : "Cached"}
            </div>
          </div>
        </header>

        {/* Body */}
        <main style={{maxWidth:1220,margin:"0 auto",padding:"22px 28px 80px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <DatePicker startDate={start} endDate={end} onChange={onDate} />
            {months.length > 0 && (
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--t3)"}}>
                <div style={{width:5,height:5,borderRadius:99,background:"var(--green)"}} />
                {months.map(m => SHORT_M[parseInt(m.split('-')[1])-1]).join(', ')} {months[0].split('-')[0]}
              </div>
            )}
          </div>
          <div key={rk}>
            <Active months={months} hsData={hsData} />
          </div>
        </main>
      </div>
    </>
  );
}
