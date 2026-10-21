interface Props {
  value: number;
  accent?: boolean;
}

/** A 0–100 number with a thin bar under it. */
export default function ScoreCell({ value, accent }: Props) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className={`score${accent ? " score--accent" : ""}`}>
      <span className="score__n">{v}</span>
      <span className="score__bar"><span style={{ width: `${v}%` }} /></span>
    </span>
  );
}
