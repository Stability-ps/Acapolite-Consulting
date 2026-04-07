const FALLBACK_PRODUCTION_URL = "https://acapoliteconsulting.co.za";

function normalizeBaseUrl(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

export function getAppBaseUrl() {
  const envUrl = normalizeBaseUrl(import.meta.env.VITE_APP_URL);
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== "undefined") {
    const currentOrigin = normalizeBaseUrl(window.location.origin);

    if (currentOrigin && !/localhost|127\.0\.0\.1/i.test(currentOrigin)) {
      return currentOrigin;
    }
  }

  return FALLBACK_PRODUCTION_URL;
}
