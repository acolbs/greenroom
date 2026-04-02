import { useState } from "react";
import { teamLogoUrl } from "../data/constants";

interface Props {
  teamId: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TeamLogo({ teamId, size = 40, className, style }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.35,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          color: "var(--color-text-muted)",
          flexShrink: 0,
          ...style,
        }}
      >
        {teamId.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={teamLogoUrl(teamId)}
      alt={teamId}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      style={{ objectFit: "contain", flexShrink: 0, ...style }}
    />
  );
}
