# LeadMASTER UI screenshot atlas

These are **local, watermarked UI previews with synthetic data**, not production screenshots, acceptance tests, or evidence that a feature is deployed. The login script and external network requests are blocked during capture. The verification-code image shows existing static markup only: no password, human challenge, OTP, login or verification request is used. The dashboard uses local fixture responses and does not access an account. Images do not assert that threading, individual attachments, automatic scheduling, external SMTP or production MCP are available; see the [feature index](../FEATURES.md) and [mail-thread design](../MAIL_THREADS_DESIGN.md). Android images below are responsive browser views, **not device or APK screenshots**.

## Capture details

- Source: checked-in landing/login HTML and the built canonical React dashboard, rendered with Playwright/Chromium and local mock endpoints.
- Viewports: desktop 1440 × 1000 and mobile 390 × 844 CSS pixels, device scale 1; full-page captures may be taller. Reduced motion enabled.
- Output: [`assets/screenshots/`](../../assets/screenshots/); CI also uploads `leadmaster-ui-screenshots` for 30 days, along with the separate synthetic message-safety browser-test captures.
- No real accounts, recipient data, codes, keys or secrets are used. A local fixture identity and watermark identify the captures.

```mermaid
flowchart LR
  Source[Canonical UI source] --> Build[Build dashboard assets]
  Build --> Local[Local fixture server]
  Local --> Browser[Chromium: desktop and mobile]
  Browser --> Atlas[Watermarked screenshot atlas]
  Atlas --> Docs[README gallery and CI artifact]
```

## Reproduce

Use Node 22 and npm. From the repository root:

```sh
npm ci
npm run build:assets
npm install --no-save --package-lock=false playwright
npx playwright install --with-deps chromium
node scripts/capture-screenshots.mjs
```

To use a local Chromium binary instead of Playwright's managed binary, set `LOCAL_CHROMIUM` to its path. The server listens on `127.0.0.1:4179`; stop any other process using that port first. Check the images for layout, watermarks and sensitive data before committing. Static account fixtures are illustrative and cannot confirm actual authorization, delivery, deployment or Android device behavior.

Additional desktop smoke-check captures: [refresh](../../assets/screenshots/dashboard-refresh-verified-desktop.png) and [synthetic template preview](../../assets/screenshots/dashboard-template-preview-desktop.png).

## Gallery

Click an image for full size. Available/disabled controls reflect the local fixture and current source.

### Public and sign-in

| Screen | Desktop | Mobile |
|---|---|---|
| Landing | [![Landing desktop](../../assets/screenshots/landing-desktop.png)](../../assets/screenshots/landing-desktop.png) | [![Landing mobile](../../assets/screenshots/landing-mobile.png)](../../assets/screenshots/landing-mobile.png) |
| Features | [![Features desktop](../../assets/screenshots/landing-features-desktop.png)](../../assets/screenshots/landing-features-desktop.png) | [![Features mobile](../../assets/screenshots/landing-features-mobile.png)](../../assets/screenshots/landing-features-mobile.png) |
| Documentation | [![Documentation desktop](../../assets/screenshots/landing-documentation-desktop.png)](../../assets/screenshots/landing-documentation-desktop.png) | [![Documentation mobile](../../assets/screenshots/landing-documentation-mobile.png)](../../assets/screenshots/landing-documentation-mobile.png) |
| Email API | [![Email API desktop](../../assets/screenshots/landing-api-desktop.png)](../../assets/screenshots/landing-api-desktop.png) | [![Email API mobile](../../assets/screenshots/landing-api-mobile.png)](../../assets/screenshots/landing-api-mobile.png) |
| Campaigns | [![Campaigns desktop](../../assets/screenshots/landing-campaigns-desktop.png)](../../assets/screenshots/landing-campaigns-desktop.png) | [![Campaigns mobile](../../assets/screenshots/landing-campaigns-mobile.png)](../../assets/screenshots/landing-campaigns-mobile.png) |
| AI & MCP | [![AI & MCP desktop](../../assets/screenshots/landing-integrations-desktop.png)](../../assets/screenshots/landing-integrations-desktop.png) | [![AI & MCP mobile](../../assets/screenshots/landing-integrations-mobile.png)](../../assets/screenshots/landing-integrations-mobile.png) |
| Status | [![Status desktop](../../assets/screenshots/landing-status-desktop.png)](../../assets/screenshots/landing-status-desktop.png) | [![Status mobile](../../assets/screenshots/landing-status-mobile.png)](../../assets/screenshots/landing-status-mobile.png) |
| Help Center | [![Help Center desktop](../../assets/screenshots/help-center-desktop.png)](../../assets/screenshots/help-center-desktop.png) | [![Help Center mobile](../../assets/screenshots/help-center-mobile.png)](../../assets/screenshots/help-center-mobile.png) |
| Login | [![Login desktop](../../assets/screenshots/login-desktop.png)](../../assets/screenshots/login-desktop.png) | [![Login mobile](../../assets/screenshots/login-mobile.png)](../../assets/screenshots/login-mobile.png) |
| Verification code | [![Verification code desktop](../../assets/screenshots/verification-code-desktop.png)](../../assets/screenshots/verification-code-desktop.png) | [![Verification code mobile](../../assets/screenshots/verification-code-mobile.png)](../../assets/screenshots/verification-code-mobile.png) |

### Workspace navigation

| Screen | Desktop | Mobile |
|---|---|---|
| Inbox / dashboard | [![Inbox / dashboard desktop](../../assets/screenshots/dashboard-inbox-desktop.png)](../../assets/screenshots/dashboard-inbox-desktop.png) | [![Inbox / dashboard mobile](../../assets/screenshots/dashboard-inbox-mobile.png)](../../assets/screenshots/dashboard-inbox-mobile.png) |
| Compose | [![Compose desktop](../../assets/screenshots/dashboard-compose-desktop.png)](../../assets/screenshots/dashboard-compose-desktop.png) | [![Compose mobile](../../assets/screenshots/dashboard-compose-mobile.png)](../../assets/screenshots/dashboard-compose-mobile.png) |
| Sent | [![Sent desktop](../../assets/screenshots/dashboard-sent-desktop.png)](../../assets/screenshots/dashboard-sent-desktop.png) | [![Sent mobile](../../assets/screenshots/dashboard-sent-mobile.png)](../../assets/screenshots/dashboard-sent-mobile.png) |
| Outbox | [![Outbox desktop](../../assets/screenshots/dashboard-outbox-desktop.png)](../../assets/screenshots/dashboard-outbox-desktop.png) | [![Outbox mobile](../../assets/screenshots/dashboard-outbox-mobile.png)](../../assets/screenshots/dashboard-outbox-mobile.png) |
| Deleted | [![Deleted desktop](../../assets/screenshots/dashboard-deleted-desktop.png)](../../assets/screenshots/dashboard-deleted-desktop.png) | [![Deleted mobile](../../assets/screenshots/dashboard-deleted-mobile.png)](../../assets/screenshots/dashboard-deleted-mobile.png) |
| Assistant | [![Assistant desktop](../../assets/screenshots/dashboard-assistant-desktop.png)](../../assets/screenshots/dashboard-assistant-desktop.png) | [![Assistant mobile](../../assets/screenshots/dashboard-assistant-mobile.png)](../../assets/screenshots/dashboard-assistant-mobile.png) |
| Automation | [![Automation desktop](../../assets/screenshots/dashboard-automation-desktop.png)](../../assets/screenshots/dashboard-automation-desktop.png) | [![Automation mobile](../../assets/screenshots/dashboard-automation-mobile.png)](../../assets/screenshots/dashboard-automation-mobile.png) |
| Templates | [![Templates desktop](../../assets/screenshots/dashboard-templates-desktop.png)](../../assets/screenshots/dashboard-templates-desktop.png) | [![Templates mobile](../../assets/screenshots/dashboard-templates-mobile.png)](../../assets/screenshots/dashboard-templates-mobile.png) |
| Scheduled | [![Scheduled desktop](../../assets/screenshots/dashboard-scheduled-desktop.png)](../../assets/screenshots/dashboard-scheduled-desktop.png) | [![Scheduled mobile](../../assets/screenshots/dashboard-scheduled-mobile.png)](../../assets/screenshots/dashboard-scheduled-mobile.png) |
| Settings | [![Settings desktop](../../assets/screenshots/dashboard-settings-desktop.png)](../../assets/screenshots/dashboard-settings-desktop.png) | [![Settings mobile](../../assets/screenshots/dashboard-settings-mobile.png)](../../assets/screenshots/dashboard-settings-mobile.png) |


The inbox is now a unified mailbox. The historical category-specific preview captures are not part of the current navigation; regenerate the gallery after the updated UI build.