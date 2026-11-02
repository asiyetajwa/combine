#!/usr/bin/env python3
"""
Combine energy model v1 -- energy-budget and dispatch simulation.

Purpose (EDA Stage 1 prerequisite):
  Produce a first, reproducible system model of a Combine node
  (PV array + battery storage + inverter + accelerator workstation)
  so that energy, latency and memory targets for later stages can be
  set "from a measured system baseline" once hardware measurements
  replace the labelled assumptions used here.

What this model IS:
  - An hourly, 365-day energy-budget simulation.
  - PV energy is driven by a daily global horizontal irradiation (GHI)
    input in kWh/m2/day, distributed over daylight hours with a
    sinusoidal profile. GHI scenarios (4.0 / 5.0 / 6.0) follow the
    bands used on Combine's public solar atlas (NASA POWER
    2001-2020 climatology: <4, 4 to <5, >=5 kWh/m2/day), extended
    with a high case. They are SCENARIOS, not site measurements.
  - A simple battery dispatch: PV serves load first, surplus charges
    the battery, deficits discharge it, the grid covers any remaining
    shortfall (Combine's public concept is solar-ASSISTED: "Grid
    support covers shortfalls when required").
  - Two scheduling strategies for the flexible workload (PEFT
    fine-tuning sessions):
      baseline     -- session starts at a fixed 18:00 every day.
      solar-aware  -- session is placed in the 4 sunniest forecast
                      hours of the day, and is deferred one day if
                      the battery state of charge is below 30% at
                      08:00 and forecast PV cannot cover the session.
                      Deferred sessions are counted, not hidden.

What this model is NOT:
  - Not a pvlib-grade irradiance transposition / single-diode model.
    That upgrade is Sprint Week 2 (pvlib + SAM cross-check).
  - Not a thermal model. Cooling appears only as a flat load adder.
  - Not measured data. Every electrical parameter below is a labelled
    assumption with a source note, to be replaced in Stage 1 profiling.

Assumption register (replace with measurements):
  A1 Workstation under PEFT load: 0.65 kW at the wall
     (600 W accelerator TDP, proposed RTX PRO 6000 Blackwell option,
     + system overhead; PROPOSED hardware, not a committed component).
  A2 Workstation under inference load: 0.35 kW at the wall (assumed).
  A3 Control / idle load: 0.02 kW continuous (assumed).
  A4 Cooling adder: 15% of workstation load (assumed; outdoor tropical
     operation is a known open design question).
  A5 PV system derate (temperature, wiring, inverter, soiling): 0.80,
     matching the 80% collection factor used on Combine's public page.
  A6 Battery round-trip efficiency: 0.90 (assumed, Li-ion class).
  A7 One flexible PEFT session per day demanded, 4 h at A1 load.
     Inference demand: 8 h/day at A2 load, not deferrable.
  A8 Day-to-day weather variability: daily GHI is drawn around the
     scenario mean with sigma 15% (seeded, reproducible). Monthly
     seasonality is NOT modelled in v1.
"""

import csv
import json
import math
import random
from dataclasses import dataclass

# ---------- parameters ----------

@dataclass
class SystemConfig:
    pv_kwp: float          # PV array size, kWp
    battery_kwh: float     # usable battery capacity, kWh
    ghi: float             # scenario daily GHI, kWh/m2/day

PEFT_KW = 0.65 * 1.15      # A1 + A4 cooling adder
INFER_KW = 0.35 * 1.15     # A2 + A4
IDLE_KW = 0.02             # A3
PEFT_HOURS = 4
INFER_HOURS = 8
DERATE = 0.80              # A5
BATT_EFF = 0.90            # A6
DAYS = 365

# ---------- solar profile ----------

def hourly_pv_kw(cfg: SystemConfig, daily_ghi: float, rng: random.Random):
    """Return 24 hourly PV outputs (kW) for one day.

    Daylight window 06:00-18:00, sinusoidal shape normalised so the
    day-integrated PV energy equals daily_ghi * pv_kwp * DERATE.
    """
    day_energy = daily_ghi * cfg.pv_kwp * DERATE  # kWh
    weights = []
    for h in range(24):
        if 6 <= h < 18:
            x = (h + 0.5 - 6) / 12.0  # 0..1 across daylight
            weights.append(math.sin(math.pi * x))
        else:
            weights.append(0.0)
    total = sum(weights)
    return [day_energy * w / total for w in weights]  # kW for that hour

# ---------- simulation ----------

def simulate(cfg: SystemConfig, strategy: str, seed: int = 42):
    rng = random.Random(seed)
    soc = cfg.battery_kwh * 0.5  # start half full
    tot = dict(pv=0.0, grid=0.0, load=0.0, curtailed=0.0,
               peft_done=0, peft_deferred=0, peft_missed=0)
    backlog = 0  # deferred PEFT sessions waiting

    for day in range(DAYS):
        daily_ghi = max(0.5, rng.gauss(cfg.ghi, cfg.ghi * 0.15))  # A8
        pv = hourly_pv_kw(cfg, daily_ghi, rng)

        # --- decide PEFT placement ---
        peft_hours = set()
        want_peft = 1 + backlog  # today's session plus any backlog
        if strategy == "baseline":
            peft_hours = set(range(18, 18 + PEFT_HOURS))
            sessions_today = 1
        else:  # solar-aware
            sunniest = sorted(range(24), key=lambda h: -pv[h])[:PEFT_HOURS]
            peft_hours = set(sunniest)
            forecast_cover = sum(pv[h] for h in peft_hours)
            if soc < 0.30 * cfg.battery_kwh and forecast_cover < PEFT_KW * PEFT_HOURS * 0.8:
                sessions_today = 0  # defer
            else:
                sessions_today = 1

        # --- build hourly load ---
        load = [IDLE_KW] * 24
        for h in range(9, 9 + INFER_HOURS):  # inference 09:00-17:00
            load[h] += INFER_KW
        if sessions_today:
            for h in peft_hours:
                load[h] += PEFT_KW

        # --- dispatch ---
        for h in range(24):
            pv_h, load_h = pv[h], load[h]
            tot["pv"] += pv_h
            tot["load"] += load_h
            net = pv_h - load_h
            if net >= 0:
                charge = min(net, cfg.battery_kwh - soc)
                soc += charge * BATT_EFF
                tot["curtailed"] += net - charge
            else:
                need = -net
                discharge = min(need, soc)
                soc -= discharge
                grid = need - discharge
                tot["grid"] += grid

        # --- bookkeeping ---
        if strategy == "baseline":
            tot["peft_done"] += 1
        else:
            if sessions_today:
                tot["peft_done"] += 1
                # Capacity is one session slot per day in v1, so a
                # deferred session stays in the backlog: there is no
                # spare slot to catch up with. Backlog at year end is
                # reported as unserved, not silently dropped.
            else:
                tot["peft_deferred"] += 1
                backlog += 1
    tot["peft_missed"] = backlog if strategy != "baseline" else 0
    tot["solar_fraction"] = 1.0 - (tot["grid"] / tot["load"]) if tot["load"] else 0.0
    tot["pv_utilisation"] = 1.0 - (tot["curtailed"] / tot["pv"]) if tot["pv"] else 0.0
    return tot

# ---------- scenarios ----------

def main():
    rows = []
    for ghi, label in [(4.0, "low (<4-5 band)"), (5.0, "base (>=5 band)"), (6.0, "high")]:
        for pv_kwp in (2.0, 4.0, 6.0):
            for batt in (5.0, 10.0, 15.0):
                cfg = SystemConfig(pv_kwp=pv_kwp, battery_kwh=batt, ghi=ghi)
                for strategy in ("baseline", "solar-aware"):
                    r = simulate(cfg, strategy)
                    rows.append(dict(
                        ghi_scenario=label, ghi_kwh_m2_day=ghi,
                        pv_kwp=pv_kwp, battery_kwh=batt, strategy=strategy,
                        annual_pv_kwh=round(r["pv"]),
                        annual_load_kwh=round(r["load"]),
                        annual_grid_kwh=round(r["grid"]),
                        solar_fraction=round(r["solar_fraction"], 3),
                        pv_utilisation=round(r["pv_utilisation"], 3),
                        peft_sessions_completed=r["peft_done"],
                        peft_deferral_events=r["peft_deferred"],
                        peft_sessions_unserved_at_year_end=r["peft_missed"],
                    ))
    with open("results/energy_model_v1_results.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    with open("results/energy_model_v1_results.json", "w") as f:
        json.dump(rows, f, indent=2)

    # headline comparison: base GHI, mid system
    print("Headline: GHI 5.0, PV 4 kWp, battery 10 kWh")
    for r in rows:
        if r["ghi_kwh_m2_day"] == 5.0 and r["pv_kwp"] == 4.0 and r["battery_kwh"] == 10.0:
            print(f"  {r['strategy']:<12} grid {r['annual_grid_kwh']:>6} kWh/yr  "
                  f"solar fraction {r['solar_fraction']:.1%}  "
                  f"PEFT done {r['peft_sessions_completed']}  deferrals {r['peft_deferral_events']}")
    print(f"\n{len(rows)} scenario rows written to results/")

if __name__ == "__main__":
    main()
