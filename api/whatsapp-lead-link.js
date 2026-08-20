const WHATSAPP_LEAD_LINK_URL = "https://ktmzabtbhrbfmwjqsfce.supabase.co/functions/v1/whatsapp-lead-link";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const authorization = request.headers.authorization;
  if (!authorization) return response.status(401).json({ error: "Administrator session is required" });

  try {
    const upstream = await fetch(WHATSAPP_LEAD_LINK_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body || {}),
    });
    const body = await upstream.text();
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return response.status(upstream.status).send(body);
  } catch (error) {
    console.error("WhatsApp lead link proxy failed", error);
    return response.status(502).json({ error: "Unable to save the WhatsApp lead link" });
  }
}
