import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Must match the repo segment in `package.json` "homepage" (github.io/<user>/<repo>/). */
const GH_PAGES_BASE = "/greenroom/";

export default defineConfig(({ mode }) => ({
  // Dev: "/" so localhost works. Production: subpath for GitHub Pages project site.
  base: mode === "production" ? GH_PAGES_BASE : "/",
  plugins: [react()]
}));
