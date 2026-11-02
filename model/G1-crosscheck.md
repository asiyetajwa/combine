# Gate G1: energy model v1 cross-checked against pvlib and NREL SAM

Date: 2 November 2026 (UTC). Status: model results under labelled
assumptions. No measured hardware data is involved. No labs are testing
Combine today.

Code: `crosscheck_g1.py` in this folder. Raw weather is cached in
`data/`, results are in `results/g1_*.csv`. Anyone can rerun it:

```bash
pip install -r requirements.txt
python crosscheck_g1.py
```

## What was checked

Energy model v1 (`energy_model_v1.py`) turns a daily irradiation figure
into PV energy with one formula: daily global horizontal irradiation (GHI)
x array kWp x 0.80, spread over a 06:00 to 18:00 sine curve, with no
seasons. Gate G1 asks two questions:

1. Does that formula give the same energy as validated open solar models
   fed real hourly weather?
2. Do v1's three findings (sizing, scheduling, storage) survive?

## Method

- **Reference sites**, one per v1 scenario, chosen only because their
  NASA POWER annual mean irradiation matches it: Douala (4.25 kWh/m2/day,
  for the 4.0 scenario), Accra (4.90, for 5.0) and Addis Ababa (5.96,
  for 6.0). They are reference points for the model, not proposed sites.
- **Weather**: a typical meteorological year (hourly, 8,760 hours) from
  PVGIS (EU Joint Research Centre: SARAH2 satellite radiation, ERA5
  temperature and wind, 2005 to 2020), and the monthly climatology from
  NASA POWER (2001 to 2020), the source behind Combine's solar atlas.
- **Two independent PV models, same system and inputs**: pvlib 0.16.1
  (Perez transposition, SAPM cell temperature, PVWatts DC and inverter
  models) and NREL SAM through PySAM 7.1.1 (PVWatts v8). System: 1 kWp,
  fixed open rack, 10 degree tilt facing the equator, 14 percent system
  losses (the PVWatts default), 96 percent inverter efficiency, DC to AC
  ratio 1.15, sun position taken at mid-hour in both.
- **Conclusion check**: v1's dispatch code (battery, grid, and the two
  scheduling strategies) was copied unchanged and first proven to
  reproduce all 54 published v1 rows exactly. It was then rerun on the
  pvlib hourly profile for every v1 array, battery and strategy
  combination, twice: with the site's own weather, and scaled to the same
  annual energy as the v1 scenario. The second run isolates what real
  hourly and seasonal shape does, separately from how sunny the site is.

## Results

### 1. pvlib and SAM agree

| Site | pvlib (kWh per kWp per year) | SAM | Difference |
|---|---|---|---|
| Douala | 1,362 | 1,329 | +2.5% |
| Accra | 1,635 | 1,633 | +0.2% |
| Addis Ababa | 1,613 | 1,583 | +1.9% |

Two independently written models agree within 2.5 percent, so either can
serve as the reference below. The remaining gap is mostly their different
cell temperature models.

### 2. v1's formula overstates yield by 3 to 9 percent

On the same weather, v1's formula (GHI x 0.80) gives 1,451, 1,711 and
1,625 kWh per kWp per year: 9.2, 4.8 and 2.6 percent above SAM. Its
effective derate is 0.80, against 0.73, 0.76 and 0.78 in SAM. The causes:

- **Heat.** Daytime cell temperatures average 40 C in Douala, 39 C in
  Accra and 34 C in Addis Ababa. That costs 7.7, 6.8 and 5.3 percent of DC
  output. v1 has no temperature term, so the error is largest at the hot,
  humid site.
- **No tilt gain near the equator.** At 10 degrees of tilt and 4 to 9
  degrees of latitude, plane-of-array irradiation is within 3 percent of
  horizontal. v1 is right to use GHI directly here; this would not hold
  at higher latitudes.
- **Losses.** 14 percent system losses and a 96 percent inverter leave
  about 0.83 before heat, which then takes it to 0.73 to 0.78.

### 3. The weather source matters more than the formula

For the same coordinates, the two satellite datasets disagree on annual
irradiation:

| Site | NASA POWER | PVGIS SARAH2 | Difference |
|---|---|---|---|
| Douala | 4.25 | 4.97 | +17% |
| Accra | 4.90 | 5.86 | +20% |
| Addis Ababa | 5.96 | 5.56 | -7% |

That is a bigger uncertainty than v1's formula error. NASA POWER's solar
data is a coarse grid (1 degree, about 110 km); SARAH2 is finer (about
5 km), but neither is a ground
measurement. Sizing should be tested against both sources, and against
ground data where a station exists, never one alone.

### 4. Findings: what holds and what changes

Same annual energy as v1, real hourly and seasonal shape (the matched
run):

**Sizing: direction holds, the headline figure does not.** v1 says a
2 kWp array with 5 kWh storage covers about 99.9 percent of the load at
5.0 kWh/m2/day. With seasons, the matched run gives 96.9 percent at Accra
(75 kWh of grid import a year, against 3 in v1) and 97.5 percent at Addis
Ababa. The shortfall sits in the rainy months: at Addis Ababa, July and
August deliver 2.8 to 3.1 kWh per kWp per day, against v1's flat 4.8.
Oversizing is still real: at 4 kWp, 45 to 64 percent of generation has
no load to serve.

**Scheduling: holds, and the trade is sharper.** In v1's tightest case
(4.0 scenario, 2 kWp, 10 kWh), sun-aware placement cuts grid import from
186 to 85 kWh a year in v1. With Douala's seasonal shape at the same
annual energy, it cuts 286 to 107 kWh, but deferrals rise from 15 to 45
sessions a year, because the cloudy season runs for weeks at a time.

**Storage: does not hold in general.** v1 found battery size a weak
lever. That holds only in the lowest irradiation case (Douala matched:
5 to 15 kWh cuts grid import 317 to 281 kWh, 11 percent). Elsewhere the
battery covers most of the seasonal shortfall: Accra 75 to 29 kWh, Addis
Ababa 61 to 22 kWh. The absolute amounts are tens of kWh a year, but the
statement "battery size is a weak lever" should not be repeated.

## What else the cross-check found in v1

Reported, not hidden. None changes the results above by more than the
effects already listed.

- v1's scenario labels follow the solar atlas bands, but the atlas bands
  classify places by their lowest monthly mean, while v1 uses an annual
  mean. A place in the atlas's "5 and above" band has an annual mean above
  5, often well above.
- Sun-aware scheduling in v1 (and here) uses the day's actual PV as its
  forecast: a perfect forecast. Real forecasts will do worse; model v2
  should use a forecast with error.
- The battery charge step limits charge to the free capacity before
  applying the 90 percent efficiency, so the battery never quite fills.
  This is a small bias in the conservative direction.
- PV utilisation counts battery round-trip losses as used energy.

## What this means for the next steps

- Model v2 (Week 2): use pvlib hourly output, or a site-specific derate of
  about 0.73 to 0.78, in place of the flat 0.80. Add monthly seasonality,
  and size against the lower of NASA POWER and PVGIS.
- The v1 headline "about 99.9 percent at 5.0 kWh/m2/day" should be
  restated as about 97 percent with seasons, wherever it is used.
- The energy cross-check does not touch the bigger open question: every
  load figure (A1 to A4) is still an assumption. Week 3's measured
  workload traces remain the most important next step.
