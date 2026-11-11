export interface Measurement { sample: string; value: number }
export interface Specification { lower: number; upper: number }
export type Rule = 'beyond-limit' | 'same-side' | 'trend';
export interface Signal { index: number; rule: Rule; start: number; message: string }
export interface Analysis {
  count: number;
  baselineCount: number;
  mean: number;
  sampleDeviation: number;
  movingRangeMean: number;
  sigma: number;
  lowerControl: number;
  upperControl: number;
  cp: number | null;
  cpk: number | null;
  outOfSpec: number;
  signals: Signal[];
  warnings: string[];
}
