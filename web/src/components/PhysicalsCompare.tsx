import type { PhysicalRow } from "../lib/playerMetrics";

interface PhysicalsCompareProps {
  rows: PhysicalRow[];
  subjectColor: string;
  compColor: string;
  compName?: string | null;
}

/**
 * Left-to-right "slider" rows for height / wingspan / reach / weight.
 * The glowing fill is the subject's measurement; the ghost marker is the comp
 * player; the far-right chip is the subject's percentile within the prospect class.
 */
export default function PhysicalsCompare({
  rows,
  subjectColor,
  compColor,
  compName,
}: PhysicalsCompareProps) {
  return (
    <div className="phys-compare">
      {rows.map((row) => (
        <div className="phys-row" key={row.key}>
          <div className="phys-row__label">{row.label}</div>

          <div className="phys-track">
            <div
              className="phys-track__fill"
              style={{
                width: `${(row.value != null ? row.fill : 0) * 100}%`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ["--fill-color" as any]: subjectColor,
              }}
            />
            {row.compFill != null && (
              <div
                className="phys-track__comp"
                style={{
                  left: `${row.compFill * 100}%`,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--comp-color" as any]: compColor,
                }}
                title={compName ? `${compName}: ${row.compDisplay}` : row.compDisplay ?? ""}
              />
            )}
            {row.compFill != null && row.compDisplay != null && (
              <span
                className={`phys-track__comp-value phys-track__comp-value--${
                  row.compFill > 0.5 ? "left" : "right"
                }`}
                style={{ left: `${row.compFill * 100}%`, color: compColor }}
                title={compName ?? undefined}
              >
                {row.compDisplay}
              </span>
            )}
            <span className="phys-track__value" style={{ color: subjectColor }}>
              {row.display}
            </span>
          </div>

          <div className="phys-row__pct">
            {row.percentile != null ? (
              <>
                <span className="phys-row__pct-num">{row.percentile}</span>
                <span className="phys-row__pct-sfx">%ile</span>
              </>
            ) : (
              <span className="phys-row__pct-sfx">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
