import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(request),
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function trimString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function documentConfig(key: string) {
  switch (key) {
    case "idCopy":
      return {
        storageKey: "id-copy",
        documentType: "id_copy",
        displayName: "ID Copy",
        profileColumn: "id_document_path",
      };
    case "certificate":
      return {
        storageKey: "practitioner-certificate",
        documentType: "tax_registration_certificate",
        displayName: "Tax Practitioner Registration Certificate",
        profileColumn: "certificate_document_path",
      };
    case "proofOfAddress":
      return {
        storageKey: "proof-of-address",
        documentType: "proof_of_address",
        displayName: "Proof of Address",
        profileColumn: "proof_of_address_path",
      };
    case "bankConfirmation":
      return {
        storageKey: "bank-confirmation-letter",
        documentType: "bank_confirmation_letter",
        displayName: "Bank Confirmation Letter",
        profileColumn: "bank_confirmation_document_path",
      };
    default:
      return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(request) });
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const formData = await request.formData();
    let userId = trimString(formData.get("userId"));
    const email = normalizeEmail(trimString(formData.get("email")));
    const password = trimString(formData.get("password"));
    const fullName = trimString(formData.get("fullName"));
    const phone = trimString(formData.get("phone"));
    const idNumber = trimString(formData.get("idNumber"));
    const taxPractitionerNumber = trimString(
      formData.get("taxPractitionerNumber"),
    );
    const professionalBody = trimString(formData.get("professionalBody"));
    const yearsExperience = Number(trimString(formData.get("yearsExperience")));
    const city = trimString(formData.get("city"));
    const province = trimString(formData.get("province"));

    if (
      !email ||
      !fullName ||
      !idNumber ||
      !taxPractitionerNumber ||
      !professionalBody ||
      !city ||
      !province
    ) {
      return jsonResponse(
        request,
        { error: "Missing required practitioner signup fields." },
        400,
      );
    }

    let createdUserId: string | null = null;

    if (!userId) {
      if (!password || password.length < 8) {
        return jsonResponse(
          request,
          { error: "Password must be at least 8 characters long." },
          400,
        );
      }

      // Check profiles table for any orphaned profiles
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        // Delete orphaned profile to allow re-creation
        await adminClient
          .from("profiles")
          .delete()
          .eq("id", existingProfile.id);
      }

      const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://acapoliteconsulting.co.za/login",
          data: {
            full_name: fullName,
            phone,
            role: "consultant",
            account_type: "practitioner",
            id_number: idNumber,
            tax_practitioner_number: taxPractitionerNumber,
            professional_body: professionalBody,
            years_of_experience: Number.isFinite(yearsExperience)
              ? String(Math.max(0, yearsExperience))
              : "0",
            city,
            province,
          },
        },
      });

      if (signUpError || !signUpData.user) {
        return jsonResponse(
          request,
          { error: signUpError?.message || "Unable to create practitioner account." },
          400,
        );
      }

      userId = signUpData.user.id;
      createdUserId = userId;
    } else {
      const {
        data: { user },
        error: authError,
      } = await adminClient.auth.admin.getUserById(userId);

      if (authError || !user) {
        return jsonResponse(
          request,
          { error: "Practitioner account could not be verified." },
          404,
        );
      }

      const createdAt = Date.parse(user.created_at ?? "");
      const isRecentSignup =
        Number.isFinite(createdAt) &&
        Date.now() - createdAt <= 1000 * 60 * 30;
      const userEmail = normalizeEmail(user.email ?? "");
      const userRole = String(user.user_metadata?.role ?? "").toLowerCase();

      if (!isRecentSignup || userEmail !== email || userRole !== "consultant") {
        return jsonResponse(
          request,
          { error: "This practitioner signup request is no longer valid." },
          403,
        );
      }
    }

    const requiredDocumentKeys = ["idCopy", "certificate", "proofOfAddress"];
    const optionalDocumentKeys = ["bankConfirmation"];
    const uploadedFiles = [...requiredDocumentKeys, ...optionalDocumentKeys]
      .map((key) => {
        const file = formData.get(key);
        const config = documentConfig(key);
        if (!config || !isFile(file)) {
          return null;
        }
        return { file, config };
      })
      .filter((item): item is { file: File; config: NonNullable<ReturnType<typeof documentConfig>> } => Boolean(item));

    const uploadedRequiredCount = uploadedFiles.filter(({ config }) =>
      requiredDocumentKeys.some((key) => documentConfig(key)?.documentType === config.documentType)
    ).length;

    if (uploadedRequiredCount !== requiredDocumentKeys.length) {
      if (createdUserId) {
        await adminClient.auth.admin.deleteUser(createdUserId);
      }

      return jsonResponse(
        request,
        { error: "ID Copy, Practitioner Certificate, and Proof of Address are required." },
        400,
      );
    }

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      phone: phone || null,
      role: "consultant",
      is_active: false,
    });

    if (profileUpsertError) {
      if (createdUserId) {
        await adminClient.auth.admin.deleteUser(createdUserId);
      }

      return jsonResponse(request, { error: profileUpsertError.message }, 400);
    }

    const uploadedPaths: string[] = [];
    const profileUpdates: Record<string, string> = {};
    const documentRows: Array<Record<string, unknown>> = [];

    try {
      for (const { file, config } of uploadedFiles) {
        const safeFileName = file.name.replace(/[^\w.\-]+/g, "_");
        const filePath = `practitioner-verifications/${userId}/${config.storageKey}-${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await adminClient.storage
          .from("documents")
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        uploadedPaths.push(filePath);
        profileUpdates[config.profileColumn] = filePath;
        documentRows.push({
          practitioner_profile_id: userId,
          document_type: config.documentType,
          display_name: config.displayName,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || null,
          status: "pending_review",
          is_required: config.documentType !== "bank_confirmation_letter",
          uploaded_at: new Date().toISOString(),
        });
      }

      const { error: profileError } = await adminClient
        .from("practitioner_profiles")
        .upsert({
          profile_id: userId,
          business_type: "individual",
          business_name: null,
          registration_number: null,
          id_number: idNumber,
          tax_practitioner_number: taxPractitionerNumber,
          professional_body: professionalBody,
          city,
          province,
          years_of_experience: Number.isFinite(yearsExperience)
            ? Math.max(0, yearsExperience)
            : 0,
          verification_status: "pending",
          verification_submitted_at: new Date().toISOString(),
          is_verified: false,
          is_vat_registered: false,
          vat_number: null,
          ...profileUpdates,
        });

      if (profileError) {
        throw new Error(profileError.message);
      }

      const { error: documentsError } = await adminClient
        .from("practitioner_verification_documents")
        .upsert(documentRows, {
          onConflict: "file_path",
          ignoreDuplicates: true,
        });

      if (documentsError) {
        throw new Error(documentsError.message);
      }

      const { count: savedDocuments, error: countError } = await adminClient
        .from("practitioner_verification_documents")
        .select("id", { count: "exact", head: true })
        .eq("practitioner_profile_id", userId)
        .in("document_type", [
          "id_copy",
          "tax_registration_certificate",
          "proof_of_address",
        ]);

      if (countError) {
        throw new Error(countError.message);
      }

      if ((savedDocuments ?? 0) < 3) {
        throw new Error(
          "Practitioner signup did not save all required verification documents.",
        );
      }
    } catch (error) {
      if (uploadedPaths.length) {
        await adminClient.storage.from("documents").remove(uploadedPaths);
      }

      if (createdUserId) {
        await adminClient.auth.admin.deleteUser(createdUserId);
      }

      throw error;
    }

    return jsonResponse(request, { success: true, userId, savedDocuments: uploadedFiles.length }, 200);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while completing practitioner signup.";
    return jsonResponse(request, { error: message }, 500);
  }
});
