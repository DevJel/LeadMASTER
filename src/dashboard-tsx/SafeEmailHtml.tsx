import React from 'react';

type Purifier = { sanitize: (input:string, options:object) => string };

/** Untrusted email HTML gets a separate opaque-origin sandbox and no network. */
export function SafeEmailHtml({html}:{html:string}) {
  const purifier:Purifier|undefined = typeof window === 'undefined' ? undefined : (window as any).DOMPurify;
  if (!purifier || typeof purifier.sanitize !== 'function') {
    return <p role="alert">HTML preview is unavailable. Use the text view instead.</p>;
  }
  const clean = purifier.sanitize(html, {
    USE_PROFILES:{html:true},
    FORBID_TAGS:['script','iframe','object','embed','form','input','button','textarea','select','base','meta','link'],
    FORBID_ATTR:['srcdoc','href','srcset','action','formaction'],
    ALLOW_DATA_ATTR:false,
    SANITIZE_NAMED_PROPS:true
  });
  const policy = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";
  const source = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><style>body{margin:16px;overflow-wrap:anywhere} img,table{max-width:100%} img[src^="http"]{display:none!important}</style></head><body>${clean}</body></html>`;
  return <iframe title="HTML email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={source} style={{minHeight:320}} className="mt-4 w-full border border-[var(--border)] rounded-xl bg-white" />;
}
