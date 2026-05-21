import * as SplashScreen from 'expo-splash-screen';

/** Minimum time the native black splash stays visible before fade-out. */
export const NATIVE_SPLASH_MIN_MS = 2000;

SplashScreen.preventAutoHideAsync().catch(() => {});

SplashScreen.setOptions({
  duration: 300,
  fade: true,
});
