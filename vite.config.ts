import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { copyFile, mkdir } from "node:fs/promises";

export default defineConfig({
  plugins: [
    viteSingleFile(),
    {
      name: "copy-legal-routes",
      apply: "build",
      async closeBundle() {
        await Promise.all(["privacy", "terms"].map(async (route) => {
          await mkdir(`dist/${route}`, { recursive: true });
          await copyFile("dist/index.html", `dist/${route}/index.html`);
        }));
      }
    }
  ],
  build: {
    target: "es2022",
    sourcemap: false
  }
});
