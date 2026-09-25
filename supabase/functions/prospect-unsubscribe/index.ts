// Public unsubscribe endpoint for prospect marketing emails.
//
// verify_jwt = false because recipients are not signed in. The only input
// is the random per-recipient unsubscribe token; the function can do
// nothing except add that recipient's address to the prospect marketing
// suppression list. Transactional/client email is unaffected.
//  - POST ?token=...           RFC 8058 one-click (List-Unsubscribe-Post)
//  - POST {"token": "..."}     from the acapoliteconsulting.co.za/unsubscribe page

import { createAdminClient, jsonResponse, preflight } from "../_shared/prospectHttp.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return jsonResponse(req, { ok: false, error: "Use POST to unsubscribe." }, 405);

  let token = new URL(req.url).searchParams.get("token");
  if (!token && (req.headers.get("content-type") || "").includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = typeof body?.token === "string" ? body.token : null;
  }
  if (!token || !UUID_RE.test(token)) return jsonResponse(req, { ok: false, error: "Invalid unsubscribe link." }, 400);

  const { data, error } = await createAdminClient().rpc("unsubscribe_prospect_by_token", { p_token: token });
  if (error) {
    console.error("prospect-unsubscribe", error.message);
    return jsonResponse(req, { ok: false, error: "Could not process the request. Please email support@acapoliteconsulting.co.za." }, 500);
  }
  if (!data?.ok) return jsonResponse(req, { ok: false, error: "This unsubscribe link is not valid." }, 404);
  return jsonResponse(req, { ok: true, message: "You have been unsubscribed from Acapolite Consulting marketing emails." });
});
