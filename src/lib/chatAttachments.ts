import { supabase } from "@/integrations/supabase/client";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function uploadChatAttachment(params: {
  file: File;
  uploadedBy: string;
  clientId: string;
  caseId?: string | null;
  recipientProfileId?: string | null;
  title?: string;
}) {
  const safeFileName = sanitizeFileName(params.file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const filePath = params.caseId
    ? `chat-attachments/${params.clientId}/${params.caseId}/${uniqueFileName}`
    : `chat-attachments/${params.clientId}/general/${uniqueFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, params.file, {
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .insert({
      client_id: params.clientId,
      case_id: params.caseId ?? null,
      uploaded_by: params.uploadedBy,
      sender_profile_id: params.uploadedBy,
      recipient_profile_id: params.recipientProfileId ?? null,
      visibility: params.caseId ? "case" : "shared",
      title: params.title || `Chat Attachment - ${params.file.name}`,
      file_name: params.file.name,
      file_path: filePath,
      file_size: params.file.size,
      mime_type: params.file.type || null,
      category: "Chat Attachment",
      status: "uploaded",
    })
    .select("id, file_name, file_path")
    .single();

  if (documentError || !documentRow) {
    await supabase.storage.from("documents").remove([filePath]);
    throw new Error(documentError?.message || "Unable to save the chat attachment.");
  }

  return documentRow;
}

export async function openChatAttachment(filePath: string) {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 10);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to open this attachment.");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
