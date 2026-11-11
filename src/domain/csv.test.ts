import { describe, expect, it } from 'vitest';
import { CsvError, exportMeasurements, parseMeasurements } from './csv';

describe('measurement CSV boundary', () => {
  it('reads decimals, exponent notation and original order', () => {
    expect(parseMeasurements('sample,value\nB,1.2e1\nA,-.25')).toEqual([{ sample: 'B', value: 12 }, { sample: 'A', value: -0.25 }]);
  });
  it('accepts timestamp labels, BOM, CRLF and extra columns', () => {
    expect(parseMeasurements('\uFEFFtimestamp,value,note\r\n2026-01-01,1,a\r\n2026-01-02,2,b\r\n')).toHaveLength(2);
  });
  it('preserves commas, escaped quotes, and quoted newlines in labels', () => {
    expect(parseMeasurements('sample,value\n"part, ""A""",1\n"part\nB",2')).toEqual([{ sample: 'part, "A"', value: 1 }, { sample: 'part\nB', value: 2 }]);
  });
  it('skips blank rows and normalizes header case', () => {
    expect(parseMeasurements(' SAMPLE , Value \n\nA,1\n\nB,2\n')).toHaveLength(2);
  });
  it.each(['NaN', 'Infinity', '', '0x12', '12mm', '1e309', '1000000000001'])('rejects invalid numeric input %j with row number', value => {
    expect(() => parseMeasurements(`sample,value\nA,1\nB,${value}`)).toThrow(/Row 3:/);
  });
  it('rejects a missing label', () => expect(() => parseMeasurements('sample,value\nA,1\n,2')).toThrow('Sample label cannot be empty'));
  it('rejects ragged rows', () => expect(() => parseMeasurements('sample,value\nA,1,extra\nB,2')).toThrow('Expected 2 columns'));
  it('rejects duplicate headers', () => expect(() => parseMeasurements('sample,value,value\nA,1,2\nB,2,3')).toThrow('Column names must be unique'));
  it('rejects absent required columns', () => expect(() => parseMeasurements('id,diameter\nA,1\nB,2')).toThrow('Expected sample,value'));
  it('reports unterminated quotes at the originating physical row', () => expect(() => parseMeasurements('sample,value\nA,1\n"B\nC,2')).toThrow('Row 3: The quoted field was not closed'));
  it('rejects text after a closing quote', () => expect(() => parseMeasurements('sample,value\n"A"x,1\nB,2')).toThrow('Expected a comma'));
  it('rejects quotes embedded in unquoted fields', () => expect(() => parseMeasurements('sample,value\nA"x,1\nB,2')).toThrow('Unexpected quote'));
  it('requires at least two observations', () => expect(() => parseMeasurements('sample,value\nA,1')).toThrow('At least two'));
  it('rejects a file above the byte limit', () => expect(() => parseMeasurements('x'.repeat(1_048_577))).toThrow('1 MiB'));
  it('rejects more than 10,000 observations', () => expect(() => parseMeasurements(`sample,value\n${Array.from({ length: 10_001 }, (_, index) => `${index},1`).join('\n')}`)).toThrow('10,000'));
  it('exports quoted labels that round-trip', () => {
    const points = [{ sample: 'A,"part"', value: 2.01 }, { sample: 'B\npart', value: -1 }];
    expect(parseMeasurements(exportMeasurements(points))).toEqual(points);
  });
  it('neutralizes formula-like text on spreadsheet export', () => {
    const csv = exportMeasurements([{ sample: '=SUM(1)', value: 1 }, { sample: ' +1', value: 2 }]);
    expect(csv).toContain("'=SUM(1)"); expect(csv).toContain("' +1");
  });
  it('exposes a machine-readable physical row', () => {
    try { parseMeasurements('sample,value\nA,1\nB,x'); } catch (error) { expect(error).toBeInstanceOf(CsvError); expect((error as CsvError).row).toBe(3); }
  });
});
