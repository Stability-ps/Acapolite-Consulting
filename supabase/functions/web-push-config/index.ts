import { corsHeaders } from "../_shared/cors.ts";

type WebPushVapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

function trimString(value?: string | null) {
  return value?.trim() ?? "";
}

function getWebPushVapidConfig() {
  const packedConfig = trimString(Deno.env.get("WEB_PUSH_VAPID"));

  if (packedConfig) {
    try {
      const parsed = JSON.parse(packedConfig) as Partial<WebPushVapidConfig>;
      const publicKey = trimString(parsed.publicKey);
      const privateKey = trimString(parsed.privateKey);
      const subject = trimString(parsed.subject);

      if (publicKey && privateKey && subject) {
        return { publicKey, privateKey, subject } satisfies WebPushVapidConfig;
      }
    } catch (error) {
      console.error("Unable to parse WEB_PUSH_VAPID.", error);
    }
  }

  const publicKey = trimString(Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY"));
  const privateKey = trimString(Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY"));
  const subject = trimString(Deno.env.get("WEB_PUSH_VAPID_SUBJECT"));

  if (publicKey && privateKey && subject) {
    return { publicKey, privateKey, subject } satisfies WebPushVapidConfig;
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const config = getWebPushVapidConfig();

  return new Response(
    JSON.stringify({
      configured: Boolean(config),
      publicKey: config?.publicKey ?? null,
    }),
    { headers: corsHeaders },
  );
});
