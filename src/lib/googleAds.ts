const GOOGLE_ADS_ID = "AW-18179840028";
const LEAD_CONVERSION_SEND_TO = "AW-18179840028/Zzz0CJLKw7IcEJyw6dxD";
const ATTRIBUTION_STORAGE_KEY = "acapolite_ad_attribution";

type Gtag = (...args: unknown[]) => void;

type Attribution = Partial<Record<
  "gclid" | "gbraid" | "wbraid" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content",
  string
>>;

function getGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { gtag?: Gtag }).gtag;
  return typeof candidate === "function" ? candidate : null;
}

export function captureAdAttribution() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const keys: (keyof Attribution)[] = [
    "gclid",
    "gbraid",
    "wbraid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];

  const incoming: Attribution = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value) incoming[key] = value;
  }

  if (Object.keys(incoming).length === 0) return;

  try {
    const existing = JSON.parse(localStorage.getItem(ATTRIBUTION_STORAGE_KEY) || "{}") as Attribution;
    localStorage.setItem(
      ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({ ...existing, ...incoming }),
    );
  } catch {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(incoming));
  }
}

export function getAdAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ATTRIBUTION_STORAGE_KEY) || "{}") as Attribution;
  } catch {
    return {};
  }
}

export function trackGoogleAdsLeadConversion(transactionId?: string) {
  const gtag = getGtag();
  if (!gtag) {
    console.warn("Google Ads conversion not sent: gtag is unavailable.");
    return;
  }

  gtag("event", "conversion", {
    send_to: LEAD_CONVERSION_SEND_TO,
    transaction_id: transactionId || undefined,
  });
}

export function trackGoogleAdsEvent(eventName: string, params: Record<string, unknown> = {}) {
  const gtag = getGtag();
  if (!gtag) return;

  gtag("event", eventName, {
    send_to: GOOGLE_ADS_ID,
    ...params,
  });
}
