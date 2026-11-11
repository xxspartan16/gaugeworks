import type { Measurement } from './types';

export type FixtureName = 'drift' | 'steady' | 'spike';
export const fixtureDetails: Record<FixtureName, { label: string; subtitle: string; description: string }> = {
  drift: { label: 'Tool wear', subtitle: 'A gradual dimensional shift', description: 'A synthetic shaft-diameter run. The first 25 parts establish a baseline; a gradual upward shift begins after part 35.' },
  steady: { label: 'Stable process', subtitle: 'Ordinary part-to-part variation', description: 'Synthetic measurements with steady variation around a 12 mm target. No injected shift or special-cause spike.' },
  spike: { label: 'Fixture slip', subtitle: 'One isolated measurement spike', description: 'A synthetic run with a single large excursion at part 42. Inspect it against the same first-25-part baseline.' },
};

export function createFixture(name: FixtureName): Measurement[] {
  let seed = 94217;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 60 }, (_, index) => {
    const noise = (random() + random() + random() - 1.5) * 0.025;
    const shift = name === 'drift' && index >= 35 ? (index - 34) * 0.0034 : 0;
    const spike = name === 'spike' && index === 41 ? 0.115 : 0;
    return { sample: `P-${String(index + 1).padStart(3, '0')}`, value: Number((12 + noise + shift + spike).toFixed(4)) };
  });
}
