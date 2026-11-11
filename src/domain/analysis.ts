import type { Analysis, Measurement, Signal, Specification } from './types';

export const RULE_NAMES = {
  'beyond-limit': 'Outside control limits',
  'same-side': 'Eight on one side',
  trend: 'Six-point trend',
} as const;

export function detectSignals(values: readonly number[], mean: number, sigma: number): Signal[] {
  const result: Signal[] = [];
  let sideRun = 0, previousSide = 0, trendRun = 1, previousDirection = 0;
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value < mean - 3 * sigma || value > mean + 3 * sigma) {
      result.push({ index, start: index, rule: 'beyond-limit', message: 'Measurement is strictly outside the baseline three-sigma limits.' });
    }
    const side = Math.sign(value - mean);
    sideRun = side === 0 ? 0 : side === previousSide ? sideRun + 1 : 1;
    if (sideRun >= 8) result.push({ index, start: index - 7, rule: 'same-side', message: `Eight consecutive measurements are strictly ${side > 0 ? 'above' : 'below'} the baseline mean.` });
    previousSide = side;
    if (index > 0) {
      const direction = Math.sign(value - values[index - 1]);
      trendRun = direction === 0 ? 1 : direction === previousDirection ? trendRun + 1 : 2;
      if (trendRun >= 6) result.push({ index, start: index - 5, rule: 'trend', message: `Six consecutive measurements are strictly ${direction > 0 ? 'increasing' : 'decreasing'}.` });
      previousDirection = direction;
    }
  }
  return result;
}

export function analyze(points: readonly Measurement[], baselineCount: number, spec: Specification): Analysis {
  if (points.length < 2 || points.length > 10_000) throw new Error('Provide 2–10,000 measurements.');
  if (!Number.isInteger(baselineCount) || baselineCount < 2 || baselineCount > points.length) throw new Error('Baseline must contain between 2 and all available measurements.');
  if (!Number.isFinite(spec.lower) || !Number.isFinite(spec.upper) || spec.lower >= spec.upper || Math.abs(spec.lower) > 1e12 || Math.abs(spec.upper) > 1e12) throw new Error('Specification limits must be finite, within ±1e12, and lower must be less than upper.');
  if (points.some(point => !Number.isFinite(point.value) || Math.abs(point.value) > 1e12)) throw new Error('All measurements must be finite and within ±1e12.');
  // Welford's update avoids subtracting two large sums when measuring small variation.
  let mean = 0, m2 = 0, movingTotal = 0;
  for (let index = 0; index < baselineCount; index++) {
    const delta = points[index].value - mean;
    mean += delta / (index + 1);
    m2 += delta * (points[index].value - mean);
    if (index > 0) movingTotal += Math.abs(points[index].value - points[index - 1].value);
  }
  const movingRangeMean = movingTotal / (baselineCount - 1);
  const sigma = movingRangeMean / 1.128;
  const lowerControl = mean - 3 * sigma, upperControl = mean + 3 * sigma;
  const signals = detectSignals(points.map(point => point.value), mean, sigma);
  const finiteOrNull = (value: number) => Number.isFinite(value) ? value : null;
  const cp = sigma > 0 ? finiteOrNull((spec.upper - spec.lower) / (6 * sigma)) : null;
  const cpk = sigma > 0 ? finiteOrNull(Math.min((spec.upper - mean) / (3 * sigma), (mean - spec.lower) / (3 * sigma))) : null;
  const warnings: string[] = [];
  if (baselineCount < 25) warnings.push('A baseline below 25 observations is preliminary; collect more representative measurements.');
  if (sigma === 0) warnings.push('The baseline has no measurable variation. Capability is undefined; check measurement resolution before interpreting limits.');
  if (signals.some(signal => signal.index < baselineCount)) warnings.push('The baseline itself contains rule signals. Investigate it before using these limits for monitoring.');
  if (signals.some(signal => signal.index >= baselineCount)) warnings.push('Monitoring data contains rule signals. Capability estimates describe the baseline and should not be used as a forecast for the shifted process.');
  return {
    count: points.length, baselineCount, mean, sampleDeviation: Math.sqrt(Math.max(0, m2 / (baselineCount - 1))),
    movingRangeMean, sigma, lowerControl, upperControl, cp, cpk,
    outOfSpec: points.filter(point => point.value < spec.lower || point.value > spec.upper).length,
    signals, warnings,
  };
}
