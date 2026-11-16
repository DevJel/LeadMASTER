import test from "node:test";
import assert from "node:assert/strict";
import { resolvePageRoute } from "../src/page-routes.mjs";

test("clean dashboard route serves the existing dashboard HTML internally", () => {
  assert.deepEqual(resolvePageRoute("/dashboard"), {
    path: "/dashboard",
    assetPath: "/dashboard.html",
    canonicalPath: null,
    redirect: false,
    isPage: true,
    requiresSession: true
  });
});

test("legacy HTML page URLs canonicalize to extensionless paths", () => {
  for (const [legacy, clean, assetPath, requiresSession] of [
    ["/dashboard.html", "/dashboard", "/dashboard.html", true],
    ["/login.html", "/login", "/login.html", false],
    ["/help-center.html", "/help-center", "/help-center.html", false],
    ["/docs.html", "/docs", "/docs.html", false],
    ["/privacy.html", "/privacy", "/privacy.html", false],
    ["/terms.html", "/terms", "/terms.html", false],
    ["/developer-api-keys.html", "/developer-api-keys", "/developer-api-keys.html", true],
    ["/index.html", "/", "/index.html", false]
  ]) {
    const route = resolvePageRoute(legacy);
    assert.equal(route.canonicalPath, clean, legacy);
    assert.equal(route.assetPath, assetPath, legacy);
    assert.equal(route.redirect, true, legacy);
    assert.equal(route.requiresSession, requiresSession, legacy);
  }
});

test("protected dashboard bundles remain protected when using clean page routing", () => {
  for (const asset of ["/dashboard.js", "/dashboard.css", "/dashboard-app.js", "/dashboard-app.css", "/html-preview.js", "/html-preview.css", "/assets/vendor/dompurify.min.js"]) {
    assert.equal(resolvePageRoute(asset).requiresSession, true, asset);
  }
});

test("trailing slashes and casing normalize without changing the internal asset", () => {
  const route = resolvePageRoute("/Dashboard/");
  assert.equal(route.path, "/dashboard");
  assert.equal(route.assetPath, "/dashboard.html");
  assert.equal(route.requiresSession, true);
});
