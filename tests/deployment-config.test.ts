import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type StaticWebAppConfig = {
  globalHeaders: Record<string, string>;
  mimeTypes: Record<string, string>;
  routes: { route: string; headers?: Record<string, string> }[];
};

describe("static deployment policy", () => {
  it("ships the financial-data response protections", async () => {
    const config = JSON.parse(await readFile("public/staticwebapp.config.json", "utf8")) as StaticWebAppConfig;
    expect(config.globalHeaders["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders["Content-Security-Policy"]).toContain("connect-src 'self' https://api.sociobot.in https://pilot-api.sociobot.in");
    expect(config.globalHeaders["Permissions-Policy"]).toContain("camera=()");
    expect(config.globalHeaders["X-Frame-Options"]).toBe("DENY");
  });

  it("declares PWA MIME types and immutable static-art caching", async () => {
    const config = JSON.parse(await readFile("public/staticwebapp.config.json", "utf8")) as StaticWebAppConfig;
    expect(config.mimeTypes).toMatchObject({ ".avif": "image/avif", ".webmanifest": "application/manifest+json" });
    for (const route of ["/art/*", "/icons/*", "/assets/*"]) {
      expect(config.routes.find((entry) => entry.route === route)?.headers?.["Cache-Control"]).toBe("public, max-age=31536000, immutable");
    }
  });
});
