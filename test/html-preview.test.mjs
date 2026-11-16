import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
test('HTML email previews are sanitized with DOMPurify before rendering',async()=>{
 const [app,html]=await Promise.all([read('../required-componets-design/App.tsx'),read('../src/Mandatory LeadMASTER Dashboard.html')]);
 assert.match(html,/dompurify\.min\.js/);
 assert.ok(html.indexOf('dompurify.min.js')<html.indexOf('dashboard-app.js'));
 assert.match(app,/window as any\)\.DOMPurify/);
 assert.match(app,/FORBID_TAGS/);
 assert.match(app,/FORBID_ATTR/);
 assert.match(app,/safe text fallback|html\.replace/);
 assert.match(app,/dangerouslySetInnerHTML/);
});
test('HTML previews remain available in compose and insert dialog',async()=>{
 const app=await read('../required-componets-design/App.tsx');
 assert.match(app,/showComposePreview/);
 assert.match(app,/htmlDialogPreview/);
 assert.match(app,/sanitizeHtml\(/);
});
