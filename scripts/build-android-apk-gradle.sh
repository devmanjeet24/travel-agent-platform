#!/usr/bin/env bash
# Fastest free path: Gradle release APK via Expo prebuild (no EAS at all).
#
# Prerequisites: Android Studio + ANDROID_HOME (same as build-android-apk-local.sh)
#
# Output: android/app/build/outputs/apk/release/app-release.apk
#
# Usage: npm run build:android:apk:gradle

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${ANDROID_HOME:-}" ]] && [[ -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$PATH"
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME is not set. Install Android Studio first."
  exit 1
fi

AVAIL_GB=$(df -g / | awk 'NR==2 {print $4}')
if [[ "${AVAIL_GB}" -lt 8 ]]; then
  echo "Low disk space: ${AVAIL_GB} GiB free on / (need ~8+ GiB for release builds)."
  echo "Run: npm run clean:android:global"
  echo "Then free space in Trash / large downloads and retry."
  exit 1
fi

export NODE_ENV=production
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"

echo "Generating native android/ from app.json (if needed)..."
npx expo prebuild --platform android --clean

echo "Assembling release APK..."
cd android
./gradlew --stop 2>/dev/null || true
./gradlew assembleRelease

APK="app/build/outputs/apk/release/app-release.apk"
APK_UNSIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"

if [[ -f "$APK" ]]; then
  FINAL_APK="$APK"
elif [[ -f "$APK_UNSIGNED" ]]; then
  FINAL_APK="$APK_UNSIGNED"
else
  echo "Gradle failed — no APK was produced."
  echo "Check the error above (common: missing splash image, SDK not installed)."
  exit 1
fi

echo
echo "APK ready:"
echo "  $(pwd)/$FINAL_APK"
echo
echo "Install on a connected device:"
echo "  adb install $(pwd)/$FINAL_APK"
