# Environment setup

## Quick start

1. Copy `.env.example` to `.env`.
2. Add Supabase URL and anon key from [Supabase](https://supabase.com) → **Settings → API**.
3. Restart Expo: `npx expo start -c`.

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
| Map preview | [OSM static map](https://staticmap.openstreetmap.de/) (tap opens openstreetmap.org) |
| Turn-by-turn / pins | External links to [openstreetmap.org](https://www.openstreetmap.org) |
| Route distance & time | [OSRM](https://project-osrm.org/) (`EXPO_PUBLIC_OSRM_BASE_URL`, optional) |

Works the same on **iOS, Android APK, and web** — no native MapView, so no Android crash risk.

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

4. In **Supabase → Authentication → URL configuration**, add redirect URL:
   `travelagentplatform://` (matches `scheme` in `app.json`).

### Troubleshooting failed builds

| Symptom | Cause | Fix |
|---------|--------|-----|
| `470 MB` upload / slow upload | Local `android/` folder uploaded | Ensure `android/` is in `.easignore` (already configured). Optional: `rm -rf android` locally — EAS will prebuild on the server. |
| `android.package in app.json is ignored` | Committed or uploaded native project | Prefer managed builds: exclude `android/` from upload (above). |
| `No environment variables … preview` | `.env` is not sent to EAS | Run `npm run eas:env:preview` (reads `.env`) or set vars in [Environment variables](https://expo.dev/accounts/saurabhkhatri2015/projects/travel-agent-platform/environment-variables). |
| `used its Android builds from the Free plan` | Monthly EAS quota | Wait for reset (shown in CLI), [upgrade plan](https://expo.dev/accounts/saurabhkhatri2015/settings/billing), or `eas build --platform android --profile preview --local` (needs Android SDK). |
| `EAS_BUILD_UNKNOWN_GRADLE_ERROR` | Often stale local `android/` on the builder | Exclude `android/` from upload and rebuild. |
| `No space left on device` (local Gradle) | Mac disk full during `mergeReleaseNativeLibs` / dex | Run `npm run clean:android:global`, empty Trash, ensure **8+ GiB** free, then `npm run build:android:apk:gradle` again. |

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

By default Supabase requires users to **confirm their email** before sign-in works. After sign-up, check your inbox for the Supabase confirmation link; sign-in returns `400` until the email is confirmed.

For local development only, you can disable this under **Supabase → Authentication → Providers → Email → Confirm email**.
