/*
Copyright (C) 2023-2026 QuantumNous

Video models billed as USD per second (720p base) × duration × resolution.
Runtime billing lives in Go relay/task helpers; this module is for UI labels.
*/

/** Default USD/s @ 720p (matches setting/ratio_setting/model_ratio.go). */
export const VIDEO_PER_SECOND_DEFAULT_PRICES: Record<string, number> = {
  'sora-2': 0.08,
  'sora-2-pro': 0.24,
}

export function isVideoPerSecondModel(modelName: string): boolean {
  if (!modelName) return false
  return Object.prototype.hasOwnProperty.call(
    VIDEO_PER_SECOND_DEFAULT_PRICES,
    modelName.toLowerCase()
  )
}

export function getVideoPerSecondDefaultPrice(
  modelName: string
): number | undefined {
  return VIDEO_PER_SECOND_DEFAULT_PRICES[modelName.toLowerCase()]
}

export function getVideoPerSecondDetailKey(modelName: string): string {
  return modelName.toLowerCase() === 'sora-2-pro'
    ? 'Video per-second detail sora-2-pro'
    : 'Video per-second detail sora-2'
}
