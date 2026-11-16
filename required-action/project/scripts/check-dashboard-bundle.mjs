// Validation only: staged components are not product entry points.
import { build } from 'esbuild';
const result = await build({
  entryPoints: ['src/dashboard-tsx/SmtpSettings.tsx','src/dashboard-tsx/SendingIndicator.tsx','src/dashboard-tsx/Inbox.tsx'],
  bundle: true,
  write: false,
  outdir: 'unused-dashboard-build',
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  logLevel: 'silent',
});
for (const name of ['SmtpSettings','SendingIndicator','Inbox']) {
  for (const ext of ['js','css']) {
    if (!result.outputFiles.some(file => file.path.endsWith(`/${name}.${ext}`))) {
      throw new Error(`Dashboard validation did not emit ${name}.${ext}`);
    }
  }
}
console.log('Staged TSX settings, sending indicator and Inbox bundle successfully (not deployed).');
