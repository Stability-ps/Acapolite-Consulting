import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

type WelcomeEmailPayload = {
  type: "welcome_email";
  profileId?: string;
  email?: string;
  fullName?: string;
};

type CaseCreatedPayload = {
  type: "case_created";
  caseId?: string;
  caseNumber?: string;
  clientProfileId?: string;
  clientEmail?: string;
  clientName?: string;
  createdDate?: string;
};

type PractitionerAssignedPayload = {
  type: "practitioner_assigned";
  caseId?: string;
  caseNumber?: string;
  practitionerProfileId?: string;
  practitionerEmail?: string;
  practitionerName?: string;
  clientName?: string;
  serviceType?: string;
  assignedDate?: string;
  priority?: string;
};

type PractitionerMessagePayload = {
  type: "practitioner_message";
  messageId?: string;
  clientProfileId?: string;
  clientEmail?: string;
  clientName?: string;
  practitionerName?: string;
  caseNumber?: string;
  messagePreview?: string;
  sentDate?: string;
};

type InvoiceCreatedPayload = {
  type: "invoice_created";
  invoiceId?: string;
  invoiceNumber?: string;
  clientProfileId?: string;
  clientEmail?: string;
  clientName?: string;
  caseNumber?: string;
  serviceDescription?: string;
  amount?: string;
  dueDate?: string;
  status?: string;
};

type ProofOfPaymentUploadedPayload = {
  type: "proof_of_payment_uploaded";
  invoiceId?: string;
  invoiceNumber?: string;
  clientProfileId?: string;
  clientName?: string;
  caseNumber?: string;
  amount?: string;
  uploadDate?: string;
};

type CaseStatusChangedPayload = {
  type: "case_status_changed";
  caseId?: string;
  caseNumber?: string;
  clientProfileId?: string;
  clientEmail?: string;
  clientName?: string;
  serviceType?: string;
  previousStatus?: string;
  newStatus?: string;
  updateDate?: string;
};

type DocumentsRequestedPayload = {
  type: "documents_requested";
  requestId?: string;
  clientProfileId?: string;
  clientEmail?: string;
  clientName?: string;
  practitionerName?: string;
  caseNumber?: string;
  documentList?: string;
  deadlineDate?: string;
};

type DocumentsUploadedAdminPayload = {
  type: "documents_uploaded_admin";
  documentId?: string;
  clientProfileId?: string;
  clientName?: string;
  caseNumber?: string;
  documentList?: string;
  uploadDate?: string;
};

type PortalEmailPayload =
  | ContactFormPayload
  | SignupNotificationPayload
  | WelcomeEmailPayload
  | CaseCreatedPayload
  | PractitionerAssignedPayload
  | PractitionerMessagePayload
  | InvoiceCreatedPayload
  | ProofOfPaymentUploadedPayload
  | CaseStatusChangedPayload
  | DocumentsRequestedPayload
  | DocumentsUploadedAdminPayload;

type MailtrapMessage = {
  toEmail: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: { email: string; name?: string };
  category: string;
  fromEmail?: string;
  fromName?: string;
};

type NotificationLogEntry = {
  notificationType: PortalEmailPayload["type"];
  recipientEmail: string;
  profileId?: string;
  contactEmail?: string | null;
  metadata?: Record<string, unknown>;
};

type WebPushVapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type WebPushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

const MAILTRAP_API_URL = "https://send.api.mailtrap.io/api/send";
const DEFAULT_FROM_EMAIL = "info@acapoliteconsulting.co.za";
const DEFAULT_FROM_NAME = "Acapolite Consulting";
const DEFAULT_NOTIFICATION_EMAIL = "Acapoliteconsulting@gmail.com";
const DEFAULT_PORTAL_URL = "https://acapoliteconsulting.co.za";
const DEFAULT_SUPPORT_EMAIL = "info@acapoliteconsulting.co.za";
const DEFAULT_SUPPORT_WHATSAPP = "+27 67 5775506";

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

function trimString(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeEmail(value?: string | null) {
  return trimString(value).toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function trimNotificationText(value: string, maxLength = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
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

function buildPortalLink(portalUrl: string, pathname: string) {
  const base = portalUrl.endsWith("/") ? portalUrl.slice(0, -1) : portalUrl;
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function buildWebPushContent(params: {
  payload: PortalEmailPayload;
  portalUrl: string;
}) {
  const { payload, portalUrl } = params;

  switch (payload.type) {
    case "case_created":
      return {
        title: "New case opened",
        body: trimNotificationText(`Case ${trimString(payload.caseNumber) || "update"} is now available in your client portal.`),
        url: buildPortalLink(portalUrl, "/dashboard/client/cases"),
        tag: `case-created:${trimString(payload.caseId)}`,
      } satisfies WebPushMessage;

    case "practitioner_assigned":
      return {
        title: "New case assignment",
        body: trimNotificationText(`${trimString(payload.clientName) || "A client"} has been assigned to you for ${trimString(payload.serviceType) || "a new matter"}.`),
        url: buildPortalLink(portalUrl, "/dashboard/staff/cases"),
        tag: `practitioner-assigned:${trimString(payload.caseId)}`,
      } satisfies WebPushMessage;

    case "practitioner_message":
      return {
        title: "New practitioner message",
        body: trimNotificationText(trimString(payload.messagePreview) || `${trimString(payload.practitionerName) || "Your practitioner"} sent you a new portal message.`),
        url: buildPortalLink(portalUrl, "/dashboard/client/messages"),
        tag: `practitioner-message:${trimString(payload.messageId)}`,
      } satisfies WebPushMessage;

    case "invoice_created":
      return {
        title: "New invoice available",
        body: trimNotificationText(`Invoice ${trimString(payload.invoiceNumber) || ""} is ready${trimString(payload.amount) ? ` for ${trimString(payload.amount)}` : ""}.`.trim()),
        url: buildPortalLink(portalUrl, "/dashboard/client/invoices"),
        tag: `invoice-created:${trimString(payload.invoiceId)}`,
      } satisfies WebPushMessage;

    case "case_status_changed":
      return {
        title: "Case status updated",
        body: trimNotificationText(`Case ${trimString(payload.caseNumber) || ""} moved to ${trimString(payload.newStatus) || "a new status"}.`.trim()),
        url: buildPortalLink(portalUrl, "/dashboard/client/cases"),
        tag: `case-status:${trimString(payload.caseId)}`,
      } satisfies WebPushMessage;

    case "documents_requested":
      return {
        title: "Documents requested",
        body: trimNotificationText(`${trimString(payload.practitionerName) || "Acapolite Consulting"} requested ${trimString(payload.documentList) || "additional documents"} for your case.`),
        url: buildPortalLink(portalUrl, "/dashboard/client/documents"),
        tag: `documents-requested:${trimString(payload.requestId)}`,
      } satisfies WebPushMessage;

    default:
      return null;
  }
}

async function sendWebPushNotifications(params: {
  adminClient: ReturnType<typeof createClient>;
  profileId: string;
  vapidConfig: WebPushVapidConfig;
  notification: WebPushMessage;
}) {
  const { adminClient, profileId, vapidConfig, notification } = params;

  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  if (!subscriptions?.length) {
    return;
  }

  webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

  const expiredSubscriptionIds: string[] = [];

  for (const row of subscriptions) {
    const subscription = row.subscription;

    if (!subscription || typeof subscription !== "object") {
      continue;
    }

    try {
      await webpush.sendNotification(
        subscription as Parameters<typeof webpush.sendNotification>[0],
        JSON.stringify(notification),
      );
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
          ? error.statusCode
          : null;

      if (statusCode === 404 || statusCode === 410) {
        expiredSubscriptionIds.push(row.id);
        continue;
      }

      console.error("Web push send failed.", {
        profileId,
        subscriptionId: row.id,
        statusCode,
        error,
      });
    }
  }

  if (expiredSubscriptionIds.length) {
    await adminClient.from("push_subscriptions").delete().in("id", expiredSubscriptionIds);
  }
}

async function sendMailtrapEmail(params: {
  token: string;
  fromEmail: string;
  fromName: string;
  message: MailtrapMessage;
}) {
  const response = await fetch(MAILTRAP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: {
        email: params.message.fromEmail ?? params.fromEmail,
        name: params.message.fromName ?? params.fromName,
      },
      to: [{ email: params.message.toEmail }],
      subject: params.message.subject,
      text: params.message.text,
      html: params.message.html,
      category: params.message.category,
      ...(params.message.replyTo ? { reply_to: params.message.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Mailtrap send failed: ${message}`);
  }
}

async function getAuthenticatedUser(
  request: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return {
      user: null,
      error: jsonResponse(request, { error: "Missing authorization header." }, 401),
    };
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
    return {
      user: null,
      error: jsonResponse(request, { error: "You must be signed in to send this notification." }, 401),
    };
  }

  return { user, error: null };
}

async function validateProfileEmail(params: {
  adminClient: ReturnType<typeof createClient>;
  profileId: string;
  email?: string;
}) {
  const { adminClient, profileId, email } = params;

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, email, role, created_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !profile) {
    return { profile: null };
  }

  if (email && normalizeEmail(profile.email) !== normalizeEmail(email)) {
    return { profile: null };
  }

  return { profile };
}

async function validateClientForCase(params: {
  adminClient: ReturnType<typeof createClient>;
  caseId: string;
  clientProfileId: string;
  clientEmail?: string;
}) {
  const { adminClient, caseId, clientProfileId, clientEmail } = params;

  const { data: caseRow, error: caseError } = await adminClient
    .from("cases")
    .select("id, client_id, assigned_consultant_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseRow?.client_id) {
    return false;
  }

  const { data: clientRow, error: clientError } = await adminClient
    .from("clients")
    .select("id, profile_id")
    .eq("id", caseRow.client_id)
    .maybeSingle();

  if (clientError || !clientRow || clientRow.profile_id !== clientProfileId) {
    return false;
  }

  if (clientEmail) {
    const { profile } = await validateProfileEmail({
      adminClient,
      profileId: clientProfileId,
      email: clientEmail,
    });

    if (!profile) {
      return false;
    }
  }

  return true;
}

async function authorizeEmailRequest(params: {
  request: Request;
  supabaseUrl: string;
  supabaseAnonKey: string;
  adminClient: ReturnType<typeof createClient>;
  payload: PortalEmailPayload;
}) {
  const { request, supabaseUrl, supabaseAnonKey, adminClient, payload } = params;
  const hasAuthorization = Boolean(request.headers.get("Authorization"));

  if (hasAuthorization) {
    const { error } = await getAuthenticatedUser(request, supabaseUrl, supabaseAnonKey);
    return { error };
  }

  switch (payload.type) {
    case "signup_notification":
    case "welcome_email": {
      const profileId = trimString(payload.profileId);
      const email = normalizeEmail(payload.email);

      if (!profileId || !email) {
        return {
          error: jsonResponse(request, { error: "Profile ID and email are required." }, 400),
        };
      }

      const { profile } = await validateProfileEmail({
        adminClient,
        profileId,
        email,
      });

      if (!profile) {
        return {
          error: jsonResponse(request, { error: "Unable to validate the signup email request." }, 403),
        };
      }

      const createdAt = profile.created_at ? Date.parse(profile.created_at) : Number.NaN;
      const isRecentSignup = Number.isFinite(createdAt) && Date.now() - createdAt <= 1000 * 60 * 30;

      if (profile.role !== "client" || !isRecentSignup) {
        return {
          error: jsonResponse(request, { error: "This signup email request is no longer valid." }, 403),
        };
      }

      return { error: null };
    }

    case "case_created":
    case "case_status_changed": {
      const isValid = await validateClientForCase({
        adminClient,
        caseId: trimString(payload.caseId),
        clientProfileId: trimString(payload.clientProfileId),
        clientEmail: normalizeEmail(payload.clientEmail),
      });

      return isValid
        ? { error: null }
        : { error: jsonResponse(request, { error: "Unable to validate this case notification request." }, 403) };
    }

    case "practitioner_assigned": {
      const caseId = trimString(payload.caseId);
      const practitionerProfileId = trimString(payload.practitionerProfileId);
      const practitionerEmail = normalizeEmail(payload.practitionerEmail);

      if (!caseId || !practitionerProfileId || !practitionerEmail) {
        return {
          error: jsonResponse(request, { error: "Case ID, practitioner profile ID, and email are required." }, 400),
        };
      }

      const { data: caseRow, error: caseError } = await adminClient
        .from("cases")
        .select("id, assigned_consultant_id")
        .eq("id", caseId)
        .maybeSingle();

      const { profile } = await validateProfileEmail({
        adminClient,
        profileId: practitionerProfileId,
        email: practitionerEmail,
      });

      if (caseError || !caseRow || caseRow.assigned_consultant_id !== practitionerProfileId || !profile) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this practitioner assignment request." }, 403),
        };
      }

      return { error: null };
    }

    case "practitioner_message": {
      const messageId = trimString(payload.messageId);
      const clientProfileId = trimString(payload.clientProfileId);
      const clientEmail = normalizeEmail(payload.clientEmail);

      if (!messageId || !clientProfileId || !clientEmail) {
        return {
          error: jsonResponse(request, { error: "Message ID, client profile ID, and email are required." }, 400),
        };
      }

      const { data: messageRow, error: messageError } = await adminClient
        .from("messages")
        .select("id, conversation_id, sender_type")
        .eq("id", messageId)
        .maybeSingle();

      if (messageError || !messageRow?.conversation_id || messageRow.sender_type === "client") {
        return {
          error: jsonResponse(request, { error: "Unable to validate this message notification request." }, 403),
        };
      }

      const { data: conversationRow, error: conversationError } = await adminClient
        .from("conversations")
        .select("id, client_id")
        .eq("id", messageRow.conversation_id)
        .maybeSingle();

      if (conversationError || !conversationRow?.client_id) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this message notification request." }, 403),
        };
      }

      const { data: clientRow, error: clientError } = await adminClient
        .from("clients")
        .select("id, profile_id")
        .eq("id", conversationRow.client_id)
        .maybeSingle();

      const { profile } = await validateProfileEmail({
        adminClient,
        profileId: clientProfileId,
        email: clientEmail,
      });

      if (clientError || !clientRow || clientRow.profile_id !== clientProfileId || !profile) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this message notification request." }, 403),
        };
      }

      return { error: null };
    }

    case "invoice_created":
    case "proof_of_payment_uploaded": {
      const invoiceId = trimString(payload.invoiceId);
      const clientProfileId = trimString(payload.clientProfileId);

      if (!invoiceId || !clientProfileId) {
        return {
          error: jsonResponse(request, { error: "Invoice ID and client profile ID are required." }, 400),
        };
      }

      const { data: invoiceRow, error: invoiceError } = await adminClient
        .from("invoices")
        .select("id, client_id")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError || !invoiceRow?.client_id) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this invoice notification request." }, 403),
        };
      }

      const { data: clientRow, error: clientError } = await adminClient
        .from("clients")
        .select("id, profile_id")
        .eq("id", invoiceRow.client_id)
        .maybeSingle();

      if (clientError || !clientRow || clientRow.profile_id !== clientProfileId) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this invoice notification request." }, 403),
        };
      }

      if (payload.type === "invoice_created") {
        const { profile } = await validateProfileEmail({
          adminClient,
          profileId: clientProfileId,
          email: normalizeEmail(payload.clientEmail),
        });

        if (!profile) {
          return {
            error: jsonResponse(request, { error: "Unable to validate this invoice notification request." }, 403),
          };
        }
      }

      return { error: null };
    }

    case "documents_requested": {
      const requestId = trimString(payload.requestId);
      const clientProfileId = trimString(payload.clientProfileId);
      const clientEmail = normalizeEmail(payload.clientEmail);

      if (!requestId || !clientProfileId || !clientEmail) {
        return {
          error: jsonResponse(request, { error: "Request ID, client profile ID, and email are required." }, 400),
        };
      }

      const { data: requestRow, error: requestError } = await adminClient
        .from("document_requests")
        .select("id, client_id")
        .eq("id", requestId)
        .maybeSingle();

      if (requestError || !requestRow?.client_id) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this document request notification." }, 403),
        };
      }

      const { data: clientRow, error: clientError } = await adminClient
        .from("clients")
        .select("id, profile_id")
        .eq("id", requestRow.client_id)
        .maybeSingle();

      const { profile } = await validateProfileEmail({
        adminClient,
        profileId: clientProfileId,
        email: clientEmail,
      });

      if (clientError || !clientRow || clientRow.profile_id !== clientProfileId || !profile) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this document request notification." }, 403),
        };
      }

      return { error: null };
    }

    case "documents_uploaded_admin": {
      const documentId = trimString(payload.documentId);
      const clientProfileId = trimString(payload.clientProfileId);

      if (!documentId || !clientProfileId) {
        return {
          error: jsonResponse(request, { error: "Document ID and client profile ID are required." }, 400),
        };
      }

      const { data: documentRow, error: documentError } = await adminClient
        .from("documents")
        .select("id, client_id, uploaded_by")
        .eq("id", documentId)
        .maybeSingle();

      if (documentError || !documentRow?.client_id) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this document upload notification." }, 403),
        };
      }

      const { data: clientRow, error: clientError } = await adminClient
        .from("clients")
        .select("id, profile_id")
        .eq("id", documentRow.client_id)
        .maybeSingle();

      if (
        clientError
        || !clientRow
        || clientRow.profile_id !== clientProfileId
        || documentRow.uploaded_by !== clientProfileId
      ) {
        return {
          error: jsonResponse(request, { error: "Unable to validate this document upload notification." }, 403),
        };
      }

      return { error: null };
    }

    default:
      return {
        error: jsonResponse(request, { error: "You must be signed in to send this notification." }, 401),
      };
  }
}

function buildEmailContent(params: {
  payload: PortalEmailPayload;
  notificationEmail: string;
  portalUrl: string;
  supportEmail: string;
  supportWhatsapp: string;
}) {
  const { payload, notificationEmail, portalUrl, supportEmail, supportWhatsapp } = params;

  if (payload.type === "contact_form") {
    const name = trimString(payload.name);
    const email = normalizeEmail(payload.email);
    const subject = trimString(payload.subject);
    const message = trimString(payload.message);

    if (!name || !email || !subject || !message) {
      throw new Error("Name, email, subject, and message are required.");
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

    return {
      requiresAuth: false,
      mail: {
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
      } satisfies MailtrapMessage,
      log: {
        notificationType: "contact_form",
        recipientEmail: notificationEmail,
        contactEmail: email,
        metadata: {
          name,
          subject,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "signup_notification") {
    const profileId = trimString(payload.profileId);
    const email = normalizeEmail(payload.email);
    const fullName = trimString(payload.fullName) || "New user";
    const role = trimString(payload.role) || "client";
    const provider = trimString(payload.provider) || "email";

    if (!profileId || !email) {
      throw new Error("Profile ID and email are required for signup notifications.");
    }

    return {
      requiresAuth: true,
      mail: {
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
          <p><strong>Full name:</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Role:</strong> ${escapeHtml(role)}</p>
          <p><strong>Auth provider:</strong> ${escapeHtml(provider)}</p>
          <p><strong>Profile ID:</strong> ${escapeHtml(profileId)}</p>
        `,
        category: "Acapolite Signup Notification",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "signup_notification",
        recipientEmail: notificationEmail,
        profileId,
        contactEmail: email,
        metadata: {
          full_name: fullName,
          role,
          provider,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "welcome_email") {
    const profileId = trimString(payload.profileId);
    const email = normalizeEmail(payload.email);
    const fullName = trimString(payload.fullName) || "Client";

    if (!profileId || !email) {
      throw new Error("Profile ID and client email are required for welcome emails.");
    }

    const safeName = escapeHtml(fullName);
    const safeEmail = escapeHtml(email);
    const siteLabel = portalUrl.replace(/^https?:\/\//, "");

    return {
      requiresAuth: true,
      mail: {
        toEmail: email,
        subject: "Welcome to Acapolite Consulting - Your Portal is Ready",
        text: [
          `Dear ${fullName},`,
          "",
          "Welcome to Acapolite Consulting. We are glad to have you on board. Your secure client portal has been activated and is ready for you to use.",
          "",
          `Portal Login: ${portalUrl}`,
          `Your Email: ${email}`,
          `Support: ${supportEmail}`,
          "",
          "Through your portal you can upload documents, track your case status in real time, view invoices, and communicate directly with your consultant.",
          "",
          `For quick help, WhatsApp us on ${supportWhatsapp}.`,
          "",
          "The Acapolite Consulting Team",
          "Registered Tax Practitioners",
          `${supportEmail} | ${supportWhatsapp}`,
          portalUrl,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff;letter-spacing:0.05em">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px">Registered Tax Practitioners | South Africa</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#c8a84b;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">New Client</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Welcome to Acapolite Consulting</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Your Secure Portal is Ready</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#ffffff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safeName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">Welcome to Acapolite Consulting. We are glad to have you on board. Your secure client portal has been activated and is ready for you to use.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8ef;border-left:4px solid #c8a84b;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;width:110px;padding:4px 0">Portal Login</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${portalUrl}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Your Email</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeEmail}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Support</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${supportEmail}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 24px">Through your portal you can upload documents, track your case status in real time, view invoices, and communicate directly with your consultant.</p>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#c8a84b;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Log In to Your Portal</a>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:13px;color:#666;margin:20px 0 0">For quick help, WhatsApp us on <strong>${supportWhatsapp}</strong>.</p>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;line-height:1.7;margin:0">
                            <strong style="color:#1a3a5c">The Acapolite Consulting Team</strong><br />
                            Registered Tax Practitioners<br />
                            ${supportEmail} | ${supportWhatsapp}<br />
                            <a href="${portalUrl}" style="color:#1a3a5c">${siteLabel}</a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. All rights reserved.<br />This is an automated notification. Please do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Welcome",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "welcome_email",
        recipientEmail: email,
        profileId,
        contactEmail: email,
        metadata: {
          full_name: fullName,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "case_created") {
    const caseId = trimString(payload.caseId);
    const caseNumber = trimString(payload.caseNumber) || caseId;
    const clientProfileId = trimString(payload.clientProfileId);
    const clientEmail = normalizeEmail(payload.clientEmail);
    const clientName = trimString(payload.clientName) || "Client";
    const createdDate = trimString(payload.createdDate) || new Date().toLocaleDateString("en-ZA");

    if (!caseId || !clientProfileId || !clientEmail) {
      throw new Error("Case ID, client profile ID, and client email are required.");
    }

    const safeCaseNumber = escapeHtml(caseNumber);
    const safeClientName = escapeHtml(clientName);
    const safeCreatedDate = escapeHtml(createdDate);
    const safeSupportEmail = escapeHtml(supportEmail);
    const safeSupportWhatsapp = escapeHtml(supportWhatsapp);
    const siteLabel = portalUrl.replace(/^https?:\/\//, "");
    const notificationKey = `case_created:${caseId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: clientEmail,
        subject: `Your Case Has Been Created - Case #${caseNumber}`,
        text: [
          `Dear ${clientName},`,
          "",
          "We would like to let you know that your case has been successfully created in our system.",
          "",
          `Case Number: #${caseNumber}`,
          `Created Date: ${createdDate}`,
          "Status: Created",
          "",
          "To view the progress of your case, please log in to your portal. If you do not yet have an account, please sign up using your email address to access your case updates.",
          "",
          `Log In / Sign Up: ${portalUrl}`,
          "",
          `If you need assistance, please contact us at ${supportEmail} or WhatsApp us on ${supportWhatsapp}.`,
          "",
          "The Acapolite Consulting Team",
          "Registered Tax Practitioners",
          `${supportEmail} | ${supportWhatsapp}`,
          portalUrl,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff;letter-spacing:0.05em">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px">Registered Tax Practitioners | South Africa</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#c8a84b;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Case Created</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Your Case Has Been Created</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#ffffff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safeClientName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">We would like to let you know that your case has been successfully created in our system.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8ef;border-left:4px solid #c8a84b;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;width:120px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Created Date</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeCreatedDate}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Status</td>
                                    <td style="padding:4px 0"><span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px">Created</span></td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">To view the progress of your case, please log in to your portal. If you do not yet have an account, please sign up using your email address to access your case updates.</p>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#c8a84b;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Log In / Sign Up</a>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:13px;color:#666;margin:20px 0 0">If you need assistance, please contact us at <strong>${safeSupportEmail}</strong> or WhatsApp us on <strong>${safeSupportWhatsapp}</strong>.</p>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;line-height:1.7;margin:0">
                            <strong style="color:#1a3a5c">The Acapolite Consulting Team</strong><br />
                            Registered Tax Practitioners<br />
                            ${safeSupportEmail} | ${safeSupportWhatsapp}<br />
                            <a href="${portalUrl}" style="color:#1a3a5c">${siteLabel}</a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. All rights reserved.<br />This is an automated notification. Please do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Case Created",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "case_created",
        recipientEmail: clientEmail,
        profileId: clientProfileId,
        contactEmail: clientEmail,
        metadata: {
          case_id: caseId,
          case_number: caseNumber,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "practitioner_assigned") {
    const caseId = trimString(payload.caseId);
    const caseNumber = trimString(payload.caseNumber) || caseId;
    const practitionerProfileId = trimString(payload.practitionerProfileId);
    const practitionerEmail = normalizeEmail(payload.practitionerEmail);
    const practitionerName = trimString(payload.practitionerName) || "Practitioner";
    const clientName = trimString(payload.clientName) || "Client";
    const serviceType = trimString(payload.serviceType) || "Tax service";
    const assignedDate = trimString(payload.assignedDate) || new Date().toLocaleDateString("en-ZA");
    const priority = trimString(payload.priority) || "Normal";

    if (!caseId || !practitionerProfileId || !practitionerEmail) {
      throw new Error("Case ID, practitioner profile ID, and practitioner email are required.");
    }

    const safeCaseNumber = escapeHtml(caseNumber);
    const safePractitionerName = escapeHtml(practitionerName);
    const safeClientName = escapeHtml(clientName);
    const safeServiceType = escapeHtml(serviceType);
    const safeAssignedDate = escapeHtml(assignedDate);
    const safePriority = escapeHtml(priority);
    const notificationKey = `practitioner_assigned:${caseId}:${practitionerProfileId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: practitionerEmail,
        fromEmail: supportEmail,
        fromName: "Acapolite Consulting Admin",
        subject: `Case #${caseNumber} Has Been Assigned to You`,
        text: [
          `Dear ${practitionerName},`,
          "",
          "A new case has been assigned to you by the admin team. Please log in to review the client details and submitted documents.",
          "",
          `Case Number: #${caseNumber}`,
          `Client Name: ${clientName}`,
          `Service Type: ${serviceType}`,
          `Assigned On: ${assignedDate}`,
          `Priority: ${priority}`,
          "",
          `Open Case in Portal: ${portalUrl}`,
          "",
          "Acapolite Consulting Admin",
          supportEmail,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Admin Notification</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#c8a84b;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Case Assigned</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">New Case Assigned to You</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safePractitionerName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">A new case has been assigned to you by the admin team. Please log in to review the client details and submitted documents.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8ef;border-left:4px solid #c8a84b;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;width:120px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Client Name</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeClientName}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Service Type</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeServiceType}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Assigned On</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeAssignedDate}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Priority</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safePriority}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#c8a84b;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Open Case in Portal</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0">
                            <strong style="color:#1a3a5c">Acapolite Consulting Admin</strong><br />
                            ${supportEmail}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Practitioner Assignment",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "practitioner_assigned",
        recipientEmail: practitionerEmail,
        profileId: practitionerProfileId,
        contactEmail: practitionerEmail,
        metadata: {
          case_id: caseId,
          case_number: caseNumber,
          practitioner_profile_id: practitionerProfileId,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "practitioner_message") {
    const messageId = trimString(payload.messageId);
    const clientProfileId = trimString(payload.clientProfileId);
    const clientEmail = normalizeEmail(payload.clientEmail);
    const clientName = trimString(payload.clientName) || "Client";
    const practitionerName = trimString(payload.practitionerName) || "Acapolite Consulting";
    const caseNumber = trimString(payload.caseNumber) || "General Support";
    const messagePreview = trimString(payload.messagePreview) || "Please log in to read the latest portal message.";
    const sentDate = trimString(payload.sentDate) || new Date().toLocaleDateString("en-ZA");

    if (!messageId || !clientProfileId || !clientEmail) {
      throw new Error("Message ID, client profile ID, and client email are required.");
    }

    const safeClientName = escapeHtml(clientName);
    const safePractitionerName = escapeHtml(practitionerName);
    const safeCaseNumber = escapeHtml(caseNumber);
    const safeMessagePreview = escapeHtml(messagePreview);
    const safeSentDate = escapeHtml(sentDate);
    const notificationKey = `practitioner_message:${messageId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: clientEmail,
        subject: `New Message from Your Consultant - Case #${caseNumber}`,
        text: [
          `Dear ${clientName},`,
          "",
          "Your consultant has sent you a new message regarding your case. Please log in to your portal to read and respond.",
          "",
          `Case Number: #${caseNumber}`,
          `From: ${practitionerName}`,
          `Preview: ${messagePreview}`,
          `Sent: ${sentDate}`,
          "",
          "Please do not reply to this email. All communication is handled securely through the portal.",
          "",
          `Read and Reply in Portal: ${portalUrl}`,
          "",
          "The Acapolite Consulting Team",
          `${supportEmail} | ${supportWhatsapp}`,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Registered Tax Practitioners</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#3a8fd4;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">New Message</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Message from Your Consultant</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safeClientName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">Your consultant has sent you a new message regarding your case. Please log in to your portal to read and respond.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;border-left:4px solid #1a3a5c;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;width:120px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">From</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safePractitionerName}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Preview</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeMessagePreview}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Sent</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeSentDate}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:13px;color:#888;margin:0 0 20px">Please do not reply to this email. All communication is handled securely through the portal.</p>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#1a3a5c;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Read and Reply in Portal</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0">
                            <strong style="color:#1a3a5c">The Acapolite Consulting Team</strong><br />
                            ${supportEmail} | ${supportWhatsapp}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Consultant Message",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "practitioner_message",
        recipientEmail: clientEmail,
        profileId: clientProfileId,
        contactEmail: clientEmail,
        metadata: {
          message_id: messageId,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "invoice_created") {
    const invoiceId = trimString(payload.invoiceId);
    const invoiceNumber = trimString(payload.invoiceNumber);
    const clientProfileId = trimString(payload.clientProfileId);
    const clientEmail = normalizeEmail(payload.clientEmail);
    const clientName = trimString(payload.clientName) || "Client";
    const caseNumber = trimString(payload.caseNumber) || "General Support";
    const serviceDescription = trimString(payload.serviceDescription) || "Professional tax services";
    const amount = trimString(payload.amount) || "R 0.00";
    const dueDate = trimString(payload.dueDate) || "Not set";
    const status = trimString(payload.status) || "Unpaid";

    if (!invoiceId || !invoiceNumber || !clientProfileId || !clientEmail) {
      throw new Error("Invoice ID, invoice number, client profile ID, and client email are required.");
    }

    const safeInvoiceNumber = escapeHtml(invoiceNumber);
    const safeCaseNumber = escapeHtml(caseNumber);
    const safeClientName = escapeHtml(clientName);
    const safeServiceDescription = escapeHtml(serviceDescription);
    const safeAmount = escapeHtml(amount);
    const safeDueDate = escapeHtml(dueDate);
    const safeStatus = escapeHtml(status);
    const notificationKey = `invoice_created:${invoiceId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: clientEmail,
        subject: `New Invoice #INV-${invoiceNumber} - Acapolite Consulting`,
        text: [
          `Dear ${clientName},`,
          "",
          "A new invoice has been issued for services rendered. Please review the details below and upload your proof of payment through the portal once payment has been made.",
          "",
          `Invoice #: INV-${invoiceNumber}`,
          `Case Number: #${caseNumber}`,
          `Service: ${serviceDescription}`,
          `Amount Due: ${amount}`,
          `Due Date: ${dueDate}`,
          `Status: ${status}`,
          "",
          "After payment, upload your proof of payment in the portal under your case. Do not email attachments.",
          "",
          `View Invoice and Pay: ${portalUrl}`,
          "",
          "The Acapolite Consulting Team",
          `${supportEmail} | ${supportWhatsapp}`,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Registered Tax Practitioners</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#c8a84b;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Invoice</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Invoice #INV-${safeInvoiceNumber}</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safeClientName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">A new invoice has been issued for services rendered. Please review the details below and upload your proof of payment through the portal once payment has been made.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8ef;border-left:4px solid #c8a84b;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;width:120px;padding:4px 0">Invoice #</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">INV-${safeInvoiceNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Service</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeServiceDescription}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Amount Due</td>
                                    <td style="font-size:15px;font-weight:bold;color:#1a3a5c;padding:4px 0">${safeAmount}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Due Date</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeDueDate}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Status</td>
                                    <td style="padding:4px 0"><span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px">${safeStatus}</span></td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:13px;color:#888;margin:0 0 20px">After payment, upload your proof of payment in the portal under your case. Do not email attachments.</p>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#c8a84b;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">View Invoice and Pay</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0">
                            <strong style="color:#1a3a5c">The Acapolite Consulting Team</strong><br />
                            ${supportEmail} | ${supportWhatsapp}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Invoice",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "invoice_created",
        recipientEmail: clientEmail,
        profileId: clientProfileId,
        contactEmail: clientEmail,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "proof_of_payment_uploaded") {
    const invoiceId = trimString(payload.invoiceId);
    const invoiceNumber = trimString(payload.invoiceNumber);
    const clientProfileId = trimString(payload.clientProfileId);
    const clientName = trimString(payload.clientName) || "Client";
    const caseNumber = trimString(payload.caseNumber) || "General Support";
    const amount = trimString(payload.amount) || "R 0.00";
    const uploadDate = trimString(payload.uploadDate) || new Date().toLocaleDateString("en-ZA");

    if (!invoiceId || !invoiceNumber || !clientProfileId) {
      throw new Error("Invoice ID, invoice number, and client profile ID are required.");
    }

    const safeInvoiceNumber = escapeHtml(invoiceNumber);
    const safeCaseNumber = escapeHtml(caseNumber);
    const safeClientName = escapeHtml(clientName);
    const safeAmount = escapeHtml(amount);
    const safeUploadDate = escapeHtml(uploadDate);
    const notificationKey = `proof_of_payment_uploaded:${invoiceId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: notificationEmail,
        fromEmail: supportEmail,
        fromName: "Acapolite Portal",
        subject: `Proof of Payment Received - Case #${caseNumber}`,
        text: [
          "Dear Admin Team,",
          "",
          "A client has uploaded proof of payment. Please log in to the portal to verify and update the invoice status.",
          "",
          `Case Number: #${caseNumber}`,
          `Client Name: ${clientName}`,
          `Invoice #: INV-${invoiceNumber}`,
          `Amount: ${amount}`,
          `Uploaded: ${uploadDate}`,
          "",
          `Review Payment in Portal: ${portalUrl}`,
          "",
          "Acapolite Portal Notification",
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Admin Notification</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#16a34a;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Payment Upload</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Proof of Payment Received</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear Admin Team,</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">A client has uploaded proof of payment. Please log in to the portal to verify and update the invoice status.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;width:120px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Client Name</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeClientName}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Invoice #</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">INV-${safeInvoiceNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Amount</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeAmount}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Uploaded</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeUploadDate}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#16a34a;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Review Payment in Portal</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0"><strong style="color:#1a3a5c">Acapolite Portal Notification</strong></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Automated notification.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Payment Upload",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "proof_of_payment_uploaded",
        recipientEmail: notificationEmail,
        profileId: clientProfileId,
        contactEmail: null,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "case_status_changed") {
    const caseId = trimString(payload.caseId);
    const caseNumber = trimString(payload.caseNumber) || caseId;
    const clientProfileId = trimString(payload.clientProfileId);
    const clientEmail = normalizeEmail(payload.clientEmail);
    const clientName = trimString(payload.clientName) || "Client";
    const serviceType = trimString(payload.serviceType) || "Tax service";
    const previousStatus = trimString(payload.previousStatus) || "Pending";
    const newStatus = trimString(payload.newStatus) || "Updated";
    const updateDate = trimString(payload.updateDate) || new Date().toLocaleDateString("en-ZA");

    if (!caseId || !clientProfileId || !clientEmail) {
      throw new Error("Case ID, client profile ID, and client email are required.");
    }

    const safeCaseNumber = escapeHtml(caseNumber);
    const safeClientName = escapeHtml(clientName);
    const safeServiceType = escapeHtml(serviceType);
    const safePreviousStatus = escapeHtml(previousStatus);
    const safeNewStatus = escapeHtml(newStatus);
    const safeUpdateDate = escapeHtml(updateDate);
    const notificationKey = `case_status_changed:${caseId}:${newStatus.toLowerCase()}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: clientEmail,
        subject: `Case Update: #${caseNumber} is now ${newStatus}`,
        text: [
          `Dear ${clientName},`,
          "",
          "We have an update on your case. Your consultant has moved your case to a new status.",
          "",
          `Case Number: #${caseNumber}`,
          `Service: ${serviceType}`,
          `Previous Status: ${previousStatus}`,
          `New Status: ${newStatus}`,
          `Updated: ${updateDate}`,
          "",
          `View Case in Portal: ${portalUrl}`,
          "",
          "The Acapolite Consulting Team",
          `${supportEmail} | ${supportWhatsapp}`,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Registered Tax Practitioners</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#3a8fd4;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Status Updated</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Your Case Has Been Updated</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safeClientName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">We have an update on your case. Your consultant has moved your case to a new status.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;border-left:4px solid #1a3a5c;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;width:130px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Service</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeServiceType}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Previous Status</td>
                                    <td style="font-size:13px;color:#888;padding:4px 0">${safePreviousStatus}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">New Status</td>
                                    <td style="padding:4px 0"><span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px">${safeNewStatus}</span></td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#1a3a5c;padding:4px 0">Updated</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeUpdateDate}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#1a3a5c;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">View Case in Portal</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0">
                            <strong style="color:#1a3a5c">The Acapolite Consulting Team</strong><br />
                            ${supportEmail} | ${supportWhatsapp}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Status Update",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "case_status_changed",
        recipientEmail: clientEmail,
        profileId: clientProfileId,
        contactEmail: clientEmail,
        metadata: {
          case_id: caseId,
          case_number: caseNumber,
          new_status: newStatus,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "documents_requested") {
    const requestId = trimString(payload.requestId);
    const clientProfileId = trimString(payload.clientProfileId);
    const clientEmail = normalizeEmail(payload.clientEmail);
    const clientName = trimString(payload.clientName) || "Client";
    const practitionerName = trimString(payload.practitionerName) || "Acapolite Consulting";
    const caseNumber = trimString(payload.caseNumber) || "General Support";
    const documentList = trimString(payload.documentList) || "Additional supporting documents";
    const deadlineDate = trimString(payload.deadlineDate) || "As soon as possible";

    if (!requestId || !clientProfileId || !clientEmail) {
      throw new Error("Request ID, client profile ID, and client email are required.");
    }

    const safeClientName = escapeHtml(clientName);
    const safePractitionerName = escapeHtml(practitionerName);
    const safeCaseNumber = escapeHtml(caseNumber);
    const safeDocumentList = escapeHtml(documentList);
    const safeDeadlineDate = escapeHtml(deadlineDate);
    const notificationKey = `documents_requested:${requestId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: clientEmail,
        subject: `Action Required: Documents Requested - Case #${caseNumber}`,
        text: [
          `Dear ${clientName},`,
          "",
          "Your consultant has requested additional documents to continue processing your case. Please upload them as soon as possible to avoid delays.",
          "",
          `Case Number: #${caseNumber}`,
          `Requested By: ${practitionerName}`,
          `Documents: ${documentList}`,
          `Deadline: ${deadlineDate}`,
          "",
          "Delays in document submission may affect your SARS deadlines and case outcome.",
          "",
          `Upload Documents Now: ${portalUrl}`,
          "",
          "The Acapolite Consulting Team",
          `${supportEmail} | ${supportWhatsapp}`,
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Registered Tax Practitioners</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#dc2626;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Action Required</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Documents Requested</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear ${safeClientName},</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">Your consultant has requested additional documents to continue processing your case. Please upload them as soon as possible to avoid delays.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#991b1b;width:130px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#991b1b;padding:4px 0">Requested By</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safePractitionerName}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#991b1b;padding:4px 0">Documents</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeDocumentList}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#991b1b;padding:4px 0">Deadline</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeDeadlineDate}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="font-size:13px;color:#888;margin:0 0 20px">Delays in document submission may affect your SARS deadlines and case outcome.</p>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#dc2626;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Upload Documents Now</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0">
                            <strong style="color:#1a3a5c">The Acapolite Consulting Team</strong><br />
                            ${supportEmail} | ${supportWhatsapp}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Do not reply to this email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Document Request",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "documents_requested",
        recipientEmail: clientEmail,
        profileId: clientProfileId,
        contactEmail: clientEmail,
        metadata: {
          request_id: requestId,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  if (payload.type === "documents_uploaded_admin") {
    const documentId = trimString(payload.documentId);
    const clientProfileId = trimString(payload.clientProfileId);
    const clientName = trimString(payload.clientName) || "Client";
    const caseNumber = trimString(payload.caseNumber) || "General Support";
    const documentList = trimString(payload.documentList) || "Supporting documents";
    const uploadDate = trimString(payload.uploadDate) || new Date().toLocaleDateString("en-ZA");

    if (!documentId || !clientProfileId) {
      throw new Error("Document ID and client profile ID are required.");
    }

    const safeClientName = escapeHtml(clientName);
    const safeCaseNumber = escapeHtml(caseNumber);
    const safeDocumentList = escapeHtml(documentList);
    const safeUploadDate = escapeHtml(uploadDate);
    const notificationKey = `documents_uploaded_admin:${documentId}`;

    return {
      requiresAuth: true,
      mail: {
        toEmail: notificationEmail,
        fromEmail: supportEmail,
        fromName: "Acapolite Portal",
        subject: `Documents Uploaded by Client - Case #${caseNumber}`,
        text: [
          "Dear Admin Team,",
          "",
          "A client has uploaded new documents to their case in the portal. Please review and notify the relevant consultant.",
          "",
          `Case Number: #${caseNumber}`,
          `Client Name: ${clientName}`,
          `Documents: ${documentList}`,
          `Uploaded: ${uploadDate}`,
          "",
          `Review Documents in Portal: ${portalUrl}`,
          "",
          "Acapolite Portal Notification",
        ].join("\n"),
        html: `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
            </head>
            <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px 16px">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
                      <tr>
                        <td style="background:#1a3a5c;border-radius:10px 10px 0 0;padding:32px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="background:#c8a84b;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:bold">A</td>
                                    <td style="padding-left:12px">
                                      <div style="font-size:15px;font-weight:bold;color:#fff">ACAPOLITE CONSULTING</div>
                                      <div style="font-size:11px;color:rgba(255,255,255,0.55)">Admin Notification</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right">
                                <span style="background:#16a34a;color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px">Doc Upload</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="color:#fff;font-size:22px;margin:24px 0 6px;font-family:Georgia,serif;font-weight:normal">Client Documents Uploaded</h1>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0">Case #${safeCaseNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#fff;padding:32px 36px">
                          <p style="font-size:15px;font-weight:bold;color:#1a3a5c;margin:0 0 12px">Dear Admin Team,</p>
                          <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">A client has uploaded new documents to their case in the portal. Please review and notify the relevant consultant.</p>
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;margin-bottom:20px">
                            <tr>
                              <td style="padding:16px">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;width:120px;padding:4px 0">Case Number</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">#${safeCaseNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Client Name</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeClientName}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Documents</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeDocumentList}</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size:13px;font-weight:bold;color:#166534;padding:4px 0">Uploaded</td>
                                    <td style="font-size:13px;color:#333;padding:4px 0">${safeUploadDate}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#16a34a;border-radius:6px">
                                <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Review Documents in Portal</a>
                              </td>
                            </tr>
                          </table>
                          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                          <p style="font-size:13px;color:#555;margin:0"><strong style="color:#1a3a5c">Acapolite Portal Notification</strong></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#f0f2f5;border-radius:0 0 10px 10px;padding:16px 36px;text-align:center">
                          <p style="font-size:11px;color:#999;margin:0">Copyright 2026 Acapolite Consulting. Automated notification.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        category: "Document Upload",
      } satisfies MailtrapMessage,
      log: {
        notificationType: "documents_uploaded_admin",
        recipientEmail: notificationEmail,
        profileId: clientProfileId,
        contactEmail: null,
        metadata: {
          document_id: documentId,
          notification_key: notificationKey,
        },
      } satisfies NotificationLogEntry,
    };
  }

  throw new Error("Unsupported email notification type.");
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
    const portalUrl = requireEnv("PORTAL_URL", DEFAULT_PORTAL_URL);
    const supportEmail = requireEnv("PORTAL_SUPPORT_EMAIL", DEFAULT_SUPPORT_EMAIL);
    const supportWhatsapp = requireEnv("PORTAL_SUPPORT_WHATSAPP", DEFAULT_SUPPORT_WHATSAPP);
    const webPushVapidConfig = getWebPushVapidConfig();
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailContent = buildEmailContent({
      payload,
      notificationEmail,
      portalUrl,
      supportEmail,
      supportWhatsapp,
    });

    if (emailContent.requiresAuth) {
      const { error } = await authorizeEmailRequest({
        request,
        supabaseUrl,
        supabaseAnonKey,
        adminClient,
        payload,
      });

      if (error) {
        return error;
      }
    }

    const notificationKey = typeof emailContent.log.metadata?.notification_key === "string"
      ? emailContent.log.metadata.notification_key
      : "";

    if (emailContent.log.profileId && notificationKey) {
      const { data: existingLog } = await adminClient
        .from("email_notification_logs")
        .select("id")
        .eq("notification_type", emailContent.log.notificationType)
        .eq("profile_id", emailContent.log.profileId)
        .contains("metadata", { notification_key: notificationKey })
        .maybeSingle();

      if (existingLog) {
        return jsonResponse(request, { success: true, skipped: true }, 200);
      }
    } else if (emailContent.log.profileId) {
      const { data: existingLog } = await adminClient
        .from("email_notification_logs")
        .select("id")
        .eq("notification_type", emailContent.log.notificationType)
        .eq("profile_id", emailContent.log.profileId)
        .maybeSingle();

      if (existingLog) {
        return jsonResponse(request, { success: true, skipped: true }, 200);
      }
    }

    await sendMailtrapEmail({
      token: mailtrapApiToken,
      fromEmail,
      fromName,
      message: emailContent.mail,
    });

    await adminClient.from("email_notification_logs").insert({
      notification_type: emailContent.log.notificationType,
      recipient_email: emailContent.log.recipientEmail,
      profile_id: emailContent.log.profileId ?? null,
      contact_email: emailContent.log.contactEmail ?? null,
      metadata: emailContent.log.metadata ?? null,
    });

    if (emailContent.log.profileId && webPushVapidConfig) {
      const webPushContent = buildWebPushContent({ payload, portalUrl });

      if (webPushContent) {
        try {
          await sendWebPushNotifications({
            adminClient,
            profileId: emailContent.log.profileId,
            vapidConfig: webPushVapidConfig,
            notification: webPushContent,
          });
        } catch (error) {
          console.error("Web push notification flow failed.", error);
        }
      }
    }

    return jsonResponse(request, { success: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while sending portal email.";
    return jsonResponse(request, { error: message }, 500);
  }
});
