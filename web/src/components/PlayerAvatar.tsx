import type { Position } from "../types/simulator";

const POS_COLORS: Record<Position, { bg: string; text: string }> = {
  PG: { bg: "#1a3a6e", text: "#79b8ff" },
  SG: { bg: "#2d1f5e", text: "#c084fc" },
  SF: { bg: "#3a2200", text: "#fb923c" },
  PF: { bg: "#3a1a00", text: "#f97316" },
  C:  { bg: "#0d2e20", text: "#34d399" },
};

interface Props {
  name: string;
  position: Position;
  size?: number;
  style?: React.CSSProperties;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerAvatar({ name, position, size = 44, style }: Props) {
  const colors = POS_COLORS[position] ?? { bg: "#1a2230", text: "#b0bec5" };
  const fontSize = size * 0.36;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors.bg,
        border: `1.5px solid ${colors.text}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        color: colors.text,
        flexShrink: 0,
        letterSpacing: "0.02em",
        ...style,
      }}
    >
      {getInitials(name)}
    </div>
  );
}
