"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DashData = {
  price: { price: number | null; changePercent: number | null; changePct: string } | null;
  bias:  { bias: string; confluenceScore: number | null; marketState: string } | null;
  realYield: { value: number | null; trend: string } | null;
  session: { session: string; sessionStart: string; sessionEnd: string } | null;
  nextEvent: { title: string; eventTime: string; impact: string; hoursUntil: number } | null;
  cot: { managedMoney: number | null; swapDealers: number | null; smallSpecs: number | null } | null;
  fedWatch: { hold: number | null; cut: number | null; hike: number | null; bias: string; summary: string | null } | null;
  yieldCurve: { spread: number | null; status: string; trend: string } | null;
  goldSilver: { ratio: number | null; zone: string } | null;
  etfFlows: { gld5d: number | null; iau5d: number | null; signal: string } | null;
  updatedAt: string;
};

// ── Design tokens ─────────────────────────────────────────────────────────────

const GOLD    = "#C9A227";
const BULL    = "#4CAF75";
const BEAR    = "#E05252";
const NEUTRAL = "#888888";

const kpiCard: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(15,15,15,0.95) 0%, rgba(8,8,8,0.95) 100%)",
  border: "1px solid rgba(201,162,39,0.12)",
  borderRadius: 12,
  padding: "14px 16px",
  position: "relative",
  minHeight: 90,
  overflow: "hidden",
};

const chartCard: React.CSSProperties = {
  ...kpiCard,
  minHeight: 180,
};

const lbl: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: 9,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(201,162,39,0.6)",
  marginBottom: 8,
};

const numVal: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 22,
  fontWeight: 600,
  color: "#F5F0E8",
  lineHeight: 1.1,
};

const smText: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 10,
  color: "rgba(255,255,255,0.32)",
  marginTop: 4,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function AccentLine() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 1,
      background: "linear-gradient(90deg, transparent 0%, rgba(201,162,39,0.4) 50%, transparent 100%)",
    }} />
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div style={{ margin: "20px 0 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 9, letterSpacing: "0.25em", color: "rgba(201,162,39,0.7)", textTransform: "uppercase", fontFamily: "ui-sans-serif, system-ui, sans-serif", flexShrink: 0 }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(201,162,39,0.3) 0%, transparent 100%)" }} />
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color, marginRight: 5, flexShrink: 0 }} />;
}

function fmt(n: number | null | undefined, dec = 2) {
  return n == null ? "—" : n.toFixed(dec);
}

function biasColor(b: string) {
  const l = b.toLowerCase();
  return l.includes("bull") ? BULL : l.includes("bear") ? BEAR : NEUTRAL;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    function check() { setMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ title, main, sub, mainColor = "#F5F0E8" }: {
  title: string; main: string; sub?: string; mainColor?: string;
}) {
  return (
    <div style={kpiCard}>
      <AccentLine />
      <div style={lbl}>{title}</div>
      <div style={{ ...numVal, color: mainColor }}>{main}</div>
      {sub && <div style={smText}>{sub}</div>}
    </div>
  );
}

// ── COT Bar Chart ─────────────────────────────────────────────────────────────

function COTChart({ data }: { data: DashData["cot"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current || !data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) (chartRef.current as { destroy(): void }).destroy();
    const mm = (data.managedMoney ?? 0) / 1000;
    const sd = (data.swapDealers  ?? 0) / 1000;
    const ss = (data.smallSpecs   ?? 0) / 1000;
    chartRef.current = new w.Chart(ref.current, {
      type: "bar",
      data: {
        labels: ["Managed Money", "Swap Dealers", "Small Specs"],
        datasets: [{ data: [mm, sd, ss], backgroundColor: [GOLD + "CC", BEAR + "CC", "rgba(136,136,136,0.7)"], borderRadius: 4, borderWidth: 0 }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { raw: number }) => `${c.raw.toFixed(1)}k contracts` } } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "rgba(255,255,255,0.3)", font: { family: "monospace", size: 9 } } },
          y: { grid: { display: false }, ticks: { color: "rgba(255,255,255,0.35)", font: { family: "monospace", size: 9 } } },
        },
      },
    });
    return () => { if (chartRef.current) (chartRef.current as { destroy(): void }).destroy(); };
  }, [data]);

  return (
    <div style={{ ...chartCard, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={lbl}>COT Institutional Positioning</div>
      {data ? (
        <>
          <div style={{ height: 140, position: "relative", flex: 1 }}>
            <canvas ref={ref} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {[
              { color: GOLD,    l: "Mgd Money", v: `${((data.managedMoney ?? 0) / 1000).toFixed(0)}k` },
              { color: BEAR,    l: "Swap Deal",  v: `${((data.swapDealers  ?? 0) / 1000).toFixed(0)}k` },
              { color: NEUTRAL, l: "Sm Specs",   v: `${((data.smallSpecs  ?? 0) / 1000).toFixed(0)}k` },
            ].map(r => (
              <span key={r.l} style={{ ...smText, marginTop: 0, display: "flex", alignItems: "center" }}>
                <Dot color={r.color} />{r.l}: {r.v}
              </span>
            ))}
          </div>
        </>
      ) : <div style={smText}>— unavailable</div>}
    </div>
  );
}

// ── FedWatch Doughnut ─────────────────────────────────────────────────────────

function FedWatchChart({ data }: { data: DashData["fedWatch"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current || !data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) (chartRef.current as { destroy(): void }).destroy();
    chartRef.current = new w.Chart(ref.current, {
      type: "doughnut",
      data: {
        labels: ["Hold", "Cut", "Hike"],
        datasets: [{ data: [data.hold ?? 0, data.cut ?? 0, data.hike ?? 0], backgroundColor: ["#444", BULL + "DD", BEAR + "DD"], borderWidth: 0 }],
      },
      options: {
        cutout: "65%", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { raw: number }) => `${c.raw}%` } } },
      },
    });
    return () => { if (chartRef.current) (chartRef.current as { destroy(): void }).destroy(); };
  }, [data]);

  return (
    <div style={{ ...chartCard, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={lbl}>FedWatch — Next FOMC</div>
      {data ? (
        <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
          <div style={{ height: 140, width: 140, flexShrink: 0, position: "relative" }}>
            <canvas ref={ref} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { color: "#444", l: "Hold", v: data.hold },
              { color: BULL,   l: "Cut",  v: data.cut  },
              { color: BEAR,   l: "Hike", v: data.hike },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Dot color={r.color} />
                <span style={{ ...smText, marginTop: 0, fontSize: 10 }}>{r.l}</span>
                <span style={{ ...smText, marginTop: 0, fontSize: 13, color: r.color, marginLeft: 4 }}>{r.v ?? "—"}%</span>
              </div>
            ))}
            {data.summary && (
              <div style={{ ...smText, fontSize: 9, color: "rgba(255,255,255,0.22)", lineHeight: 1.5, marginTop: 4 }}>
                {data.summary}
              </div>
            )}
          </div>
        </div>
      ) : <div style={smText}>— unavailable</div>}
    </div>
  );
}

// ── Yield Curve SVG ───────────────────────────────────────────────────────────

function YieldCurveCard({ data }: { data: DashData["yieldCurve"] }) {
  const spread = data?.spread ?? 0;
  const points: number[] = [-0.85,-0.72,-0.65,-0.55,-0.40,-0.28,-0.15,0.05,0.12,0.18,0.22, spread];
  const min = Math.min(...points) - 0.1;
  const max = Math.max(...points) + 0.1;
  const W = 240, H = 80, PAD = 10;
  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const polyline = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const zeroY = toY(0);
  const statusColor = data?.status === "inverted" ? BEAR : data?.status === "flat" ? GOLD : BULL;

  return (
    <div style={chartCard}>
      <AccentLine />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={lbl}>Yield Curve 10Y − 2Y</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...numVal, fontSize: 16, color: statusColor }}>{fmt(spread, 3)}%</span>
          <span style={{ ...smText, fontSize: 9, marginTop: 0, color: statusColor, background: statusColor + "22", padding: "2px 8px", borderRadius: 4 }}>
            {data?.status?.toUpperCase() ?? "—"}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke={BEAR} strokeWidth="0.7" strokeDasharray="3,3" opacity="0.4" />
        <polyline points={polyline} fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={toX(points.length - 1)} cy={toY(spread)} r="3" fill={GOLD} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", ...smText, fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
        <span>6 months ago</span><span>now</span>
      </div>
    </div>
  );
}

// ── Gold / Silver ─────────────────────────────────────────────────────────────

function GoldSilverCard({ data }: { data: DashData["goldSilver"] }) {
  const ratio = data?.ratio ?? 0;
  const MAX = 112;
  const zoneColor = data?.zone === "cheap_gold" ? BULL : data?.zone === "expensive_gold" ? BEAR : GOLD;
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current || !data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) (chartRef.current as { destroy(): void }).destroy();
    chartRef.current = new w.Chart(ref.current, {
      type: "doughnut",
      data: { datasets: [{ data: [ratio, MAX - ratio], backgroundColor: [zoneColor + "DD", "rgba(255,255,255,0.04)"], borderWidth: 0 }] },
      options: { cutout: "70%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    });
    return () => { if (chartRef.current) (chartRef.current as { destroy(): void }).destroy(); };
  }, [data, ratio, zoneColor]);

  return (
    <div style={{ ...chartCard, display: "flex", gap: 16, alignItems: "center" }}>
      <AccentLine />
      <div style={{ height: 90, width: 90, flexShrink: 0, position: "relative" }}>
        {data ? <canvas ref={ref} /> : null}
      </div>
      <div>
        <div style={lbl}>Gold / Silver Ratio</div>
        <div style={{ ...numVal, color: zoneColor }}>{fmt(ratio, 1)}</div>
        <div style={{ ...smText, color: zoneColor, fontSize: 10 }}>{data?.zone?.replace("_", " ") ?? "—"}</div>
        <div style={{ ...smText, fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 8, lineHeight: 1.7 }}>
          <span style={{ color: BULL }}>{"<70"}</span> cheap ·{" "}
          <span style={{ color: GOLD }}>70–85</span> normal ·{" "}
          <span style={{ color: BEAR }}>{">85"}</span> exp.
        </div>
      </div>
    </div>
  );
}

// ── ETF Flows ─────────────────────────────────────────────────────────────────

function ETFFlowsCard({ data }: { data: DashData["etfFlows"] }) {
  const signalColor = data?.signal === "accumulation" ? BULL : data?.signal === "distribution" ? BEAR : NEUTRAL;

  function Sparkline({ pct, color }: { pct: number | null; color: string }) {
    const v = pct ?? 0;
    const pts = [-1.2,-0.8,-0.3,0.1,0.5,v].map((x, i) => `${24 + i * 30},${28 - x * 5}`).join(" ");
    return (
      <svg viewBox="0 0 200 40" width="100%" height="30" style={{ display: "block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={24 + 5 * 30} cy={28 - v * 5} r="2.5" fill={color} />
      </svg>
    );
  }

  return (
    <div style={{ ...chartCard, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={lbl}>ETF Flows — GLD / IAU</div>
      {data ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Dot color={GOLD} />
            <span style={{ ...smText, marginTop: 0, fontSize: 10 }}>
              GLD 5d: {data.gld5d != null ? `${data.gld5d > 0 ? "+" : ""}${data.gld5d.toFixed(1)}%` : "—"}
            </span>
          </div>
          <Sparkline pct={data.gld5d} color={GOLD} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 2 }}>
            <Dot color={NEUTRAL} />
            <span style={{ ...smText, marginTop: 0, fontSize: 10 }}>
              IAU 5d: {data.iau5d != null ? `${data.iau5d > 0 ? "+" : ""}${data.iau5d.toFixed(1)}%` : "—"}
            </span>
          </div>
          <Sparkline pct={data.iau5d} color={NEUTRAL} />

          <div style={{ ...numVal, fontSize: 12, color: signalColor, marginTop: 10, letterSpacing: "0.1em" }}>
            {data.signal?.toUpperCase() ?? "—"}
          </div>
        </>
      ) : <div style={smText}>— unavailable</div>}
    </div>
  );
}

// ── Narrative Intelligence ────────────────────────────────────────────────────

function NarrativeCard() {
  const metrics = [
    { label: "Phase",      value: "—",      color: GOLD    },
    { label: "Velocity",   value: "—",      color: NEUTRAL },
    { label: "Confluence", value: "—",      color: NEUTRAL },
    { label: "Catalyst",   value: "—",      color: NEUTRAL },
  ];

  return (
    <div style={{ ...chartCard, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={lbl}>Narrative Intelligence</div>

      {/* 2×2 metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ ...smText, marginTop: 0, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase" }}>{m.label}</div>
            <div style={{ ...numVal, fontSize: 14, color: m.color, marginTop: 4 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Liquidation progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ ...smText, marginTop: 0, fontSize: 9, marginBottom: 4 }}>Spec Liquidation Progress</div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "0%", background: GOLD, borderRadius: 2 }} />
        </div>
      </div>

      {/* Top catalyst */}
      <div style={{ ...smText, fontSize: 10, color: "rgba(255,255,255,0.28)", lineHeight: 1.6, marginTop: "auto" }}>
        Ask the AI for a full analysis to get the current narrative score, phase, and velocity.
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MarketDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartJsReady, setChartJsReady] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if ((window as unknown as { Chart?: unknown }).Chart) { setChartJsReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload = () => setChartJsReady(true);
    document.head.appendChild(script);
  }, []);

  async function load() {
    try {
      const r = await fetch("/api/dashboard");
      if (r.ok) setData(await r.json());
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  void chartJsReady;

  const p  = data?.price;
  const b  = data?.bias;
  const ry = data?.realYield;
  const ryColor = (ry?.value ?? 0) > 1 ? BEAR : (ry?.value ?? 0) < 0 ? BULL : GOLD;
  const lastUpdate = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : null;

  return (
    <section style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 20px" }}>

      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: BULL, display: "inline-block", flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }} />
        <span style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
          Live · {data?.session?.session ?? "—"} · {lastUpdate ?? "—"}
        </span>
      </div>

      {loading ? (
        <div style={{ ...smText, color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 12 }}>Loading market data…</div>
      ) : (
        <>
          {/* ── MARKET STATE ── */}
          <SectionDivider title="Market State" />

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
            gap: 10,
          }}>
            <KPICard
              title="XAUUSD"
              main={p?.price != null ? p.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
              sub={p?.changePct}
              mainColor={GOLD}
            />
            <KPICard
              title="Bias / Score"
              main={b?.bias?.toUpperCase() ?? "—"}
              sub={b?.confluenceScore != null ? `${b.confluenceScore}/9 confluence` : undefined}
              mainColor={b ? biasColor(b.bias) : NEUTRAL}
            />
            <KPICard
              title="Real Yield 10Y"
              main={ry?.value != null ? `${ry.value.toFixed(2)}%` : "—"}
              sub={ry?.trend ? `↕ ${ry.trend}` : undefined}
              mainColor={ryColor}
            />
            <KPICard
              title="Session"
              main={data?.session?.session ?? "—"}
              sub={data?.session ? `${data.session.sessionStart}–${data.session.sessionEnd} UTC` : undefined}
            />
            <KPICard
              title="Next Event"
              main={data?.nextEvent?.title
                ? (data.nextEvent.title.length > 18 ? data.nextEvent.title.slice(0, 16) + "…" : data.nextEvent.title)
                : "—"}
              sub={data?.nextEvent ? `${data.nextEvent.hoursUntil.toFixed(1)}h · ${data.nextEvent.impact}` : undefined}
              mainColor={data?.nextEvent?.impact === "HIGH" ? BEAR : "#F5F0E8"}
            />
          </div>

          {/* ── INSTITUTIONAL POSITIONING ── */}
          <SectionDivider title="Institutional Positioning" />

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr",
            gap: 10,
          }}>
            <COTChart      data={data?.cot       ?? null} />
            <FedWatchChart data={data?.fedWatch  ?? null} />
            <YieldCurveCard data={data?.yieldCurve ?? null} />
          </div>

          {/* ── NARRATIVE & FLOWS ── */}
          <SectionDivider title="Narrative & Flows" />

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1.2fr",
            gap: 10,
          }}>
            <GoldSilverCard data={data?.goldSilver ?? null} />
            <ETFFlowsCard   data={data?.etfFlows   ?? null} />
            <NarrativeCard />
          </div>
        </>
      )}
    </section>
  );
}
