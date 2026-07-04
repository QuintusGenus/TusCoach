# Mobile Release Guide

How to build, test, and ship TusCoach to TestFlight (iOS) and the Google Play
internal track (Android) using EAS Build + Submit.

---

## Prerequisites

1. **Expo account** — sign up at https://expo.dev
2. **EAS CLI** installed globally:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. **Apple Developer account** ($99/year) for iOS
4. **Google Play Console** with the app created for Android

### One-time EAS project setup

```bash
cd mobile
eas init            # Links the project to your Expo account
```

This writes your project ID into `app.json → extra.eas.projectId`.
Update the `owner` field in `app.json` to match your Expo account name.

---

## Build Profiles

Defined in [mobile/eas.json](../mobile/eas.json):

| Profile | API target | Distribution | Use case |
|---------|-----------|--------------|----------|
| `development` | localhost | Internal (dev client) | Local development with hot reload |
| `preview` | staging API | Internal (ad-hoc) | QA testing on physical devices |
| `production` | production API | Store | TestFlight / Play Store release |

Each profile sets `EXPO_PUBLIC_API_BASE_URL` so the app points at the correct
backend automatically.

---

## 1. Preview builds (internal QA)

Preview builds are ad-hoc signed (iOS) / APK (Android) builds for internal
testers. No store submission required.

### Build

```bash
cd mobile

# Both platforms
npm run build:preview

# Or one at a time
npm run build:preview:ios
npm run build:preview:android
```

### Distribute

Once the build completes, EAS shows a URL. Share it with testers:

- **iOS** — Testers must register their device UDID first:
  ```bash
  eas device:create    # Generates a registration link
  ```
  After device registration, rebuild. Testers install via the EAS link.

- **Android** — Testers download the APK directly from the EAS link.

---

## 2. Production builds

### 2.1 Bump version (if needed)

Update `version` in `mobile/app.json`. The `buildNumber` (iOS) and
`versionCode` (Android) auto-increment via `"autoIncrement": true` in
`eas.json`.

### 2.2 Build

```bash
cd mobile

# Both platforms
npm run build:prod

# Or one at a time
npm run build:prod:ios
npm run build:prod:android
```

---

## 3. Submit to TestFlight (iOS)

### 3.1 First-time setup

1. Create the app in [App Store Connect](https://appstoreconnect.apple.com):
   - Bundle ID: `com.tuscoach.app`
   - SKU: `com.tuscoach.app`

2. Update `mobile/eas.json` → `submit.production.ios`:
   ```json
   {
     "appleId": "you@example.com",
     "ascAppId": "1234567890",
     "appleTeamId": "ABCDE12345"
   }
   ```

   Find your `ascAppId` in App Store Connect → App Information → Apple ID.

3. Generate an app-specific password at https://appleid.apple.com (or use
   an API key — EAS will prompt you).

### 3.2 Submit

```bash
npm run submit:ios
```

EAS uploads the latest production build to TestFlight automatically.

### 3.3 Test via TestFlight

1. Open TestFlight on your test device.
2. The build appears under "Internal Testing" after Apple processes it
   (usually 5–15 minutes).
3. Tap **Install** → run through the [QA checklist](qa_checklist.md).

### 3.4 Add external testers (optional)

In App Store Connect → TestFlight → External Testing:
1. Create a group.
2. Add testers by email.
3. Submit the build for Beta App Review (one-time, ~24h).
4. Once approved, external testers receive an invite.

---

## 4. Submit to Google Play internal track (Android)

### 4.1 First-time setup

1. Create the app in [Google Play Console](https://play.google.com/console):
   - Package name: `com.tuscoach.app`

2. Create a Google Cloud **service account** with Play Console access:
   - Google Cloud Console → IAM → Service Accounts → Create
   - Grant role: **Service Account User**
   - Create a JSON key → download as `google-service-account.json`
   - In Play Console → Settings → API access → link the service account
   - Grant it **Release manager** permission for TusCoach

3. Place the key file in the mobile directory:
   ```bash
   cp ~/Downloads/your-key.json mobile/google-service-account.json
   ```
   > This file is in `.gitignore` — never commit it.

4. The path is already configured in `eas.json`:
   ```json
   {
     "android": {
       "serviceAccountKeyPath": "./google-service-account.json",
       "track": "internal"
     }
   }
   ```

### 4.2 Submit

```bash
npm run submit:android
```

EAS uploads the AAB to the **internal testing** track.

### 4.3 Test via Play Store

1. Go to Play Console → Internal testing → Testers.
2. Create an email list with tester Google accounts.
3. Copy the **opt-in URL** and share with testers.
4. Testers open the link → install from Play Store → run through the
   [QA checklist](qa_checklist.md).

---

## 5. Promoting to production

After QA passes on both platforms:

### iOS

In App Store Connect:
1. Go to the app → App Store tab → create a new version.
2. Select the TestFlight build.
3. Fill in release notes, screenshots, etc.
4. Submit for App Review.

### Android

In Play Console:
1. Go to Internal testing → select the build → **Promote to Production**.
2. Fill in release notes.
3. Review and roll out.

---

## Quick Reference

```bash
# Full release cycle (example)
cd mobile

# 1. Build for both platforms
npm run build:prod

# 2. Submit to stores
npm run submit:ios
npm run submit:android

# 3. Monitor
eas build:list          # Check build status
eas submit:list         # Check submission status
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `eas build` fails with credentials error | Run `eas credentials` to re-configure signing |
| iOS build succeeds but TestFlight rejects | Check `bundleIdentifier` matches App Store Connect |
| Android AAB rejected by Play Console | Ensure `package` in `app.json` matches Play Console |
| Push notifications don't work in build | Verify `expo-notifications` plugin is in `app.json` plugins |
| API calls fail in preview build | Check `EXPO_PUBLIC_API_BASE_URL` in `eas.json` matches your staging server |
