const FORBIDDEN_TAGS = "script|style|iframe|object|embed|form|meta|link|base|svg|math";
const FORBIDDEN_BLOCK = new RegExp("<(" + FORBIDDEN_TAGS + ")\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>", "gi");
const FORBIDDEN_SINGLE = new RegExp("<(" + FORBIDDEN_TAGS + ")\\b[^>]*\\/?\\s*>", "gi");
const EVENT_ATTRIBUTE = /\s(?:on[a-z]+|srcdoc|formaction|formmethod|formtarget)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_ATTRIBUTE = /\s(href|src|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|(?:javascript|vbscript|data):[^\s>]+)/gi;

export function sanitizeGeneratedEmailHtml(value, maxLength = 24000) {
  const html = String(value || "");
  if (!html.trim()) return "";
  return html
    .slice(0, Math.max(1, Math.min(30000, Number(maxLength) || 24000)))
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(FORBIDDEN_BLOCK, "")
    .replace(FORBIDDEN_SINGLE, "")
    .replace(EVENT_ATTRIBUTE, "")
    .replace(UNSAFE_URL_ATTRIBUTE, ' $1="#"')
    .replace(/\sstyle\s*=\s*("[^"]*expression\s*\([^"]*"|'[^']*expression\s*\([^']*')/gi, "")
    .trim();
}
