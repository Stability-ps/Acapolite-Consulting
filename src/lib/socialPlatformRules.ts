// Frontend copy of the canonical platform rules, for instant UI feedback in
// the Media Library (badge: "meets requirements" / "too small" etc.)
// without a network round trip per asset.
//
// The AUTHORITATIVE copy that actually blocks scheduling/publishing lives in
// supabase/functions/_shared/socialPlatformRules.ts and is enforced server
// -side by social-campaign-activate and social-publish-worker. This file
// must be kept in sync with it by hand - it can never itself gate what
// actually gets published, only what the UI shows before that server-side
// check runs.
export type SocialPlatformKey = "facebook_feed" | "instagram_feed" | "linkedin_company_page";

export type PlatformImageRules = {
  key: SocialPlatformKey;
  label: string;
  supported: boolean;
  allowedMimeTypes: string[];
  minWidthPx: number;
  minHeightPx: number;
  maxWidthPx: number;
  maxHeightPx: number;
  minAspectRatio: number;
  maxAspectRatio: number;
  maxFileSizeBytes: number;
  maxCaptionLength: number;
};

export const SOCIAL_PLATFORM_RULES: Record<SocialPlatformKey, PlatformImageRules> = {
  facebook_feed: {
    key: "facebook_feed",
    label: "Facebook Feed",
    supported: true,
    allowedMimeTypes: ["image/jpeg", "image/png"],
    minWidthPx: 600,
    minHeightPx: 315,
    maxWidthPx: 8192,
    maxHeightPx: 8192,
    minAspectRatio: 0.5,
    maxAspectRatio: 1.91,
    maxFileSizeBytes: 8 * 1024 * 1024,
    maxCaptionLength: 63206,
  },
  instagram_feed: {
    key: "instagram_feed",
    label: "Instagram Feed",
    supported: true,
    allowedMimeTypes: ["image/jpeg", "image/png"],
    minWidthPx: 320,
    minHeightPx: 320,
    maxWidthPx: 1440,
    maxHeightPx: 1800,
    minAspectRatio: 0.8,
    maxAspectRatio: 1.91,
    maxFileSizeBytes: 8 * 1024 * 1024,
    maxCaptionLength: 2200,
  },
  linkedin_company_page: {
    key: "linkedin_company_page",
    label: "LinkedIn Company Page",
    supported: false,
    allowedMimeTypes: ["image/jpeg", "image/png"],
    minWidthPx: 552,
    minHeightPx: 276,
    maxWidthPx: 7680,
    maxHeightPx: 4320,
    minAspectRatio: 0.5625,
    maxAspectRatio: 1.91,
    maxFileSizeBytes: 10 * 1024 * 1024,
    maxCaptionLength: 3000,
  },
};

export type AssetForValidation = { mimeType: string; width: number; height: number; fileSizeBytes: number };
export type ValidationFailure = { code: string; message: string };
export type ValidationResult = { platform: SocialPlatformKey; valid: boolean; aspectRatio: number; failures: ValidationFailure[] };

export function validateAssetForPlatform(asset: AssetForValidation, platform: SocialPlatformKey): ValidationResult {
  const rules = SOCIAL_PLATFORM_RULES[platform];
  const failures: ValidationFailure[] = [];
  if (!rules.supported) failures.push({ code: "unsupported_platform", message: `${rules.label} publishing is not implemented yet.` });
  if (!rules.allowedMimeTypes.includes(asset.mimeType)) failures.push({ code: "unsupported_mime_type", message: `${rules.label} only accepts ${rules.allowedMimeTypes.join(", ")}.` });
  if (asset.width < rules.minWidthPx || asset.height < rules.minHeightPx) failures.push({ code: "too_small", message: `${rules.label} requires at least ${rules.minWidthPx}x${rules.minHeightPx}px.` });
  if (asset.width > rules.maxWidthPx || asset.height > rules.maxHeightPx) failures.push({ code: "too_large_dimensions", message: `${rules.label} allows at most ${rules.maxWidthPx}x${rules.maxHeightPx}px.` });
  const aspectRatio = asset.height > 0 ? asset.width / asset.height : 0;
  if (aspectRatio < rules.minAspectRatio || aspectRatio > rules.maxAspectRatio) failures.push({ code: "aspect_ratio_out_of_range", message: `${rules.label} requires an aspect ratio between ${rules.minAspectRatio} and ${rules.maxAspectRatio}.` });
  if (asset.fileSizeBytes > rules.maxFileSizeBytes) failures.push({ code: "file_too_large", message: `${rules.label} allows at most ${Math.round(rules.maxFileSizeBytes / (1024 * 1024))}MB.` });
  return { platform, valid: failures.length === 0, aspectRatio, failures };
}

export const ALL_PLATFORM_KEYS: SocialPlatformKey[] = ["facebook_feed", "instagram_feed", "linkedin_company_page"];
