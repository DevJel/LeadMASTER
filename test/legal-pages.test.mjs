import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../public/'+path,import.meta.url),'utf8');
test('legal notices are linked and visibly marked draft',async()=>{const [home,docs,privacy,terms]=await Promise.all(['index.html','docs.html','privacy.html','terms.html'].map(read));for(const page of [home,docs]){assert.match(page,/href="\.\/privacy\.html"/);assert.match(page,/href="\.\/terms\.html"/)}for(const page of [privacy,terms]){assert.match(page,/Draft · not yet effective/);assert.match(page,/name="robots" content="noindex,follow"/);assert.doesNotMatch(page,/github\.com/i)}});
test('privacy and terms do not present planned sending as available',async()=>{const [privacy,terms]=await Promise.all(['privacy.html','terms.html'].map(read));assert.match(privacy,/not operational in the preview/);assert.match(terms,/not operational in the preview/);assert.match(privacy,/privacy contact/);assert.match(terms,/governing law/)});
