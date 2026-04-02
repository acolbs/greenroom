import { useEffect, useState } from "react";
import type { Position } from "../types/simulator";
import { headshotUrl, type HeadshotIndexPool } from "../data/headshotUrl";
import { teamLogoUrl } from "../data/constants";
import { avatarColorsForTeam } from "../data/teamAvatarTheme";

export type PlayerHeadshotPool = "nba" | "prospect";

interface Props {
  name: string;
  position: Position;
  size?: number;
  style?: React.CSSProperties;
  /** Use prospect PNGs (draft class) vs NBA roster PNGs. Default "nba". */
  headshotPool?: PlayerHeadshotPool;
  /**
   * Canonical team id (e.g. BOS). When set, ring uses team colors + faded logo behind the headshot.
   */
  teamId?: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function indexPool(pool: PlayerHeadshotPool): HeadshotIndexPool {
  return pool === "prospect" ? "prospects" : "nba";
}

function borderWithAlpha(textColor: string, alphaHex: string): string {
  if (textColor.startsWith("#") && textColor.length === 7) {
    return `${textColor}${alphaHex}`;
  }
  return textColor;
}

export default function PlayerAvatar({
  name,
  position,
  size = 44,
  style,
  headshotPool = "nba",
  teamId = null,
}: Props) {
  const colors = avatarColorsForTeam(teamId, position);
  const fontSize = size * 0.36;
  const url = headshotUrl(name, indexPool(headshotPool));
  const [imgFailed, setImgFailed] = useState(!url);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setImgFailed(!url);
  }, [name, headshotPool, url]);

  useEffect(() => {
    setLogoFailed(false);
  }, [teamId]);

  const showImg = url && !imgFailed;
  const ringPx = teamId ? Math.max(2, Math.round(size * 0.075)) : 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors.bg,
        border: `1.5px solid ${borderWithAlpha(colors.text, "44")}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {teamId && !logoFailed ? (
        <img
          src={teamLogoUrl(teamId)}
          alt=""
          aria-hidden
          draggable={false}
          onError={() => setLogoFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            opacity: 0.28,
            transform: "scale(1.5)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          top: ringPx,
          left: ringPx,
          right: ringPx,
          bottom: ringPx,
          borderRadius: "50%",
          overflow: "hidden",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: showImg
            ? undefined
            : `linear-gradient(160deg, ${colors.bg}f2, ${colors.bg})`,
        }}
      >
        {showImg ? (
          <img
            src={url}
            alt=""
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />
        ) : (
          <span
            style={{
              fontSize,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: colors.text,
              letterSpacing: "0.02em",
            }}
          >
            {getInitials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
