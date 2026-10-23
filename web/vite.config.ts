import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Must match the repo segment in `package.json` "homepage" (github.io/<user>/<repo>/). */
const GH_PAGES_BASE = "/greenroom/";

export default defineConfig(({ mode }) => ({
  // Dev and Vercel (served at the domain root): "/". GitHub Pages production build: repo subpath.
  base: mode === "production" && !process.env.VERCEL ? GH_PAGES_BASE : "/",
  plugins: [react()]
}));
