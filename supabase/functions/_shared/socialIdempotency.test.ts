import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildIdempotencyKey } from "./socialIdempotency.ts";

const base = {
  campaignId: "11111111-1111-1111-1111-111111111111",
  mediaAssetId: "22222222-2222-2222-2222-222222222222",
  targetPlatform: "facebook_feed",
  socialAccountId: "33333333-3333-3333-3333-333333333333",
  scheduledAt: new Date("2026-09-01T07:00:00.000Z"),
};

Deno.test("identical input always produces the identical key (deterministic, not random)", async () => {
  const a = await buildIdempotencyKey(base);
  const b = await buildIdempotencyKey({ ...base });
  assertEquals(a, b);
});

Deno.test("a retry of the exact same scheduled post produces the exact same key, so a duplicate insert is rejected by the unique constraint", async () => {
  const originalAttempt = await buildIdempotencyKey(base);
  const retryAttempt = await buildIdempotencyKey({ ...base }); // simulates a second worker/regeneration computing the key independently
  assertEquals(originalAttempt, retryAttempt);
});

Deno.test("changing any single field changes the key", async () => {
  const original = await buildIdempotencyKey(base);
  assertNotEquals(original, await buildIdempotencyKey({ ...base, campaignId: "99999999-9999-9999-9999-999999999999" }));
  assertNotEquals(original, await buildIdempotencyKey({ ...base, mediaAssetId: "99999999-9999-9999-9999-999999999999" }));
  assertNotEquals(original, await buildIdempotencyKey({ ...base, targetPlatform: "instagram_feed" }));
  assertNotEquals(original, await buildIdempotencyKey({ ...base, socialAccountId: "99999999-9999-9999-9999-999999999999" }));
  assertNotEquals(original, await buildIdempotencyKey({ ...base, scheduledAt: new Date("2026-09-04T07:00:00.000Z") }));
});

Deno.test("key is a 64-character lowercase hex SHA-256 digest, safe for a text/unique column", async () => {
  const key = await buildIdempotencyKey(base);
  assertEquals(key.length, 64);
  assertEquals(/^[0-9a-f]{64}$/.test(key), true);
});
