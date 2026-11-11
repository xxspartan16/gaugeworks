import type { Measurement } from './types';

export class CsvError extends Error {
  readonly row: number;
  constructor(message: string, row: number) {
    super(`Row ${row}: ${message}`);
    this.name = 'CsvError';
    this.row = row;
  }
}

interface RecordRow { fields: string[]; line: number }

// A small state machine keeps delimiters and newlines inside quoted fields intact.
function records(text: string): RecordRow[] {
  const result: RecordRow[] = [];
  let fields: string[] = [], field = '', quoted = false, closed = false, line = 1, start = 1;
  const pushField = () => { fields.push(field); field = ''; closed = false; };
  const pushRow = () => {
    pushField();
    if (fields.some(value => value.trim() !== '')) result.push({ fields, line: start });
    fields = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else {
        field += char;
        if (char === '\n') line++;
      }
      continue;
    }
    if (char === '"') {
      if (field !== '' || closed) throw new CsvError('Unexpected quote in an unquoted field.', line);
      quoted = true;
    } else if (char === ',') pushField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      pushRow(); line++; start = line;
    } else {
      if (closed) {
        if (char === ' ' || char === '\t') continue;
        throw new CsvError('Expected a comma or newline after the closing quote.', line);
      }
      field += char;
    }
  }
  if (quoted) throw new CsvError('The quoted field was not closed.', start);
  if (field !== '' || fields.length || closed) pushRow();
  return result;
}

export function parseMeasurements(source: string): Measurement[] {
  if (new TextEncoder().encode(source).length > 1_048_576) throw new CsvError('File exceeds the 1 MiB limit.', 1);
  const rows = records(source.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new CsvError('Add a header and at least two measurements.', 1);
  const header = rows[0].fields.map(value => value.trim().toLowerCase());
  if (new Set(header).size !== header.length) throw new CsvError('Column names must be unique.', rows[0].line);
  const valueColumn = header.indexOf('value');
  const sampleColumn = header.includes('sample') ? header.indexOf('sample') : header.indexOf('timestamp');
  if (valueColumn === -1 || sampleColumn === -1) throw new CsvError('Expected sample,value or timestamp,value columns.', rows[0].line);
  if (rows.length > 10_001) throw new CsvError('The limit is 10,000 measurements.', 1);
  const points = rows.slice(1).map(({ fields, line }) => {
    if (fields.length !== header.length) throw new CsvError(`Expected ${header.length} columns, received ${fields.length}.`, line);
    const label = fields[sampleColumn].trim(), raw = fields[valueColumn].trim();
    if (!label) throw new CsvError('Sample label cannot be empty.', line);
    if (label.length > 200) throw new CsvError('Sample labels must be 200 characters or fewer.', line);
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) throw new CsvError('Value must be a finite decimal number.', line);
    const value = Number(raw);
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new CsvError('Value must be finite and between -1e12 and 1e12.', line);
    return { sample: label, value };
  });
  if (points.length < 2) throw new CsvError('At least two measurements are required.', rows.at(-1)?.line ?? 1);
  return points;
}

function csvField(value: string): string {
  // Prevent spreadsheet applications from interpreting imported labels as formulas.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function exportMeasurements(points: Measurement[]): string {
  return ['sample,value', ...points.map(point => `${csvField(point.sample)},${point.value}`)].join('\r\n');
}
