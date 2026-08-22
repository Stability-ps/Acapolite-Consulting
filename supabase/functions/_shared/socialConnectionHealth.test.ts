import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateAccountHealth, hasGrantedScope, isNumericGraphId } from "./socialConnectionHealth.ts";

const now = Math.floor(new Date("2026-09-01T00:00:00Z").getTime() / 1000);
const validToken = { is_valid: true, expires_at: 0 };
const okProbe = { ok: true as const, id: "111222333444555", matchesExpectedType: true };

Deno.test("isNumericGraphId rejects profile URLs (the actual production bug)", () => {
  assertEquals(isNumericGraphId("https://www.facebook.com/acapolite"), false);
  assertEquals(isNumericGraphId("https://www.instagram.com/acapolite/"), false);
  assertEquals(isNumericGraphId("111222333444555"), true);
});

Deno.test("hasGrantedScope recognises a granular (System User asset-scoped) grant, not just flat scopes", () => {
  const data = { scopes: [], granular_scopes: [{ scope: "pages_manage_posts", target_ids: ["111222333444555"] }] };
  assertEquals(hasGrantedScope(data, "pages_manage_posts", "111222333444555"), true);
  assertEquals(hasGrantedScope(data, "pages_manage_posts", "999999999999999"), false); // granted for a DIFFERENT asset only
});

Deno.test("hasGrantedScope still recognises a flat, ungated scope grant", () => {
  const data = { scopes: ["pages_manage_posts"] };
  assertEquals(hasGrantedScope(data, "pages_manage_posts", "anything"), true);
});

Deno.test("REGRESSION: a System User token with correct granular access to the exact Page ID is reported connected, not permission-missing", () => {
  const debugToken = {
    is_valid: true,
    expires_at: 0,
    granular_scopes: [
      { scope: "pages_manage_posts", target_ids: ["111222333444555"] },
      { scope: "pages_read_engagement", target_ids: ["111222333444555"] },
    ],
  };
  const result = evaluateAccountHealth("facebook", "111222333444555", debugToken, okProbe, now);
  assertEquals(result.status, "connected");
});

Deno.test("a stored profile URL is reported as wrong_account_id, distinctly, before ever calling Meta for permissions", () => {
  const result = evaluateAccountHealth("facebook", "https://www.facebook.com/acapolite", validToken, okProbe, now);
  assertEquals(result.status, "wrong_account_id");
});

Deno.test("an invalid token is invalid_or_expired_token, distinct from a permission problem", () => {
  const result = evaluateAccountHealth("facebook", "111222333444555", { is_valid: false }, okProbe, now);
  assertEquals(result.status, "invalid_or_expired_token");
});

Deno.test("a live Graph probe failing with code 100 (object does not exist) is wrong_account_id, not permission_missing", () => {
  const probe = { ok: false as const, httpStatus: 400, body: { error: { message: "Unsupported get request. Object does not exist", code: 100 } } };
  const result = evaluateAccountHealth("facebook", "111222333444555", validToken, probe, now);
  assertEquals(result.status, "wrong_account_id");
});

Deno.test("REGRESSION (production case): a code-100 error whose message actually names a missing permission is missing_scope, not wrong_account_id", () => {
  // Meta overloads error code 100 for both "malformed/nonexistent ID" and
  // "this ID exists but the token lacks the read permission for it" - the
  // real-world message this System User token returned when probing a
  // correct, freshly-discovered numeric Page ID.
  const probe = {
    ok: false as const,
    httpStatus: 400,
    body: {
      error: {
        message: "(#100) Object does not exist, cannot be loaded due to missing permission or reviewable feature, or does not support this operation. This endpoint requires the 'pages_read_engagement' permission or the 'Page Public Content Access' feature.",
        code: 100,
      },
    },
  };
  const result = evaluateAccountHealth("facebook", "1077357338795210", validToken, probe, now);
  assertEquals(result.status, "missing_scope");
});

Deno.test("a live Graph probe failing with code 190 is invalid_or_expired_token, even if debug_token said valid", () => {
  const probe = { ok: false as const, httpStatus: 401, body: { error: { message: "Error validating access token", code: 190 } } };
  const result = evaluateAccountHealth("facebook", "111222333444555", validToken, probe, now);
  assertEquals(result.status, "invalid_or_expired_token");
});

Deno.test("a live Graph probe failing with a role/assignment message is asset_not_assigned, distinct from missing_scope", () => {
  const probe = { ok: false as const, httpStatus: 403, body: { error: { message: "User is not assigned to this asset", code: 10 } } };
  const result = evaluateAccountHealth("facebook", "111222333444555", validToken, probe, now);
  assertEquals(result.status, "asset_not_assigned");
});

Deno.test("a live Graph probe failing with a plain permission message is missing_scope", () => {
  const probe = { ok: false as const, httpStatus: 403, body: { error: { message: "(#200) Permissions error", code: 200 } } };
  const result = evaluateAccountHealth("facebook", "111222333444555", validToken, probe, now);
  assertEquals(result.status, "missing_scope");
});

Deno.test("a 5xx from Meta during the probe is api_request_failed, not treated as a real permission verdict", () => {
  const probe = { ok: false as const, httpStatus: 503, body: {} };
  const result = evaluateAccountHealth("facebook", "111222333444555", validToken, probe, now);
  assertEquals(result.status, "api_request_failed");
});

Deno.test("the probe succeeding but the token lacking the required granular scope for THIS id is missing_scope", () => {
  const debugToken = { is_valid: true, expires_at: 0, granular_scopes: [{ scope: "pages_manage_posts", target_ids: ["999999999999999"] }] }; // wrong target id
  const result = evaluateAccountHealth("facebook", "111222333444555", debugToken, okProbe, now);
  assertEquals(result.status, "missing_scope");
});

Deno.test("Instagram uses its own required-scope set independently of Facebook's", () => {
  const debugToken = { is_valid: true, expires_at: 0, granular_scopes: [{ scope: "instagram_content_publish", target_ids: ["222333444555666"] }, { scope: "instagram_basic", target_ids: ["222333444555666"] }] };
  const igProbe = { ok: true as const, id: "222333444555666", matchesExpectedType: true };
  const result = evaluateAccountHealth("instagram", "222333444555666", debugToken, igProbe, now);
  assertEquals(result.status, "connected");
});

Deno.test("an expiring-soon token with otherwise full access still reports expiring_soon, not connected", () => {
  const debugToken = {
    is_valid: true,
    expires_at: now + 2 * 24 * 60 * 60,
    granular_scopes: [
      { scope: "pages_manage_posts", target_ids: ["111222333444555"] },
      { scope: "pages_read_engagement", target_ids: ["111222333444555"] },
    ],
  };
  const result = evaluateAccountHealth("facebook", "111222333444555", debugToken, okProbe, now);
  assertEquals(result.status, "expiring_soon");
});

Deno.test("a network/error response from debug_token itself is api_request_failed", () => {
  const result = evaluateAccountHealth("facebook", "111222333444555", { error: { message: "Network error" } }, okProbe, now);
  assertEquals(result.status, "api_request_failed");
});

Deno.test("REGRESSION (production case): a Facebook Page ID connected as Instagram (or vice versa) is platform_mismatch, not silently connected", () => {
  // The Graph API happily returns 200 for a Facebook Page ID even when
  // queried with Instagram-shaped fields (both are base Graph objects with
  // id/name) - only the platform-specific field (category for a Page,
  // username for an IG Business Account) tells them apart. This is exactly
  // what happened in production: the Facebook Page ID was connected with
  // platform="instagram" and still reported "connected".
  const mismatchedProbe = { ok: true as const, id: "1077357338795210", matchesExpectedType: false };
  const debugToken = { is_valid: true, expires_at: 0, granular_scopes: [{ scope: "instagram_basic" }, { scope: "instagram_content_publish" }] };
  const result = evaluateAccountHealth("instagram", "1077357338795210", debugToken, mismatchedProbe, now);
  assertEquals(result.status, "platform_mismatch");
});

Deno.test("a matching object type with full permissions is still reported connected (no false positive from the type check)", () => {
  const result = evaluateAccountHealth("instagram", "17841420423370318", { is_valid: true, expires_at: 0, granular_scopes: [{ scope: "instagram_basic" }, { scope: "instagram_content_publish" }] }, { ok: true, id: "17841420423370318", matchesExpectedType: true }, now);
  assertEquals(result.status, "connected");
});
