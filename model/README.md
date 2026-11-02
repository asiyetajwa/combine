# Combine energy models

Open, rerunnable models behind the [Evidence Log](../evidence.html).
Every number they produce is a model result under labelled assumptions,
not a measurement. No labs are testing Combine today.

| File | What it is |
|---|---|
| `energy_model_v1.py` | Energy model v1: hourly, year-long energy budget of one node, 54 scenarios. Assumptions A1 to A8 are in its header. |
| `results/energy_model_v1_results.csv` | v1 results, as published on 2 November 2026 |
| `crosscheck_g1.py` | Gate G1: v1 cross-checked against pvlib and NREL SAM on real hourly weather |
| `G1-crosscheck.md` | What the cross-check found, what holds and what changes |
| `results/g1_*.csv` | Cross-check results: annual energy, monthly energy, and every v1 scenario rerun |
| `data/` | Cached weather: PVGIS typical meteorological years and NASA POWER climatology |

Run:

```bash
pip install -r requirements.txt
python crosscheck_g1.py               # checks itself against v1's published results first
python energy_model_v1.py             # regenerates results/energy_model_v1_results.csv
```

Weather data: PVGIS (European Commission Joint Research Centre) and NASA
POWER (NASA Langley Research Center), both free to reuse with attribution.
