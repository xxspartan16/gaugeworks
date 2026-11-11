# Gaugeworks

**Understand process variation before treating every change as a problem.**

[Live demo](https://gaugeworks.vercel.app) · [Brennan's portfolio](https://brennan-portfolio-jade.vercel.app)

Gaugeworks is a local statistical-process-control workbench for ordered, individual measurements. Import a CSV, establish a fixed baseline, inspect control-chart signals, and export the calculation behind the chart. A small Python CLI provides the same core analysis without a browser or third-party packages.

**Project context:** manufacturing and quality control make a useful starting point for software. A measurement can meet its drawing tolerance and still be part of a changing process. This project makes that distinction visible and keeps the input, assumptions, and calculation inspectable.

Personal project by Brennan LeBlanc. This initial v0.1 implementation was developed with AI assistance. It is an exploratory software project, not a claim of professional SPC certification or a production deployment at an employer. All bundled measurements are synthetic.

## Try a useful workflow

1. Open **Tool wear**, the default synthetic scenario.
2. Inspect the first 25 measurements that establish the baseline.
3. Click a later chart point or use the previous/next controls. The gradual drift is evaluated against the unchanged baseline limits.
4. Change the specification limits. Cp/Cpk and specification checks change; control limits do not.
5. Load **Stable process** or **Fixture slip** to compare different failure shapes.
6. Import your own ordered `sample,value` CSV, then export the JSON report. No measurements leave the browser tab.

## Run locally

Node.js 22.12 or newer is required.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The production build is static. `vercel.json` uses the Vite build and `dist` output. There are no API keys, databases, paid APIs, or runtime servers. Relative asset paths also allow the build to be hosted below a subdirectory.

## What is implemented

- CSV state-machine parser: quoted fields, commas/newlines inside quotes, escaped quotes, UTF-8 BOM, CRLF, extra columns, physical-row error messages, strict numeric validation and input limits.
- Fixed first-N baseline, Welford mean/sample-deviation calculation, adjacent moving ranges and individuals control limits.
- Three explicitly defined rolling rules: one point outside 3σ, eight points on the same side, and six strictly monotonic points.
- Interactive SVG chart, exact measurement inspection, searchable/paginated accessible table, and separate engineering specification limits.
- Baseline Cp/Cpk estimates with visible stability/zero-variance warnings.
- Three deterministic synthetic scenarios, CSV export with spreadsheet-formula escaping, and a self-contained JSON analysis export.
- Dependency-free Python CLI and shared numeric fixtures across TypeScript and Python.

## Input contract

```csv
sample,value
P-001,12.003
P-002,11.997
P-003,12.008
```

`timestamp,value` also works; timestamps are labels, not parsed or sorted. Extra columns are accepted but not retained on export. Use a consistent unit; the interface is labelled **mm** and performs no conversion. Preserve measurement order. Limits: 10,000 measurements, 1 MiB UTF-8, 200 characters per sample label, finite numbers within ±1e12.

Samples equal to specification limits are considered within specification. Formula-like text labels are prefixed with an apostrophe on CSV export for safe opening in spreadsheet software; this intentional escaping means those labels will not byte-for-byte round-trip.

## Analysis decisions

For baseline observations `x₁ … xₙ`:

```text
MRᵢ = |xᵢ − xᵢ₋₁|
sigma estimate = mean(MR) / 1.128
control limits = baseline mean ± 3 × sigma estimate
Cp = (USL − LSL) / (6 × sigma estimate)
Cpk = min((USL − mean), (mean − LSL)) / (3 × sigma estimate)
```

The 1.128 span-two constant and individuals-limit formula follow [NIST's Individuals Control Charts](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm). Capability indices follow the form in [NIST's Process Capability](https://itl.nist.gov/div898/handbook/pmc/section1/pmc16.htm), using the disclosed moving-range estimate of within-process sigma. [NIST's stability discussion](https://itl.nist.gov/div898/handbook/ppc/section4/ppc45.htm) motivates the visible warning when interpreting capability for a changing process.

These are estimates, not confidence intervals or certification results. A first-25 baseline is a practical demo default, not a claim that 25 parts guarantees stability or precision. Smaller baselines are accepted for exploration with a warning. A constant baseline yields undefined capability (`null` in JSON), not infinity.

Rule semantics are intentionally explicit:

| Rule | Trigger | Boundary behavior |
|---|---|---|
| Beyond limits | Value strictly outside mean ± 3σ | A value on the boundary is not flagged |
| Same side | Eight consecutive values strictly above or below mean | A value on the mean resets the run |
| Trend | Six strictly increasing/decreasing values | Equal adjacent values break the trend |

Each qualifying window produces one signal at its endpoint. A long run can therefore produce overlapping signals. Windows may cross the baseline/monitoring boundary. The interface distinguishes the count of events from the count of measurements with at least one event.

## Python CLI

Python 3.10+; standard library only:

```sh
python3 cli/gaugeworks.py public/sample-measurements.csv --baseline 25 --lower 11.95 --upper 12.05
python3 -m unittest discover -s cli -p 'test_*.py' -v
```

The CLI writes JSON to stdout, diagnostics to stderr, and exits 2 for invalid input. The Python CSV parser uses the standard library; it reports the ending physical line of a multiline record, whereas the web parser reports its starting line. The CLI signal objects contain indices and rule IDs; the browser additionally supplies explanatory messages.

## Verification

The TypeScript suite covers the input boundary, strict rule thresholds, reset/overlap behavior, baseline invariance, specification/control separation, zero variance, negative capability, and numeric fixtures. Python tests cover the same numeric fixtures and core rule behavior. The shared [parity fixtures](fixtures/parity.json) include hand-computable values, monitoring excursions, and zero variance.

See [architecture and tradeoffs](docs/architecture.md) for the component boundary and complexity discussion.

## Deliberate limits

- One variable and one ordered observation per part; no subgroup, multivariate, or autocorrelation correction.
- No automatic deletion of “bad” observations or automatic rebaselining.
- Near-normal, stable-process assumptions matter for interpreting capability. No signal is not proof of stability.
- No permanent storage: refreshing resets the workspace. Export before leaving.
- SVG renders every measurement in its line; above 300 signaled points, only the first 300 signal markers are displayed. The table and report retain all signals.
- Synthetic data demonstrates behavior but does not validate performance for a real manufacturing process.
- Exploratory use only; do not use it as an automated safety-critical release gate.

## Next work worth doing

1. Add phase-specific baselines with explicit approvals and a visible change history.
2. Add a moving-range companion chart so changes in variation have their own inspection surface.
3. Support subgroup charts with a separate data contract instead of overloading individual measurements.
4. Add importable/exportable workspace schema migrations and IndexedDB persistence.
5. Benchmark dense chart interaction and move large analyses to a Web Worker if measurements justify it.

## License

MIT. See [LICENSE](LICENSE).
