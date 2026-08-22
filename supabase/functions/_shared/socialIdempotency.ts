// Deterministic idempotency key for a single scheduled post. Same
// (campaign, media asset, platform, account, scheduled instant) always
// produces the same key - this is what the database UNIQUE constraint on
// social_scheduled_posts.idempotency_key actually enforces, so a schedule
// regeneration can never insert a duplicate row for the same slot, and two
// concurrent activation attempts collapse onto the same key instead of
// creating two rows.

export type IdempotencyInput = {
  campaignId: string;
  mediaAssetId: string;
  targetPlatform: string;
  socialAccountId: string;
  scheduledAt: Date;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildIdempotencyKey(input: IdempotencyInput): Promise<string> {
  const canonical = [
    input.campaignId,
    input.mediaAssetId,
    input.targetPlatform,
    input.socialAccountId,
    input.scheduledAt.toISOString(),
  ].join("|");
  return sha256Hex(canonical);
}
