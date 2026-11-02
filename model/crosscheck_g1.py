#!/usr/bin/env python3
"""
Combine Gate G1: cross-check of energy model v1 against pvlib and NREL SAM.

Question this answers: does the simple PV formula in energy model v1
(daily GHI x kWp x 0.80 derate, spread over a 06:00 to 18:00 sine
curve, no seasons) give the same energy, and the same sizing and
scheduling conclusions, as two validated open solar models fed real
hourly weather?

Method, in four steps (all reproducible, raw data cached in data/):

  1. Weather. For three reference sites, one per v1 irradiation
     scenario, fetch a typical meteorological year (TMY, hourly) from
     PVGIS (EU JRC: SARAH2 radiation, ERA5 temperature and wind,
     2005 to 2020) and the monthly climatology from NASA POWER
     (2001 to 2020, the source behind Combine's solar atlas).
     Reference sites are chosen only because their NASA POWER annual
     mean matches a v1 scenario. They are not proposed sites.

  2. Two independent PV models, same inputs, same system:
     pvlib (ModelChain, Perez transposition, SAPM cell temperature,
     PVWatts DC and inverter models) and NREL SAM (PySAM PVWatts v8).
     System: 1 kWp, fixed open rack, 10 degree tilt facing the
     equator, 14 percent system losses (the PVWatts default),
     96 percent inverter efficiency, DC to AC ratio 1.15.

  3. Energy comparison: annual and monthly AC energy per kWp from
     pvlib and SAM against v1's formula, with the gap broken into
     its physical parts (tilt gain, temperature, losses).

  4. Conclusion check: the v1 dispatch logic (copied unchanged, and
     regression-tested against v1's published CSV) is rerun on the
     pvlib hourly profile for every v1 array, battery and scheduling
     combination, so the sizing and scheduling findings can be
     compared directly.

Run: python crosscheck_g1.py   (needs pvlib, nrel-pysam, pandas;
network only on the first run, after that data/ is used).
"""

import json
import math
import os
import random
import urllib.request

import pandas as pd
import pvlib
import PySAM.Pvwattsv8 as pvwatts

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "results")

# name, latitude, longitude, UTC offset (h), matched v1 scenario
SITES = [
    ("Douala", 4.05, 9.70, 1, 4.0),
    ("Accra", 5.60, -0.19, 0, 5.0),
    ("Addis Ababa", 9.03, 38.74, 3, 6.0),
]

# common PV system, both models
TILT = 10.0              # degrees; low tilt near the equator, kept >= 10 for rain self-cleaning
LOSSES_PCT = 14.0        # PVWatts default: soiling, wiring, mismatch, availability, etc.
INV_EFF = 0.96
DC_AC = 1.15
GAMMA_PDC = -0.0037      # PVWatts standard module, per degree C
SUN_MINUTE = 30          # sun position at mid-hour in both models

# v1 constants, unchanged (see energy_model_v1.py)
PEFT_KW = 0.65 * 1.15
INFER_KW = 0.35 * 1.15
IDLE_KW = 0.02
PEFT_HOURS = 4
INFER_HOURS = 8
V1_DERATE = 0.80
BATT_EFF = 0.90
DAYS = 365


# ---------- 1. weather ----------

def cached_json(path, url):
    if not os.path.exists(path):
        with urllib.request.urlopen(url, timeout=120) as r:
            body = r.read()
        with open(path, "wb") as f:
            f.write(body)
    with open(path) as f:
        return json.load(f)


def slug(name):
    return name.lower().replace(" ", "-")


def load_tmy(name, lat, lon, utc_offset):
    """PVGIS TMY as an hourly frame in local standard time, 8760 rows."""
    url = (f"https://re.jrc.ec.europa.eu/api/v5_2/tmy?lat={lat}&lon={lon}"
           f"&usehorizon=1&outputformat=json")
    raw = cached_json(os.path.join(DATA, f"pvgis-tmy-{slug(name)}.json"), url)
    rows = raw["outputs"]["tmy_hourly"]
    df = pd.DataFrame({
        "ghi": [r["G(h)"] for r in rows],
        "dni": [r["Gb(n)"] for r in rows],
        "dhi": [r["Gd(h)"] for r in rows],
        "temp_air": [r["T2m"] for r in rows],
        "wind_speed": [r["WS10m"] for r in rows],
    })
    # PVGIS rows are UTC; rotate so row 0 is local midnight on 1 January.
    # A TMY is a stitched typical year, so wrapping the year end is standard.
    df = df.iloc[[(i - utc_offset) % len(df) for i in range(len(df))]].reset_index(drop=True)
    tz = f"Etc/GMT{-utc_offset:+d}" if utc_offset else "UTC"
    df.index = pd.date_range("2025-01-01 00:00", periods=len(df), freq="h", tz=tz)
    elevation = raw["inputs"]["location"]["elevation"]
    return df, elevation, raw["inputs"]["meteo_data"]


def load_nasa_monthly(name, lat, lon):
    url = ("https://power.larc.nasa.gov/api/temporal/climatology/point"
           f"?parameters=ALLSKY_SFC_SW_DWN,T2M&community=RE"
           f"&longitude={lon}&latitude={lat}&format=JSON")
    raw = cached_json(os.path.join(DATA, f"nasa-power-{slug(name)}.json"), url)
    p = raw["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    return [p[m] for m in months], p["ANN"]


# ---------- 2a. pvlib ----------

def run_pvlib(tmy, lat, lon, elevation):
    loc = pvlib.location.Location(lat, lon, tz=tmy.index.tz, altitude=elevation)
    azimuth = 180.0 if lat >= 0 else 0.0
    system = pvlib.pvsystem.PVSystem(
        surface_tilt=TILT, surface_azimuth=azimuth,
        module_parameters={"pdc0": 1000.0, "gamma_pdc": GAMMA_PDC},
        inverter_parameters={"pdc0": 1000.0 / DC_AC / INV_EFF, "eta_inv_nom": INV_EFF},
        temperature_model_parameters=pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS
        ["sapm"]["open_rack_glass_polymer"],
        losses_parameters={},
    )
    mc = pvlib.modelchain.ModelChain(
        system, loc, transposition_model="perez", aoi_model="physical",
        spectral_model="no_loss", losses_model="no_loss", temperature_model="sapm",
    )
    # Sun position at mid-hour: shift the stamps, keep the weather values.
    weather = tmy.copy()
    weather.index = tmy.index + pd.Timedelta(minutes=SUN_MINUTE)
    mc.run_model(weather)
    r = mc.results
    poa = r.total_irrad["poa_global"].clip(lower=0).fillna(0)
    dc_raw = r.dc.clip(lower=0).fillna(0)                 # after temperature, before losses
    dc = dc_raw * (1 - LOSSES_PCT / 100)                    # PVWatts-style flat losses
    ac = pvlib.inverter.pvwatts(dc, 1000.0 / DC_AC / INV_EFF, eta_inv_nom=INV_EFF).clip(lower=0)
    eff_irr = r.effective_irradiance.clip(lower=0).fillna(0)
    ac.index = tmy.index
    return dict(
        ac_kwh=ac.values / 1000.0,
        poa_kwh_m2=poa.sum() / 1000.0,
        dc_stc_kwh=eff_irr.sum() / 1000.0,      # DC if cells stayed at 25 C
        dc_raw_kwh=dc_raw.sum() / 1000.0,
        dc_kwh=dc.sum() / 1000.0,
        mean_cell_temp_daylight=float(r.cell_temperature[poa.values > 50].mean()),
    )


# ---------- 2b. NREL SAM (PVWatts v8) ----------

def run_sam(tmy, lat, lon, elevation, utc_offset):
    m = pvwatts.default("PVWattsNone")
    idx = tmy.index
    m.SolarResource.solar_resource_data = {
        "lat": lat, "lon": lon, "tz": float(utc_offset), "elev": float(elevation),
        "year": [int(t.year) for t in idx], "month": [int(t.month) for t in idx],
        "day": [int(t.day) for t in idx], "hour": [int(t.hour) for t in idx],
        "minute": [SUN_MINUTE] * len(idx),
        "dn": tmy["dni"].tolist(), "df": tmy["dhi"].tolist(), "gh": tmy["ghi"].tolist(),
        "tdry": tmy["temp_air"].tolist(), "wspd": tmy["wind_speed"].tolist(),
    }
    sd = m.SystemDesign
    sd.system_capacity = 1.0
    sd.dc_ac_ratio = DC_AC
    sd.inv_eff = INV_EFF * 100
    sd.losses = LOSSES_PCT
    sd.array_type = 0          # fixed, open rack
    sd.module_type = 0         # standard
    sd.tilt = TILT
    sd.azimuth = 180.0 if lat >= 0 else 0.0
    sd.gcr = 0.3
    m.execute()
    ac = [max(0.0, x) / 1000.0 for x in m.Outputs.ac]       # W -> kWh per hour
    return dict(ac_kwh=ac, annual=m.Outputs.ac_annual, poa=sum(m.Outputs.poa) / 1000.0)


# ---------- 4. v1 dispatch, unchanged logic ----------

def v1_pv_series(pv_kwp, ghi, seed=42):
    """Regenerate exactly the hourly PV series v1 uses (same RNG draws)."""
    rng = random.Random(seed)
    weights = [math.sin(math.pi * ((h + 0.5 - 6) / 12.0)) if 6 <= h < 18 else 0.0
               for h in range(24)]
    total = sum(weights)
    series = []
    for _ in range(DAYS):
        daily = max(0.5, rng.gauss(ghi, ghi * 0.15))
        e = daily * pv_kwp * V1_DERATE
        series.extend(e * w / total for w in weights)
    return series


def dispatch(pv_series, battery_kwh, strategy):
    """energy_model_v1.simulate(), with the PV series passed in.

    Logic is copied line for line from v1 so that only the PV input
    differs. regression_check() proves it reproduces v1's CSV.
    """
    soc = battery_kwh * 0.5
    tot = dict(pv=0.0, grid=0.0, load=0.0, curtailed=0.0,
               peft_done=0, peft_deferred=0)
    backlog = 0
    for day in range(DAYS):
        pv = pv_series[day * 24:(day + 1) * 24]
        if strategy == "baseline":
            peft_hours = set(range(18, 18 + PEFT_HOURS))
            sessions_today = 1
        else:
            peft_hours = set(sorted(range(24), key=lambda h: -pv[h])[:PEFT_HOURS])
            forecast_cover = sum(pv[h] for h in peft_hours)
            if soc < 0.30 * battery_kwh and forecast_cover < PEFT_KW * PEFT_HOURS * 0.8:
                sessions_today = 0
            else:
                sessions_today = 1
        load = [IDLE_KW] * 24
        for h in range(9, 9 + INFER_HOURS):
            load[h] += INFER_KW
        if sessions_today:
            for h in peft_hours:
                load[h] += PEFT_KW
        for h in range(24):
            pv_h, load_h = pv[h], load[h]
            tot["pv"] += pv_h
            tot["load"] += load_h
            net = pv_h - load_h
            if net >= 0:
                charge = min(net, battery_kwh - soc)
                soc += charge * BATT_EFF
                tot["curtailed"] += net - charge
            else:
                need = -net
                discharge = min(need, soc)
                soc -= discharge
                tot["grid"] += need - discharge
        if strategy == "baseline" or sessions_today:
            tot["peft_done"] += 1
        else:
            tot["peft_deferred"] += 1
            backlog += 1
    tot["solar_fraction"] = 1 - tot["grid"] / tot["load"]
    tot["pv_utilisation"] = 1 - tot["curtailed"] / tot["pv"]
    return tot


def regression_check():
    """The copied dispatch must reproduce v1's published results exactly."""
    path = os.path.join(OUT, "energy_model_v1_results.csv")
    v1 = pd.read_csv(path)
    for _, row in v1.iterrows():
        r = dispatch(v1_pv_series(row.pv_kwp, row.ghi_kwh_m2_day),
                     row.battery_kwh, row.strategy)
        assert round(r["grid"]) == row.annual_grid_kwh, row.to_dict()
        assert round(r["solar_fraction"], 3) == row.solar_fraction, row.to_dict()
        assert round(r["pv_utilisation"], 3) == row.pv_utilisation, row.to_dict()
        assert r["peft_deferred"] == row.peft_deferral_events, row.to_dict()
    return len(v1)


# ---------- main ----------

def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    n = regression_check()
    print(f"Regression: copied v1 dispatch reproduces all {n} published v1 rows.")

    energy_rows, monthly_rows, dispatch_rows = [], [], []
    months = list(range(1, 13))
    for name, lat, lon, off, scenario in SITES:
        tmy, elev, meteo = load_tmy(name, lat, lon, off)
        nasa_month, nasa_ann = load_nasa_monthly(name, lat, lon)
        p = run_pvlib(tmy, lat, lon, elev)
        s = run_sam(tmy, lat, lon, elev, off)

        ghi_tmy = tmy["ghi"].sum() / 1000.0                  # kWh/m2/yr
        v1_formula_tmy = ghi_tmy * V1_DERATE                 # v1 formula on the same weather
        v1_scenario = scenario * 365 * V1_DERATE             # what v1 actually assumed
        pv_ann = sum(p["ac_kwh"])
        sam_ann = s["annual"]
        energy_rows.append({
            "site": name, "lat": lat, "lon": lon, "elevation_m": elev,
            "v1_scenario_ghi": scenario,
            "nasa_power_annual_ghi": round(nasa_ann, 2),
            "nasa_power_lowest_month_ghi": round(min(nasa_month), 2),
            "pvgis_tmy_annual_ghi": round(ghi_tmy / 365, 2),
            "radiation_db": meteo["radiation_db"],
            "poa_over_ghi_pvlib": round(p["poa_kwh_m2"] / ghi_tmy, 3),
            "poa_over_ghi_sam": round(s["poa"] / ghi_tmy, 3),
            "temperature_factor_pvlib": round(p["dc_raw_kwh"] / p["dc_stc_kwh"], 3),
            "mean_cell_temp_daylight_c": round(p["mean_cell_temp_daylight"], 1),
            "v1_yield_scenario_kwh_per_kwp": round(v1_scenario),
            "v1_formula_on_tmy_kwh_per_kwp": round(v1_formula_tmy),
            "pvlib_yield_kwh_per_kwp": round(pv_ann),
            "sam_yield_kwh_per_kwp": round(sam_ann),
            "pvlib_vs_sam_pct": round(100 * (pv_ann / sam_ann - 1), 1),
            "v1_formula_vs_sam_pct": round(100 * (v1_formula_tmy / sam_ann - 1), 1),
            "effective_derate_sam": round(sam_ann / ghi_tmy, 3),
        })

        ac = pd.Series(p["ac_kwh"], index=tmy.index)
        sam_ac = pd.Series(s["ac_kwh"], index=tmy.index)
        ghi_m = tmy["ghi"].groupby(tmy.index.month).sum() / 1000.0
        for mth in months:
            days = tmy[tmy.index.month == mth].shape[0] / 24
            monthly_rows.append({
                "site": name, "month": mth,
                "nasa_power_ghi_kwh_m2_day": round(nasa_month[mth - 1], 2),
                "pvgis_tmy_ghi_kwh_m2_day": round(ghi_m[mth] / days, 2),
                "pvlib_kwh_per_kwp_day": round(ac[ac.index.month == mth].sum() / days, 2),
                "sam_kwh_per_kwp_day": round(sam_ac[sam_ac.index.month == mth].sum() / days, 2),
                "v1_kwh_per_kwp_day": round(scenario * V1_DERATE, 2),
            })

        for kwp in (2.0, 4.0, 6.0):
            series_site = [x * kwp for x in p["ac_kwh"]]
            series_v1 = v1_pv_series(kwp, scenario)
            # Same annual energy as v1, real hourly and seasonal shape:
            # isolates the effect of shape from the irradiation level.
            scale = sum(series_v1) / sum(series_site)
            series_matched = [x * scale for x in series_site]
            for batt in (5.0, 10.0, 15.0):
                for strat in ("baseline", "solar-aware"):
                    a = dispatch(series_v1, batt, strat)
                    b = dispatch(series_site, batt, strat)
                    c = dispatch(series_matched, batt, strat)
                    dispatch_rows.append({
                        "site": name, "v1_scenario_ghi": scenario, "pv_kwp": kwp,
                        "battery_kwh": batt, "strategy": strat,
                        "v1_grid_kwh": round(a["grid"]),
                        "site_grid_kwh": round(b["grid"]),
                        "v1_solar_fraction": round(a["solar_fraction"], 3),
                        "site_solar_fraction": round(b["solar_fraction"], 3),
                        "v1_pv_utilisation": round(a["pv_utilisation"], 3),
                        "site_pv_utilisation": round(b["pv_utilisation"], 3),
                        "v1_deferrals": a["peft_deferred"],
                        "site_deferrals": b["peft_deferred"],
                        "matched_grid_kwh": round(c["grid"]),
                        "matched_solar_fraction": round(c["solar_fraction"], 3),
                        "matched_pv_utilisation": round(c["pv_utilisation"], 3),
                        "matched_deferrals": c["peft_deferred"],
                    })

    pd.DataFrame(energy_rows).to_csv(os.path.join(OUT, "g1_energy.csv"), index=False)
    pd.DataFrame(monthly_rows).to_csv(os.path.join(OUT, "g1_monthly.csv"), index=False)
    pd.DataFrame(dispatch_rows).to_csv(os.path.join(OUT, "g1_dispatch.csv"), index=False)
    print(pd.DataFrame(energy_rows).T.to_string())


if __name__ == "__main__":
    main()
