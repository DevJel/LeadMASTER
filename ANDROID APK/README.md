# LeadMASTER Android app

The Android companion app opens the same authenticated LeadMASTER production workspace as the website. It does not create a second email service or a separate account-data store.

## App experience

- Jetpack Compose with Material 3 navigation.
- Five primary destinations: Home, Emails, Audience, Metrics and Profile.
- Compact phones use a fixed bottom navigation bar; larger screens use a Navigation Rail.
- The active destination follows navigation inside the shared dashboard.
- The WebView content scrolls independently; native navigation stays in place.
- The website's own bottom bar is hidden only inside the native app, avoiding duplicate navigation.
- Native Back returns to Home before leaving the workspace.
- System edge-to-edge layout and safe-area insets are respected.
- Existing notification, download, HTTPS link handling and WebView cookie-session behavior are retained.

## Architecture alignment

This app follows the applicable principles in [Android-References](https://github.com/DevJel/Android-References):

- **UI:** Jetpack Compose and Material 3; adaptive bottom navigation / navigation rail.
- **State:** `WorkspaceViewModel` exposes immutable `StateFlow<WorkspaceUiState>`. UI collects state lifecycle-aware; user actions flow back through ViewModel events (UDF).
- **Platform integration:** `MainActivity` owns the trusted-origin WebView, navigation bridge, notifications, external intents and downloads.
- **Security:** only HTTPS requests to the exact `leadmaster.jelvan.pro` origin remain inside the app. File/content access and third-party cookies are disabled.
- **Single source of truth:** authentication, email, templates, contacts, metrics, account permissions and activity records stay in the production LeadMASTER services and D1. The Android app does not maintain a competing copy of business records.

The reference describes a larger multi-module, Room-backed offline-first architecture for apps that own substantial native data. LeadMASTER Android is intentionally a thin native shell around the production web workspace; adding Room, Hilt, sync workers or duplicate feature modules for data already owned by the server would create a second source of truth. If native-owned offline data is introduced later, it should be added through the reference's repository/Room/WorkManager pattern.

## Web and Android feature parity

The mandatory dashboard source is `src/Mandatory LeadMASTER Dashboard.html`. The Android app opens the same production dashboard and uses the same authenticated WebView cookie session.

When a web feature changes:
1. Check whether it is reachable or materially affects the Android app.
2. Reuse the shared dashboard and authenticated API for account and email operations.
3. Update the native shell only for navigation, responsive layout, device integrations or Android-specific behavior.
4. Do not fork validation, authorization, sending or persistence logic.
5. Run the web tests and Android build after changes; a successful build is not a substitute for device testing.

Native navigation maps to the mandatory dashboard destinations: Home (`home`), Emails (`emails`), Audience (`audience`), Metrics (`metrics`) and Profile (`profile`). Other workspace modules remain accessible from the dashboard menu. Do not add navigation for unavailable modules.

## Build a debug APK

Requirements: JDK 17, Android SDK Platform 35 and Gradle 8.7.

From this folder:

```bash
gradle assembleDebug
```

APK output:

`app/build/outputs/apk/debug/app-debug.apk`

The GitHub Actions workflow builds and publishes the debug APK as an artifact whenever this folder changes.

## Release signing

A production-signed APK must be signed with an owner-controlled Android upload/release key. Never commit the keystore, passwords or signing secrets. Add these GitHub Actions secrets before configuring a signed release: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Security notes

- Cleartext traffic, file URL access, content URL access and third-party cookies are disabled.
- Authentication and account authorization remain server-side.
- The JavaScript bridge is used only for local navigation state and Android notifications; it does not expose account data, credentials or platform controls.
- The app does not connect to Google Mail or another external inbox.
