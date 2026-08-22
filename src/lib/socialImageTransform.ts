// Frontend copy of the pure geometry/decision logic used to predict, before
// generation runs, whether a platform variant would be safe to auto-create.
//
// The AUTHORITATIVE copy that actually generates variants lives in
// supabase/functions/_shared/socialImageTransform.ts (paired with
// socialImageProcessor.ts, which does the real pixel work server-side). This
// file must be kept in sync with the transform.ts half by hand - it never
// itself creates a variant, only predicts the Media Library status badge
// before the admin clicks "Generate platform versions".
export type ImageTarget = { width: number; height: number };
export type ContainLayout = { scaledWidth: number; scaledHeight: number; offsetX: number; offsetY: number; fillRatio: number };

export function computeContainLayout(sourceWidth: number, sourceHeight: number, target: ImageTarget): ContainLayout {
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scale));
  const offsetX = Math.round((target.width - scaledWidth) / 2);
  const offsetY = Math.round((target.height - scaledHeight) / 2);
  const fillRatio = (scaledWidth * scaledHeight) / (target.width * target.height);
  return { scaledWidth, scaledHeight, offsetX, offsetY, fillRatio };
}

export const MIN_SAFE_FILL_RATIO = 0.5;

export function needsManualAdjustment(layout: ContainLayout): boolean {
  return layout.fillRatio < MIN_SAFE_FILL_RATIO;
}

export const INSTAGRAM_PORTRAIT_TARGET: ImageTarget = { width: 1080, height: 1350 };
export const INSTAGRAM_SQUARE_TARGET: ImageTarget = { width: 1080, height: 1080 };

export function chooseInstagramFeedTarget(sourceWidth: number, sourceHeight: number): ImageTarget {
  const sourceRatio = sourceWidth / sourceHeight;
  const portraitRatio = INSTAGRAM_PORTRAIT_TARGET.width / INSTAGRAM_PORTRAIT_TARGET.height;
  const squareRatio = INSTAGRAM_SQUARE_TARGET.width / INSTAGRAM_SQUARE_TARGET.height;
  const portraitDiff = Math.abs(Math.log(sourceRatio) - Math.log(portraitRatio));
  const squareDiff = Math.abs(Math.log(sourceRatio) - Math.log(squareRatio));
  return squareDiff < portraitDiff ? INSTAGRAM_SQUARE_TARGET : INSTAGRAM_PORTRAIT_TARGET;
}

export const FACEBOOK_FALLBACK_TARGET: ImageTarget = { width: 1200, height: 1200 };
