// Pure decision logic for interpreting Meta's /debug_token response and a
// direct per-asset probe into the health states Super Admin needs to see.
// Kept separate from the network calls so it is unit-testable without a
// live Meta API dependency.
//
// Root-cause note (2026-08-22 audit): the previous version of this module
// only inspected the flat top-level `scopes` array from /debug_token. A
// Meta Business System User granted "Full access" to specific assets
// (exactly the Acapolite setup) reports those permissions via
// `granular_scopes` (each entry scoped to specific target_ids), which the
// old code never read - so it reported "permission missing" for every
// account regardless of the token's real, correctly-configured access.
// This version checks granular scopes AND directly probes the specific
// account ID against Meta, which is what requirement #3 actually asked
// for: verify via Meta's endpoints, not by inferring from DB values.

export type HealthStatus =
  | "connected"
  | "expiring_soon"
  | "invalid_or_expired_token"
  | "missing_scope"
  | "asset_not_assigned"
  | "wrong_account_id"
  | "api_request_failed";

export type DebugTokenData = {
  is_valid?: boolean;
  expires_at?: number; // unix seconds; 0 means never expires
  scopes?: string[];
  granular_scopes?: { scope: string; target_ids?: string[] }[];
  error?: { message?: string };
};

export type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

const REQUIRED_SCOPES: Record<"facebook" | "instagram", string[]> = {
  facebook: ["pages_manage_posts", "pages_read_engagement"],
  instagram: ["instagram_content_publish", "instagram_basic"],
};

const EXPIRING_SOON_WINDOW_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type HealthResult = { status: HealthStatus; message: string };

// A numeric Meta Graph API object ID - never a profile/page URL. Facebook
// Page IDs and Instagram Business Account IDs are always digit strings.
export function isNumericGraphId(value: string): boolean {
  return /^[0-9]+$/.test(value.trim());
}

// True if `scope` is granted either globally (flat `scopes`) or granularly
// for this specific target id (`granular_scopes[].target_ids`). A granular
// grant with no target_ids at all is treated as ungated (rare, but Meta's
// docs allow it) and counts as granted.
export function hasGrantedScope(data: DebugTokenData, scope: string, targetId: string): boolean {
  if ((data.scopes || []).includes(scope)) return true;
  const granular = (data.granular_scopes || []).find((entry) => entry.scope === scope);
  if (!granular) return false;
  if (!granular.target_ids || granular.target_ids.length === 0) return true;
  return granular.target_ids.includes(targetId);
}

export function evaluateTokenValidity(data: DebugTokenData, nowSeconds: number): HealthResult | null {
  if (data.error) return { status: "api_request_failed", message: data.error.message || "Meta did not return token status" };
  if (!data.is_valid) return { status: "invalid_or_expired_token", message: "Token is no longer valid according to Meta." };
  if (data.expires_at && data.expires_at > 0) {
    const secondsRemaining = data.expires_at - nowSeconds;
    if (secondsRemaining <= 0) return { status: "invalid_or_expired_token", message: "Token has expired." };
    if (secondsRemaining <= EXPIRING_SOON_WINDOW_SECONDS) {
      const daysLeft = Math.max(1, Math.ceil(secondsRemaining / 86400));
      return { status: "expiring_soon", message: `Token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Still usable.` };
    }
  }
  return null; // token itself is fine - caller proceeds to the scope/asset checks
}

// Classifies a failed direct Graph API GET on the specific account ID
// (e.g. GET /{page-id}?fields=id,name) into one of the distinct categories
// requirement #4 asked for. This is a best-effort read of Meta's error
// shape - codes 100/803 mean the object graph couldn't resolve the ID at
// all (wrong/non-existent ID); code 190 means the token itself is bad;
// codes 10/200 mean the ID is real but this token/System User isn't
// authorized for it, split further by message wording between "missing
// scope" (no such permission at all) and "asset not assigned" (the
// permission exists but not for this asset).
export function classifyAssetProbeError(httpStatus: number, body: GraphErrorBody): HealthResult {
  const error = body?.error || {};
  const code = typeof error.code === "number" ? error.code : null;
  const message = error.message || `Meta API request failed (${httpStatus})`;

  if (httpStatus >= 500) return { status: "api_request_failed", message };
  if (code === 190) return { status: "invalid_or_expired_token", message };
  if (code === 100 || code === 803) return { status: "wrong_account_id", message };
  if (code === 10 || code === 200) {
    const lower = message.toLowerCase();
    if (lower.includes("permission") && !lower.includes("role") && !lower.includes("assigned")) {
      return { status: "missing_scope", message };
    }
    return { status: "asset_not_assigned", message };
  }
  return { status: "api_request_failed", message };
}

export type AssetProbeSuccess = { ok: true; id: string };
export type AssetProbeFailure = { ok: false; httpStatus: number; body: GraphErrorBody };
export type AssetProbeResult = AssetProbeSuccess | AssetProbeFailure;

// Orchestrates the full per-account verdict: ID format -> token validity ->
// granular scope check -> live asset probe result. Each step can short-
// circuit to a distinct, specific status rather than a single generic
// "permission missing" bucket.
export function evaluateAccountHealth(
  platform: "facebook" | "instagram",
  providerAccountId: string,
  debugToken: DebugTokenData,
  probe: AssetProbeResult,
  nowSeconds: number,
): HealthResult {
  if (!isNumericGraphId(providerAccountId)) {
    return {
      status: "wrong_account_id",
      message: `Stored account ID "${providerAccountId}" is not a numeric Meta Graph API ID (it looks like a profile URL). Run discovery to resolve the correct ID.`,
    };
  }

  const validity = evaluateTokenValidity(debugToken, nowSeconds);
  if (validity && validity.status === "invalid_or_expired_token") return validity;
  if (validity && validity.status === "api_request_failed") return validity;

  if (!probe.ok) return classifyAssetProbeError(probe.httpStatus, probe.body);

  const required = REQUIRED_SCOPES[platform];
  const missing = required.filter((scope) => !hasGrantedScope(debugToken, scope, providerAccountId));
  if (missing.length) {
    return { status: "missing_scope", message: `Token does not grant: ${missing.join(", ")} for this account.` };
  }

  if (validity && validity.status === "expiring_soon") return validity;
  return { status: "connected", message: "Account ID resolves on Meta and the token has all required permissions for it." };
}
