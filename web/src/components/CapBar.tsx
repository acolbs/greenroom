import { SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON } from "../data/constants";

interface Props {
  payroll: number;
}

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

const THRESHOLDS = [
  { label: "Cap",  value: SALARY_CAP,   color: "var(--color-accent)" },
  { label: "Tax",  value: LUXURY_TAX,   color: "var(--color-warning)" },
  { label: "1st",  value: FIRST_APRON,  color: "#f0883e" },
  { label: "2nd",  value: SECOND_APRON, color: "var(--color-danger)" },
] as const;

export default function CapBar({ payroll }: Props) {
  const ceiling = SECOND_APRON * 1.08;
  const fillPct = Math.min((payroll / ceiling) * 100, 100);

  let fillColor = "var(--color-accent)";
  if (payroll > SECOND_APRON)     fillColor = "var(--color-danger)";
  else if (payroll > FIRST_APRON) fillColor = "#f0883e";
  else if (payroll > LUXURY_TAX)  fillColor = "var(--color-warning)";

  const pct = (v: number) => Math.min((v / ceiling) * 100, 100);

  return (
    <div className="cap-bar-wrap">
      {/* Top row: payroll left, cap right */}
      <div className="cap-bar-label">
        <span>
          Payroll&nbsp;
          <strong style={{ color: fillColor }}>{fmt(payroll)}</strong>
        </span>
        <span>Cap&nbsp;<strong>{fmt(SALARY_CAP)}</strong></span>
      </div>

      {/* Track — markers only, no labels */}
      <div className="cap-bar-track">
        <div
          className="cap-bar-fill"
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
        {THRESHOLDS.map((t) => (
          <div
            key={t.label}
            className="cap-bar-marker"
            style={{ left: `${pct(t.value)}%`, background: t.color, opacity: 0.6 }}
          />
        ))}
      </div>

      {/* Legend row */}
      <div className="cap-bar-thresholds">
        {THRESHOLDS.map((t) => (
          <span key={t.label}>
            <span className="dot" style={{ background: t.color }} />
            {t.label}&nbsp;{fmt(t.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
