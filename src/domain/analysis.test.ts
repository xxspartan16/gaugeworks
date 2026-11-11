import { describe, expect, it } from 'vitest';
import { analyze, detectSignals } from './analysis';
import { createFixture } from './fixtures';
import type { Measurement } from './types';
import golden from '../../fixtures/parity.json';

const points = (values: number[]): Measurement[] => values.map((value, index) => ({ sample: `P${index}`, value }));
const spec = { lower: 0, upper: 20 };
describe('fixed-baseline individuals analysis', () => {
  it('matches a hand-computable mean and adjacent moving range', () => {
    const result = analyze(points([10, 12, 11, 13]), 4, spec);
    expect(result.mean).toBe(11.5); expect(result.movingRangeMean).toBeCloseTo(5 / 3, 12);
    expect(result.sigma).toBeCloseTo((5 / 3) / 1.128, 12);
    expect(result.sampleDeviation).toBeCloseTo(Math.sqrt(5 / 3), 12);
  });
  it('does not let monitoring data change its own baseline limits', () => {
    const baseline = [10, 12, 11, 13];
    const before = analyze(points(baseline), 4, spec), after = analyze(points([...baseline, 100, 500]), 4, spec);
    expect(after.mean).toBe(before.mean); expect(after.sigma).toBe(before.sigma); expect(after.upperControl).toBe(before.upperControl);
    expect(after.signals.filter(signal => signal.rule === 'beyond-limit').map(signal => signal.index)).toEqual([4, 5]);
  });
  it('keeps specification changes separate from control limits', () => {
    const data = points([10, 12, 11, 13]);
    const a = analyze(data, 4, spec), b = analyze(data, 4, { lower: 10, upper: 13 });
    expect(a.upperControl).toBe(b.upperControl); expect(b.cp).toBeLessThan(a.cp!);
  });
  it('treats observations exactly on specification boundaries as within', () => expect(analyze(points([0, 20]), 2, spec).outOfSpec).toBe(0));
  it('returns undefined capability for a constant baseline, never infinity', () => {
    const result = analyze(points([12, 12, 12, 13]), 3, spec);
    expect(result.cp).toBeNull(); expect(result.cpk).toBeNull(); expect(result.warnings.some(w => w.includes('no measurable variation'))).toBe(true);
    expect(result.signals.some(signal => signal.index === 3 && signal.rule === 'beyond-limit')).toBe(true);
  });
  it('permits negative Cpk when the baseline mean is outside specification', () => expect(analyze(points([15, 16, 17]), 3, { lower: 0, upper: 10 }).cpk).toBeLessThan(0));
  it('warns when a monitoring shift limits capability interpretation', () => expect(analyze(createFixture('drift'), 25, { lower: 11.95, upper: 12.05 }).warnings.some(w => w.startsWith('Monitoring'))).toBe(true));
  it('retains useful precision for a large offset and small spread', () => expect(analyze(points([1e9, 1e9 + 1, 1e9 - 1]), 3, { lower: 0, upper: 2e9 }).sampleDeviation).toBeCloseTo(1, 10));
  it.each([1, 5, 2.5, NaN])('rejects invalid baseline %s', baseline => expect(() => analyze(points([1, 2, 3]), baseline, spec)).toThrow('Baseline'));
  it.each([{ lower: 2, upper: 2 }, { lower: 4, upper: 2 }, { lower: 0, upper: Infinity }])('rejects invalid specifications %j', limits => expect(() => analyze(points([1, 2, 3]), 3, limits)).toThrow('Specification'));
  it('rejects invalid programmatic measurements', () => expect(() => analyze(points([1, NaN]), 2, spec)).toThrow('finite'));
  it.each(golden.cases)('matches shared Python/TypeScript fixture $name', fixture => {
    const result = analyze(points(fixture.values), fixture.baseline, fixture.spec);
    for (const [key, expected] of Object.entries(fixture.expected)) {
      const actual = result[key as keyof typeof fixture.expected];
      if (expected === null) expect(actual).toBeNull();
      else expect(actual).toBeCloseTo(expected, 9);
    }
  });
});

describe('explicit rolling rule semantics', () => {
  it('uses strict three-sigma boundaries', () => expect(detectSignals([7, 13, 13.001, 6.999], 10, 1).filter(s => s.rule === 'beyond-limit').map(s => s.index)).toEqual([2, 3]));
  it('flags the endpoint of eight strictly same-side points', () => expect(detectSignals(Array(8).fill(2), 0, 100)).toEqual([{ index: 7, start: 0, rule: 'same-side', message: 'Eight consecutive measurements are strictly above the baseline mean.' }]));
  it('reports overlapping windows rather than losing a continuing run', () => expect(detectSignals(Array(9).fill(-2), 0, 100).map(s => s.index)).toEqual([7, 8]));
  it('resets the side rule at a point on the mean', () => expect(detectSignals([2, 2, 2, 2, 0, 2, 2, 2, 2], 0, 100)).toHaveLength(0));
  it('resets the side rule when the sign changes', () => expect(detectSignals([2, 2, 2, 2, -2, 2, 2, 2], 0, 100)).toHaveLength(0));
  it.each([[1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1]])('flags six strictly monotonic values %j', (...values) => expect(detectSignals(values, 0, 100).filter(s => s.rule === 'trend').map(s => [s.start, s.index])).toEqual([[0, 5]]));
  it('breaks a trend on a tie', () => expect(detectSignals([1, 2, 3, 3, 4, 5], 0, 100)).toHaveLength(0));
  it('breaks a trend on a reversal', () => expect(detectSignals([1, 2, 3, 2, 3, 4], 0, 100)).toHaveLength(0));
  it('creates repeatable synthetic data', () => expect(createFixture('drift')).toEqual(createFixture('drift')));
  it('shares an identical baseline across fixture scenarios', () => expect(createFixture('spike').slice(0, 25)).toEqual(createFixture('drift').slice(0, 25)));
});
