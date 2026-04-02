/**
 * Chromium Edge and legacy EdgeHTML — both often report reduced-motion in ways
 * that hide our UI transitions; we still run motion on Edge.
 */
export function isMicrosoftEdge(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return ua.includes("Edg/") || ua.includes("Edge/");
}

/** When true, skip route transitions, glow flashes, etc. */
export function honorReducedMotion(): boolean {
  if (isMicrosoftEdge()) return false;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
