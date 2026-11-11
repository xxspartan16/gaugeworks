import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { RULE_NAMES } from '../domain/analysis';
import type { Analysis, Measurement, Specification } from '../domain/types';

interface Props { points: Measurement[]; analysis: Analysis; spec: Specification; selected: number; onSelect: (index: number) => void }
export default function MeasurementsTable({ points, analysis, spec, selected, onSelect }: Props) {
  const [query, setQuery] = useState(''), [onlySignals, setOnlySignals] = useState(false), [page, setPage] = useState(0);
  const signalMap = useMemo(() => {
    const result = new Map<number, string[]>();
    for (const signal of analysis.signals) result.set(signal.index, [...(result.get(signal.index) ?? []), RULE_NAMES[signal.rule]]);
    return result;
  }, [analysis]);
  const filtered = points.map((point, index) => ({ ...point, index })).filter(point => point.sample.toLowerCase().includes(query.toLowerCase()) && (!onlySignals || signalMap.has(point.index)));
  const pages = Math.max(1, Math.ceil(filtered.length / 12)), currentPage = Math.min(page, pages - 1);
  return <section className="panel measurement-panel">
    <div className="panel-heading"><div><span className="eyebrow">THE SOURCE OF TRUTH</span><h2>Measurements</h2></div><span className="count-badge">{points.length} rows</span></div>
    <div className="table-tools"><label className="search"><Search size={16} /><input value={query} placeholder="Find a sample…" aria-label="Find a sample" onChange={event => { setQuery(event.target.value); setPage(0); }} /></label><label className="checkbox-label"><input type="checkbox" checked={onlySignals} onChange={event => { setOnlySignals(event.target.checked); setPage(0); }} /> Signals only</label></div>
    <div className="table-scroll"><table><thead><tr><th scope="col">Sample</th><th scope="col">Phase</th><th scope="col" className="numeric">Diameter / mm</th><th scope="col">Specification</th><th scope="col">Rule signals</th></tr></thead><tbody>
      {filtered.slice(currentPage * 12, (currentPage + 1) * 12).map(point => <tr key={point.index} className={selected === point.index ? 'selected-row' : ''}><td><button className="sample-button" onClick={() => onSelect(point.index)} aria-label={`Inspect ${point.sample}`}>{point.sample}</button></td><td><span className="phase-label">{point.index < analysis.baselineCount ? 'Baseline' : 'Monitoring'}</span></td><td className="numeric mono">{point.value.toFixed(4)}</td><td>{point.value < spec.lower || point.value > spec.upper ? <span className="text-rust">Outside</span> : <span className="text-green">Within</span>}</td><td><span className={signalMap.has(point.index) ? 'text-rust' : 'muted'}>{signalMap.get(point.index)?.join(' · ') ?? '—'}</span></td></tr>)}
      {!filtered.length && <tr><td colSpan={5} className="empty-cell">No measurements match this filter.</td></tr>}
    </tbody></table></div>
    <div className="pagination"><span>{filtered.length ? currentPage * 12 + 1 : 0}–{Math.min((currentPage + 1) * 12, filtered.length)} of {filtered.length} measurements</span><div><button className="icon-button" aria-label="Previous table page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span>{currentPage + 1} / {pages}</span><button className="icon-button" aria-label="Next table page" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div></div>
  </section>;
}
