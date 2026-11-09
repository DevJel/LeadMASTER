// This loader is only for offline HTTP route tests; it never opens network sockets.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:sockets') return { url: 'data:text/javascript,export function connect(){throw Error("socket disabled in synthetic test")}', shortCircuit: true };
  // Only the gate is tested, not the real generated dashboard assets.
  if (specifier.endsWith('/static-assets.mjs')) return { url: 'data:text/javascript,' + encodeURIComponent(`export const staticAssets={'/dashboard.html':{contentType:'text/html',body:'SYNTHETIC DASHBOARD'},'/dashboard.js':{contentType:'text/javascript',body:'/* test */'},'/login.html':{contentType:'text/html',body:'SYNTHETIC LOGIN'}};`), shortCircuit: true };
  return nextResolve(specifier, context);
}
