/**
 * Resolves a path under /public/data/ to a full URL that works both in
 * local dev (base = "/") and on GitHub Pages (base = "/greenroom/").
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${normalized}`;
}
