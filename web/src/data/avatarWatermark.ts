/**
 * Soft “profile card” plate behind the headshot + logo watermark (dark UI).
 * Uses color-mix when supported; falls back to semi-transparent overlay.
 */
export function watermarkPlateBackground(accentHex: string, fallbackBg: string): string {
  const a = accentHex.trim();
  if (!a.startsWith("#") || a.length !== 7) {
    return fallbackBg;
  }
  return `linear-gradient(
    165deg,
    color-mix(in srgb, ${a} 18%, #323b4d),
    color-mix(in srgb, ${a} 9%, #282f3f)
  )`;
}
