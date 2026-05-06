# News Pipeline for Gold Market Edge Testing

**Objective**: Test if LLM-analyzed gold news generates a statistically significant edge (p < 0.05) for predicting 1-day and 5-day gold returns using rigorous block bootstrap permutation testing.

**Key Constraint**: Learn from VPIN errors — strict train/test split, no calibration on OOS, block bootstrap permutation.

---

## Pipeline Architecture

### ÉTAPE 1: News Collection (COMPLETED)

**Status**: ✓ Complete  
**Source**: GDELT Project (fallback: synthetic news for testing)  
**Output**: `aurum_quant/data/cache/news/gdelt_gold.csv`  
**Records**: 8,089 headlines (2020-2026)

```bash
# If GDELT API available:
python news_pipeline/news_collector.py

# Fallback (used in this implementation):
python news_pipeline/news_collector_fallback.py
```

**Columns**:
- `timestamp_utc`: Publication time
- `title`: Headline text
- `source`: News source (Reuters, Bloomberg, etc.)
- `tone`: GDELT sentiment score (-10 to +10)
- `url`: Article URL

---

### ÉTAPE 2: LLM Analysis (READY — requires Claude API)

**Status**: ⏳ Ready to run  
**Model**: claude-haiku-4-5-20251001 (cost: ~$1-2 for full 8k headlines)  
**Output**: `aurum_quant/data/cache/news/gdelt_gold_analyzed.csv`

```bash
# Analyze all headlines (add Claude API key first):
export ANTHROPIC_API_KEY=sk-...
python news_pipeline/llm_analyzer.py
```

**For each headline, Claude classifies**:
- `direction`: LONG / SHORT / NEUTRAL (impact on XAUUSD)
- `magnitude`: SMALL / MEDIUM / LARGE
- `timeframe`: INTRADAY / SHORT_TERM / LONG_TERM
- `confidence`: 0-100 certainty score
- `reasoning`: One-sentence explanation

**Classification rules** (built into prompt):
- **LONG (gold up)**: Dovish Fed, weak USD, inflation, geopolitical risk, lower real rates
- **SHORT (gold down)**: Hawkish Fed, strong USD, deflation, higher real rates
- **NEUTRAL**: Mixed or ambiguous signals

---

### ÉTAPE 3: Daily Signal Construction (READY)

**Status**: ✓ Ready to run  
**Output**: `aurum_quant/data/cache/news/daily_news_signal.csv`

```bash
python news_pipeline/signal_builder.py
```

**Daily aggregation**:

For each trading day, compute:

```
daily_score = sum(direction_sign × magnitude_factor × confidence) / sum(magnitude_factor × confidence)

Where:
  direction_sign = +1 (LONG), -1 (SHORT), 0 (NEUTRAL)
  magnitude_factor = {SMALL: 1, MEDIUM: 2, LARGE: 4}
  daily_score ∈ [-1, +1]
```

**Daily features**:
- `daily_score`: Aggregated directional signal
- `news_count_24h`: Total articles per day
- `news_intensity`: Sum of weighted magnitudes
- `news_polarization`: Variance of directions (high = contested)
- `large_news_count`: Count of LARGE magnitude news
- `fed_news_count`: Count of Fed/policy-related news
- `mean_confidence`: Average LLM confidence

---

### ÉTAPE 4: Train/OOS Split (NEXT)

**Calibration period**: 2020-01-01 → 2024-06-30 (4.5 years, 75%)  
**Test period (OOS)**: 2024-07-01 → 2026-05-01 (~2 years, 25%)

**On training data only**:
- Calculate 80th percentile of `daily_score` → LONG threshold
- Calculate 20th percentile of `daily_score` → SHORT threshold
- Identify optimal `news_intensity` for signal confidence

**On OOS data**:
- Apply train thresholds **without any re-optimization**
- Generate signals: LONG if score > 80th, SHORT if score < 20th
- Measure actual forward returns

---

### ÉTAPE 5: Edge Test with Permutation (NEXT)

**Methodology**: Block bootstrap permutation testing (learn from VPIN)

**Block bootstrap**:
- Block size: 21 days (preserves market autocorrelation)
- Iterations: 10,000
- For each iteration:
  1. Divide OOS returns into 21-day blocks
  2. Shuffle block order randomly
  3. Recompute mean return on permuted returns
  4. Compare to observed mean return

**Tests**:

1. **Primary edge test**: Hit rate by horizon (1d, 3d, 5d, 10d)
   - p-value from block bootstrap
   - Confidence intervals from permutation distribution

2. **Cross-asset robustness**:
   - Apply same pipeline to EURUSD and SP500
   - If edge appears everywhere → data mining artifact
   - If edge gold-specific → real signal

3. **Temporal stability**:
   - Split OOS into 3 subperiods (6-month chunks)
   - Hit rate should be consistent across all 3
   - If unstable → curve-fitted signal

4. **Baseline comparison**:
   - Naive momentum: LONG if 5-day return > 0
   - Compare news edge vs. momentum edge
   - News should beat momentum by >5pp to be valuable

---

## Success Criteria

### PRODUCTION READY
- p < 0.01 on block bootstrap OOS for ≥1 horizon
- Hit rate stable >55% across 3 subperiods
- Edge gold-specific (fails on EURUSD/SP500)
- Outperforms momentum baseline by >5pp

### MARGINAL EDGE (combine with others)
- 0.01 < p < 0.05 on block bootstrap OOS
- Hit rate stable >52% on 2/3 subperiods
- Gold-specific edge
- Beats momentum by 3-5pp

### NO EDGE (abandon)
- p > 0.05 on all horizons
- Hit rate unstable or <52%
- Edge not gold-specific

---

## Quick Start

### Step 1: Generate synthetic news
```bash
python news_pipeline/news_collector_fallback.py
# Output: aurum_quant/data/cache/news/gdelt_gold.csv (8,089 headlines)
```

### Step 2: Analyze with Claude (requires API key)
```bash
export ANTHROPIC_API_KEY=sk-...
python news_pipeline/llm_analyzer.py
# Output: aurum_quant/data/cache/news/gdelt_gold_analyzed.csv
```

### Step 3: Build daily signals
```bash
python news_pipeline/signal_builder.py
# Output: aurum_quant/data/cache/news/daily_news_signal.csv
```

### Step 4: Train/OOS edge testing (next iteration)
```bash
# Coming next:
python news_pipeline/edge_test_news.py
# Output: news_edge_report.md (final verdict)
```

---

## Architecture Constraints (from VPIN lessons)

✓ **No OOS calibration**: All thresholds computed on train period only  
✓ **Block bootstrap**: Permutation test preserves autocorrelation  
✓ **Cross-asset validation**: Test on EURUSD, SP500 for data-mining check  
✓ **Temporal stability**: Check hit rate across 3 subperiods  
✓ **Baseline comparison**: Must beat naive momentum  

**If any constraint is violated**, the edge is considered data-snooped and not production-ready.

---

## Cost Estimate

- **GDELT news collection**: Free (unlimited historical)
- **Claude API analysis**: ~$1-2 for 8,089 headlines
- **Computing**: <10 min for full pipeline (local)

**Total**: Effectively free to validate entire pipeline.

---

## Files Generated

```
aurum_quant/data/cache/news/
├── gdelt_gold.csv                    # Raw news (ÉTAPE 1)
├── gdelt_gold_analyzed.csv           # LLM classifications (ÉTAPE 2)
└── daily_news_signal.csv             # Daily aggregates (ÉTAPE 3)

(ÉTAPE 4-5 outputs pending):
├── daily_news_signal_train.csv       # Train period splits
├── daily_news_signal_oos.csv         # OOS period splits
└── news_edge_report.md               # Final verdict
```

---

## Next Steps

1. Run Steps 1-3 to generate daily signals
2. Implement ÉTAPE 4: `edge_test_news.py` with train/OOS split
3. Implement ÉTAPE 5: Block bootstrap and final verdict
4. Document results in `news_edge_report.md`

If edge passes all criteria → production candidate  
If edge fails → archive as research artifact with lessons learned
