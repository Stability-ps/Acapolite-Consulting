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

export async function getSocialAssetDownloadUrl(storagePath: string, downloadFileName: string, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).createSignedUrl(storagePath, expiresInSeconds, { download: downloadFileName });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export type ReplaceSocialAssetInput = { assetId: string; file: File };

// Replaces the original pixels behind an existing poster in place (same
// row, same id - so campaign items and scheduled posts that reference it
// keep working). Any previously generated platform variants were derived
// from the OLD pixels, so they're deleted (row + storage object) rather
// than left around silently pointing at content that no longer matches
// the poster - the Media Library will show "needs variant" again until
// they're regenerated from the new original.
export async function replaceSocialMediaAsset(input: ReplaceSocialAssetInput) {
  assertValidSocialAssetFile(input.file);

  const { data: existing, error: fetchError } = await supabase.from("social_media_assets").select("storage_path, created_by").eq("id", input.assetId).single();
  if (fetchError || !existing) throw new Error(fetchError?.message || "Asset not found");

  const [{ width, height }, checksum] = await Promise.all([readImageDimensions(input.file), computeSha256(input.file)]);
  const aspectRatio = Number((width / height).toFixed(3));

  const safeFileName = sanitizeFileName(input.file.name);
  const newPath = `${existing.created_by || "system"}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).upload(newPath, input.file, {
    upsert: false,
    contentType: input.file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: updated, error: updateError } = await supabase
    .from("social_media_assets")
    .update({
      storage_path: newPath,
      mime_type: input.file.type,
      width_px: width,
      height_px: height,
      aspect_ratio: aspectRatio,
      file_size_bytes: input.file.size,
      checksum_sha256: checksum,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.assetId)
    .select("*")
    .single();

  if (updateError || !updated) {
    await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([newPath]);
    throw new Error(updateError?.message || "Unable to update the asset record");
  }

  await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([existing.storage_path]);

  const { data: staleVariants } = await supabase.from("social_platform_variants").select("id, storage_path").eq("media_asset_id", input.assetId);
  if (staleVariants?.length) {
    await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove(staleVariants.map((v) => v.storage_path));
    await supabase.from("social_platform_variants").delete().eq("media_asset_id", input.assetId);
  }

  return updated;
}

export type DuplicateSocialAssetInput = { asset: { id: string; title: string; storage_path: string; default_caption: string | null; mime_type: string; width_px: number; height_px: number; aspect_ratio: number; file_size_bytes: number; checksum_sha256: string }; createdBy: string };

// Copies only the original - not the derived platform variants, which
// would need to reference the new asset's id anyway and are cheap to
// regenerate on demand.
export async function duplicateSocialMediaAsset(input: DuplicateSocialAssetInput) {
  const { data: fileBlob, error: downloadError } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).download(input.asset.storage_path);
  if (downloadError || !fileBlob) throw new Error(downloadError?.message || "Unable to read the original file");

  const ext = input.asset.mime_type === "image/png" ? "png" : "jpg";
  const newPath = `${input.createdBy}/${Date.now()}-copy.${ext}`;
  const { error: uploadError } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).upload(newPath, fileBlob, {
    upsert: false,
    contentType: input.asset.mime_type,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: inserted, error: insertError } = await supabase
    .from("social_media_assets")
    .insert({
      title: `Copy of ${input.asset.title}`,
      default_caption: input.asset.default_caption,
      storage_path: newPath,
      mime_type: input.asset.mime_type,
      width_px: input.asset.width_px,
      height_px: input.asset.height_px,
      aspect_ratio: input.asset.aspect_ratio,
      file_size_bytes: input.asset.file_size_bytes,
      checksum_sha256: input.asset.checksum_sha256,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([newPath]);
    throw new Error(insertError?.message || "Unable to create the duplicate asset record");
  }

  return inserted;
}
