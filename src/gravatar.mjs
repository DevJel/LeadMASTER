/**
 * Gravatar's public avatar identifier uses SHA-256(email.trim().toLowerCase()).
 * Keep email addresses out of the request URL; only the one-way hash is sent.
 */
export function normalizeGravatarEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function createGravatarHash(email) {
  const normalized = normalizeGravatarEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized)
  );
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createGravatarAvatarUrl(email, size = 160) {
  const hash = await createGravatarHash(email);
  if (!hash) return null;
  const dimension = Math.max(16, Math.min(2048, Math.round(Number(size) || 160)));
  return `https://gravatar.com/avatar/${hash}?s=${dimension}&d=404`;
}
