import type { RadarPoint } from "../lib/playerMetrics";

interface RadarFallbackProps {
  subject: RadarPoint[];
  comp?: RadarPoint[] | null;
  subjectColor: string;
  compColor: string;
  size?: number;
}

/**
 * Static SVG radar — used when WebGL is unavailable. Same six axes and overlay
 * as the hologram, drawn flat with a soft glow filter.
 */
export default function RadarFallback({
  subject,
  comp,
  subjectColor,
  compColor,
  size = 320,
}: RadarFallbackProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
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

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="radar-fallback"
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

      {/* axis labels */}
      {subject.map((p, i) => {
        const [x, y] = point(i, R + 18);
        return (
          <text
            key={p.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="radar-fallback__label"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
