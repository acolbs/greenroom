import { useEffect, useState } from "react";
import type { Position } from "../types/simulator";
import { headshotUrl, type HeadshotIndexPool } from "../data/headshotUrl";
import { avatarColorsForTeam } from "../data/teamAvatarTheme";
import { collegeThemeForSchool } from "../data/collegeAvatarTheme";

export type PlayerHeadshotPool = "nba" | "prospect";

interface Props {
  name: string;
  position: Position;
  size?: number;
  style?: React.CSSProperties;
  /** Use prospect PNGs (draft class) vs NBA roster PNGs. Default "nba". */
  headshotPool?: PlayerHeadshotPool;
  /** Canonical NBA team id — avatar ring uses team colors when set. */
  teamId?: string | null;
  /**
   * College / school from the big board. When `headshotPool` is "prospect" and set,
   * colors follow school branding instead of `teamId`.
   */
  school?: string | null;
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
  school = null,
}: Props) {
  const useCollege = headshotPool === "prospect" && Boolean(school?.trim());
  const college = useCollege ? collegeThemeForSchool(school!) : null;
  const colors = useCollege && college
    ? { bg: college.bg, text: college.text }
    : avatarColorsForTeam(teamId, position);

  const fontSize = size * 0.36;
  const url = headshotUrl(name, indexPool(headshotPool));
  const [imgFailed, setImgFailed] = useState(!url);

  useEffect(() => {
    setImgFailed(!url);
  }, [name, headshotPool, url]);

  const showImg = url && !imgFailed;

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: showImg ? undefined : `linear-gradient(160deg, ${colors.bg}f2, ${colors.bg})`,
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
