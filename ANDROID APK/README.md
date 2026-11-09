# LeadMASTER Android app

This is the Android companion app for the LeadMASTER web workspace.

## What it does

- Uses the same production LeadMASTER account, sign-in, email inbox, sending queue and backend as the website.
- Keeps the website's monochrome gray and white visual design.
- Adds Android-friendly bottom navigation for Overview, Inbox, Activity and Settings.
- Keeps authentication in the system WebView cookie store using secure HTTPS cookies.
- Opens links outside leadmaster.jelvan.pro in the device browser.
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
