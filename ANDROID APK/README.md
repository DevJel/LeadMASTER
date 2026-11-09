# LeadMASTER Android app

This is the Android companion app for the LeadMASTER web workspace.

## What it does

- Uses the same production LeadMASTER account, sign-in, email inbox, sending queue and backend as the website.
- Keeps the website's monochrome gray and white visual design.
- Adds Android-friendly bottom navigation mapped to the live web sections: Overview, Emails, Activity, Sending addresses and Settings.
- Highlights the active section and keeps the selected state synchronized when the user navigates inside the workspace.
- Reuses the shared web workspace for message folders, compose/reply, notifications, account profile and developer connections instead of duplicating business logic.
- Keeps authentication in the system WebView cookie store using secure HTTPS cookies.
- Opens supported external web, email and telephone links with Android handlers; only the exact HTTPS LeadMASTER origin stays inside the app.
- Handles system Back by returning to Overview before leaving the workspace.
- Supports Android notification permission and displays LeadMASTER updates through a native notification channel.
- Uses the same website features rather than maintaining a second copy of business logic.

## Build a debug APK

Requirements: JDK 17 and Android SDK Platform 35.

From this folder:

```bash
gradle assembleDebug
```

APK output:

`app/build/outputs/apk/debug/app-debug.apk`

The repository GitHub Actions workflow builds and publishes the debug APK as a workflow artifact whenever this folder changes.

## Release signing

A production-signed APK must be signed with an owner-controlled Android upload/release key. Never commit the keystore, passwords or signing secrets. Add these GitHub Actions secrets before configuring a signed release: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Security

- Only HTTPS and the exact LeadMASTER host are loaded inside the app.
- Cleartext traffic, file URL access, content URL access and third-party cookies are disabled.
- Authentication and account authorization remain server-side.
- The JavaScript bridge exposes only local Android notifications; it does not expose account data, credentials or platform controls.
- The app does not connect to Google Mail or any other external inbox. It only displays data available to the signed-in LeadMASTER account.


## Web and Android feature parity

The Android app is a native navigation and device-integration shell around the same authenticated LeadMASTER web workspace. It is not a second implementation of email, account, API-key or backend business logic.

When a web feature changes:
1. Identify whether the feature is reachable or materially affects the Android app.
2. If connected, verify the shared WebView flow and update Android navigation, device integration, responsive behavior or app documentation where needed.
3. Keep account authorization, validation, persistence and business rules in the shared LeadMASTER server/web implementation; do not fork them into Android.
4. If the change is web-only or unrelated to an Android surface, record that Android is unaffected rather than adding duplicate code.
5. Build the debug APK and review the GitHub Actions build result after Android source changes. A successful build is not a substitute for device testing.

Current native navigation maps to the live dashboard hash sections: `overview`, `emails`, `logs`, `domains` and `settings`. App connections remain available through the shared dashboard link. Do not add navigation for planned or unavailable modules.


## Mandatory dashboard parity

The app opens the same production LeadMASTER dashboard defined in `src/Mandatory LeadMASTER Dashboard.html`. Native navigation must activate the matching dashboard tab rather than relying on URL hashes. The live workspace remains the source for email, account and API data. Android-specific navigation and device integrations must not fork business logic or alter the mandatory dashboard UI.
