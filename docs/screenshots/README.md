# LeadMASTER UI screenshot evidence

The CI workflow captures rendered screenshots into the `leadmaster-ui-screenshots` artifact.

Files:
- `landing.png`
- `login.png`
- `dashboard-overview.png`
- `dashboard-emails.png`
- `dashboard-logs.png`
- `dashboard-broadcasts.png`
- `dashboard-audiences.png`
- `dashboard-templates.png`
- `dashboard-domains.png`
- `dashboard-webhooks.png`
- `dashboard-settings.png`
- `dashboard-api-keys.png`

These are local UI-preview captures from the canonical page source using a synthetic test identity and empty test data. Each image is visibly watermarked **LOCAL UI PREVIEW · SYNTHETIC ACCOUNT**. They are not production screenshots and do not prove authenticated production behavior or live service functionality.

The login capture intentionally does not solve or bypass the human security verification. The dashboard captures use a local mocked session only to render the authenticated shell and navigation states. Never place production account data, keys, OTPs, email addresses or webhook secrets in screenshot fixtures.

To regenerate:
1. Run `npm ci`.
2. Install Playwright without changing the lockfile: `npm install --no-save --package-lock=false playwright`.
3. Install Chromium: `npx playwright install --with-deps chromium`.
4. Run `node scripts/capture-screenshots.mjs`.
5. Review the images and upload them only as approved documentation artifacts.

For true production screenshots, use an authorized account owner browser session and a synthetic test account. Capture the authenticated dashboard only after sign-in, and redact all personal or secret information.
