#!/usr/bin/env bash
# Free disk space before Android Gradle builds (needs several GB free).
# Usage: npm run clean:android

set -euo pipefail

cd "$(dirname "$0")/.."

echo "Stopping Gradle daemons..."
if [[ -d android ]]; then
  (cd android && ./gradlew --stop 2>/dev/null) || true
fi

echo "Removing local Android build outputs..."
rm -rf android/app/build android/.gradle android/build 2>/dev/null || true
rm -rf node_modules/@react-native/gradle-plugin/.gradle 2>/dev/null || true
rm -rf node_modules/expo-modules-core/expo-module-gradle-plugin/.gradle 2>/dev/null || true
rm -rf node_modules/expo-modules-autolinking/android/expo-gradle-plugin/.gradle 2>/dev/null || true

if [[ "${1:-}" == "--global" ]]; then
  echo "Removing global Gradle caches (~/.gradle/caches)..."
  rm -rf "${HOME}/.gradle/caches" "${HOME}/.gradle/daemon" 2>/dev/null || true
fi

AVAIL=$(df -g / | awk 'NR==2 {print $4}')
echo
echo "Disk space available on /: ${AVAIL} GiB"
if [[ "${AVAIL}" -lt 8 ]]; then
  echo "Warning: Android release builds usually need 8+ GiB free."
  echo "Empty Trash, remove old Xcode simulators, or run with --global after closing Android Studio."
fi
