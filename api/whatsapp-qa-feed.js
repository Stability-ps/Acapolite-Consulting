const WHATSAPP_QA_FEED_URL = "https://ktmzabtbhrbfmwjqsfce.supabase.co/functions/v1/whatsapp-qa-feed";

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const authorization = request.headers.authorization;
  if (!authorization) return response.status(401).json({ error: "Administrator session is required" });

  try {
    const upstream = await fetch(WHATSAPP_QA_FEED_URL, {
      method: request.method,
      headers: {
        Authorization: authorization,
        ...(request.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: request.method === "POST" ? JSON.stringify(request.body || {}) : undefined,
    });
    const body = await upstream.text();
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return response.status(upstream.status).send(body);
  } catch (error) {
    console.error("WhatsApp QA feed proxy failed", error);
    return response.status(502).json({ error: "Unable to reach the WhatsApp service" });
  }
}
