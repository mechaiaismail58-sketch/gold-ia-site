#!/usr/bin/env python
"""ÉTAPE 2: Analyze news with Claude API for directional signals."""
from __future__ import annotations

import sys
from pathlib import Path
import logging
import json
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
import anthropic

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class LLMNewsAnalyzer:
    """Analyze gold news headlines with Claude API."""

    def __init__(self, model: str = "claude-haiku-4-5-20251001"):
        """Initialize with Claude API."""
        self.client = anthropic.Anthropic()
        self.model = model
        self.analyses_count = 0

    def analyze_headline(self, title: str, source: str, timestamp: datetime) -> dict:
        """
        Analyze a single headline for directional impact on gold.

        Returns:
            dict with direction, magnitude, timeframe, confidence, reasoning
        """
        prompt = f"""You are a gold market analyst. Analyze this headline and predict its directional impact on XAUUSD spot price.

Headline: {title}
Source: {source}
Date: {timestamp.strftime('%Y-%m-%d')}

Respond ONLY with valid JSON (no markdown, no extra text):
{{
  "direction": "LONG" or "SHORT" or "NEUTRAL",
  "magnitude": "SMALL" or "MEDIUM" or "LARGE",
  "timeframe": "INTRADAY" or "SHORT_TERM" or "LONG_TERM",
  "confidence": <0-100 integer>,
  "reasoning": "<one sentence explaining the impact>"
}}

Analysis framework:
- LONG signals: hawkish Fed = negative for gold; dovish Fed = positive for gold; weak USD = positive for gold; inflation = positive for gold; geopolitical risk = positive for gold
- SHORT signals: higher real rates = negative for gold; strong USD = negative for gold; deflation = negative for gold
- Consider impact on US dollar, real interest rates, and risk sentiment
- Confidence 0-100: how certain you are about direction"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text.strip()

            # Try to parse JSON
            analysis = json.loads(response_text)

            # Validate required fields
            required_fields = ["direction", "magnitude", "timeframe", "confidence", "reasoning"]
            if not all(field in analysis for field in required_fields):
                log.warning(f"    Missing fields in response: {analysis}")
                return self._default_analysis()

            self.analyses_count += 1
            return analysis

        except json.JSONDecodeError as e:
            log.warning(f"    Failed to parse JSON: {e}")
            return self._default_analysis()
        except anthropic.APIError as e:
            log.error(f"    API error: {e}")
            return self._default_analysis()

    @staticmethod
    def _default_analysis() -> dict:
        """Return neutral default analysis."""
        return {
            "direction": "NEUTRAL",
            "magnitude": "SMALL",
            "timeframe": "SHORT_TERM",
            "confidence": 0,
            "reasoning": "Analysis failed, defaulting to neutral",
        }

    def analyze_batch(self, df: pd.DataFrame, batch_size: int = 100, output_path: Path | None = None) -> pd.DataFrame:
        """
        Analyze all headlines in batch.

        Args:
            df: DataFrame with [timestamp_utc, title, source, tone, url]
            batch_size: Process this many before saving checkpoint
            output_path: Path to save analyzed results

        Returns:
            DataFrame with analysis results appended
        """
        if output_path is None:
            output_path = Path(__file__).parent.parent / "aurum_quant" / "data" / "cache" / "news"

        output_path.mkdir(parents=True, exist_ok=True)
        output_file = output_path / "gdelt_gold_analyzed.csv"

        log.info("=" * 80)
        log.info("LLM ANALYSIS — Claude API")
        log.info("=" * 80)
        log.info(f"\nAnalyzing {len(df):,} headlines")
        log.info(f"Model: {self.model}")
        log.info(f"Estimated cost: ${len(df) * 0.00015 * 150 / 1_000_000:.2f} (150 tokens per call)")

        # Prepare output dataframe
        df_analyzed = df.copy()
        analyses = []

        for idx, row in df.iterrows():
            if idx % batch_size == 0:
                log.info(f"  [{idx}/{len(df)}] {(100*idx/len(df)):.1f}% complete...")

            analysis = self.analyze_headline(row["title"], row["source"], row["timestamp_utc"])
            analyses.append(analysis)

            # Checkpoint every batch_size
            if (idx + 1) % batch_size == 0:
                df_with_analysis = df.iloc[: idx + 1].copy()
                for key in ["direction", "magnitude", "timeframe", "confidence", "reasoning"]:
                    df_with_analysis[f"llm_{key}"] = [a.get(key) for a in analyses]

                df_with_analysis.to_csv(output_file, index=False)
                log.info(f"    Checkpoint saved: {output_file}")

        # Final save
        for key in ["direction", "magnitude", "timeframe", "confidence", "reasoning"]:
            df_analyzed[f"llm_{key}"] = [a.get(key) for a in analyses]

        df_analyzed.to_csv(output_file, index=False)

        log.info(f"\n" + "=" * 80)
        log.info(f"ANALYSIS COMPLETE")
        log.info("=" * 80)
        log.info(f"\nFile: {output_file}")
        log.info(f"Total analyzed: {self.analyses_count:,} headlines")
        log.info(f"\nDirection distribution:")
        for direction, count in df_analyzed["llm_direction"].value_counts().items():
            log.info(f"  {direction}: {count} ({100*count/len(df_analyzed):.1f}%)")

        return df_analyzed


if __name__ == "__main__":
    # Load news
    news_file = Path(__file__).parent.parent / "aurum_quant" / "data" / "cache" / "news" / "gdelt_gold.csv"

    if not news_file.exists():
        log.error(f"News file not found: {news_file}")
        log.info("Run news_collector_fallback.py first to generate synthetic news")
        sys.exit(1)

    log.info(f"Loading news from {news_file}")
    df = pd.read_csv(news_file)
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"])

    log.info(f"Loaded {len(df):,} headlines")

    # Analyze with Claude (small batch for testing)
    analyzer = LLMNewsAnalyzer(model="claude-haiku-4-5-20251001")

    # For testing: analyze first 100 headlines only
    df_test = df.head(100)
    log.info(f"\nAnalyzing first 100 headlines for testing...")

    df_analyzed = analyzer.analyze_batch(df_test)

    log.info(f"\n✓ Sample analysis complete")
    log.info(f"Analyze full {len(df):,} headlines by removing .head(100) limit")
