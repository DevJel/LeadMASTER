const CLEAN_PAGE_ROUTES = Object.freeze({
  "/": { assetPath: "/index.html", requiresSession: false },
  "/login": { assetPath: "/login.html", requiresSession: false },
  "/dashboard": { assetPath: "/dashboard.html", requiresSession: true },
  "/help-center": { assetPath: "/help-center.html", requiresSession: false },
  "/docs": { assetPath: "/docs.html", requiresSession: false },
  "/privacy": { assetPath: "/privacy.html", requiresSession: false },
  "/terms": { assetPath: "/terms.html", requiresSession: false },
  "/developer-api-keys": { assetPath: "/developer-api-keys.html", requiresSession: true },
  "/mcp-info": { assetPath: "/mcp.html", requiresSession: false }
});

const LEGACY_PAGE_ROUTES = Object.freeze(
  Object.fromEntries(
    Object.entries(CLEAN_PAGE_ROUTES)
      .filter(([cleanPath]) => cleanPath !== "/")
      .map(([cleanPath, route]) => [route.assetPath, { ...route, canonicalPath: cleanPath }])
      .concat([["/index.html", { assetPath: "/index.html", requiresSession: false, canonicalPath: "/" }]])
  )
);

const PROTECTED_ASSETS = new Set([
  "/dashboard.js",
  "/dashboard.css",
  "/dashboard-app.js",
  "/dashboard-app.css",
  "/html-preview.js",
  "/html-preview.css",
  "/assets/vendor/dompurify.min.js"
]);

export function isProtectedPageAsset(pathname) {\n  return PROTECTED_ASSETS.has(String(pathname || "").toLowerCase());\n}\n\nexport function resolvePageRoute(pathname) {
  const normalizedPath = String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  const cleanRoute = CLEAN_PAGE_ROUTES[normalizedPath];
  if (cleanRoute) {
    return {
      path: normalizedPath,
      assetPath: cleanRoute.assetPath,
      canonicalPath: null,
      redirect: false,
      isPage: true,
      requiresSession: cleanRoute.requiresSession
    };
  }

  const legacyRoute = LEGACY_PAGE_ROUTES[normalizedPath];
  if (legacyRoute) {
    return {
      path: normalizedPath,
      assetPath: legacyRoute.assetPath,
      canonicalPath: legacyRoute.canonicalPath,
      redirect: true,
      isPage: true,
      requiresSession: legacyRoute.requiresSession
    };
  }

  return {
    path: normalizedPath,
    assetPath: normalizedPath,
    canonicalPath: null,
    redirect: false,
    isPage: false,
    requiresSession: PROTECTED_ASSETS.has(normalizedPath) || normalizedPath.startsWith("/dashboard/") || normalizedPath.startsWith("/dashboard.")
  };
}
