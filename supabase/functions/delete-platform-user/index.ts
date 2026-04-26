import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DeleteMode = "preview" | "delete";

type DeletePlatformUserPayload = {
  target_profile_id?: string;
  mode?: DeleteMode;
};

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

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function normalizeCount(value: number | null | undefined) {
  return Number(value ?? 0);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(request) });
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(request, { error: "Missing authorization header." }, 401);
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

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
      data: { user: callerUser },
      error: callerAuthError,
    } = await callerClient.auth.getUser();

    if (callerAuthError || !callerUser) {
      return jsonResponse(request, { error: "You must be signed in to manage user deletions." }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerProfileError) {
      return jsonResponse(request, { error: callerProfileError.message }, 400);
    }

    if (callerProfile?.role !== "admin") {
      return jsonResponse(request, { error: "Only admins can delete platform users." }, 403);
    }

    const payload = (await request.json()) as DeletePlatformUserPayload;
    const targetProfileId = payload.target_profile_id?.trim() ?? "";
    const mode = payload.mode === "delete" ? "delete" : "preview";

    if (!targetProfileId) {
      return jsonResponse(request, { error: "Target profile ID is required." }, 400);
    }

    if (targetProfileId === callerUser.id) {
      return jsonResponse(request, { error: "You cannot delete your own admin account from this screen." }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", targetProfileId)
      .maybeSingle();

    if (targetProfileError) {
      return jsonResponse(request, { error: targetProfileError.message }, 400);
    }

    if (!targetProfile) {
      return jsonResponse(request, { error: "Target profile was not found." }, 404);
    }

    if (targetProfile.role === "admin") {
      return jsonResponse(request, { error: "Admin deletion is not enabled from this flow." }, 400);
    }

    const isClient = targetProfile.role === "client";
    const isPractitioner = targetProfile.role === "consultant";

    const preview: Record<string, number> = {};
    const warnings: string[] = [];

    if (isClient) {
      const { data: clientRows, error: clientRowsError } = await adminClient
        .from("clients")
        .select("id")
        .eq("profile_id", targetProfileId);

      if (clientRowsError) {
        return jsonResponse(request, { error: clientRowsError.message }, 400);
      }

      const clientIds = (clientRows ?? []).map((row) => row.id);
      const clientId = clientIds[0] ?? null;

      preview.client_records = clientIds.length;

      if (clientIds.length > 0) {
        const [
          { count: caseCount },
          { count: documentCount },
          { count: invoiceCount },
          { count: requestCount },
          { count: conversationCount },
        ] = await Promise.all([
          adminClient.from("cases").select("*", { count: "exact", head: true }).in("client_id", clientIds),
          adminClient.from("documents").select("*", { count: "exact", head: true }).in("client_id", clientIds),
          adminClient.from("invoices").select("*", { count: "exact", head: true }).in("client_id", clientIds),
          adminClient.from("document_requests").select("*", { count: "exact", head: true }).in("client_id", clientIds),
          adminClient.from("conversations").select("*", { count: "exact", head: true }).in("client_id", clientIds),
        ]);

        let messageCount = 0;
        if (clientId) {
          const { data: conversationIds } = await adminClient
            .from("conversations")
            .select("id")
            .eq("client_id", clientId);

          const ids = (conversationIds ?? []).map((row) => row.id);
          if (ids.length > 0) {
            const { count } = await adminClient
              .from("messages")
              .select("*", { count: "exact", head: true })
              .in("conversation_id", ids);
            messageCount = normalizeCount(count);
          }
        }

        preview.cases = normalizeCount(caseCount);
        preview.documents = normalizeCount(documentCount);
        preview.invoices = normalizeCount(invoiceCount);
        preview.document_requests = normalizeCount(requestCount);
        preview.conversations = normalizeCount(conversationCount);
        preview.messages = messageCount;
      }

      const { count: notificationCount } = await adminClient
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_profile_id", targetProfileId);

      preview.notifications = normalizeCount(notificationCount);
      warnings.push("This will permanently delete the client portal account and related client records.");
    }

    if (isPractitioner) {
      const [
        { count: practitionerProfileCount },
        { count: verificationDocumentCount },
        { count: creditAccountCount },
        { count: creditPurchaseCount },
        { count: creditTransactionCount },
        { count: subscriptionCount },
        { count: storageAddonCount },
        { count: accessRequestCount },
        { count: responseCount },
        { count: assignmentHistoryCount },
        { count: assignedClientCount },
        { count: assignedCaseCount },
        { count: assignedLeadCount },
        { count: conversationCount },
      ] = await Promise.all([
        adminClient.from("practitioner_profiles").select("*", { count: "exact", head: true }).eq("profile_id", targetProfileId),
        adminClient.from("practitioner_verification_documents").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("practitioner_credit_accounts").select("*", { count: "exact", head: true }).eq("profile_id", targetProfileId),
        adminClient.from("practitioner_credit_purchases").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("practitioner_credit_transactions").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("practitioner_subscriptions").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("practitioner_storage_addon_purchases").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("service_request_access_requests").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("service_request_responses").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
        adminClient.from("service_request_assignment_history").select("*", { count: "exact", head: true }).or(`practitioner_profile_id.eq.${targetProfileId},previous_practitioner_id.eq.${targetProfileId}`),
        adminClient.from("clients").select("*", { count: "exact", head: true }).eq("assigned_consultant_id", targetProfileId),
        adminClient.from("cases").select("*", { count: "exact", head: true }).eq("assigned_consultant_id", targetProfileId),
        adminClient.from("service_requests").select("*", { count: "exact", head: true }).eq("assigned_practitioner_id", targetProfileId),
        adminClient.from("conversations").select("*", { count: "exact", head: true }).eq("practitioner_profile_id", targetProfileId),
      ]);

      preview.practitioner_profile = normalizeCount(practitionerProfileCount);
      preview.verification_documents = normalizeCount(verificationDocumentCount);
      preview.credit_accounts = normalizeCount(creditAccountCount);
      preview.credit_purchases = normalizeCount(creditPurchaseCount);
      preview.credit_transactions = normalizeCount(creditTransactionCount);
      preview.subscriptions = normalizeCount(subscriptionCount);
      preview.storage_addons = normalizeCount(storageAddonCount);
      preview.marketplace_access_requests = normalizeCount(accessRequestCount);
      preview.marketplace_responses = normalizeCount(responseCount);
      preview.assignment_history = normalizeCount(assignmentHistoryCount);
      preview.assigned_clients = normalizeCount(assignedClientCount);
      preview.assigned_cases = normalizeCount(assignedCaseCount);
      preview.assigned_leads = normalizeCount(assignedLeadCount);
      preview.conversations = normalizeCount(conversationCount);

      if (normalizeCount(conversationCount) > 0) {
        const { data: conversationIds, error: conversationIdsError } = await adminClient
          .from("conversations")
          .select("id")
          .eq("practitioner_profile_id", targetProfileId);

        if (conversationIdsError) {
          return jsonResponse(request, { error: conversationIdsError.message }, 400);
        }

        const ids = (conversationIds ?? []).map((row) => row.id);
        if (ids.length > 0) {
          const { count: messageCount, error: messageCountError } = await adminClient
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", ids);

          if (messageCountError) {
            return jsonResponse(request, { error: messageCountError.message }, 400);
          }

          preview.messages = normalizeCount(messageCount);
        }
      }

      const { count: notificationCount } = await adminClient
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_profile_id", targetProfileId);

      preview.notifications = normalizeCount(notificationCount);
      warnings.push("Assigned clients, cases, and leads will be unassigned before the practitioner account is deleted.");
      warnings.push("Practitioner-owned billing, verification, and marketplace records will be removed permanently.");
    }

    if (mode === "preview") {
      return jsonResponse(request, {
        target: targetProfile,
        preview,
        warnings,
      });
    }

    if (isClient) {
      const { data: clientRows } = await adminClient
        .from("clients")
        .select("id")
        .eq("profile_id", targetProfileId);

      const clientIds = (clientRows ?? []).map((row) => row.id);

      if (clientIds.length > 0) {
        const { data: conversationRows } = await adminClient
          .from("conversations")
          .select("id")
          .in("client_id", clientIds);

        const conversationIds = (conversationRows ?? []).map((row) => row.id);
        const { data: documents } = await adminClient
          .from("documents")
          .select("file_path")
          .in("client_id", clientIds);

        const filePaths = (documents ?? [])
          .map((row) => row.file_path)
          .filter((value): value is string => Boolean(value));

        if (filePaths.length > 0) {
          await adminClient.storage.from("documents").remove(filePaths);
        }

        if (conversationIds.length > 0) {
          await adminClient.from("messages").delete().in("conversation_id", conversationIds);
        }

        await adminClient.from("documents").delete().in("client_id", clientIds);
        await adminClient.from("document_requests").delete().in("client_id", clientIds);
        await adminClient.from("invoices").delete().in("client_id", clientIds);
        await adminClient.from("conversations").delete().in("client_id", clientIds);
        await adminClient.from("cases").delete().in("client_id", clientIds);
        await adminClient.from("clients").delete().eq("profile_id", targetProfileId);
      }
    }

    if (isPractitioner) {
      const { data: verificationDocuments } = await adminClient
        .from("practitioner_verification_documents")
        .select("file_path")
        .eq("practitioner_profile_id", targetProfileId);

      const verificationPaths = (verificationDocuments ?? [])
        .map((row) => row.file_path)
        .filter((value): value is string => Boolean(value));

      if (verificationPaths.length > 0) {
        await adminClient.storage.from("documents").remove(verificationPaths);
      }

      const { data: practitionerConversations, error: practitionerConversationsError } = await adminClient
        .from("conversations")
        .select("id, client_id, case_id")
        .eq("practitioner_profile_id", targetProfileId);

      if (practitionerConversationsError) {
        return jsonResponse(request, { error: practitionerConversationsError.message }, 400);
      }

      const caseIdsToResolve = Array.from(
        new Set(
          (practitionerConversations ?? [])
            .filter((conversation) => !conversation.client_id && conversation.case_id)
            .map((conversation) => conversation.case_id as string),
        ),
      );

      const caseClientMap = new Map<string, string | null>();

      if (caseIdsToResolve.length > 0) {
        const { data: caseRows, error: caseRowsError } = await adminClient
          .from("cases")
          .select("id, client_id")
          .in("id", caseIdsToResolve);

        if (caseRowsError) {
          return jsonResponse(request, { error: caseRowsError.message }, 400);
        }

        for (const caseRow of caseRows ?? []) {
          caseClientMap.set(caseRow.id, caseRow.client_id);
        }
      }

      const conversationIdsToDelete: string[] = [];

      for (const conversation of practitionerConversations ?? []) {
        const fallbackClientId = conversation.case_id ? caseClientMap.get(conversation.case_id) ?? null : null;
        const resolvedClientId = conversation.client_id ?? fallbackClientId;

        if (resolvedClientId) {
          const { error: updateConversationError } = await adminClient
            .from("conversations")
            .update({
              client_id: resolvedClientId,
              practitioner_profile_id: null,
            })
            .eq("id", conversation.id);

          if (updateConversationError) {
            return jsonResponse(request, { error: updateConversationError.message }, 400);
          }

        } else {
          conversationIdsToDelete.push(conversation.id);
        }
      }

      if (conversationIdsToDelete.length > 0) {
        const { error: deleteConversationMessagesError } = await adminClient
          .from("messages")
          .delete()
          .in("conversation_id", conversationIdsToDelete);

        if (deleteConversationMessagesError) {
          return jsonResponse(request, { error: deleteConversationMessagesError.message }, 400);
        }

        const { error: deleteConversationsError } = await adminClient
          .from("conversations")
          .delete()
          .in("id", conversationIdsToDelete);

        if (deleteConversationsError) {
          return jsonResponse(request, { error: deleteConversationsError.message }, 400);
        }
      }

      await adminClient.from("clients").update({ assigned_consultant_id: null }).eq("assigned_consultant_id", targetProfileId);
      await adminClient.from("cases").update({ assigned_consultant_id: null }).eq("assigned_consultant_id", targetProfileId);
      await adminClient.from("service_requests").update({ assigned_practitioner_id: null }).eq("assigned_practitioner_id", targetProfileId);
      await adminClient.from("staff_permissions").delete().eq("profile_id", targetProfileId);
      await adminClient.from("practitioner_verification_documents").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("practitioner_storage_addon_purchases").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("practitioner_credit_purchases").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("practitioner_credit_transactions").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("practitioner_subscriptions").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("practitioner_credit_accounts").delete().eq("profile_id", targetProfileId);
      await adminClient.from("service_request_access_requests").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("service_request_responses").delete().eq("practitioner_profile_id", targetProfileId);
      await adminClient.from("practitioner_profiles").delete().eq("profile_id", targetProfileId);
    }

    await adminClient.from("notifications").delete().eq("recipient_profile_id", targetProfileId);
    await adminClient.from("notifications").delete().eq("actor_profile_id", targetProfileId);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(targetProfileId);

    if (deleteUserError) {
      return jsonResponse(request, { error: deleteUserError.message }, 400);
    }

    return jsonResponse(request, {
      success: true,
      target: targetProfile,
      preview,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while deleting the platform user.";
    return jsonResponse(request, { error: message }, 500);
  }
});
