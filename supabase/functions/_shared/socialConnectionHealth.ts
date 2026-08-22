// Pure decision logic for interpreting Meta's /debug_token response into
// the health states Super Admin needs to see. Kept separate from the
// network call so it is unit-testable without a live Meta API dependency.

export type HealthStatus = "connected" | "expiring_soon" | "expired" | "permission_missing" | "unavailable";

export type DebugTokenData = {
  is_valid?: boolean;
  expires_at?: number; // unix seconds; 0 means never expires
  scopes?: string[];
  error?: { message?: string };
};

const REQUIRED_SCOPES: Record<"facebook" | "instagram", string[]> = {
  facebook: ["pages_manage_posts", "pages_read_engagement"],
  instagram: ["instagram_content_publish", "instagram_basic", "pages_show_list"],
};

const EXPIRING_SOON_WINDOW_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type HealthResult = { status: HealthStatus; message: string };

export function evaluateTokenHealth(platform: "facebook" | "instagram", data: DebugTokenData, nowSeconds: number): HealthResult {
  if (data.error) {
    return { status: "unavailable", message: data.error.message || "Meta API did not return token status" };
  }
  if (!data.is_valid) {
    return { status: "expired", message: "Token is no longer valid according to Meta." };
  }

  const scopes = new Set(data.scopes || []);
  const required = REQUIRED_SCOPES[platform];
  const missing = required.filter((scope) => !scopes.has(scope));
  if (missing.length) {
    return { status: "permission_missing", message: `Missing required permission(s): ${missing.join(", ")}` };
  }

  if (data.expires_at && data.expires_at > 0) {
    const secondsRemaining = data.expires_at - nowSeconds;
    if (secondsRemaining <= 0) return { status: "expired", message: "Token has expired." };
    if (secondsRemaining <= EXPIRING_SOON_WINDOW_SECONDS) {
      const daysLeft = Math.max(1, Math.ceil(secondsRemaining / 86400));
      return { status: "expiring_soon", message: `Token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.` };
    }
  }

  return { status: "connected", message: "Token is valid with all required permissions." };
}
