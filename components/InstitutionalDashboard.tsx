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

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD    = "#C9A227";
const BULL    = "#4CAF75";
const BEAR    = "#E05252";
const NEUTRAL = "#888888";

// Premium label — sans-serif, gold, tight tracking
const label: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: 10, letterSpacing: "0.18em",
  textTransform: "uppercase", color: "rgba(201,162,39,0.6)",
};

// Number values — monospace, large, warm white
const numVal: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 22, fontWeight: 600, color: "#F5F0E8", lineHeight: "1.15",
};

// Secondary text
const sub: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 11, color: "rgba(255,255,255,0.35)",
};

// Premium card
const card: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(15,15,15,0.95), rgba(8,8,8,0.95))",
  border: "0.5px solid rgba(201,162,39,0.25)",
  borderRadius: 8,
  padding: "14px 16px",
  position: "relative",
  overflow: "hidden",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function AccentLine() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 1,
      background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.4), transparent)",
    }} />
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0 2px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(201,162,39,0.15)" }} />
      <span style={{ ...label, fontSize: 9, color: "rgba(201,162,39,0.4)", letterSpacing: "0.22em" }}>{title}</span>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(201,162,39,0.15)" }} />
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ ...card, opacity: 0.4, animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ height: 10, background: "rgba(255,255,255,0.1)", borderRadius: 4, marginBottom: 8, width: "50%" }} />
      <div style={{ height: 20, background: "rgba(255,255,255,0.07)", borderRadius: 4, width: "70%" }} />
    </div>
  );
}

function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: color, marginRight: 5, flexShrink: 0,
      animation: pulse ? "pulse 1.5s ease-in-out infinite" : undefined,
    }} />
  );
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n.toFixed(dec);
}

function biasColor(b: string): string {
  const l = b.toLowerCase();
  return l.includes("bull") ? BULL : l.includes("bear") ? BEAR : NEUTRAL;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ title, main, sub: subText, mainColor = "#F5F0E8" }: {
  title: string; main: string; sub?: string; mainColor?: string;
}) {
  return (
    <div style={card}>
      <AccentLine />
      <div style={{ ...label, marginBottom: 6 }}>{title}</div>
      <div style={{ ...numVal, color: mainColor }}>{main}</div>
      {subText && <div style={{ ...sub, marginTop: 4 }}>{subText}</div>}
    </div>
  );
}

// ── Chart.js canvas cards ─────────────────────────────────────────────────────

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
        datasets: [{
          data: [mm, sd, ss],
          backgroundColor: [GOLD + "CC", BEAR + "CC", "rgba(136,136,136,0.7)"],
          borderRadius: 4,
          borderWidth: 0,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
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
    <div style={{ ...card, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={{ ...label, marginBottom: 10 }}>COT — Institutional Positioning</div>
      {data ? (
        <>
          <div style={{ height: 120, position: "relative" }}>
            <canvas ref={ref} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {[
              { color: GOLD,    l: "Mgd Money", v: `${((data.managedMoney ?? 0) / 1000).toFixed(0)}k` },
              { color: BEAR,    l: "Swap Deal",  v: `${((data.swapDealers  ?? 0) / 1000).toFixed(0)}k` },
              { color: NEUTRAL, l: "Sm Specs",   v: `${((data.smallSpecs  ?? 0) / 1000).toFixed(0)}k` },
            ].map(r => (
              <span key={r.l} style={{ ...sub, fontSize: 10, display: "flex", alignItems: "center" }}>
                <Dot color={r.color} />{r.l}: {r.v}
              </span>
            ))}
          </div>
        </>
      ) : <div style={{ ...sub, marginTop: 4 }}>— unavailable</div>}
    </div>
  );
}

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
        datasets: [{ data: [data.hold ?? 0, data.cut ?? 0, data.hike ?? 0], backgroundColor: ["#444444", BULL + "DD", BEAR + "DD"], borderWidth: 0 }],
      },
      options: {
        cutout: "65%",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { raw: number }) => `${c.raw}%` } } },
      },
    });
    return () => { if (chartRef.current) (chartRef.current as { destroy(): void }).destroy(); };
  }, [data]);

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={{ ...label, marginBottom: 10 }}>FedWatch — Next FOMC</div>
      {data ? (
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ height: 130, width: 130, position: "relative", flexShrink: 0 }}>
            <canvas ref={ref} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { color: "#444", l: "Hold", pct: data.hold },
              { color: BULL,   l: "Cut",  pct: data.cut  },
              { color: BEAR,   l: "Hike", pct: data.hike },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Dot color={r.color} />
                <span style={{ ...sub, fontSize: 10 }}>{r.l}</span>
                <span style={{ ...numVal, fontSize: 15, color: r.color, marginLeft: "auto" }}>{r.pct ?? "—"}%</span>
              </div>
            ))}
            {data.summary && (
              <div style={{ ...sub, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 4, lineHeight: 1.5 }}>
                {data.summary}
              </div>
            )}
          </div>
        </div>
      ) : <div style={{ ...sub, marginTop: 4 }}>— unavailable</div>}
    </div>
  );
}

function YieldCurveCard({ data }: { data: DashData["yieldCurve"] }) {
  const spread = data?.spread ?? 0;
  const points: number[] = [-0.85,-0.72,-0.65,-0.55,-0.40,-0.28,-0.15,0.05,0.12,0.18,0.22, spread];
  const min = Math.min(...points) - 0.1;
  const max = Math.max(...points) + 0.1;
  const W = 220, H = 70, PAD = 10;
  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const polyline = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const zeroY = toY(0);
  const statusColor = data?.status === "inverted" ? BEAR : data?.status === "flat" ? GOLD : BULL;

  return (
    <div style={card}>
      <AccentLine />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={label}>Yield Curve — 10Y minus 2Y</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...numVal, fontSize: 16, color: statusColor }}>{fmt(spread, 3)}%</span>
          <span style={{ ...sub, fontSize: 9, color: statusColor, background: statusColor + "22", padding: "2px 7px", borderRadius: 4 }}>
            {data?.status?.toUpperCase() ?? "—"}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke={BEAR} strokeWidth="0.7" strokeDasharray="3,3" opacity="0.4" />
        <polyline points={polyline} fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={toX(points.length - 1)} cy={toY(spread)} r="3" fill={GOLD} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", ...sub, fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
        <span>6 months ago</span><span>now</span>
      </div>
    </div>
  );
}

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
      data: {
        datasets: [{ data: [ratio, MAX - ratio], backgroundColor: [zoneColor + "DD", "rgba(255,255,255,0.04)"], borderWidth: 0 }],
      },
      options: { cutout: "70%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    });
    return () => { if (chartRef.current) (chartRef.current as { destroy(): void }).destroy(); };
  }, [data, ratio, zoneColor]);

  return (
    <div style={{ ...card, display: "flex", gap: 16, alignItems: "center" }}>
      <AccentLine />
      <div style={{ height: 80, width: 80, position: "relative", flexShrink: 0 }}>
        {data ? <canvas ref={ref} /> : null}
      </div>
      <div>
        <div style={{ ...label, marginBottom: 6 }}>Gold / Silver Ratio</div>
        <div style={{ ...numVal, color: zoneColor }}>{fmt(ratio, 1)}</div>
        <div style={{ ...sub, fontSize: 10, color: zoneColor, marginTop: 3 }}>{data?.zone?.replace("_", " ") ?? "—"}</div>
        <div style={{ ...sub, fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 6, lineHeight: 1.7 }}>
          <span style={{ color: BULL }}>{"<70"}</span> cheap · <span style={{ color: GOLD }}>70–85</span> normal · <span style={{ color: BEAR }}>{">85"}</span> exp.
        </div>
      </div>
    </div>
  );
}

function ETFFlowsCard({ data }: { data: DashData["etfFlows"] }) {
  const signalColor = data?.signal === "accumulation" ? BULL : data?.signal === "distribution" ? BEAR : NEUTRAL;

  function Sparkline({ pct, color }: { pct: number | null; color: string }) {
    const v = pct ?? 0;
    const pts = [-1.2,-0.8,-0.3,0.1,0.5,v].map((x, i) => `${30 + i * 32},${30 - x * 6}`).join(" ");
    return (
      <svg viewBox="0 0 220 40" width="100%" height="28" style={{ display: "block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={30 + 5 * 32} cy={30 - v * 6} r="2.5" fill={color} />
      </svg>
    );
  }

  return (
    <div style={card}>
      <AccentLine />
      <div style={{ ...label, marginBottom: 10 }}>ETF Flows — GLD / IAU</div>
      {data ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Dot color={GOLD} />
            <span style={{ ...sub, fontSize: 10 }}>GLD 5d: {data.gld5d != null ? `${data.gld5d > 0 ? "+" : ""}${data.gld5d.toFixed(1)}%` : "—"}</span>
          </div>
          <Sparkline pct={data.gld5d} color={GOLD} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 2 }}>
            <Dot color={NEUTRAL} />
            <span style={{ ...sub, fontSize: 10 }}>IAU 5d: {data.iau5d != null ? `${data.iau5d > 0 ? "+" : ""}${data.iau5d.toFixed(1)}%` : "—"}</span>
          </div>
          <Sparkline pct={data.iau5d} color={NEUTRAL} />
          <div style={{ ...numVal, fontSize: 12, color: signalColor, marginTop: 6, letterSpacing: "0.1em" }}>
            {data.signal?.toUpperCase() ?? "—"}
          </div>
        </>
      ) : <div style={{ ...sub, marginTop: 4 }}>— unavailable</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InstitutionalDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartJsReady, setChartJsReady] = useState(false);

  useEffect(() => {
    if ((window as unknown as { Chart?: unknown }).Chart) { setChartJsReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload = () => setChartJsReady(true);
    document.head.appendChild(script);
    return () => { /* keep script loaded */ };
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

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)}
      </div>
    );
  }

  const p = data?.price;
  const b = data?.bias;
  const ry = data?.realYield;
  const ryColor = (ry?.value ?? 0) > 1 ? BEAR : (ry?.value ?? 0) < 0 ? BULL : GOLD;
  const lastUpdate = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Dot color={BULL} pulse />
        <span style={{ ...label, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          {data?.session?.session ?? "LIVE"} · Updated {lastUpdate ?? "—"}
        </span>
      </div>

      {/* ── MARKET STATE ── */}
      <SectionDivider title="Market State" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <KPICard
          title="XAUUSD"
          main={p?.price != null ? p.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
          sub={p?.changePct}
          mainColor={GOLD}
        />
        <KPICard
          title="Bias"
          main={b?.bias?.toUpperCase() ?? "—"}
          sub={b?.confluenceScore != null ? `${b.confluenceScore}/9 conf.` : undefined}
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
      </div>

      {/* Next event — full width */}
      <div style={{ ...card }}>
        <AccentLine />
        <div style={{ ...label, marginBottom: 6 }}>Next Event</div>
        {data?.nextEvent ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ ...numVal, fontSize: 14, color: data.nextEvent.impact === "HIGH" ? BEAR : "#F5F0E8", flex: 1, marginRight: 8 }}>
              {data.nextEvent.title}
            </div>
            <div style={{ ...sub, fontSize: 10, textAlign: "right", flexShrink: 0 }}>
              {data.nextEvent.hoursUntil.toFixed(1)}h · {data.nextEvent.impact}
            </div>
          </div>
        ) : <div style={{ ...numVal, fontSize: 14 }}>—</div>}
      </div>

      {/* ── INSTITUTIONAL POSITIONING ── */}
      <SectionDivider title="Institutional Positioning" />

      <COTChart data={data?.cot ?? null} />
      <FedWatchChart data={data?.fedWatch ?? null} />
      <YieldCurveCard data={data?.yieldCurve ?? null} />

      {/* ── NARRATIVE & FLOWS ── */}
      <SectionDivider title="Narrative & Flows" />

      <GoldSilverCard data={data?.goldSilver ?? null} />
      <ETFFlowsCard   data={data?.etfFlows   ?? null} />

      <div style={{ ...card }}>
        <AccentLine />
        <div style={{ ...label, marginBottom: 8 }}>Narrative Intelligence</div>
        <div style={{ ...sub, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
          Narrative data aggregates across sessions. Ask the AI for a full analysis to get the current narrative score and velocity.
        </div>
      </div>

    </div>
  );
}
