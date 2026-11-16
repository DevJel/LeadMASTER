/** Verify a Turnstile token server-side; this alone does not authenticate a user. */
export async function verifyTurnstile({ token, secret, expectedHostname, expectedAction, fetcher = fetch, timeoutMs = 5000 }) {
  const allowedHostnames = Array.isArray(expectedHostname) ? expectedHostname : [expectedHostname];
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048 || !allowedHostnames.length || allowedHostnames.some(host => typeof host !== 'string' || !/^[a-z0-9.-]+$/.test(host)) || typeof expectedAction !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(expectedAction) || typeof fetcher !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) return false;
  try {
    const value = typeof secret?.get === 'function' ? await secret.get() : secret;
    if (typeof value !== 'string' || !value || value.length > 512) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({secret:value,response:token}), signal:controller.signal });
      if (!response.ok) return false;
      const result = await response.json();
      return result?.success === true && allowedHostnames.includes(result.hostname) && result.action === expectedAction;
    } finally { clearTimeout(timer); }
  } catch { return false; }
}
