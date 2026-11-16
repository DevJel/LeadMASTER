// Recover the supplied design exactly; it remains a non-production reference.
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const dir = new URL('.', import.meta.url);
const source = inflateSync(Buffer.from((await readFile(new URL('App.tsx.deflate.b64', dir), 'utf8')).trim(), 'base64'));
const digest = createHash('sha256').update(source).digest('hex');
if (digest !== 'e2306b1dddbe8155ea4b5dd3573ccc3eae044efa2d3666e5511d7a839891e990') throw new Error('Reference source checksum mismatch');
await writeFile(new URL('App.tsx', dir), source, { flag: 'wx' });
console.log('Recovered App.tsx (not served).');
