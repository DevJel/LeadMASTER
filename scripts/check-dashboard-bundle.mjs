// Validation only: the staged component is not a product entry point.
import { build } from 'esbuild';
const result = await build({
  entryPoints: ['src/dashboard-tsx/SmtpSettings.tsx'],
  bundle: true,
  write: false,
  outdir: 'unused-dashboard-build',
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  logLevel: 'silent',
});
if (!result.outputFiles.some(file => file.path.endsWith('.js')) ||
    !result.outputFiles.some(file => file.path.endsWith('.css'))) {
  throw new Error('Dashboard validation did not emit both JS and CSS');
}
console.log('Staged TSX settings component bundles successfully (not deployed).');
