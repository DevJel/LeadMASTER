import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../public/'+path,import.meta.url),'utf8');

test('published legal notices are linked from the landing page and crawlable',async()=>{
  const [home,docs,privacy,terms]=await Promise.all(['index.html','docs.html','privacy.html','terms.html'].map(read));
  assert.ok(home.includes('href="./privacy.html"'));
  assert.ok(home.includes('href="./terms.html"'));
  assert.ok(home.includes('Data Privacy Notice'));
  assert.ok(home.includes('Terms and Conditions'));
  assert.ok(docs.includes('Documentation moved'));
  assert.ok(docs.includes('index.html#documentation'));
  for(const page of [privacy,terms]){
    assert.ok(page.includes('name="robots" content="index,follow"'));
    assert.ok(page.includes('Effective date:'));
    assert.ok(!page.includes('Draft · not yet effective'));
    assert.ok(!page.includes('github.com'));
  }
});

test('privacy notice identifies the operator and describes deployed data processing',async()=>{
  const privacy=await read('privacy.html');
  for(const phrase of ['Operava Global Solutions','administrator','authentication','email','Cloudflare','Amazon Simple Email Service','AI-assisted reply suggestions','retention','data portability','hello@operavaglobal.com','Republic Act No. 10173']) assert.ok(privacy.toLowerCase().includes(phrase.toLowerCase()),'missing: '+phrase);
  assert.ok(!privacy.includes('not operational in the preview'));
  assert.ok(!privacy.includes('Draft'));
});

test('terms identify the operator and govern current service capabilities',async()=>{
  const terms=await read('terms.html');
  for(const phrase of ['Operava Global Solutions','email sending','API keys','webhooks','recipient','Republic of the Philippines','hello@operavaglobal.com']) assert.ok(terms.toLowerCase().includes(phrase.toLowerCase()),'missing: '+phrase);
  assert.ok(!terms.includes('not operational in the preview'));
  assert.ok(!terms.includes('Draft'));
});

test('privacy and terms cross-link to each other',async()=>{
  const [privacy,terms]=await Promise.all(['privacy.html','terms.html'].map(read));
  assert.ok(privacy.includes('href="./terms.html"'));
  assert.ok(terms.includes('href="./privacy.html"'));
});
