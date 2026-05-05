"""Aurum Quant — gold-specific quantitative signal generation engine.

Implements the Aurum Stochastic Field Model (ASFM):
    HMM regimes  +  Kalman fair value  +  Heston CIR volatility
    +  Merton-Hawkes coupled jumps  +  PCA macro drift
    +  Dual-Entropy Guard  +  Bai-Perron structural breaks.

See module docstrings in each submodule for the mathematical basis.
"""
__version__ = "0.1.0"
