import { useEffect, useState } from "react";
import type { Position } from "../types/simulator";
import { headshotUrl, type HeadshotIndexPool } from "../data/headshotUrl";
import { teamLogoUrl } from "../data/constants";
import { avatarColorsForTeam } from "../data/teamAvatarTheme";
import { collegeThemeForSchool, collegeLogoUrl } from "../data/collegeAvatarTheme";

export type PlayerHeadshotPool = "nba" | "prospect";

interface Props {
  name: string;
  position: Position;
  size?: number;
  style?: React.CSSProperties;
  /** Use prospect PNGs (draft class) vs NBA roster PNGs. Default "nba". */
  headshotPool?: PlayerHeadshotPool;
  /**
   * Canonical NBA team id — ring colors + centered logo behind the headshot (when not using college).
   */
  teamId?: string | null;
  /**
   * College / school name from the big board. When `headshotPool` is "prospect" and this
   * is set, colors and logo use NCAA branding instead of `teamId`.
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
  const colors = useCollege
    ? { bg: college!.bg, text: college!.text }
    : avatarColorsForTeam(teamId, position);

  const logoSrc =
    useCollege && college!.logoId != null
      ? collegeLogoUrl(college.logoId)
      : teamId
        ? teamLogoUrl(teamId)
        : null;

  const fontSize = size * 0.36;
  const url = headshotUrl(name, indexPool(headshotPool));
  const [imgFailed, setImgFailed] = useState(!url);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setImgFailed(!url);
  }, [name, headshotPool, url]);

  useEffect(() => {
    setLogoFailed(false);
  }, [teamId, school, headshotPool]);

  const showImg = url && !imgFailed;
  const showLogo = Boolean(logoSrc) && !logoFailed;
  const initialsOnLogo = !showImg && showLogo;

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
      {showLogo ? (
        <img
          src={logoSrc!}
          alt=""
          aria-hidden
          draggable={false}
          onError={() => setLogoFailed(true)}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "86%",
            height: "86%",
            objectFit: "contain",
            objectPosition: "center",
            opacity: showImg ? 0.34 : 0.5,
            zIndex: 0,
            pointerEvents: "none",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
          }}
        />
      ) : null}

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
          background:
            showImg || initialsOnLogo
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
              position: "relative",
              zIndex: 1,
              textShadow: initialsOnLogo
                ? "0 0 10px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9), 0 0 1px #000"
                : undefined,
            }}
          >
            {getInitials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
