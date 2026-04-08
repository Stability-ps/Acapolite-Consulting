import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ContactFormPayload = {
  type: "contact_form";
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

type SignupNotificationPayload = {
  type: "signup_notification";
  profileId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  provider?: string;
};

type PortalEmailPayload = ContactFormPayload | SignupNotificationPayload;

const MAILTRAP_API_URL = "https://send.api.mailtrap.io/api/send";
const DEFAULT_FROM_EMAIL = "hello@demomailtrap.co";
const DEFAULT_FROM_NAME = "Acapolite Consulting Portal";
const DEFAULT_NOTIFICATION_EMAIL = "Acapoliteconsulting@gmail.com";

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(request),
  });
}

function requireEnv(name: string, fallback?: string) {
  const value = Deno.env.get(name) ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function sendMailtrapEmail(params: {
  token: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: { email: string; name?: string };
  category: string;
}) {
  const response = await fetch(MAILTRAP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: {
        email: params.fromEmail,
        name: params.fromName,
      },
      to: [{ email: params.toEmail }],
      subject: params.subject,
      text: params.text,
      html: params.html,
      category: params.category,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Mailtrap send failed: ${message}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(request) });
  }

  try {
    const payload = (await request.json()) as PortalEmailPayload;

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const mailtrapApiToken = requireEnv("MAILTRAP_API_TOKEN");
    const notificationEmail = requireEnv("PORTAL_NOTIFICATION_EMAIL", DEFAULT_NOTIFICATION_EMAIL);
    const fromEmail = requireEnv("MAILTRAP_FROM_EMAIL", DEFAULT_FROM_EMAIL);
    const fromName = requireEnv("MAILTRAP_FROM_NAME", DEFAULT_FROM_NAME);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (payload.type === "contact_form") {
      const name = payload.name?.trim() ?? "";
      const email = payload.email?.trim().toLowerCase() ?? "";
      const subject = payload.subject?.trim() ?? "";
      const message = payload.message?.trim() ?? "";

      if (!name || !email || !subject || !message) {
        return jsonResponse(request, { error: "Name, email, subject, and message are required." }, 400);
      }

      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeSubject = escapeHtml(subject);
      const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

      await sendMailtrapEmail({
        token: mailtrapApiToken,
        fromEmail,
        fromName,
        toEmail: notificationEmail,
        subject: `New Contact Form Message: ${subject}`,
        text: [
          "A new contact form enquiry was submitted on the Acapolite Consulting website.",
          "",
          `Name: ${name}`,
          `Email: ${email}`,
          `Subject: ${subject}`,
          "",
          "Message:",
          message,
        ].join("\n"),
        html: `
          <h2>New Contact Form Message</h2>
          <p>A new contact form enquiry was submitted on the Acapolite Consulting website.</p>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <p><strong>Message:</strong><br />${safeMessage}</p>
        `,
        replyTo: { email, name },
        category: "Acapolite Contact Form",
      });

      await adminClient.from("email_notification_logs").insert({
        notification_type: "contact_form",
        recipient_email: notificationEmail,
        contact_email: email,
        metadata: {
          name,
          subject,
        },
      });

      return jsonResponse(request, { success: true }, 200);
    }

    if (payload.type === "signup_notification") {
      const authorization = request.headers.get("Authorization");

      if (!authorization) {
        return jsonResponse(request, { error: "Missing authorization header." }, 401);
      }

      const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const {
        data: { user },
        error: userError,
      } = await callerClient.auth.getUser();

      if (userError || !user) {
        return jsonResponse(request, { error: "You must be signed in to send this notification." }, 401);
      }

      const profileId = payload.profileId?.trim() || user.id;
      const email = payload.email?.trim().toLowerCase() || user.email || "";
      const fullName = payload.fullName?.trim() || user.user_metadata?.full_name || user.user_metadata?.name || "New user";
      const role = payload.role?.trim() || "client";
      const provider = payload.provider?.trim() || user.app_metadata?.provider || "email";

      const { data: existingLog } = await adminClient
        .from("email_notification_logs")
        .select("id")
        .eq("notification_type", "signup_notification")
        .eq("profile_id", profileId)
        .maybeSingle();

      if (existingLog) {
        return jsonResponse(request, { success: true, skipped: true }, 200);
      }

      const safeName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      const safeRole = escapeHtml(role);
      const safeProvider = escapeHtml(provider);

      await sendMailtrapEmail({
        token: mailtrapApiToken,
        fromEmail,
        fromName,
        toEmail: notificationEmail,
        subject: "New Portal Signup: Acapolite Consulting",
        text: [
          "A new user has signed up on the Acapolite Consulting portal.",
          "",
          `Full name: ${fullName}`,
          `Email: ${email}`,
          `Role: ${role}`,
          `Auth provider: ${provider}`,
          `Profile ID: ${profileId}`,
        ].join("\n"),
        html: `
          <h2>New Portal Signup</h2>
          <p>A new user has signed up on the Acapolite Consulting portal.</p>
          <p><strong>Full name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Role:</strong> ${safeRole}</p>
          <p><strong>Auth provider:</strong> ${safeProvider}</p>
          <p><strong>Profile ID:</strong> ${escapeHtml(profileId)}</p>
        `,
        category: "Acapolite Signup Notification",
      });

      await adminClient.from("email_notification_logs").insert({
        notification_type: "signup_notification",
        recipient_email: notificationEmail,
        profile_id: profileId,
        contact_email: email || null,
        metadata: {
          full_name: fullName,
          role,
          provider,
        },
      });

      return jsonResponse(request, { success: true }, 200);
    }

    return jsonResponse(request, { error: "Unsupported email notification type." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while sending portal email.";
    return jsonResponse(request, { error: message }, 500);
  }
});
