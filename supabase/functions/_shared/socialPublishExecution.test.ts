import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { claimScheduledPost, executePublish, type PublishablePost } from "./socialPublishExecution.ts";

Deno.env.set("META_GRAPH_API_VERSION", "v20.0");
Deno.env.set("META_ACCESS_TOKEN", "test-meta-token");

// A minimal in-memory stand-in for the Supabase-backed tables
// executePublish/claimScheduledPost touch. Every read/write is keyed by row
// id, so a test can assert "post B's row/attempts/log are untouched" after
// only post A was processed.
function makeFakeStore(options: { posts: PublishablePost[]; assets?: Record<string, { storage_path: string }>; accounts?: Record<string, { provider_account_id: string }> }) {
  const scheduledPosts = new Map(options.posts.map((p) => [p.id, { ...p }]));
  const assets = options.assets || {};
  const accounts = options.accounts || {};
  const publishAttempts: Record<string, unknown>[] = [];
  const activityLog: Record<string, unknown>[] = [];

  // deno-lint-ignore no-explicit-any
  const sb: any = {
    from(table: string) {
      if (table === "social_media_assets" || table === "social_platform_variants") {
        return { select: () => ({ eq: (_col: string, id: string) => ({ single: async () => ({ data: assets[id] || null, error: assets[id] ? null : { message: "not found" } }) }) }) };
      }
      if (table === "social_accounts") {
        return { select: () => ({ eq: (_col: string, id: string) => ({ single: async () => ({ data: accounts[id] || null, error: accounts[id] ? null : { message: "not found" } }) }) }) };
      }
      if (table === "social_publish_attempts") {
        return { insert: async (row: Record<string, unknown>) => { publishAttempts.push(row); return { error: null }; } };
      }
      if (table === "system_activity_log") {
        return { insert: async (row: Record<string, unknown>) => { activityLog.push(row); return { error: null }; } };
      }
      if (table === "social_scheduled_posts") {
        return {
          update(patch: Record<string, unknown>) {
            return {
              eq(_col1: string, id: string) {
                const eqChain = {
                  // claimScheduledPost: .update().eq("id",x).eq("status","scheduled").select(...).maybeSingle()
                  eq(_col2: string, expectedStatus: string) {
                    return {
                      select: () => ({
                        async maybeSingle() {
                          const row = scheduledPosts.get(id);
                          if (!row || row.status !== expectedStatus) return { data: null, error: null };
                          Object.assign(row, patch);
                          return { data: { ...row }, error: null };
                        },
                      }),
                    };
                  },
                  // executePublish's final write: .update().eq("id",x) awaited directly, no second eq/select.
                  then(resolve: (v: { data: null; error: null }) => void) {
                    const row = scheduledPosts.get(id);
                    if (row) Object.assign(row, patch);
                    resolve({ data: null, error: null });
                  },
                };
                return eqChain;
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table in fake store: ${table}`);
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }),
      }),
    },
  };

  return { sb, scheduledPosts, publishAttempts, activityLog };
}

function makePost(overrides: Partial<PublishablePost> = {}): PublishablePost {
  return {
    id: "post-A", campaign_id: "campaign-1", media_asset_id: "asset-1", platform_variant_id: null,
    target_platform: "facebook", social_account_id: "account-1", caption: "Hello", hashtags: [], attempt_count: 0,
    status: "scheduled", ...overrides,
  };
}

function mockFetchOnce(handler: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).fetch = async (input: string | URL | Request, init?: RequestInit) => handler(input, init);
  return () => { globalThis.fetch = original; };
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

Deno.test("REGRESSION: executePublish on post A never touches post B's row, attempts, or log", async () => {
  const postA = makePost({ id: "post-A" });
  const postB = makePost({ id: "post-B" });
  const store = makeFakeStore({
    posts: [postA, postB],
    assets: { "asset-1": { storage_path: "orig/a.jpg" } },
    accounts: { "account-1": { provider_account_id: "111222333" } },
  });

  const restore = mockFetchOnce(() => jsonResponse({ post_id: "pid_1" }));
  try {
    await executePublish(store.sb, postA, { triggeredBy: "manual_admin", actorProfileId: "admin-1" });
  } finally {
    restore();
  }

  assertEquals(store.scheduledPosts.get("post-A")?.status, "published");
  assertEquals(store.scheduledPosts.get("post-B")?.status, "scheduled", "post B must be completely untouched");
  assertEquals(store.publishAttempts.length, 1);
  assertEquals(store.activityLog.length, 1);
  assertEquals(store.activityLog[0].target_id, "post-A");
});

Deno.test("provider success: marks published, stores provider_post_id/permalink, sets published_at", async () => {
  const post = makePost();
  const store = makeFakeStore({
    posts: [post],
    assets: { "asset-1": { storage_path: "orig/a.jpg" } },
    accounts: { "account-1": { provider_account_id: "111222333" } },
  });
  const restore = mockFetchOnce(() => jsonResponse({ post_id: "pid_42" }));
  let result;
  try {
    result = await executePublish(store.sb, post, { triggeredBy: "manual_admin", actorProfileId: "admin-1" });
  } finally {
    restore();
  }
  assertEquals(result.status, "published");
  assertEquals(result.outcome.kind, "success");
  const row = store.scheduledPosts.get("post-A")!;
  assertEquals(row.status, "published");
  assertEquals((row as unknown as { provider_post_id: string }).provider_post_id, "pid_42");
  assertEquals((row as unknown as { provider_permalink: string }).provider_permalink, "https://www.facebook.com/pid_42");
  assert((row as unknown as { published_at: string }).published_at);
  assertEquals(store.publishAttempts[0].status, "success");
  assertEquals(store.activityLog[0].action, "social_post_published");
});

Deno.test("provider temporary failure (5xx): post returns to scheduled with a retry time, not failed", async () => {
  const post = makePost();
  const store = makeFakeStore({
    posts: [post],
    assets: { "asset-1": { storage_path: "orig/a.jpg" } },
    accounts: { "account-1": { provider_account_id: "111222333" } },
  });
  const restore = mockFetchOnce(() => jsonResponse({ error: { message: "server busy" } }, 503));
  let result;
  try {
    result = await executePublish(store.sb, post, { triggeredBy: "system_cron" });
  } finally {
    restore();
  }
  assertEquals(result.outcome.kind, "temporary_failure");
  assertEquals(result.status, "scheduled");
  const row = store.scheduledPosts.get("post-A")!;
  assertEquals(row.status, "scheduled");
  assert((row as unknown as { next_retry_at: string }).next_retry_at);
  assertEquals(store.publishAttempts[0].status, "temporary_failure");
  assertEquals(store.activityLog[0].action, "social_post_publish_retry_scheduled");
});

Deno.test("provider permanent failure (invalid token, code 190): post is marked failed, not retried", async () => {
  const post = makePost();
  const store = makeFakeStore({
    posts: [post],
    assets: { "asset-1": { storage_path: "orig/a.jpg" } },
    accounts: { "account-1": { provider_account_id: "111222333" } },
  });
  const restore = mockFetchOnce(() => jsonResponse({ error: { code: 190, message: "Invalid OAuth access token" } }, 400));
  let result;
  try {
    result = await executePublish(store.sb, post, { triggeredBy: "manual_admin", actorProfileId: "admin-1" });
  } finally {
    restore();
  }
  assertEquals(result.outcome.kind, "permanent_failure");
  assertEquals(result.status, "failed");
  const row = store.scheduledPosts.get("post-A")!;
  assertEquals(row.status, "failed");
  assertEquals((row as unknown as { failure_code: string }).failure_code, "meta_190");
  assertEquals((row as unknown as { next_retry_at: string | null }).next_retry_at, null);
  assertEquals(store.activityLog[0].action, "social_post_publish_failed");
});

Deno.test("a variant-linked post publishes the variant's storage path, not the original's", async () => {
  const post = makePost({ platform_variant_id: "variant-1" });
  const store = makeFakeStore({
    posts: [post],
    assets: { "variant-1": { storage_path: "variants/ig.png" }, "asset-1": { storage_path: "orig/a.jpg" } },
    accounts: { "account-1": { provider_account_id: "111222333" } },
  });
  let capturedUrl = "";
  const restore = mockFetchOnce((_input, init) => {
    capturedUrl = String(JSON.parse(String(init?.body)).url);
    return jsonResponse({ post_id: "pid_1" });
  });
  try {
    await executePublish(store.sb, post, { triggeredBy: "manual_admin", actorProfileId: "admin-1" });
  } finally {
    restore();
  }
  assertEquals(capturedUrl, "https://signed.example/variants/ig.png");
});

// --- claimScheduledPost: the idempotency/concurrency primitive ------------

Deno.test("REGRESSION: claiming post A never touches post B's row", async () => {
  const postA = makePost({ id: "post-A" });
  const postB = makePost({ id: "post-B" });
  const store = makeFakeStore({ posts: [postA, postB] });

  const claimed = await claimScheduledPost(store.sb, "post-A", "manual:admin-1", new Date().toISOString());
  assert(claimed, "post A should be claimed");
  assertEquals(claimed?.id, "post-A");
  assertEquals(store.scheduledPosts.get("post-A")?.status, "publishing");
  assertEquals(store.scheduledPosts.get("post-B")?.status, "scheduled", "post B must be untouched by claiming post A");
});

Deno.test("REGRESSION: a second concurrent claim on the same post fails - it is never published twice", async () => {
  const post = makePost();
  const store = makeFakeStore({ posts: [post] });
  const nowIso = new Date().toISOString();

  const first = await claimScheduledPost(store.sb, "post-A", "claim-1", nowIso);
  const second = await claimScheduledPost(store.sb, "post-A", "claim-2", nowIso);

  assert(first, "the first claim should win");
  assertEquals(second, null, "the second concurrent claim must lose - never both claim the same post");
});

Deno.test("an already-published post cannot be claimed (and therefore cannot publish twice)", async () => {
  const post = makePost({ status: "published" });
  const store = makeFakeStore({ posts: [post] });
  const claimed = await claimScheduledPost(store.sb, "post-A", "claim-1", new Date().toISOString());
  assertEquals(claimed, null);
});

Deno.test("a post already in 'publishing' (claimed by someone else) cannot be claimed again", async () => {
  const post = makePost({ status: "publishing" });
  const store = makeFakeStore({ posts: [post] });
  const claimed = await claimScheduledPost(store.sb, "post-A", "claim-1", new Date().toISOString());
  assertEquals(claimed, null);
});
