#!/usr/bin/env python
"""Quick test: collect 30 days of news to verify GDELT integration."""
from datetime import datetime, timedelta
from news_pipeline.news_collector import GDELTCollector

collector = GDELTCollector()

# Test with recent 30 days
end_date = datetime.now()
start_date = end_date - timedelta(days=30)

print(f"Testing GDELT collection for {start_date.date()} to {end_date.date()}")
print("This should complete in <30 seconds if GDELT is accessible...\n")

try:
    df = collector.download_historical(start_date=start_date, end_date=end_date)
    print(f"\nSUCCESS: Collected {len(df):,} articles")
    print(f"  If >500 articles: GDELT is working, proceed to full 2020-2025 collection")
    print(f"  If <100 articles: Check GDELT API availability")
except Exception as e:
    print(f"\nERROR: {e}")
    print("  Fallback: Check GDELT API status or use alternative source")
