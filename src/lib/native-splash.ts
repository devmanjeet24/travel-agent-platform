import * as SplashScreen from 'expo-splash-screen';

/** Minimum time the native black splash stays visible before fade-out. */
export const NATIVE_SPLASH_MIN_MS = 2000;

SplashScreen.preventAutoHideAsync().catch(() => {});

try {
  SplashScreen.setOptions({
    duration: 300,
    fade: true,
  });
} catch (error) {
  console.warn(
    '[splash] setOptions unavailable in this runtime:',
    error instanceof Error ? error.message : error,
  );
}
