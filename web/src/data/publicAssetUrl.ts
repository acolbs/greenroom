/**
 * URLs for files in `public/` (e.g. `public/data/foo.csv` → `data/foo.csv`).
 * Must go through this so GitHub Pages subpaths (`base: /greenroom/`) resolve correctly.
 */
export function publicAssetUrl(path: string): string {
  const p = path.replace(/^\//, "");
  const base = import.meta.env.BASE_URL;
  return base.endsWith("/") ? `${base}${p}` : `${base}/${p}`;
}
