# BullionDesk — AI Senior Trading Advisor

BullionDesk is an institutional-grade AI trading advisor for serious traders. It analyses market structure, macro context, and risk conditions across all asset classes — Forex, Metals, Indices, Futures, Energy.

## What BullionDesk does

- **Complete market analysis** across all asset classes — not just gold
- **Real-time tradability score** — know when conditions favor trading
- **Prop firm monitoring** — FTMO, The5ers, Apex, E8, FundedNext and more
- **Risk management** adapted to your account and current phase
- **Psychological pattern detection** — revenge trading, FOMO, overtrading
- **Trade journal** — log outcomes and build a disciplined track record

## What BullionDesk does NOT do

- No trade signals
- No entry prices, stop losses, or take profit levels
- No performance claims
- No predictions

BullionDesk helps you navigate uncertainty like a professional. You make the decisions.

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (auth, trades, conversations, account snapshots)
- **Anthropic Claude** (claude-opus-4-6, streaming SSE)
- **Stripe** (beta access payments)
- **Vercel** (deployment, edge functions)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.local.example` for required variables (Supabase, Anthropic, Stripe, Twelve Data, FRED, Polygon, Notion).

---

Not investment advice. Trade at your own risk.
