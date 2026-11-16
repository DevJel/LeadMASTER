// Validation only: staged components are not product entry points.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const result = await build({
  entryPoints: ['src/dashboard-tsx/SmtpSettings.tsx','src/dashboard-tsx/SendingIndicator.tsx','src/dashboard-tsx/Inbox.tsx'],
  bundle: true,
  write: false,
  outdir: 'unused-dashboard-build',
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
 for (const name of ['SmtpSettings','SendingIndicator','Inbox']) {
  if (!result.outputFiles.some(file => file.path.endsWith(`/${name}.js`))) {
    throw new Error(`Dashboard validation did not emit ${name}.js`);
  }
}

// SendingIndicator uses the dashboard's shared stylesheet rather than shipping
// a component-local CSS import. Validate its selectors in the canonical sheet.
const sharedCss = await readFile('required-componets-design/index.css', 'utf8');
for (const selector of ['.lm-send{', '.lm-send-art{', '.lm-send-step{']) {
  if (!sharedCss.includes(selector)) {
    throw new Error(`Dashboard shared stylesheet is missing ${selector}`);
  }
}
n did not emit ${name}.${ext}`);
    }
  }
}
console.log('Staged TSX settings, sending indicator and Inbox bundle successfully (not deployed).');
