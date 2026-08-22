import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateTokenHealth } from "./socialConnectionHealth.ts";

const now = Math.floor(new Date("2026-09-01T00:00:00Z").getTime() / 1000);

Deno.test("a valid, non-expiring token with all required scopes is connected", () => {
  const result = evaluateTokenHealth("facebook", { is_valid: true, expires_at: 0, scopes: ["pages_manage_posts", "pages_read_engagement"] }, now);
  assertEquals(result.status, "connected");
});

Deno.test("an invalid token is expired", () => {
  const result = evaluateTokenHealth("facebook", { is_valid: false }, now);
  assertEquals(result.status, "expired");
});

Deno.test("a token expiring within 7 days is flagged expiring_soon, not connected", () => {
  const expiresAt = now + 3 * 24 * 60 * 60;
  const result = evaluateTokenHealth("facebook", { is_valid: true, expires_at: expiresAt, scopes: ["pages_manage_posts", "pages_read_engagement"] }, now);
  assertEquals(result.status, "expiring_soon");
});

Deno.test("a token already past its expiry is expired even if is_valid was stale-true", () => {
  const expiresAt = now - 60;
  const result = evaluateTokenHealth("facebook", { is_valid: true, expires_at: expiresAt, scopes: ["pages_manage_posts", "pages_read_engagement"] }, now);
  assertEquals(result.status, "expired");
});

Deno.test("missing a required Instagram scope is permission_missing, not silently connected", () => {
  const result = evaluateTokenHealth("instagram", { is_valid: true, expires_at: 0, scopes: ["instagram_basic"] }, now);
  assertEquals(result.status, "permission_missing");
  assertEquals(result.message.includes("instagram_content_publish"), true);
});

Deno.test("a Meta API error (network failure, bad request) is reported as unavailable, not connected", () => {
  const result = evaluateTokenHealth("facebook", { error: { message: "Invalid OAuth access token" } }, now);
  assertEquals(result.status, "unavailable");
});
