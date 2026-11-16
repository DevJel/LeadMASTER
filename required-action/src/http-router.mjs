/** Public routing. Authentication remains unavailable; email API is opt-in only. */
import { submitEmail } from './email-api.mjs';
import { handleMcp } from './mcp-server.mjs';
const json = (body, status, extra = {}) => Response.json(body, {status, headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
export async function routeHttp(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/mcp') return handleMcp(request,env);
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/v1/emails') return submitEmail(request,env);
    if (url.pathname === '/api/auth/config') {
      if (request.method !== 'GET') return json({error:'Method not allowed'},405,{allow:'GET'});
      // Fail closed: exposing a site key before a real auth backend exists
      // would enable an unusable sign-in form and imply false readiness.
      return json({error:'Secure sign-in is unavailable'},503);
    }
    return json({error:'Not found'},404);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return new Response('Service unavailable',{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  try {
    const upstream = await env.ASSETS.fetch(request);
    const headers = new Headers(upstream.headers);
    headers.set('x-content-type-options','nosniff');
    headers.set('referrer-policy','strict-origin-when-cross-origin');
    if (url.pathname === '/login' || url.pathname === '/login.html' || url.pathname === '/dashboard.html') {
      headers.set('cache-control','no-store');
      headers.set('x-robots-tag','noindex, nofollow');
    }
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
  } catch { return new Response('Service unavailable',{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}}); }
}
