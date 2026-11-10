# LeadMASTER Android app

The Android companion opens the same authenticated LeadMASTER workspace as the website. The canonical dashboard is the UI source of truth; Android does not render a second set of navigation controls or re-create dashboard screens.

## App experience

- Full-screen Android host for the canonical responsive LeadMASTER dashboard.
- The dashboard owns its own mobile bottom navigation, desktop sidebar, responsive breakpoints, page spacing, cards, forms, dialogs, icons, theme and interactions.
- No additional native bottom bar or desktop Navigation Rail is layered over the web app.
- The dashboard's existing light/dark theme is preserved; Android system-bar icon contrast follows the active dashboard theme.
- WebView viewport handling uses the page's responsive viewport without desktop overview scaling or forced text zoom.
- Native Back follows WebView page history and exits only when there is no page history.
- Existing notification, multi-file picker, download, HTTPS link handling and WebView cookie-session behavior are retained.

## Architecture alignment

- **UI:** the canonical dashboard in `src/Mandatory LeadMASTER Dashboard.html` supplies the complete responsive UI. Jetpack Compose hosts the full-screen WebView; it does not duplicate dashboard controls.
- **Platform integration:** `MainActivity` owns the trusted-origin WebView, restricted JavaScript bridge, notifications, external intents and downloads.
- **Security:** only HTTPS requests to the exact `leadmaster.jelvan.pro` origin remain inside the app. File/content access and third-party cookies are disabled.
- **Single source of truth:** authentication, email, templates, contacts, metrics, account permissions and activity records stay in the production LeadMASTER services and D1. The Android app does not maintain a competing copy of business records.

The app intentionally remains a thin companion to the production workspace. Do not add Room, offline copies, duplicate API business logic or native versions of existing dashboard workflows unless a separately approved native-only capability requires them.

## Native notification sounds

Android creates separate notification channels for email sent, email deleted, newly received mail and general LeadMASTER updates. Each channel uses the device's default notification sound and vibration and can be adjusted independently in Android Settings → Apps → LeadMASTER → Notifications.

While the app is open and authenticated, it checks the existing activity and inbox read endpoints every 30 seconds. It establishes an initial baseline so old activity and existing inbox messages do not generate a burst of notifications. New activity events are mapped to their corresponding notification category; newly appearing inbox messages generate a new-mail notification.

Notification access requires the Android notification permission. Android notification channel settings, Do Not Disturb, silent mode and device volume remain under the user's control. Because this implementation deliberately does not change the production backend or add a push service, inbox/activity monitoring is active only while the app's authenticated workspace is open; it is not a guaranteed background or force-closed push notification service.

## Web and Android feature parity

The mandatory dashboard source is `src/Mandatory LeadMASTER Dashboard.html`. Android loads the same production dashboard and uses the same authenticated WebView cookie session.

When a web feature changes:
1. Check whether it is reachable or materially affects the Android app.
2. Reuse the shared dashboard and authenticated API for account and email operations.
3. Update native code only for device integrations, platform behavior or an Android-specific issue.
4. Do not fork validation, authorization, sending or persistence logic.
5. Run web tests and the Android build after changes; a successful build is not a substitute for device testing.

The five primary mobile destinations remain the canonical dashboard destinations: Home (`home`), Emails (`emails`), Audience (`audience`), Metrics (`metrics`) and Profile (`profile`). Templates and other workspace modules remain reachable through the dashboard's own navigation and must not be substituted into the primary navigation.

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
- Authentication and account authorization remain server-side. The HttpOnly `lm_session` cookie is persisted by Android WebView and flushed on page completion, app pause, stop and close; closing the app does not sign out. The server-side session has a rolling 180-day expiry renewed whenever the app restores the authenticated session, unless the user explicitly signs out or the session expires.
- The JavaScript bridge exposes only theme synchronization and local notifications; it does not expose account data, credentials or platform controls.
- The app does not connect to Google Mail or another external inbox.
