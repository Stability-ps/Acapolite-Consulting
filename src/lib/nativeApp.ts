export function isNativeAppRuntime() {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
}
