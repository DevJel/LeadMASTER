# LeadMASTER for Android

[![Build Android APK](https://github.com/DevJel/LeadMASTER/actions/workflows/android-apk.yml/badge.svg)](https://github.com/DevJel/LeadMASTER/actions/workflows/android-apk.yml)

LeadMASTER for Android is the official Android companion to the LeadMASTER web workspace. It provides a native Android application shell around the same authenticated, responsive production dashboard used on the web.

- **Production workspace:** https://leadmaster.jelvan.pro
- **Source repository:** https://github.com/DevJel/LeadMASTER
- **Android build workflow:** https://github.com/DevJel/LeadMASTER/actions/workflows/android-apk.yml
- **Current app version in source:** `1.6.0` (`versionCode 7`)
- **Android application ID:** `pro.leadmaster.app`

> **APK availability:** CI publishes an installable debug APK as a GitHub Actions artifact. Open the Android build workflow, select the latest successful run, and download the `leadmaster-android-debug-apk` artifact. Artifacts are retained for 90 days. A public GitHub Release APK is not currently published. Debug builds are for testing and are not signed with the owner's production release key.

## 1. Product and implementation principles

The Android application is intentionally a thin client. It does not implement a second mailbox, account system, contact database, sending engine or authorization layer.

1. **One dashboard:** `src/Mandatory LeadMASTER Dashboard.html` is the canonical dashboard source. `public/dashboard.html` is its generated deployment mirror.
2. **One service layer:** authenticated requests, account permissions, email operations and persisted workspace data are handled by the production LeadMASTER application and APIs.
3. **Native where appropriate:** Android code is limited to platform capabilities such as WebView hosting, notifications, file selection, downloads, external intents, Back navigation and system-bar appearance.
4. **No fake parity:** a web module is not considered available in Android merely because it appears in navigation. The same production-backed capability must work through the shared dashboard and API.
5. **No competing persistence:** do not add a second local business-data store, duplicate validation rules or a separate native implementation of web workflows without an explicit product decision.

## 2. Feature inventory

| Capability | Implementation | Important boundary |
|---|---|---|
| Authenticated workspace | Loads the production LeadMASTER HTTPS workspace in Android WebView | Requires a valid server-side account session |
| Dashboard UI | Uses the canonical responsive web dashboard | No duplicated native dashboard or extra native navigation bar |
| Mobile navigation | Supplied by the dashboard's own responsive navigation | Keep web and Android UI behavior aligned |
| Light/dark theme | Dashboard theme is observed and synchronized to Android system-bar icon contrast | Dashboard remains the theme source of truth |
| Sign-in persistence | WebView persists the server-issued HttpOnly session cookie; cookie store is flushed on lifecycle transitions | Closing the app is not sign-out; server expiry and explicit logout still apply |
| Back navigation | Android Back navigates WebView history; exits when no history remains | Does not create a separate native navigation stack |
| File selection | WebView file chooser launches Android's multi-document picker | The web app remains responsible for file validation and upload behavior |
| Email download | Android DownloadManager saves supported same-origin downloads to Downloads | The current native filename is `LeadMASTER-message.eml` |
| External links | HTTP(S), mailto and tel links outside the trusted app origin are handed to Android | Only the exact trusted HTTPS app origin stays in the WebView |
| Local notifications | Native notification channels for sent, deleted, received and general events | Requires notification permission on Android 13+ |
| Foreground activity monitoring | Polls authenticated activity and inbox read endpoints while the workspace is visible | Not a background push service; no guaranteed alerts while closed or force-stopped |

### Notification behavior

The app defines four Android notification channels:

- **Email sent** — events identified as successful email sends.
- **Email deleted** — email deletion events.
- **New mail received** — newly appearing inbox messages.
- **LeadMASTER notifications** — other supported activity updates, including queue/status updates.

When the authenticated workspace page is loaded, the notification monitor establishes an initial baseline of existing activity and inbox items. This avoids treating the entire existing mailbox as new. It then checks the authenticated activity and inbox endpoints after an initial delay and every 30 seconds while the document is visible.

Android notification permission, channel sound, vibration, Do Not Disturb and device volume remain under the device owner's control. The app does not register a push token or run a dedicated background notification worker. Monitoring pauses when the document is hidden and is not guaranteed after the app is closed, force-stopped or its WebView is no longer active.

## 3. Architecture

```text
Android application (pro.leadmaster.app)
└── MainActivity (Jetpack Compose host)
    └── Android WebView
        ├── Trusted production origin: https://leadmaster.jelvan.pro
        ├── Canonical responsive LeadMASTER dashboard
        ├── Same-origin authenticated API requests
        └── Restricted JavaScript bridge
            ├── Theme synchronization
            └── Local Android notifications

LeadMASTER production services
├── Authentication and server-side sessions
├── Account and authorization rules
├── Mailbox and email sending workflows
├── Activity and inbox read APIs
└── Persistent application data
```

### Source-of-truth map

| Concern | Authoritative implementation |
|---|---|
| Dashboard layout, navigation, theme and interactions | `src/Mandatory LeadMASTER Dashboard.html` |
| Generated dashboard served in production | `public/dashboard.html` and the Worker asset bundle |
| Android lifecycle and WebView integration | `ANDROID APK/app/src/main/java/pro/leadmaster/app/MainActivity.kt` |
| Android app identity and SDK levels | `ANDROID APK/app/build.gradle.kts` |
| Android permissions and launcher activity | `ANDROID APK/app/src/main/AndroidManifest.xml` |
| Production authentication and authorization | LeadMASTER Worker and server-side session store |
| Android CI build and artifact publication | `.github/workflows/android-apk.yml` |

The Android bridge is intentionally narrow. The current JavaScript interface exposes theme synchronization and notification methods only. Do not expose credentials, arbitrary native method invocation, account records, filesystem access or unrestricted URL launching through this bridge.

## 4. Authentication and persistent sign-in

The app uses the same LeadMASTER account and authentication flow as the website. It does not store the user's password in Android preferences, local storage or a separate database.

- The server issues the authenticated `lm_session` cookie with `HttpOnly`, `Secure` and `SameSite=Strict` attributes.
- Android WebView accepts first-party cookies and disables third-party cookies.
- The app flushes the WebView cookie store after page completion and during `onPause`, `onStop` and `onDestroy`.
- The production session uses a rolling 180-day expiry. A successful session restoration renews the server-side expiry and refreshes the cookie.
- Closing or reopening the app does not itself revoke the session.
- Explicitly choosing **Log out**, server-side revocation or expiry ends the authenticated session.

The 180-day value is an inactivity window, not a promise of permanent or indefinite authentication. Session validity is always decided by the production server. Cookie persistence does not bypass password, OTP, security verification, account authorization or other server-side checks.

## 5. Android security model

### WebView hardening

The current WebView configuration:

- Enables JavaScript and DOM storage because the production dashboard requires them.
- Enables database storage for WebView compatibility.
- Disables file URL access and content URL access.
- Disables third-party cookies.
- Disallows mixed content.
- Disables JavaScript-created automatic windows.
- Disables WebView zoom controls and forced text scaling.
- Enables Android Safe Browsing on supported Android versions.
- Uses the responsive page viewport rather than desktop overview scaling.
- Accepts only HTTPS navigation to the exact configured LeadMASTER host and standard HTTPS port as in-app navigation.
- Hands supported external HTTP(S), email and telephone links to Android; blocks unsupported schemes.

The Android manifest disables cleartext network traffic and Android backup. Do not weaken these settings to work around a content or authentication defect.

### Permissions

The current manifest requests:

| Permission | Purpose |
|---|---|
| `INTERNET` | Load the production workspace and call its authenticated APIs |
| `POST_NOTIFICATIONS` | Display local notification events on Android 13 and later |

No camera, microphone, contacts, location, SMS, phone-state or broad storage permission is declared by the current manifest. The system document picker and DownloadManager are used for the supported file workflows.

### Trusted-origin rule

The app's in-app origin is configured in `WorkspaceViewModel`. Keep the exact production host and HTTPS-only policy synchronized with the approved deployment domain. Never use suffix matching (for example, accepting every hostname ending in `leadmaster.jelvan.pro`), arbitrary redirects or user-provided URLs as a trusted origin.

## 6. Build and run locally

### Requirements

- JDK 17
- Android SDK Platform 35
- Android Build Tools 35.0.0
- Gradle 8.7
- Android device or emulator running Android 8.0 (API 26) or later

The project uses Kotlin, Jetpack Compose for the native host, AndroidX Activity/Core/Lifecycle and Material 3. Dependency versions are declared in `app/build.gradle.kts`.

### Build a debug APK

From the repository root:

```bash
cd "ANDROID APK"
gradle assembleDebug
```

Output:

```text
ANDROID APK/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Launch the app from the Android launcher or with:

```bash
adb shell monkey -p pro.leadmaster.app 1
```

### Build a release variant

```bash
cd "ANDROID APK"
gradle assembleRelease
```

A release variant built without the owner-controlled signing configuration must not be distributed as the production app. Verify the signing certificate and package/version metadata before any store or customer distribution.

## 7. Continuous integration and APK download

The workflow is `.github/workflows/android-apk.yml`.

It runs when files under `ANDROID APK/**` or the workflow itself change, and can also be started manually with GitHub Actions. The workflow:

1. Checks out the repository.
2. Installs Temurin JDK 17.
3. Installs Android platform 35 and build tools 35.0.0.
4. Configures Gradle 8.7.
5. Runs `gradle assembleDebug`.
6. Uploads `app-debug.apk` as `leadmaster-android-debug-apk`.
7. Builds and uploads a production-signed release APK only when all four release-signing secrets are present.

**Download the APK:** [Open Android build workflow runs](https://github.com/DevJel/LeadMASTER/actions/workflows/android-apk.yml). Open the newest successful run, scroll to **Artifacts**, and download **leadmaster-android-debug-apk**. GitHub Actions artifacts currently have a 90-day retention period.

The debug artifact is installable for development/testing but is not a Play Store release. GitHub Releases currently contain no published APK release. Do not describe an Actions artifact as a public permanent download.

## 8. Release signing and versioning

The Android module currently declares:

| Property | Current value |
|---|---|
| Application ID | `pro.leadmaster.app` |
| Namespace | `pro.leadmaster.app` |
| Version name | `1.6.0` |
| Version code | `7` |
| Minimum SDK | API 26 (Android 8.0) |
| Compile SDK | API 35 |
| Target SDK | API 35 |
| Java/Kotlin target | 17 |

Production signing is optional in CI and requires all of these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The workflow decodes the keystore into the ephemeral runner's temporary directory and passes its path to Gradle. Never commit a keystore, signing password, private key or decoded signing file. Never create a replacement signing key casually: updates to an installed Android app must preserve the established signing identity (or follow the platform's approved key-rotation process).

For every release:

1. Increment `versionCode`; set the human-readable `versionName`.
2. Review the app manifest, trusted origin, WebView security and notification behavior.
3. Run the web test suite and Android build.
4. Test login, app close/reopen, explicit logout, navigation, file selection, downloads, external links and notification permission on physical Android devices.
5. Confirm the release APK's signature, package ID, version name and version code.
6. Publish release notes that distinguish debug artifacts from production-signed APKs.
7. Record the workflow run, artifact, commit SHA and device-test results.

## 9. Web-to-Android feature parity protocol

For every dashboard or backend change:

1. Review the changed web route, component, API and permission requirements.
2. Check whether the feature is reachable or materially affects Android.
3. Prefer the shared responsive dashboard and authenticated API; do not duplicate the feature in Kotlin.
4. Verify the feature on a narrow mobile viewport and on Android WebView.
5. Update native code only when a platform integration or Android-specific defect requires it.
6. Run the relevant web tests and the Android CI build.
7. Perform device-level acceptance for changes affecting authentication, downloads, file selection, notifications, navigation or lifecycle behavior.
8. Update this document and the root README when app behavior, permissions, architecture, versioning or release procedure changes.

The mandatory dashboard must remain visually and behaviorally authoritative. Do not add a second native bottom bar, Navigation Rail, parallel screen hierarchy or alternate set of business actions.

## 10. Verification checklist

### Authentication and lifecycle
- [ ] Sign in through the production authentication flow.
- [ ] Navigate within the workspace and verify the session remains authenticated.
- [ ] Background and close the app, then reopen it and verify account restoration.
- [ ] Confirm no password or OTP is written to local app storage.
- [ ] Use the dashboard's explicit Log out action and verify protected routes require authentication again.

### WebView and navigation
- [ ] Verify dashboard mobile navigation appears once and is not covered by native controls.
- [ ] Verify light and dark theme system-bar contrast.
- [ ] Verify Android Back follows web history and exits only at the top-level page.
- [ ] Verify untrusted origins open externally or are blocked, never silently loaded as trusted app content.
- [ ] Verify unsupported URL schemes are blocked.

### Files and notifications
- [ ] Verify the document picker can return multiple selected files.
- [ ] Verify a supported same-origin email download completes in Downloads.
- [ ] Verify notification permission behavior on Android 13+.
- [ ] Verify the initial notification baseline does not notify for existing mail.
- [ ] Verify new inbox/activity notifications while the workspace is visible.
- [ ] Verify documentation and UI do not promise push notifications while the app is closed.

### Build and release
- [ ] Run `gradle assembleDebug`.
- [ ] Confirm CI artifact upload succeeds.
- [ ] Verify the APK package ID and version metadata.
- [ ] For production release, verify the expected owner-controlled signing certificate.
- [ ] Complete physical-device testing before describing the build as device-validated.

## 11. Troubleshooting

| Symptom | Checks |
|---|---|
| App asks for sign-in after reopening | Confirm the user did not explicitly log out; inspect WebView cookie persistence, device storage restrictions, server session expiry/revocation and the production `/api/auth/session` response |
| App loads a blank or error page | Check device connectivity, production domain availability, TLS validity, WebView version and the Android logcat output |
| A link opens outside the app | Confirm whether its scheme/host is outside the exact trusted origin; external navigation is intentional |
| File picker does not appear | Check the page's file input behavior, Android activity result flow and WebChromeClient callback |
| Download does not start | Confirm the URL is under the trusted HTTPS origin and that the response is a supported download |
| No notifications appear | Check Android notification permission, per-channel settings, app visibility, authenticated read APIs and whether the event arrived after the initial baseline |
| No alert while app is closed | Expected limitation: current notifications are foreground polling, not push messaging |
| Release APK is not production-signed | Confirm all four signing secrets are configured and the workflow's signed release step ran |

For diagnosis, capture the app version, Android version, device model, workflow run URL and relevant redacted logcat output. Never include session cookies, OTPs, passwords, signing credentials or personal email content in a bug report.

## 12. Change control

- Keep `MainActivity.kt`, `WorkspaceViewModel.kt`, the manifest, Gradle configuration, workflow and this README consistent.
- Keep production authentication and account authorization server-side.
- Do not change production hostnames, session policy, backend APIs, sender identities or account behavior as an incidental Android UI change.
- Do not claim a feature is complete solely because the APK compiles.
- Do not claim device acceptance without actual device testing.
- Do not claim a release is production-signed unless the artifact's signing certificate has been verified.
