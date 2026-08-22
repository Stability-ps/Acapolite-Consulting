import { supabase } from "@/integrations/supabase/client";

export const MAX_SOCIAL_ASSET_BYTES = 15 * 1024 * 1024;
export const SOCIAL_ASSET_BUCKET = "social-media-assets";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

export function assertValidSocialAssetFile(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}. Upload a JPEG or PNG image.`);
  }
  if (file.size > MAX_SOCIAL_ASSET_BYTES) {
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum is ${MAX_SOCIAL_ASSET_BYTES / (1024 * 1024)}MB.`);
  }
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type UploadSocialAssetInput = {
  file: File;
  title: string;
  defaultCaption?: string | null;
  createdBy: string;
};

export async function uploadSocialMediaAsset(input: UploadSocialAssetInput) {
  assertValidSocialAssetFile(input.file);

  const [{ width, height }, checksum] = await Promise.all([readImageDimensions(input.file), computeSha256(input.file)]);
  const aspectRatio = Number((width / height).toFixed(3));

  const safeFileName = sanitizeFileName(input.file.name);
  const filePath = `${input.createdBy}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).upload(filePath, input.file, {
    upsert: false,
    contentType: input.file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: assetRow, error: insertError } = await supabase
    .from("social_media_assets")
    .insert({
      title: input.title,
      default_caption: input.defaultCaption?.trim() || null,
      storage_path: filePath,
      mime_type: input.file.type,
      width_px: width,
      height_px: height,
      aspect_ratio: aspectRatio,
      file_size_bytes: input.file.size,
      checksum_sha256: checksum,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (insertError) {
    await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([filePath]);
    throw new Error(insertError.message);
  }

  return assetRow;
}

export async function getSocialAssetPreviewUrl(storagePath: string, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
