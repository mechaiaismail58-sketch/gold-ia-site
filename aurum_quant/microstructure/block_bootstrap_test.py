#!/usr/bin/env python
"""Block bootstrap permutation test for autocorrelation-preserving validation."""
from __future__ import annotations

import logging
import numpy as np
import pandas as pd
from typing import Tuple

log = logging.getLogger(__name__)


class BlockBootstrapTester:
    """
    Permutation test with block bootstrap to preserve time-series autocorrelation.

    Reference: López de Prado et al. on autocorrelation-robust testing.

    Key idea: Instead of permuting individual observations (destroys autocorr),
    permute blocks of contiguous observations (preserves local autocorr).
    """

    def __init__(self, block_size: int = 60):
        """
        Args:
            block_size: Size of blocks (in minutes for 1-minute data)
                       60 min ≈ market microstructure autocorr window
        """
        self.block_size = block_size

    def run_block_bootstrap_test(
        self,
        signals: np.ndarray,  # Binary signal array (0/1)
        returns: np.ndarray,  # Forward returns (%)
        n_perms: int = 1000,
        seed: int = 42,
    ) -> dict:
        """
        Block bootstrap permutation test.

        Args:
            signals: Binary signal array (0 or 1)
            returns: Forward returns corresponding to each observation
            n_perms: Number of permutations
            seed: Random seed for reproducibility

        Returns:
            dict with real_hr, perm_hrs, p_value, and detailed diagnostics
        """
        np.random.seed(seed)

        # Real hit rate (on non-NaN returns only)
        valid_idx = ~np.isnan(returns) & (signals == 1)
        if valid_idx.sum() == 0:
            return {"real_hr": np.nan, "p_value": np.nan, "perm_hrs": [], "error": "No signals"}

        real_hr = (returns[valid_idx] > 0).mean()
        n_obs = len(signals)
        n_blocks = int(np.ceil(n_obs / self.block_size))

        # Permutation: shuffle blocks, not individual observations
        perm_hrs = []
        for perm_idx in range(n_perms):
            # Create random permutation of block indices
            block_order = np.random.permutation(n_blocks)

            # Reconstruct signal array by concatenating permuted blocks
            perm_signals = []
            for old_block_idx in block_order:
                start_old = old_block_idx * self.block_size
                end_old = min(start_old + self.block_size, n_obs)
                perm_signals.append(signals[start_old:end_old])

            perm_signals = np.concatenate(perm_signals)[:n_obs]  # Trim to original length

            # Recompute hit rate on permuted data
            perm_valid = ~np.isnan(returns) & (perm_signals == 1)
            if perm_valid.sum() > 0:
                perm_hr = (returns[perm_valid] > 0).mean()
                perm_hrs.append(perm_hr)

        perm_hrs = np.array(perm_hrs)

        # P-value: fraction of permutations with HR >= real HR
        p_value = (perm_hrs >= real_hr).mean()

        return {
            "real_hr": real_hr,
            "perm_hrs": perm_hrs.tolist(),
            "p_value": p_value,
            "n_signals": valid_idx.sum(),
            "n_perms_executed": len(perm_hrs),
            "perm_mean": perm_hrs.mean(),
            "perm_std": perm_hrs.std(),
        }


def compare_permutation_tests(
    signals: np.ndarray, returns: np.ndarray, n_perms: int = 1000
) -> dict:
    """
    Compare naive permutation test vs. block bootstrap.

    Returns:
        dict with results for both methods
    """
    np.random.seed(42)

    # Naive permutation: shuffle signal labels individually
    valid_idx = ~np.isnan(returns) & (signals == 1)
    if valid_idx.sum() == 0:
        return {"error": "No signals"}

    real_hr = (returns[valid_idx] > 0).mean()

    # Naive test
    naive_perm_hrs = []
    for _ in range(n_perms):
        perm_signals = np.random.permutation(signals)
        perm_valid = ~np.isnan(returns) & (perm_signals == 1)
        if perm_valid.sum() > 0:
            perm_hr = (returns[perm_valid] > 0).mean()
            naive_perm_hrs.append(perm_hr)

    naive_perm_hrs = np.array(naive_perm_hrs)
    naive_p = (naive_perm_hrs >= real_hr).mean()

    # Block bootstrap test
    bb_tester = BlockBootstrapTester(block_size=60)
    bb_result = bb_tester.run_block_bootstrap_test(signals, returns, n_perms=n_perms, seed=42)

    return {
        "real_hr": real_hr,
        "naive": {
            "p_value": naive_p,
            "perm_mean": naive_perm_hrs.mean(),
            "perm_std": naive_perm_hrs.std(),
        },
        "block_bootstrap": bb_result,
        "comparison": {
            "naive_p": naive_p,
            "bb_p": bb_result["p_value"],
            "same_conclusion": (naive_p < 0.05) == (bb_result["p_value"] < 0.05),
        },
    }
