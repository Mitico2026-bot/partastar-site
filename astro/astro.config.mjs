// Static output that keeps the existing URL scheme: /solar-panels.html, /en/solar-panels.html, ...
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://partastar.solar",
  output: "static",
  build: { format: "file" },
  compressHTML: false
});
