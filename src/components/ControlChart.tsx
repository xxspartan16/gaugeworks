import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Analysis, Measurement, Specification } from '../domain/types';

interface Props { points: Measurement[]; analysis: Analysis; spec: Specification; selected: number; onSelect: (index: number) => void }
export default function ControlChart({ points, analysis, spec, selected, onSelect }: Props) {
  const width = 920, height = 320, left = 60, right = 28, top = 27, bottom = 44;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  let low = Math.min(spec.lower, analysis.lowerControl), high = Math.max(spec.upper, analysis.upperControl);
  for (const point of points) { low = Math.min(low, point.value); high = Math.max(high, point.value); }
  const padding = Math.max((high - low) * 0.14, 0.001);
  low -= padding; high += padding;
  const x = (index: number) => left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (value: number) => top + ((high - value) / (high - low)) * plotHeight;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
  const signalIndices = [...new Set(analysis.signals.map(signal => signal.index))];
  const tickIndices = [...new Set(Array.from({ length: 6 }, (_, index) => Math.round((index / 5) * (points.length - 1))))];
  const selectedPoint = points[selected];
  const baselineEnd = x(analysis.baselineCount - 1);
  return <>
    <div className="chart-access" role="group" aria-label="Inspect chart measurement">
      <button className="icon-button" aria-label="Previous measurement" disabled={selected === 0} onClick={() => onSelect(selected - 1)}><ChevronLeft size={17} /></button>
      <span><b>{selectedPoint.sample}</b><span className="muted"> · </span>{selectedPoint.value.toFixed(4)} mm</span>
      <button className="icon-button" aria-label="Next measurement" disabled={selected === points.length - 1} onClick={() => onSelect(selected + 1)}><ChevronRight size={17} /></button>
    </div>
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-description">
        <title id="chart-title">Individuals control chart</title>
        <desc id="chart-description">{points.length} ordered measurements. Baseline is the first {analysis.baselineCount}. Mean {analysis.mean.toFixed(4)}, lower control limit {analysis.lowerControl.toFixed(4)}, upper control limit {analysis.upperControl.toFixed(4)}. Use previous and next measurement controls or the measurements table to inspect exact values.</desc>
        <defs><clipPath id="plot-clip"><rect x={left} y={top} width={plotWidth} height={plotHeight} /></clipPath></defs>
        <rect x={left} y={top} width={Math.max(0, baselineEnd - left)} height={plotHeight} fill="#edf0e8" />
        {Array.from({ length: 5 }, (_, i) => {
          const value = low + (i / 4) * (high - low);
          return <g key={i}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e3e6dd" /><text x={left - 12} y={y(value) + 4} textAnchor="end" className="axis-label">{value.toFixed(3)}</text></g>;
        })}
        <text x={left} y={14} className="chart-note">DIAMETER / mm</text>
        <text x={left + 10} y={top + 17} className="baseline-label">BASELINE</text>
        {analysis.baselineCount < points.length && <text x={baselineEnd + 12} y={top + 17} className="chart-note">MONITORING</text>}
        <line x1={baselineEnd} x2={baselineEnd} y1={top} y2={height - bottom} stroke="#b7c0b2" strokeDasharray="3 4" />
        {[spec.lower, spec.upper].map((value, index) => <line key={`spec-${index}`} x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#839187" strokeDasharray="2 5" />)}
        {[analysis.lowerControl, analysis.upperControl].map((value, index) => <line key={`control-${index}`} x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#b17c35" strokeWidth="1.5" strokeDasharray="7 5" />)}
        <line x1={left} x2={width - right} y1={y(analysis.mean)} y2={y(analysis.mean)} stroke="#3d6b59" strokeWidth="1" opacity="0.5" />
        <g clipPath="url(#plot-clip)">
          <path d={path} fill="none" stroke="#275a47" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.length <= 100 && points.map((point, index) => <circle key={index} cx={x(index)} cy={y(point.value)} r="2.7" fill="#275a47" />)}
          {signalIndices.slice(0, 300).map(index => <circle key={`signal-${index}`} cx={x(index)} cy={y(points[index].value)} r="4.1" fill="#c2704b" stroke="#fffef9" strokeWidth="1.4" />)}
          <line x1={x(selected)} x2={x(selected)} y1={top} y2={height - bottom} stroke="#172e26" strokeDasharray="2 3" opacity="0.4" />
          <circle cx={x(selected)} cy={y(selectedPoint.value)} r="7" fill="#fffef9" stroke="#183d2e" strokeWidth="2" />
          <circle cx={x(selected)} cy={y(selectedPoint.value)} r="2.5" fill="#183d2e" />
        </g>
        {tickIndices.map(index => <text key={index} x={x(index)} y={height - 17} textAnchor="middle" className="axis-label">{index + 1}</text>)}
        <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" className="chart-hit" onClick={event => {
          const rect = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
          const svgX = (event.clientX - rect.left) * width / rect.width;
          onSelect(Math.max(0, Math.min(points.length - 1, Math.round((svgX - left) / plotWidth * (points.length - 1)))));
        }} />
      </svg>
    </div>
    <div className="chart-footer"><div className="chart-legend"><span><i className="legend-line" /> Measurement</span><span><i className="legend-line amber" /> Control limit</span><span><i className="legend-line dotted" /> Specification</span><span><i className="legend-dot" /> Rule signal</span></div><span className="muted">Ordered sample →</span></div>
    {signalIndices.length > 300 && <p className="micro muted">First 300 signal markers shown; all measurements and signals remain in the table and report.</p>}
  </>;
}
