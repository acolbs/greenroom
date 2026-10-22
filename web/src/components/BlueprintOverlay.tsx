import { FILLED_AT, type BlueprintMatchResult } from "../lib/teamAnalysis";
import { roleLabel } from "../lib/format";

interface Props {
  match: BlueprintMatchResult;
  teamName: string;
}

/**
 * The past contender's rotation on the left (with how much of that team's
 * value each player carried), the best-fitting player from this roster on the
 * right, and how closely their play styles line up in between.
 */
export default function BlueprintOverlay({ match, teamName }: Props) {
  const bp = match.blueprint;
  const filled = match.pairings.filter((p) => p.similarity >= FILLED_AT).length;

  return (
    <div className="card card--flush">
      <div className="overlay__head">
        <div>
          <div className="eyebrow">
            {bp.season} · {bp.result}
          </div>
          <h3 className="h2 display" style={{ marginTop: "0.35rem" }}>{bp.team}</h3>
          <p className="overlay__identity">{bp.identity}</p>
        </div>
        <div className="overlay__score">
          <div className="num">{match.score}</div>
          <div className="eyebrow" style={{ marginTop: "0.3rem" }}>match</div>
          <div className="footnote" style={{ marginTop: "0.4rem" }}>
            {filled} of {match.pairings.length} roles filled
          </div>
        </div>
      </div>

      <div className="overlay__cols eyebrow">
        <span>{bp.abbrev} {bp.season.slice(2)}</span>
        <span style={{ textAlign: "center" }}>Fit (style × role size)</span>
        <span style={{ textAlign: "right" }}>{teamName}</span>
      </div>

      {match.pairings.map((p) => {
        const gap = p.similarity < FILLED_AT;
        return (
          <div key={p.blueprintPlayer.name} className={`overlay__row${gap ? " is-gap" : ""}`}>
            <div className="overlay__cell">
              <div className="overlay__player">{p.blueprintPlayer.name}</div>
              <div className="overlay__role">
                <span className="num">{Math.round(p.weight * 100)}%</span> of team value · {roleLabel(p.blueprintPlayer)}
              </div>
            </div>
            <div className="overlay__link" aria-label={`${Math.round(p.similarity * 100)}% fit`}>
              <span className="overlay__bar"><span style={{ width: `${p.similarity * 100}%` }} /></span>
              <span className="overlay__pct">{Math.round(p.similarity * 100)}%</span>
            </div>
            <div className="overlay__cell overlay__cell--right">
              {p.player && !gap ? (
                <>
                  <div className="overlay__player">{p.player.name}</div>
                  <div className="overlay__role">{roleLabel(p.player)}</div>
                </>
              ) : (
                <>
                  <div className="overlay__empty">Need</div>
                  <div className="overlay__role">
                    {p.player ? `Closest: ${p.player.name}` : "Nobody on the roster"}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
