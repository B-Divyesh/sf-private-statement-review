import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { copyFile, mkdir } from "node:fs/promises";

export default defineConfig({
  plugins: [
    viteSingleFile(),
    {
      name: "copy-static-routes",
      apply: "build",
      async closeBundle() {
        await Promise.all(["privacy", "terms", "demo"].map(async (route) => {
          await mkdir(`dist/${route}`, { recursive: true });
          await copyFile("dist/index.html", `dist/${route}/index.html`);
        }));
        await copyFile("dist/index.html", "dist/404.html");
      }
    }
  ],
  build: {
    target: "es2022",
    sourcemap: false
  }
});
