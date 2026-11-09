import { readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const publicDir = join(root, "public");
const mandatoryDashboard = await readFile(join(root, "src", "Mandatory LeadMASTER Dashboard.html"), "utf8");
await writeFile(join(publicDir, "dashboard.html"), mandatoryDashboard, "utf8");
const output = join(root, "src", "static-assets.mjs");
const allowlist = [
  "index.html", "landing-halftone.css", "landing-halftone.js", "halftone.js",
  "login.html", "login.css", "login.js", "cover.css",
  "dashboard.html", "dashboard.css", "dashboard.js",
  "html-preview.css", "html-preview.js", "developer-api-keys.html",
  "docs.html", "mcp.html", "privacy.html", "terms.html", "legal.css", "docs.css", "llms.txt", "robots.txt",
  "assets/brand/leadmaster-full.svg", "assets/brand/favicon-gray.svg",
  "assets/vendor/dompurify.min.js", "assets/marketing/leadmaster_testimonial_email_campaigns_transparent.webp"
];
const mime = {
  ".webp": "image/webp",
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};
const entries = {};
for (const path of allowlist) {
  let body;
  const binary = extname(path).toLowerCase() === ".webp";
  try { body = binary ? (await readFile(join(publicDir, path))).toString("base64") : await readFile(join(publicDir, path), "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") throw new Error(`Required public asset is missing: public/${path}`);
    throw error;
  }
  entries["/" + path.replaceAll("\\", "/")] = {
    contentType: mime[extname(path).toLowerCase()] || "application/octet-stream",
    body
  };
}
const source = "// Generated from canonical public/ files by scripts/build-static-assets.mjs. Do not edit by hand.\n" +
  "export const staticAssets = " + JSON.stringify(entries) + ";\n";
await writeFile(output, source, "utf8");
console.log(`Generated ${Object.keys(entries).length} static assets in src/static-assets.mjs`);
