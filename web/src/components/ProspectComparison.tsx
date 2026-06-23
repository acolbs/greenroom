import { useMemo, useState } from "react";
import type { DraftProspect } from "../types/simulator";
import { useSimulatorStore } from "../store/simulatorStore";
import { normalizeName } from "../data/csvUtils";
import {
  radarFromCollege,
  radarFromNba,
  buildPhysicalRows,
} from "../lib/playerMetrics";
import HologramRadar from "./HologramRadar";
import PhysicalsCompare from "./PhysicalsCompare";

const SUBJECT_COLOR = "#46A877"; // pine
const COMP_COLOR = "#39E3FF"; // cyan

export default function ProspectComparison({ prospect }: { prospect: DraftProspect }) {
  const comparisonData = useSimulatorStore((st) => st.comparisonData);
  const comps = useMemo(() => (prospect.comps ?? []).slice(0, 3), [prospect.comps]);
  const [selected, setSelected] = useState(0);

  const activeComp = comps[selected] ?? null;

  const subjectRadar = useMemo(
    () => (prospect.collegeStats ? radarFromCollege(prospect.collegeStats) : null),
    [prospect.collegeStats]
  );

  const compRadar = useMemo(() => {
    if (!activeComp || !comparisonData) return null;
    const stats = comparisonData.nbaRadarByName.get(normalizeName(activeComp.name));
    return stats ? radarFromNba(stats) : null;
  }, [activeComp, comparisonData]);

  const physRows = useMemo(() => {
    if (!prospect.physicals || !comparisonData) return null;
    const compPhys = activeComp
      ? comparisonData.physicalsByName.get(normalizeName(activeComp.name)) ?? null
      : null;
    return buildPhysicalRows(
      prospect.physicals,
      compPhys,
      comparisonData.prospectPhysicals
    );
  }, [prospect.physicals, activeComp, comparisonData]);

  // Nothing to show without at least the radar or the physicals.
  if (!subjectRadar && !physRows) return null;

  return (
    <>
      <div className="player-modal__divider" />
      <div className="player-modal__section-label">Comparison Lab</div>

      {comps.length > 0 && (
        <div className="comp-switcher">
          {comps.map((c, i) => (
            <button
              key={c.name}
              type="button"
              className={`comp-chip${i === selected ? " comp-chip--active" : ""}`}
              onClick={() => setSelected(i)}
            >
              <span className="comp-chip__name">{c.name}</span>
              <span className="comp-chip__sim">{Math.round(c.similarity)}%</span>
            </button>
          ))}
        </div>
      )}

      <div className="comp-legend">
        <span className="comp-legend__item">
          <span className="comp-legend__dot" style={{ background: SUBJECT_COLOR }} />
          {prospect.name}
        </span>
        {activeComp && (
          <span className="comp-legend__item">
            <span className="comp-legend__dot" style={{ background: COMP_COLOR }} />
            {activeComp.name}
          </span>
        )}
      </div>

      {subjectRadar && (
        <div className="comp-radar-wrap">
          <HologramRadar
            subject={subjectRadar}
            comp={compRadar}
            subjectColor={SUBJECT_COLOR}
            compColor={COMP_COLOR}
          />
          <div className="comp-radar-grid">
            {subjectRadar.map((p, i) => (
              <div className="comp-stat" key={p.key}>
                <span className="comp-stat__label">{p.label}</span>
                <span className="comp-stat__vals">
                  <b style={{ color: SUBJECT_COLOR }}>{p.display}</b>
                  {compRadar && (
                    <span style={{ color: COMP_COLOR }}>{compRadar[i].display}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {physRows && (
        <>
          <div className="player-modal__section-label" style={{ marginTop: "1.25rem" }}>
            Measurements
          </div>
          <PhysicalsCompare
            rows={physRows}
            subjectColor={SUBJECT_COLOR}
            compColor={COMP_COLOR}
            compName={activeComp?.name ?? null}
          />
          <div className="player-modal__no-stats" style={{ marginTop: "0.5rem" }}>
            Percentile vs the 2026 draft class · combine measurements
          </div>
        </>
      )}
    </>
  );
}
