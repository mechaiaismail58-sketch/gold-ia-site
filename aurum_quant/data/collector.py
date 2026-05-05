"""DataCollector — fetch and cache the macro panel for ASFM calibration.

Sources
-------
* XAU/USD (GC=F), DXY (DX-Y.NYB), VIX (^VIX), GVZ (^GVZ), WTI (CL=F)
    via :mod:`yfinance` (free, daily OHLCV).
* US 10y real rate (TIPS, FRED ``DFII10``) via :mod:`fredapi`.
* CFTC Disaggregated COT report (gold COMEX, code ``088691``) via direct CSV
    download.

Each series is cached on disk in ``data/cache/<series>.csv`` with a sidecar
``<series>.meta.json`` recording the download timestamp.  When ``fetch_all``
is called and the cache is < ``CACHE_MAX_AGE_HOURS`` old, the cached copy is
used and the network call is skipped.

The class returns a single merged ``pandas.DataFrame`` indexed by the gold
trading-day calendar with all series forward-filled (daily) or linearly
interpolated (weekly COT resampled to daily).
"""
from __future__ import annotations

import io
import json
import logging
import time
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import requests

from .. import config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CacheEntry:
    csv_path: Path
    meta_path: Path

    def is_fresh(self, max_age_hours: float) -> bool:
        if not self.csv_path.exists() or not self.meta_path.exists():
            return False
        try:
            meta = json.loads(self.meta_path.read_text(encoding="utf-8"))
            ts = datetime.fromisoformat(meta["downloaded_at"])
            age = datetime.now(timezone.utc) - ts
            return age < timedelta(hours=max_age_hours)
        except Exception:
            return False

    def write(self, frame: pd.DataFrame, source: str) -> None:
        frame.to_csv(self.csv_path, index=True)
        self.meta_path.write_text(
            json.dumps(
                {
                    "downloaded_at": datetime.now(timezone.utc).isoformat(),
                    "source": source,
                    "rows": int(len(frame)),
                    "columns": list(map(str, frame.columns)),
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def read(self) -> pd.DataFrame:
        return pd.read_csv(self.csv_path, index_col=0, parse_dates=[0])


def _entry(name: str) -> CacheEntry:
    return CacheEntry(
        csv_path=config.CACHE_DIR / f"{name}.csv",
        meta_path=config.CACHE_DIR / f"{name}.meta.json",
    )


# ---------------------------------------------------------------------------
# DataCollector
# ---------------------------------------------------------------------------
class DataCollector:
    """Download / cache / align all input series required by ASFM."""

    def __init__(
        self,
        start: str = config.START_DATE,
        end: Optional[str] = None,
        fred_api_key: str = config.FRED_API_KEY,
        cache_max_age_hours: float = config.CACHE_MAX_AGE_HOURS,
    ) -> None:
        self.start = start
        self.end = end or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.fred_api_key = fred_api_key
        self.cache_max_age_hours = cache_max_age_hours

    # ------------------------------------------------------------------
    # Per-source fetchers
    # ------------------------------------------------------------------
    def _yahoo(self, ticker: str, name: str) -> pd.DataFrame:
        entry = _entry(name)
        if entry.is_fresh(self.cache_max_age_hours):
            log.info("[cache] %s (yahoo:%s)", name, ticker)
            return entry.read()
        try:
            import yfinance as yf

            print(f"  ↓ Yahoo: {ticker:<10s} ({name})")
            df = yf.download(
                ticker,
                start=self.start,
                end=self.end,
                progress=False,
                auto_adjust=False,
            )
            if df.empty:
                raise RuntimeError(f"yfinance returned empty for {ticker}")
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            df.index = pd.to_datetime(df.index).tz_localize(None)
            entry.write(df, source=f"yfinance:{ticker}")
            return df
        except Exception as exc:  # pragma: no cover - network path
            log.error("Yahoo fetch failed for %s: %s", ticker, exc)
            if entry.csv_path.exists():
                log.warning("Falling back to stale cache for %s", name)
                return entry.read()
            raise

    def _fred(self, series_id: str, name: str) -> pd.DataFrame:
        entry = _entry(name)
        if entry.is_fresh(self.cache_max_age_hours):
            log.info("[cache] %s (fred:%s)", name, series_id)
            return entry.read()
        if not self.fred_api_key or self.fred_api_key == "YOUR_FRED_API_KEY_HERE":
            log.warning(
                "FRED_API_KEY not set — skipping %s. "
                "Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html",
                series_id,
            )
            return pd.DataFrame()
        try:
            from fredapi import Fred

            print(f"  ↓ FRED:  {series_id:<10s} ({name})")
            fred = Fred(api_key=self.fred_api_key)
            ser = fred.get_series(series_id, observation_start=self.start, observation_end=self.end)
            df = ser.to_frame(name=series_id)
            df.index = pd.to_datetime(df.index).tz_localize(None)
            entry.write(df, source=f"fred:{series_id}")
            return df
        except Exception as exc:  # pragma: no cover
            log.error("FRED fetch failed for %s: %s", series_id, exc)
            if entry.csv_path.exists():
                return entry.read()
            return pd.DataFrame()

    def _cftc(self) -> pd.DataFrame:
        """Download CFTC Disaggregated COT and isolate gold COMEX (088691).

        The CFTC currently distributes the disaggregated history as compressed
        annual zip archives.  We try the direct text endpoint first and fall
        back to historical zip if that fails.
        """
        entry = _entry("cftc_gold")
        if entry.is_fresh(self.cache_max_age_hours):
            log.info("[cache] cftc_gold")
            return entry.read()
        # CFTC provides two comprehensive historical ZIPs plus a current-year file.
        try:
            print("  ↓ CFTC:  disaggregated COT history (gold 088691)")
            frames = []
            hist_urls = [
                "https://www.cftc.gov/files/dea/history/fut_disagg_txt_hist_2006_2016.zip",
                "https://www.cftc.gov/files/dea/history/fut_disagg_txt_2017_2024.zip",
            ]
            current_year = datetime.now(timezone.utc).year
            # add current year + previous year for recency
            for yr in range(max(2024, current_year - 1), current_year + 1):
                hist_urls.append(f"https://www.cftc.gov/files/dea/history/fut_disagg_txt_{yr}.zip")
            for zip_url in hist_urls:
                try:
                    rz = requests.get(zip_url, timeout=90)
                    rz.raise_for_status()
                    with zipfile.ZipFile(io.BytesIO(rz.content)) as zf:
                        inner = [n for n in zf.namelist() if n.endswith(".txt")][0]
                        with zf.open(inner) as fh:
                            frames.append(pd.read_csv(fh, low_memory=False))
                except Exception as exc_url:
                    log.debug("CFTC ZIP %s skipped: %s", zip_url, exc_url)
            if not frames:
                raise RuntimeError("No CFTC ZIP archives downloaded")
            df = pd.concat(frames, ignore_index=True)
        except Exception as exc:
            log.error("CFTC fetch failed (%s) — returning empty frame", exc)
            if entry.csv_path.exists():
                return entry.read()
            return pd.DataFrame()

        # Locate the report-date column (varies between CFTC schemas).
        date_col = next(
            (c for c in df.columns if "Report_Date_as_YYYY-MM-DD" in c or "Report_Date" in c),
            None,
        )
        code_col = next((c for c in df.columns if "CFTC_Contract_Market_Code" in c), None)
        if date_col is None or code_col is None:
            log.error("CFTC schema unexpected — columns=%s", list(df.columns)[:10])
            return pd.DataFrame()

        df = df[df[code_col].astype(str).str.strip() == config.CFTC_GOLD_CODE].copy()
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.dropna(subset=[date_col])
        # Multiple year files may produce duplicate report dates; keep one row per date.
        df = df.sort_values(date_col).drop_duplicates(subset=[date_col], keep="last")
        df = df.set_index(date_col).sort_index()

        # Net managed-money position (proxy for speculative positioning).
        long_col = next(
            (c for c in df.columns if c.startswith("M_Money_Positions_Long")), None
        )
        short_col = next(
            (c for c in df.columns if c.startswith("M_Money_Positions_Short")), None
        )
        if long_col is None or short_col is None:
            log.error("CFTC managed-money columns missing — schema drift")
            return pd.DataFrame()

        out = pd.DataFrame(
            {
                "cot_mm_long": pd.to_numeric(df[long_col], errors="coerce"),
                "cot_mm_short": pd.to_numeric(df[short_col], errors="coerce"),
            }
        )
        out["cot_net_long"] = out["cot_mm_long"] - out["cot_mm_short"]
        entry.write(out, source="cftc:disagg")
        return out

    def _yahoo_intraday(
        self, ticker: str, name: str, interval: str = "1h",
        intraday_start: Optional[str] = None,
    ) -> pd.DataFrame:
        """Fetch intraday OHLCV in 58-day chunks to respect yfinance history limits."""
        cache_name = f"{name}_intraday_{interval.replace('/', '_')}"
        entry = _entry(cache_name)
        if entry.is_fresh(self.cache_max_age_hours):
            log.info("[cache] %s intraday %s", name, interval)
            return entry.read()
        try:
            import yfinance as yf
            from datetime import timedelta as _td

            start_str = intraday_start or config.INTRADAY_START
            start_dt = datetime.strptime(start_str, "%Y-%m-%d")
            end_dt = datetime.strptime(self.end, "%Y-%m-%d")
            chunk = config.INTRADAY_CHUNK_DAYS
            frames = []
            cur = start_dt
            while cur < end_dt:
                chunk_end = min(cur + _td(days=chunk), end_dt)
                try:
                    df = yf.download(
                        ticker,
                        start=cur.strftime("%Y-%m-%d"),
                        end=chunk_end.strftime("%Y-%m-%d"),
                        interval=interval,
                        progress=False,
                        auto_adjust=False,
                    )
                    if not df.empty:
                        if isinstance(df.columns, pd.MultiIndex):
                            df.columns = df.columns.get_level_values(0)
                        df.index = pd.to_datetime(df.index).tz_localize(None)
                        frames.append(df)
                except Exception as exc_c:
                    log.debug("intraday chunk %s skipped: %s", cur.date(), exc_c)
                cur = chunk_end
            if not frames:
                raise RuntimeError(f"All intraday chunks empty for {ticker}")
            result = pd.concat(frames).drop_duplicates().sort_index()
            entry.write(result, source=f"yfinance:{ticker}:{interval}")
            print(f"  ↓ Intraday {interval}: {ticker}  {len(result):,} bars "
                  f"({result.index[0].date()} to {result.index[-1].date()})")
            return result
        except Exception as exc:
            log.error("Intraday fetch failed for %s: %s", ticker, exc)
            if entry.csv_path.exists():
                log.warning("Falling back to stale cache for %s", cache_name)
                return entry.read()
            return pd.DataFrame()

    def fetch_intraday_gold(self, start: str = config.INTRADAY_START) -> pd.DataFrame:
        """Fetch 1h gold bars for real OFI computation and Class C window testing."""
        return self._yahoo_intraday(
            config.TICKER_GOLD_INTRADAY, "gold", interval="1h", intraday_start=start,
        )

    def fetch_intraday_1h(self) -> pd.DataFrame:
        """Fetch last 730 days of 1h GC=F bars for Class C window validation.

        Cached as pickle (``gold_1h.pkl``) to preserve timezone-safe datetimes.
        Index: datetime_utc (UTC-naive Timestamp). Columns: open, high, low, close, volume.
        """
        pkl_path = config.CACHE_DIR / "gold_1h.pkl"
        meta_path = config.CACHE_DIR / "gold_1h.meta.json"

        if pkl_path.exists() and meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                ts = datetime.fromisoformat(meta["downloaded_at"])
                if datetime.now(timezone.utc) - ts < timedelta(hours=self.cache_max_age_hours):
                    log.info("[cache] gold 1h (gold_1h.pkl)")
                    return pd.read_pickle(pkl_path)
            except Exception:
                pass

        try:
            import yfinance as yf

            print(f"  [1h] fetching {config.TICKER_GOLD_INTRADAY}  period=730d")
            df = yf.download(
                config.TICKER_GOLD_INTRADAY,
                period="730d",
                interval="1h",
                progress=False,
                auto_adjust=False,
            )
            if df.empty:
                raise RuntimeError("yfinance 1h returned empty DataFrame")
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            # Normalise to UTC-naive datetime
            if hasattr(df.index, "tz") and df.index.tz is not None:
                df.index = df.index.tz_convert("UTC").tz_localize(None)
            else:
                df.index = pd.to_datetime(df.index)
            df.index.name = "datetime_utc"
            df = df[["Open", "High", "Low", "Close", "Volume"]].rename(columns=str.lower)
            df = df.dropna(how="all").sort_index()
            df.to_pickle(pkl_path)
            meta_path.write_text(
                json.dumps({
                    "downloaded_at": datetime.now(timezone.utc).isoformat(),
                    "source": f"yfinance:{config.TICKER_GOLD_INTRADAY}:1h:730d",
                    "rows": int(len(df)),
                    "start": str(df.index[0]),
                    "end": str(df.index[-1]),
                }, indent=2),
                encoding="utf-8",
            )
            print(f"    {len(df):,} bars  {df.index[0].date()} → {df.index[-1].date()}")
            return df
        except Exception as exc:
            log.error("1h fetch failed: %s", exc)
            if pkl_path.exists():
                log.warning("Falling back to stale 1h cache")
                return pd.read_pickle(pkl_path)
            return pd.DataFrame()

    # ------------------------------------------------------------------
    # Top-level orchestration
    # ------------------------------------------------------------------
    def fetch_all(self) -> pd.DataFrame:
        """Fetch every series and return the aligned merged frame."""
        print(f"\n[DataCollector] {self.start} to {self.end}")
        t0 = time.time()

        gold = self._yahoo(config.TICKER_GOLD, "gold")
        dxy = self._yahoo(config.TICKER_DXY, "dxy")
        vix = self._yahoo(config.TICKER_VIX, "vix")
        gvz = self._yahoo(config.TICKER_GVZ, "gvz")
        wti = self._yahoo(config.TICKER_WTI, "wti")
        rates = self._fred(config.FRED_REAL_RATE, "real_rate_10y")
        cot = self._cftc()

        if gold.empty:
            raise RuntimeError("Gold price series unavailable — aborting")

        # Align everything to gold's trading-day calendar.
        idx = gold.index

        merged = pd.DataFrame(index=idx)
        merged["gold_open"] = gold["Open"]
        merged["gold_high"] = gold["High"]
        merged["gold_low"] = gold["Low"]
        merged["gold_close"] = gold["Close"]
        merged["gold_volume"] = gold["Volume"]

        for src, col_in, col_out in [
            (dxy, "Close", "dxy"),
            (vix, "Close", "vix"),
            (gvz, "Close", "gvz"),
            (wti, "Close", "wti"),
        ]:
            if not src.empty and col_in in src.columns:
                merged[col_out] = src[col_in].reindex(idx).ffill()
            else:
                merged[col_out] = np.nan

        if not rates.empty:
            merged["real_rate_10y"] = rates.iloc[:, 0].reindex(idx).ffill()
        else:
            merged["real_rate_10y"] = np.nan

        if not cot.empty:
            cot_d = cot.reindex(idx).interpolate(method="time", limit_direction="both")
            for c in ("cot_mm_long", "cot_mm_short", "cot_net_long"):
                if c in cot_d.columns:
                    merged[c] = cot_d[c]

        # Final daily forward-fill for any tiny gaps left over (holiday mismatch).
        merged = merged.ffill()

        elapsed = time.time() - t0
        n_missing = merged.isna().sum().sum()
        print(
            f"[DataCollector] merged frame: {len(merged):,} rows × "
            f"{merged.shape[1]} cols ({n_missing} NaN remaining) in {elapsed:.1f}s"
        )
        return merged

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------
    @staticmethod
    def summary(frame: pd.DataFrame) -> None:
        print(f"\nDate range : {frame.index.min().date()} -> {frame.index.max().date()}")
        print(f"Rows       : {len(frame):,}")
        print("Missing per column:")
        for col, n in frame.isna().sum().items():
            print(f"  {col:<22s} {n:>6d}")
