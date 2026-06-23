import type { RadarPoint } from "../lib/playerMetrics";

interface RadarChartProps {
  subject: RadarPoint[];
  comp?: RadarPoint[] | null;
  subjectColor: string;
  compColor: string;
  size?: number;
}

/**
 * Flat SVG radar — six axes with a soft glow. Each spoke is labeled with the
 * stat name plus its value and unit (e.g. "Scoring / 19.9 PPG"), spelling out
 * exactly what each axis measures. When a comp is overlaid its value appears
 * beneath the subject's in the comp color.
 */
export default function RadarChart({
  subject,
  comp,
  subjectColor,
  compColor,
  size = 340,
}: RadarChartProps) {
  // Leave generous margin around the polygon for the two-line labels.
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.3;
  const n = subject.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number): [number, number] => [
    cx + Math.cos(angle(i)) * r,
    cy + Math.sin(angle(i)) * r,
  ];
  const polygon = (pts: RadarPoint[]): string =>
    pts
      .map((p, i) => {
        const [x, y] = point(i, R * (p.norm / 100));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  // Anchor each label sensibly by its position around the circle so the text
  // never overhangs the chart edge.
  const labelAnchor = (x: number): "start" | "middle" | "end" => {
    if (x < cx - 4) return "end";
    if (x > cx + 4) return "start";
    return "middle";
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="radar-chart"
      role="img"
      aria-label="Player comparison radar"
    >
      <defs>
        <filter id="radar-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={subject.map((_, i) => point(i, R * r).map((v) => v.toFixed(1)).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={1}
        />
      ))}
      {/* spokes */}
      {subject.map((_, i) => {
        const [x, y] = point(i, R);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
        );
      })}

      {/* comp overlay (under) */}
      {comp && (
        <polygon
          points={polygon(comp)}
          fill={compColor}
          fillOpacity={0.14}
          stroke={compColor}
          strokeWidth={2}
          strokeOpacity={0.85}
          filter="url(#radar-glow)"
        />
      )}
      {/* subject */}
      <polygon
        points={polygon(subject)}
        fill={subjectColor}
        fillOpacity={0.2}
        stroke={subjectColor}
        strokeWidth={2.5}
        strokeOpacity={0.95}
        filter="url(#radar-glow)"
      />

      {/* axis labels: stat name + subject value (+ comp value when present) */}
      {subject.map((p, i) => {
        const [x, y] = point(i, R + 16);
        const anchor = labelAnchor(x);
        return (
          <text key={p.key} x={x} y={y} textAnchor={anchor} className="radar-chart__label">
            <tspan x={x} dy="-0.3em" className="radar-chart__label-name">
              {p.label}
            </tspan>
            <tspan x={x} dy="1.25em" className="radar-chart__label-val" fill={subjectColor}>
              {p.display}
            </tspan>
            {comp && (
              <tspan x={x} dy="1.2em" className="radar-chart__label-comp" fill={compColor}>
                {comp[i].display}
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
}
