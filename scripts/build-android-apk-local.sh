#!/usr/bin/env bash
# Build a release APK on your Mac — free, does not use EAS cloud build quota.
#
# Prerequisites (one-time):
#   1. Android Studio → install Android SDK + Platform Tools
#   2. Accept licenses: sdkmanager --licenses
#   3. Optional: brew install --cask android-commandlinetools
#
# Usage: npm run build:android:apk:local

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "Loaded EXPO_PUBLIC_* from .env"
else
  echo "Warning: no .env — Supabase and other services may not work in the APK."
fi

if [[ -z "${ANDROID_HOME:-}" ]] && [[ -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME is not set. Install Android Studio and set ANDROID_HOME to your SDK path."
  exit 1
fi

echo "Building APK locally with EAS (no cloud quota used)..."
echo "This can take 15–40 minutes on first run."
echo

if npx eas build --platform android --profile preview --local "$@"; then
  echo
  echo "Local EAS build finished. The APK path is printed above (often under /var/folders/.../eas-build-local-nodejs/)."
  echo "Search: find /var/folders -name '*.apk' -path '*eas-build-local*' 2>/dev/null | head -5"
else
  echo
  echo "Build failed — no APK was created. Fix Gradle errors above, then retry."
  exit 1
fi
