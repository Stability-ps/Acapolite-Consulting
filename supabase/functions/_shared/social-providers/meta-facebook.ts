// Facebook Page feed photo publishing via the Meta Graph API.
// Deliberately isolated from supabase/functions/whatsapp-agent - this reads
// its own META_* secrets, never the WHATSAPP_* ones, so a WhatsApp
// credential rotation can never break social publishing or vice versa.
import { classifyMetaError, classifyNetworkError } from "./metaErrorClassifier.ts";
import type { PublishRequest, PublishSuccess } from "./types.ts";

const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export async function publishToFacebookPage(request: PublishRequest): Promise<PublishSuccess> {
  const version = env("META_GRAPH_API_VERSION");
  const token = env("META_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/${version}/${request.providerAccountId}/photos`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: request.imageUrl,
        caption: request.caption,
        access_token: token,
      }),
    });
  } catch (error) {
    classifyNetworkError(error);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.post_id && !body?.id) {
    classifyMetaError(response.status, body);
  }

  const postId = String(body.post_id || body.id);
  return {
    ok: true,
    providerPostId: postId,
    permalink: body.post_id ? `https://www.facebook.com/${body.post_id}` : null,
  };
}
