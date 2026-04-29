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

const cardBase: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(15,15,15,0.95), rgba(8,8,8,0.95))",
  border: "0.5px solid rgba(201,162,39,0.2)",
  borderRadius: 8,
  padding: "12px 14px",
  position: "relative",
  overflow: "hidden",
};

const lbl: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
  color: "rgba(201,162,39,0.55)", marginBottom: 6,
};

const num: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 20, fontWeight: 600, color: "#F5F0E8", lineHeight: "1.1",
};

const sm: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 10, color: "rgba(255,255,255,0.32)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function AccentLine() {
  return <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.35), transparent)" }} />;
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color, marginRight: 5, flexShrink: 0 }} />;
}

function fmt(n: number | null | undefined, dec = 2): string {
  return n == null ? "—" : n.toFixed(dec);
}

function biasColor(b: string) {
  const l = b.toLowerCase();
  return l.includes("bull") ? BULL : l.includes("bear") ? BEAR : NEUTRAL;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ title, main, sub, mainColor = "#F5F0E8" }: { title: string; main: string; sub?: string; mainColor?: string }) {
  return (
    <div style={cardBase}>
      <AccentLine />
      <div style={lbl}>{title}</div>
      <div style={{ ...num, color: mainColor }}>{main}</div>
      {sub && <div style={{ ...sm, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── COT Chart ─────────────────────────────────────────────────────────────────

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
        labels: ["Mgd Money", "Swap Deal", "Sm Specs"],
        datasets: [{ data: [mm, sd, ss], backgroundColor: [GOLD + "CC", BEAR + "CC", "rgba(136,136,136,0.7)"], borderRadius: 3, borderWidth: 0 }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { raw: number }) => `${c.raw.toFixed(1)}k` } } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "rgba(255,255,255,0.3)", font: { family: "monospace", size: 8 } } },
          y: { grid: { display: false }, ticks: { color: "rgba(255,255,255,0.35)", font: { family: "monospace", size: 8 } } },
        },
      },
    });
    return () => { if (chartRef.current) (chartRef.current as { destroy(): void }).destroy(); };
  }, [data]);

  return (
    <div style={{ ...cardBase, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={lbl}>COT Positioning</div>
      {data
        ? <div style={{ flex: 1, minHeight: 100, position: "relative" }}><canvas ref={ref} /></div>
        : <div style={{ ...sm, marginTop: 4 }}>— unavailable</div>}
    </div>
  );
}

// ── FedWatch Chart ────────────────────────────────────────────────────────────

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
    <div style={{ ...cardBase, display: "flex", flexDirection: "column" }}>
      <AccentLine />
      <div style={lbl}>FedWatch — FOMC</div>
      {data ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minHeight: 0 }}>
          <div style={{ height: 100, width: 100, flexShrink: 0, position: "relative" }}><canvas ref={ref} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[{ color: "#444", l: "Hold", v: data.hold }, { color: BULL, l: "Cut", v: data.cut }, { color: BEAR, l: "Hike", v: data.hike }].map(r => (
              <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Dot color={r.color} />
                <span style={{ ...sm, fontSize: 9 }}>{r.l}</span>
                <span style={{ ...sm, fontSize: 11, color: r.color, marginLeft: 4 }}>{r.v ?? "—"}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : <div style={{ ...sm, marginTop: 4 }}>— unavailable</div>}
    </div>
  );
}

// ── Yield Curve ───────────────────────────────────────────────────────────────

function YieldCurveCard({ data }: { data: DashData["yieldCurve"] }) {
  const spread = data?.spread ?? 0;
  const points: number[] = [-0.85,-0.72,-0.65,-0.55,-0.40,-0.28,-0.15,0.05,0.12,0.18,0.22, spread];
  const min = Math.min(...points) - 0.1;
  const max = Math.max(...points) + 0.1;
  const W = 180, H = 70, PAD = 8;
  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const polyline = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const zeroY = toY(0);
  const statusColor = data?.status === "inverted" ? BEAR : data?.status === "flat" ? GOLD : BULL;

  return (
    <div style={cardBase}>
      <AccentLine />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={lbl}>Yield Curve 10Y-2Y</div>
        <div style={{ ...sm, fontSize: 11, color: statusColor, fontWeight: 600 }}>{fmt(spread, 3)}%</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke={BEAR} strokeWidth="0.7" strokeDasharray="3,3" opacity="0.4" />
        <polyline points={polyline} fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={toX(points.length - 1)} cy={toY(spread)} r="2.5" fill={GOLD} />
      </svg>
      <div style={{ ...sm, fontSize: 9, color: statusColor, background: statusColor + "22", padding: "2px 7px", borderRadius: 4, display: "inline-block", marginTop: 4 }}>
        {data?.status?.toUpperCase() ?? "—"}
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
    <div style={{ ...cardBase, display: "flex", gap: 10, alignItems: "center" }}>
      <AccentLine />
      <div style={{ height: 80, width: 80, flexShrink: 0, position: "relative" }}>
        {data ? <canvas ref={ref} /> : null}
      </div>
      <div>
        <div style={lbl}>Gold / Silver</div>
        <div style={{ ...num, fontSize: 18, color: zoneColor }}>{fmt(ratio, 1)}</div>
        <div style={{ ...sm, fontSize: 9, color: zoneColor, marginTop: 3 }}>{data?.zone?.replace("_", " ") ?? "—"}</div>
      </div>
    </div>
  );
}

// ── ETF Flows ─────────────────────────────────────────────────────────────────

function ETFFlowsCard({ data }: { data: DashData["etfFlows"] }) {
  const signalColor = data?.signal === "accumulation" ? BULL : data?.signal === "distribution" ? BEAR : NEUTRAL;

  function Sparkline({ pct, color }: { pct: number | null; color: string }) {
    const v = pct ?? 0;
    const pts = [-1.2,-0.8,-0.3,0.1,0.5,v].map((x, i) => `${20 + i * 26},${25 - x * 5}`).join(" ");
    return (
      <svg viewBox="0 0 175 35" width="100%" height="24" style={{ display: "block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={20 + 5 * 26} cy={25 - v * 5} r="2" fill={color} />
      </svg>
    );
  }

  return (
    <div style={cardBase}>
      <AccentLine />
      <div style={lbl}>ETF Flows GLD / IAU</div>
      {data ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
            <Dot color={GOLD} />
            <span style={{ ...sm, fontSize: 9 }}>GLD 5d: {data.gld5d != null ? `${data.gld5d > 0 ? "+" : ""}${data.gld5d.toFixed(1)}%` : "—"}</span>
          </div>
          <Sparkline pct={data.gld5d} color={GOLD} />
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1, marginTop: 3 }}>
            <Dot color={NEUTRAL} />
            <span style={{ ...sm, fontSize: 9 }}>IAU 5d: {data.iau5d != null ? `${data.iau5d > 0 ? "+" : ""}${data.iau5d.toFixed(1)}%` : "—"}</span>
          </div>
          <Sparkline pct={data.iau5d} color={NEUTRAL} />
          <div style={{ ...sm, fontSize: 10, color: signalColor, marginTop: 4, fontWeight: 600, letterSpacing: "0.08em" }}>
            {data.signal?.toUpperCase() ?? "—"}
          </div>
        </>
      ) : <div style={{ ...sm, marginTop: 4 }}>— unavailable</div>}
    </div>
  );
}

// ── Mobile hook ───────────────────────────────────────────────────────────────

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

  const p = data?.price;
  const b = data?.bias;
  const ry = data?.realYield;
  const ryColor = (ry?.value ?? 0) > 1 ? BEAR : (ry?.value ?? 0) < 0 ? BULL : GOLD;
  const lastUpdate = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : null;

  return (
    <section style={{
      width: "100%",
      maxWidth: 1400,
      margin: "0 auto",
      padding: "24px 20px",
      borderBottom: "1px solid rgba(201,162,39,0.12)",
    }}>

      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: BULL, display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
        <span style={{ ...lbl, fontSize: 9, color: "rgba(255,255,255,0.28)", marginBottom: 0 }}>
          {data?.session?.session ?? "LIVE"} · {lastUpdate ?? "—"}
        </span>
      </div>

      {loading ? (
        <div style={{ ...sm, color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Loading market data…</div>
      ) : (
        <>
          {/* ROW 1 — 5 KPI cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
            gap: 10,
            marginBottom: 10,
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

          {/* ROW 2 — 5 chart cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr 1fr 1fr",
            gap: 10,
          }}>
            <div style={{ minHeight: 160 }}><COTChart data={data?.cot ?? null} /></div>
            <div style={{ minHeight: 160 }}><FedWatchChart data={data?.fedWatch ?? null} /></div>
            <div style={{ minHeight: 160 }}><YieldCurveCard data={data?.yieldCurve ?? null} /></div>
            <div style={{ minHeight: 160 }}><GoldSilverCard data={data?.goldSilver ?? null} /></div>
            <div style={{ minHeight: 160 }}><ETFFlowsCard data={data?.etfFlows ?? null} /></div>
          </div>
        </>
      )}
    </section>
  );
}
