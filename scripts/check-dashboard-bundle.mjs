// Validate the staged workspace components and the actual production React app bundle.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const entryPoints = [
  'src/dashboard-tsx/SmtpSettings.tsx',
  'src/dashboard-tsx/SendingIndicator.tsx',
  'src/dashboard-tsx/Inbox.tsx',
  'src/dashboard-tsx/ActionConfirmation.tsx',
  'required-componets-design/UtilityApps.tsx',
  'required-componets-design/App.tsx'
];
const result = await build({
  entryPoints,
  bundle: true,
  write: false,
  outdir: 'unused-dashboard-build',
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  logLevel: 'silent',
});
const requiredScripts = ['SmtpSettings','SendingIndicator','Inbox','ActionConfirmation','UtilityApps','App'];
for (const name of requiredScripts) {
  if (!result.outputFiles.some(file => file.path.endsWith(`/${name}.js`))) {
    throw new Error(`Dashboard validation did not emit ${name}.js`);
  }
}
for (const name of ['SmtpSettings','Inbox']) {
  if (!result.outputFiles.some(file => file.path.endsWith(`/${name}.css`))) {
    throw new Error(`Dashboard validation did not emit ${name}.css`);
  }
}
const designCss = await readFile(new URL('../required-componets-design/index.css', import.meta.url), 'utf8');
for (const selector of ['.lm-loading-art','.lm-send-art','.lm-confirm-overlay']) {
  if (!designCss.includes(selector)) throw new Error(`Canonical workspace CSS is missing ${selector}`);
}
console.log('Production React workspace, utility modules and shared loading/sending/confirmation components validated.');
