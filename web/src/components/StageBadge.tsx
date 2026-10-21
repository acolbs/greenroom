import type { TeamStrengthLabel } from "../types/simulator";

export default function StageBadge({ label }: { label: TeamStrengthLabel }) {
  return <span className={`stage-badge stage--${label}`}>{label}</span>;
}
