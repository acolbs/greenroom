interface Props {
  /** 0–100 readiness score. */
  score: number;
  /** Track label, e.g. "Contender". */
  label: string;
  /** Optional supporting line under the gauge. */
  sublabel?: string;
}

// Semicircular needle gauge. 0% = needle hard left, 100% = hard right.
const CX = 110;
const CY = 118;
const R = 98;

function pointAt(pct: number): [number, number] {
  const theta = Math.PI * (1 - pct / 100); // 0% → π (left), 100% → 0 (right)
  return [CX + R * Math.cos(theta), CY - R * Math.sin(theta)];
}

export default function ReadinessGauge({ score, label, sublabel }: Props) {
  const s = Math.max(0, Math.min(100, score));
  const [sx, sy] = pointAt(0);
  const [ex, ey] = pointAt(100);
  const [vx, vy] = pointAt(s);
  const needleAngle = (s / 100) * 180 - 90; // -90° (left) … +90° (right)

  return (
    <div className="gauge">
      <svg className="gauge__svg" viewBox="0 0 220 132" role="img"
           aria-label={`Championship readiness ${Math.round(s)} of 100`}>
        <path className="gauge__track" d={`M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}`} />
        {s > 0 && (
          <path className="gauge__value" d={`M ${sx} ${sy} A ${R} ${R} 0 0 1 ${vx} ${vy}`} />
        )}
        <g transform={`rotate(${needleAngle} ${CX} ${CY})`}>
          <line className="gauge__needle" x1={CX} y1={CY} x2={CX} y2={CY - R + 16} />
          <circle className="gauge__hub" cx={CX} cy={CY} r="7" />
          <circle className="gauge__hub-dot" cx={CX} cy={CY} r="3" />
        </g>
      </svg>
      <div className="gauge__num">{Math.round(s)}</div>
      <div className="gauge__label">{label}</div>
      {sublabel && <div className="gauge__sub">{sublabel}</div>}
    </div>
  );
}
