/** $12.3M style money. */
export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

/** "Shot Creator / Helper" */
export function roleLabel(p: { offensiveArchetype: string; defensiveRole: string }): string {
  return `${p.offensiveArchetype} / ${p.defensiveRole}`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
