import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../public/'+path,import.meta.url),'utf8');
test('legal notices are linked and documentation remains integrated',async()=>{const [home,docs,privacy,terms]=await Promise.all(['index.html','docs.html','privacy.html','terms.html'].map(read));assert.ok(home.includes('href="./privacy.html"'));assert.ok(home.includes('href="./terms.html"'));assert.ok(docs.includes('Documentation moved'));assert.ok(docs.includes('index.html#documentation'));for(const page of [privacy,terms]){assert.ok(page.includes('Draft · not yet effective'));assert.ok(page.includes('name="robots" content="noindex,follow"'));assert.ok(!page.includes('github.com'));}});
test('privacy and terms do not present planned sending as available',async()=>{const [privacy,terms]=await Promise.all(['privacy.html','terms.html'].map(read));assert.ok(privacy.includes('not operational in the preview'));assert.ok(terms.includes('not operational in the preview'));assert.ok(privacy.includes('privacy contact'));assert.ok(terms.includes('governing law'));});
