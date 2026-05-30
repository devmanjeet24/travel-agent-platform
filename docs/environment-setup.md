# Environment setup

## Quick start

1. Copy `.env.example` to `.env`.
2. Add Supabase URL and anon key from [Supabase](https://supabase.com) → **Settings → API**.
3. Restart Expo: `npm run start:clear` (uses a larger Node heap; avoids “JavaScript heap out of memory” on large bundles).

## Dev server: `JavaScript heap out of memory` (`npx expo start`)

Metro/Expo CLI runs in **Node**. The default heap is often too small for this project’s bundle graph on an 8GB Mac. **`npm start` / `npm run start:clear` / `npm run start:tunnel`** set `NODE_OPTIONS=--max-old-space-size=8192`. If you still OOM, close other apps or run `npm run start:clear` once after `watchman watch-del-all` (if you use Watchman).

## Expo Go: `Failed to download remote update` (Android)

That message is **Expo Go failing to download your JavaScript bundle** from the dev machine (it is not the same as EAS Update / OTA). Common causes:

| Cause | What to try |
|--------|-------------|
| Phone and computer not reachable to each other | Same Wi‑Fi (not guest/AP isolation), or run `npx expo start --tunnel` (or `npm run start:tunnel`). |
| VPN / corporate / “public” Wi‑Fi | Disable VPN; on Windows set the network to **Private** and allow **Node.js** through the firewall for private networks. |
| Wrong interface / IP in the QR URL | In the Expo CLI terminal, switch connection type (LAN ↔ Tunnel) and scan again. |
| Stale cache | `npx expo start -c`. |
| SDK mismatch | Update **Expo Go** from the store so its SDK matches the project (`expo` in `package.json`, e.g. **54**). |

If you use a **development build** (`expo-dev-client`), open the project with that app, not store Expo Go.

## APK: “Failed to download remote update” or default Expo UI

That screen means the **JavaScript bundle did not load** (not a styling bug). Common causes:

| Cause | Fix |
|--------|-----|
| Old APK built before config fixes | **Rebuild** after pulling latest `app.json` (see below). Uninstall the old APK first. |
| EAS Update blocking startup | `app.json` sets `updates.checkAutomatically` to `ON_ERROR_RECOVERY` and `fallbackToCacheTimeout: 0` so the **embedded** bundle runs immediately. |
| Missing `EXPO_PUBLIC_*` on EAS | Run `npm run eas:env:preview` or set vars in the Expo dashboard for the build profile. |
| React Compiler + Expo Router crash | `experiments.reactCompiler` is **disabled** — do not re-enable until Expo Router supports frozen components. |

After changing `app.json`, always create a **new** APK (`npm run build:android:apk`). Hot reload does not apply to installed APKs.

## Client variables (`.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Auth, database, storage |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public client key (not service role) |
| `EXPO_PUBLIC_OSRM_BASE_URL` | No | Driving route distance & duration (default: public OSRM) |
| `EXPO_PUBLIC_POSTHOG_KEY` | No | Product analytics (future) |

## Server secrets (never in `.env` on the phone)

Set in **Supabase → Edge Functions → Secrets** when you add AI tools:

| Secret | Purpose |
|--------|---------|
| `GROQ_API_KEY` | AI chat, plan-trip, transcribe — see [groq-chat-setup.md](./groq-chat-setup.md) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-only server tasks (optional) |

Travel data (weather, hotels, geocoding) uses free APIs — see [travel-apis-setup.md](./travel-apis-setup.md).

## Maps (OpenStreetMap only — no API keys)

Maps are **100% free/open-source** — no Google Maps SDK, no billing, no cloud API keys.

| Feature | Service |
|---------|---------|
| Map preview | CARTO/OSM tile template via `EXPO_PUBLIC_MAP_TILE_URL` |
| Pins and route preview | In-app SVG overlays on the OSM/CARTO tile preview |
| Route distance & time | [OSRM](https://project-osrm.org/) (`EXPO_PUBLIC_OSRM_BASE_URL`, optional) |

Works the same on **iOS, Android APK, and web** — no native MapView, so no Android Google Maps key requirement.

Respect [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) if you self-host tiles later.

## EAS Build (shareable Android APK)

Cloud builds use [EAS Build](https://docs.expo.dev/build/introduction/). Profiles live in `eas.json`:

| Profile | Output | Use case |
|---------|--------|----------|
| `preview` | `.apk` | Share with testers (sideload) |
| `production-apk` | `.apk` | Production config + version bump, still sideloadable |
| `production` | `.aab` | Google Play Store |

### One-time setup

1. Install CLI: `npm install` (includes `eas-cli` from devDependencies).
2. Log in: `npx eas login`
3. Create EAS env vars (required — `.env` is not uploaded):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --environment preview --visibility sensitive
# Repeat for --environment production when you ship store builds
```

Optional: copy the same vars for `development` if you use `eas build --profile development`.

4. In **Supabase → Authentication → URL configuration** (required for email confirm & OAuth on APK):
   - **Redirect URLs** (add all):
     - `travelagentplatform://auth/callback`
     - `travelagentplatform://**`
     - `http://localhost:8081/auth/callback` (Expo web dev only)
   - **Site URL**: set to `travelagentplatform://auth/callback` for mobile-first testing, or your production web URL — **do not** leave `http://localhost:3000` if you ship APK builds (confirmation emails will open localhost on the phone).

### Troubleshooting failed builds

| Symptom | Cause | Fix |
|---------|--------|-----|
| `470 MB` upload / slow upload | Local `android/` folder uploaded | Ensure `android/` is in `.easignore` (already configured). Optional: `rm -rf android` locally — EAS will prebuild on the server. |
| `android.package in app.json is ignored` | Committed or uploaded native project | Prefer managed builds: exclude `android/` from upload (above). |
| `No environment variables … preview` | `.env` is not sent to EAS | Run `npm run eas:env:preview` (reads `.env`) or set vars in [Environment variables](https://expo.dev/accounts/saurabhkhatri2015/projects/travel-agent-platform/environment-variables). |
| `used its Android builds from the Free plan` | Monthly EAS quota | Wait for reset (shown in CLI), [upgrade plan](https://expo.dev/accounts/saurabhkhatri2015/settings/billing), or `eas build --platform android --profile preview --local` (needs Android SDK). |
| `EAS_BUILD_UNKNOWN_GRADLE_ERROR` | Often stale local `android/` on the builder | Exclude `android/` from upload and rebuild. |
| `No space left on device` (local Gradle) | Mac disk full during `mergeReleaseNativeLibs` / dex | Run `npm run clean:android:global`, empty Trash, ensure **8+ GiB** free, then `npm run build:android:apk:gradle` again. |
| `Metaspace` / `compileReleaseKotlin FAILED` (local EAS) | Gradle JVM ran out of metaspace on an 8GB Mac | Close Android Studio, run `npm run clean:android:global`, then `npm run build:android:apk:local` (project sets 4GB heap / 1GB metaspace). Or use `npm run build:android:apk:gradle`. |
| `used its Android builds from the Free plan` (cloud EAS) | Monthly free Android build quota used | Wait for reset (date shown in CLI), upgrade billing, or `npm run build:android:apk:local` / `npm run build:android:apk:gradle` (no cloud quota). |

### Build commands

```bash
# Shareable test APK (most common)
npm run build:android:apk
# or: npx eas build --platform android --profile preview

# Production-like APK (auto-increments version on EAS)
npm run build:android:apk:prod

# Play Store bundle (not directly installable)
npm run build:android:store
```

When the build finishes, open the build page on [expo.dev](https://expo.dev) and download the **APK** artifact, or use the install link EAS prints.

### Share APK with testers

1. Download the `.apk` from the EAS build page.
2. Send the file or the **public install URL** (email, Slack, Drive, etc.).
3. On the device: enable **Install unknown apps** for the browser/files app, open the APK, install.
4. Testers need network access to your Supabase project and any APIs you configured in EAS env vars.

Install via USB: `adb install path/to/app.apk`

## OAuth (Google / Apple)

Configure in **Supabase → Authentication → Providers**, not in `.env` for basic setup.

## Email sign-up (confirmation)

By default Supabase requires users to **confirm their email** before sign-in works. After sign-up, open the link on your phone — it should launch the app via `travelagentplatform://auth/callback` (not localhost). Sign-in returns `400` until the email is confirmed.

The app passes `emailRedirectTo` on sign-up; Supabase must allow that URL in **Redirect URLs** (see EAS step 4 above).

For local development only, you can disable confirmation under **Supabase → Authentication → Providers → Email → Confirm email**.
