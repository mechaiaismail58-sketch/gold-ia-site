// Fed policy context — SOFR vs target spread as FedWatch proxy

export type FedWatchContext = {
  current_target_upper: number | null;
  sofr: number | null;
  effective_rate: number | null;
  tga_balance_bn: number | null;
  next_meeting_bias: "hike" | "cut" | "hold" | "unknown";
  policy_note: string;
  liquidity_note: string;
  summary: string;
};

export function buildFedWatchContext(params: {
  targetUpper: number | null;
  sofr: number | null;
  effectiveRate: number | null;
  tgaBalance: number | null;
}): FedWatchContext {
  const { targetUpper, sofr, effectiveRate, tgaBalance } = params;

  let next_meeting_bias: FedWatchContext["next_meeting_bias"] = "unknown";
  const parts: string[] = [];

  if (targetUpper != null) {
    const floor = targetUpper - 0.25;
    parts.push(`Fed target: ${floor.toFixed(2)}–${targetUpper.toFixed(2)}%`);

    if (sofr != null) {
      const spread = sofr - floor;
      if (spread < -0.30) {
        next_meeting_bias = "cut";
        parts.push(`SOFR ${sofr.toFixed(2)}% — well below floor → market pricing rate cuts`);
      } else if (spread > 0.15) {
        next_meeting_bias = "hike";
        parts.push(`SOFR ${sofr.toFixed(2)}% — above floor → tight funding, hike risk`);
      } else {
        next_meeting_bias = "hold";
        parts.push(`SOFR ${sofr.toFixed(2)}% — aligned with target floor → hold expected`);
      }
    } else if (effectiveRate != null) {
      const diff = effectiveRate - targetUpper;
      if (diff < -0.20) next_meeting_bias = "cut";
      else if (diff > 0.15) next_meeting_bias = "hike";
      else next_meeting_bias = "hold";
      parts.push(`Effective rate ${effectiveRate.toFixed(2)}%`);
    }
  }

  const policy_note =
    next_meeting_bias === "cut"
      ? "Rate cut expected — bullish gold (lower opportunity cost)"
      : next_meeting_bias === "hike"
      ? "Hike risk — bearish gold (higher opportunity cost)"
      : next_meeting_bias === "hold"
      ? "Fed on hold — neutral, watch for guidance"
      : "Fed policy path uncertain";

  parts.push(policy_note);

  let liquidity_note = "";
  if (tgaBalance != null) {
    const tga_bn = tgaBalance / 1e9;
    if (tga_bn > 700) {
      liquidity_note = `TGA $${tga_bn.toFixed(0)}B — high balance, drawdown would inject liquidity (gold supportive)`;
    } else if (tga_bn < 200) {
      liquidity_note = `TGA $${tga_bn.toFixed(0)}B — near-empty, refill risk would drain liquidity (gold headwind)`;
    } else {
      liquidity_note = `TGA $${tga_bn.toFixed(0)}B — normal level`;
    }
    parts.push(liquidity_note);
  }

  return {
    current_target_upper: targetUpper,
    sofr,
    effective_rate: effectiveRate,
    tga_balance_bn: tgaBalance != null ? tgaBalance / 1e9 : null,
    next_meeting_bias,
    policy_note,
    liquidity_note,
    summary: parts.join(" | "),
  };
}
