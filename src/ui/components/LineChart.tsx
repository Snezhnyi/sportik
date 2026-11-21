import { useId, useMemo, useRef, useState } from 'react';
import { formatDate } from '../../lib/dates';

export interface Point { x: string; y: number }

const W = 340;
const H = 170;
const PAD = { l: 34, r: 12, t: 14, b: 22 };

/**
 * Single-series line chart: one hue, 2px line, recessive grid, tap/hover crosshair with tooltip.
 * Points are plotted by index (one session = one step) so dense weeks don't squeeze together.
 */
export function LineChart({ points, unit, target, format = (v) => `${Math.round(v * 10) / 10}` }: {
  points: Point[];
  unit: string;
  /** Optional horizontal reference line (e.g. target body weight). */
  target?: number | null;
  format?: (v: number) => string;
}) {
  const gid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    const ys = points.map((p) => p.y);
    if (target) ys.push(target);
    let min = Math.min(...ys);
    let max = Math.max(...ys);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * ih;
    const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
    return { x, y, ticks };
  }, [points, target]);

  if (!points.length) return null;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(i).toFixed(1)},${geo.y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${geo.x(points.length - 1)},${H - PAD.b}L${geo.x(0)},${H - PAD.b}Z`;
  const showDots = points.length <= 24;
  const last = points.length - 1;
  const active = hover ?? last;

  const onMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(geo.x(i) - px) < Math.abs(geo.x(best) - px)) best = i;
    setHover(best);
  };

  const tipX = geo.x(active);

  return (
    <div>
      <div className="row between small" style={{ marginBottom: 6 }}>
        <span className="muted">{formatDate(points[active].x, true)}</span>
        <span className="bold num">{format(points[active].y)} {unit}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`График: ${points.length} значений, последнее ${format(points[last].y)} ${unit}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.l - 6} y={geo.y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)">{format(t)}</text>
          </g>
        ))}
        {target ? (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(target)} y2={geo.y(target)} stroke="var(--text-3)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={W - PAD.r} y={geo.y(target) - 4} textAnchor="end" fontSize="10" fill="var(--text-2)">цель {format(target)}</text>
          </g>
        ) : null}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={tipX} x2={tipX} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-3)" strokeWidth="1" />}
        {showDots && points.map((p, i) => (
          <circle key={i} cx={geo.x(i)} cy={geo.y(p.y)} r={i === active ? 5 : 3.5} fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
        ))}
        {!showDots && <circle cx={tipX} cy={geo.y(points[active].y)} r={5} fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--text-3)">{formatDate(points[0].x)}</text>
        {points.length > 1 && <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--text-3)">{formatDate(points[last].x)}</text>}
      </svg>
    </div>
  );
}
