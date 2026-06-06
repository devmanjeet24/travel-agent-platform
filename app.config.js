/** @type {import('expo/config').ExpoConfig} */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

const expo = appJson.expo;

/** Load .env for local Gradle/APK builds so EXPO_PUBLIC_* are inlined in the native bundle. */
function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key.startsWith('EXPO_PUBLIC_') && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

/** EAS/production builds only — Expo Go must load the Metro bundle, not u.expo.dev. */
const otaUpdatesEnabled =
  process.env.EAS_BUILD === 'true' || process.env.EXPO_PUBLIC_ENABLE_OTA === '1';

function pluginKey(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function dedupePlugins(plugins) {
  const seen = new Set();
  return plugins.filter((plugin) => {
    const key = pluginKey(plugin);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pluginsForBuild() {
  const plugins = dedupePlugins(expo.plugins ?? []);
  if (otaUpdatesEnabled) return plugins;
  return plugins.filter((plugin) => pluginKey(plugin) !== 'expo-updates');
}

module.exports = ({ config }) => {
  const base = {
    ...expo,
    ...config,
    plugins: pluginsForBuild(),
  };

  if (otaUpdatesEnabled) {
    return {
      ...base,
      runtimeVersion: expo.runtimeVersion,
      updates: {
        ...expo.updates,
        enabled: true,
      },
    };
  }

  // Dev / Expo Go: no OTA URL, no runtimeVersion pin, no expo-updates plugin.
  const { updates: _updates, runtimeVersion: _runtimeVersion, ...withoutOta } = base;
  return {
    ...withoutOta,
    updates: {
      enabled: false,
    },
    extra: {
      ...(withoutOta.extra ?? {}),
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  };
};
