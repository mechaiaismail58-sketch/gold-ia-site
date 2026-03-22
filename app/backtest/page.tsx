import PerformanceChart from "./PerformanceChart";

type NotionPage = any;

function getProperty(page: NotionPage, names: string[]) {
  for (const name of names) { if (page?.properties?.[name]) return page.properties[name]; }
  return null;
}
function getTitle(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  return prop?.type === "title" ? prop.title?.map((i: any) => i.plain_text).join("") || "" : "";
}
function getSelect(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "status") return prop.status?.name || "";
  if (prop.type === "rich_text") return prop.rich_text?.map((i: any) => i.plain_text).join("") || "";
  return "";
}
function getDate(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  return prop?.type === "date" ? prop.date?.start || "" : "";
}
function getCheckbox(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return false;
  if (prop.type === "checkbox") return !!prop.checkbox;
  if (prop.type === "formula" && prop.formula?.type === "boolean") return !!prop.formula.boolean;
  return false;
}
function getNumber(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return null;
  if (prop.type === "number") return typeof prop.number === "number" ? prop.number : null;
  if (prop.type === "formula" && prop.formula?.type === "number") return typeof prop.formula.number === "number" ? prop.formula.number : null;
  if (prop.type === "rich_text") {
    const text = prop.rich_text?.map((i: any) => i.plain_text).join("") || "";
    const parsed = parseFloat(text.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function getBacktestData() {
  const notionRes = await fetch(
    `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ page_size: 100, sorts: [{ property: "Date", direction: "descending" }] }),
      cache: "no-store",
    }
  );

  if (!notionRes.ok) return { trades: [], stats: { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalR: 0, avgR: 0 } };

  const data = await notionRes.json();
  const trades = (data.results || []).map((page: NotionPage) => {
    const rawResult = getSelect(page, ["Result", "Outcome", "Status"]);
    const isWin = getCheckbox(page, ["Is Win", "Win"]);
    const isLoss = getCheckbox(page, ["Is Loss", "Loss"]);
    const result = rawResult === "win" || isWin ? "Win" : rawResult === "loss" || isLoss ? "Loss" : rawResult;
    const rawRR = getNumber(page, ["RR", "R", "Profit", "R Multiple", "RR Multiple"]);
    const rr = result === "Win" ? (rawRR ?? 0) : result === "Loss" ? -1 : 0;
    return {
      id: page.id,
      title: getTitle(page, ["Trade", "Name", "Title"]),
      date: getDate(page, ["Date", "Trade Date"]),
      direction: getSelect(page, ["Direction", "Bias", "Side"]),
      setup: getSelect(page, ["Setup", "Setup Type"]),
      result, rr,
      emotion: getSelect(page, ["Emotion"]),
    };
  });

  const totalTrades = trades.length;
  const wins = trades.filter((t: any) => t.result === "Win").length;
  const losses = trades.filter((t: any) => t.result === "Loss").length;
  const totalR = trades.reduce((sum: number, t: any) => sum + (t.rr || 0), 0);
  return {
    trades,
    stats: { totalTrades, wins, losses, winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0, totalR, avgR: totalTrades > 0 ? totalR / totalTrades : 0 },
  };
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default async function BacktestPage() {
  const data = await getBacktestData();
  const trades = data.trades ?? [];
  const stats = data.stats ?? {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalR: 0,
    avgR: 0,
  };

  return (
    <main>
      <section className="card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_18px_80px_rgba(109,40,217,0.18)]">
        <div className="flex flex-col gap-4">
          <h1 className="text-[28px] sm:text-[34px] leading-[1.15] tracking-[-0.02em]">
            Verified gold backtest performance, structured through a disciplined framework.
          </h1>

          <p className="text-[color:var(--muted)] max-w-[60ch] leading-6">
            Live-synced historical trades from the Bullion Desk system, designed to validate signal quality, execution discipline, and risk-adjusted performance.
          </p>

          <div className="flex gap-3 flex-wrap mt-2">
            <div className="rounded-2xl px-3 py-1 text-xs card border-[rgba(109,40,217,0.5)]">
              Live Notion Sync
            </div>
            <div className="rounded-2xl px-3 py-1 text-xs card border-[rgba(200,162,74,0.35)]">
              XAUUSD Only
            </div>
            <div className="rounded-2xl px-3 py-1 text-xs card border-[rgba(109,40,217,0.35)]">
              Risk-Adjusted
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="card rounded-3xl p-5 border border-white/10" style={{ borderLeft: "2px solid rgba(212,175,55,0.35)" }}>
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Total Trades
          </div>
          <div className="mt-3 text-3xl text-white/90">{stats.totalTrades}</div>
        </div>

        <div className="card rounded-3xl p-5 border border-white/10" style={{ borderLeft: "2px solid rgba(212,175,55,0.35)" }}>
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Win Rate
          </div>
          <div className="mt-3 text-3xl text-white/90">{stats.winRate.toFixed(1)}%</div>
        </div>

        <div className="card rounded-3xl p-5 border border-white/10" style={{ borderLeft: "2px solid rgba(212,175,55,0.35)" }}>
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Total R
          </div>
          <div className="mt-3 text-3xl text-white/90">{stats.totalR.toFixed(2)}</div>
        </div>

        <div className="card rounded-3xl p-5 border border-white/10" style={{ borderLeft: "2px solid rgba(212,175,55,0.35)" }}>
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Avg R / Trade
          </div>
          <div className="mt-3 text-3xl text-white/90">{stats.avgR.toFixed(2)}</div>
        </div>
      </section>

      <section className="mt-8">
        <PerformanceChart trades={trades} />
      </section>

      <section className="mt-8">
        <div className="card rounded-3xl p-0 overflow-hidden border border-white/10">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
            <div className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
              Backtest Archive
            </div>

            <div className="text-xs text-[color:var(--muted)]">
              {stats.wins} Wins · {stats.losses} Losses
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm text-white/85">
              <thead className="border-b border-[color:var(--border)] text-xs uppercase tracking-widest text-[color:var(--muted)]">
                <tr>
                  <th className="px-6 py-4 text-left">Date</th>
                  <th className="px-6 py-4 text-left">Trade</th>
                  <th className="px-6 py-4 text-left">Direction</th>
                  <th className="px-6 py-4 text-left">Setup</th>
                  <th className="px-6 py-4 text-left">Result</th>
                  <th className="px-6 py-4 text-left">RR</th>
                  <th className="px-6 py-4 text-left">Emotion</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t: any) => (
                  <tr
                    key={t.id}
                    className="border-b border-white/[0.05] hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4 text-white/60">{formatDate(t.date)}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-[280px] truncate">{t.title || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex px-3 py-1 rounded-2xl text-xs border",
                        t.direction === "BUY" && "text-green-300 border-green-500/30 bg-green-500/10",
                        t.direction === "SELL" && "text-red-300 border-red-500/30 bg-red-500/10"
                      )}>
                        {t.direction || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 rounded-2xl text-xs border border-[rgba(109,40,217,0.35)] bg-[rgba(109,40,217,0.10)]">
                        {t.setup || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex px-3 py-1 rounded-2xl text-xs border",
                        t.result === "Win" && "text-green-300 border-green-500/30 bg-green-500/10",
                        t.result === "Loss" && "text-red-300 border-red-500/30 bg-red-500/10"
                      )}>
                        {t.result || "—"}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 font-medium",
                      t.rr > 0 && "text-green-300",
                      t.rr < 0 && "text-red-300",
                      t.rr === 0 && "text-white/50"
                    )}>
                      {typeof t.rr === "number" ? t.rr.toFixed(2) : "—"}
                    </td>
                    <td className="px-6 py-4 text-white/60">{t.emotion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col divide-y divide-white/[0.05]">
            {trades.map((t: any) => (
              <div key={t.id} className="px-5 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">{formatDate(t.date)}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex px-2.5 py-0.5 rounded-full text-[11px] border",
                      t.direction === "BUY" && "text-green-300 border-green-500/30 bg-green-500/10",
                      t.direction === "SELL" && "text-red-300 border-red-500/30 bg-red-500/10"
                    )}>
                      {t.direction || "—"}
                    </span>
                    <span className={cn(
                      "inline-flex px-2.5 py-0.5 rounded-full text-[11px] border",
                      t.result === "Win" && "text-green-300 border-green-500/30 bg-green-500/10",
                      t.result === "Loss" && "text-red-300 border-red-500/30 bg-red-500/10"
                    )}>
                      {t.result || "—"}
                    </span>
                  </div>
                </div>
                <div className="text-[13px] text-white/85 leading-snug">{t.title || "—"}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] border border-[rgba(109,40,217,0.35)] bg-[rgba(109,40,217,0.10)]">
                    {t.setup || "—"}
                  </span>
                  <span className={cn(
                    "text-[13px] font-medium",
                    t.rr > 0 && "text-green-300",
                    t.rr < 0 && "text-red-300",
                    t.rr === 0 && "text-white/50"
                  )}>
                    RR {typeof t.rr === "number" ? t.rr.toFixed(2) : "—"}
                  </span>
                  {t.emotion && (
                    <span className="text-[11px] text-white/40">{t.emotion}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-8 text-xs text-[color:var(--muted)]">
        Historical results are provided for research and framework validation.
      </footer>
    </main>
  );
}

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}