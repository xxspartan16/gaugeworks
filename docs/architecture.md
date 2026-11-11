# Gaugeworks architecture

## Data flow

```text
CSV text → validated ordered measurements → fixed-baseline analysis → React views / JSON report
```

The UI does not calculate control limits. It supplies validated settings to `src/domain/analysis.ts`; the result is the single source for charts, counts, tables and reports.

## Boundaries

| File | Responsibility |
|---|---|
| `src/domain/csv.ts` | Parse and validate CSV, report physical row errors, export spreadsheet-safe labels |
| `src/domain/analysis.ts` | Fixed-baseline statistics and selected rolling signals; no browser dependency |
| `src/domain/fixtures.ts` | Seeded deterministic sample runs; no runtime randomness |
| `src/components/ControlChart.tsx` | SVG presentation and selection only |
| `src/components/MeasurementsTable.tsx` | Search, filtering and pagination |
| `src/App.tsx` | Workspace state, user actions, validated settings, import/export |
| `cli/gaugeworks.py` | Python standard-library command-line analysis |
| `fixtures/parity.json` | Language-independent numeric examples |

## Why a fixed baseline?

If every new part refits the control limits, a deteriorating process can widen its own definition of ordinary variation. The first-N baseline is explicit and remains unchanged until the user applies a new setting. Specification limits never participate in control-limit estimation.

The display may include monitoring points outside specification even if baseline Cpk looks healthy. The UI therefore labels Cpk as a baseline estimate and displays a warning whenever baseline or monitoring rules signal.

## Why a local static app?

A single operator comparing a small ordered dataset does not need accounts or a cloud database. Keeping calculation local reduces operational work and allows a demo to run without credentials. The tradeoff is that refreshing discards the workspace; the UI says this clearly and offers exports. The static build can be served from a normal host, Vercel, or a subdirectory.

This is not a server-backed multi-operator quality system. Authentication, durable audit history and access control would be separate features with their own data model.

## Statistical model

The analyzer uses Welford's one-pass mean/variance update, adjacent moving ranges and a disclosed `1.128` constant. Sample standard deviation is included in the report for inspection but does **not** replace moving-range sigma for control limits or baseline Cp/Cpk.

Signal detection maintains side-run and trend-run state. It emits one event per qualifying rolling-window endpoint, so event counts and unique signaled-observation counts differ. Values exactly on the mean reset same-side runs; ties reset trends. Values exactly on the three-sigma limits are not outside.

With zero baseline variation, control limits coincide with the mean. A later unequal observation is flagged, and capability is undefined. That case requires a measurement-resolution investigation rather than a claim of perfect capability.

## Complexity and limits

- Parsing: O(bytes), bounded to 1 MiB.
- Analysis and rule detection: O(n) time and O(n) returned signals, bounded to 10,000 measurements.
- Chart polyline construction: O(n); individual point dots only for 100 or fewer measurements.
- Signal markers: at most 300; complete results remain available in the table/report.
- Table search: O(n); only 12 rows are rendered per page.

The synthetic generator uses a seeded linear-congruential generator and a sum of three uniforms for illustrative noise. It is not a normality guarantee or a model of actual tooling wear.

## Input and export considerations

CSV is not parsed by splitting on commas: quoted labels can include commas, newlines and escaped double quotes. Numeric validation precedes conversion so empty strings, hex, infinity, suffixes and accidental unit strings do not become valid measurements. Inputs remain text until Apply/Analyze validates a complete candidate state. Failed imports leave the previous analysis intact.

Labels render through React text nodes, never `innerHTML`. CSV export neutralizes formula-like label prefixes to avoid spreadsheet execution. JSON export has an explicit schema version, settings, metadata and original measurement order. There is no network upload and no external font request.

## Verification strategy

Tests use hand-computable examples and boundary cases, not a reimplementation of the production formulas as the only oracle. The shared fixture file checks Python/TypeScript numeric results. Baseline invariance tests append large monitoring excursions and prove the limits remain unchanged. Rule tests cover exact thresholds, interruptions, ties, overlaps and direction changes. Parser tests cover malformed quoting and physical row diagnostics.

## Deployment

The build runs TypeScript before Vite and produces a static `dist/` directory. Relative asset URLs support root and subdirectory hosting. A production host requires no environment secrets. GitHub CI and project publishing are repository-level concerns; there is no deployment token in this source tree.
