import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { handleInvoicePdfRequest, type InvoicePdfRequestContext } from "../_shared/invoicePdfRequest.ts";

/**
 * Authenticated server-side proxy for invoice PDF generation.
 *
 * Replaces the previous client-side flow, which called the external PDF
 * provider directly from the browser with a hardcoded bearer token - that
 * token shipped in the public JS bundle and was publicly downloadable by
 * anyone, authenticated or not.
 *
 * Architecture: browser (authenticated Supabase session) -> this function
 * (validates the caller, re-fetches the authoritative invoice row via the
 * caller's own RLS-scoped client, cross-checks the submitted display
 * payload against it - see _shared/invoicePdfRequest.ts) -> external PDF
 * provider (server-side secret only).
 *
 * The provider credential lives only in this function's environment as
 * PDF_API_KEY. It is never logged, never echoed back to the client, and
 * never accepted as client input.
 */

const DEFAULT_PDF_API_URL = "https://nxqtduvaaacxsxkkaopd.supabase.co/functions/v1/generate-pdf-api";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required." }, 401);

    const callerClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rawPayload = await request.json().catch(() => null);

    const context: InvoicePdfRequestContext = {
      async getAuthenticatedUser() {
        const { data: { user }, error } = await callerClient.auth.getUser();
        if (error || !user) return null;
        return { id: user.id };
      },
      async fetchInvoiceRow(invoiceId) {
        const { data, error } = await callerClient
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .maybeSingle();
        if (error || !data) return null;
        return data;
      },
      async requestPdf(apiPayload) {
        const pdfApiUrl = Deno.env.get("PDF_API_URL") || DEFAULT_PDF_API_URL;
        let pdfApiKey: string;
        try {
          pdfApiKey = env("PDF_API_KEY");
        } catch {
          console.error("generate-invoice-pdf: PDF_API_KEY is not configured");
          return { ok: false, providerStatus: 0 };
        }

        const response = await fetch(pdfApiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pdfApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiPayload),
        });

        if (!response.ok) {
          // Log only the status - never the response body (which could
          // echo back request details) and never anything from headers.
          console.error("generate-invoice-pdf: provider request failed", response.status);
          return { ok: false, providerStatus: response.status };
        }

        return { ok: true, bytes: await response.arrayBuffer() };
      },
    };

    const result = await handleInvoicePdfRequest(rawPayload, context);

    if (result.status !== 200) {
      return json({ error: result.error }, result.status);
    }

    return new Response(result.bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${result.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("generate-invoice-pdf: unexpected failure", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "PDF generation is temporarily unavailable." }, 500);
  }
});
