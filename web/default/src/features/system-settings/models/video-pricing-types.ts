/**
 * Mirrors setting/billing_setting/video_price.go.
 *
 * The vocabularies are duplicated rather than fetched because they are a closed
 * set the backend enforces on save. Offering a dropdown removes a class of typo
 * entirely: the backend folds case ("4K" survives) but rejects unknown tiers
 * ("1440p" does not), and a rejected save is a worse experience than never
 * being able to type it.
 */

export type BasisValue = 'output_duration' | 'total_duration'

export type VideoPriceRule = {
  model: string
  match: Record<string, string>
  price_per_second: number
  basis: BasisValue
  fallback_seconds?: number
  source_rate_per_1m_tokens?: number
  assumed_fps?: number
}

// canonicalResolutions in video_price.go. 2160p is an alias folding to 4k, so
// it is not a separate choice.
export const RESOLUTION_VALUES = [
  '480p',
  '512p',
  '720p',
  '768p',
  '1080p',
  '2k',
  '4k',
] as const

// canonicalMode. kling prices by generation mode and has no resolution.
export const MODE_VALUES = ['std', 'pro'] as const

// canonicalHasVideo. Adapters emit string booleans, not JSON booleans.
export const HAS_VIDEO_VALUES = ['true', 'false'] as const

export const DIMENSION_KEYS = ['resolution', 'has_video', 'mode'] as const

export type DimensionKey = (typeof DIMENSION_KEYS)[number]

export const DIMENSION_VALUES: Record<DimensionKey, readonly string[]> = {
  resolution: RESOLUTION_VALUES,
  has_video: HAS_VIDEO_VALUES,
  mode: MODE_VALUES,
}

export const BASIS_OPTIONS: ReadonlyArray<{ value: BasisValue }> = [
  { value: 'output_duration' },
  { value: 'total_duration' },
]

export function createEmptyRule(model = ''): VideoPriceRule {
  return {
    model,
    match: {},
    price_per_second: 0,
    basis: 'output_duration',
  }
}

/**
 * Reads the stored option value. Returns no rules for anything unreadable: a
 * save replaces the key wholesale, so refusing to render the sheet over one
 * malformed row would be a worse failure than starting from empty.
 */
export function parseAllRules(raw: string | undefined): VideoPriceRule[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VideoPriceRule[]) : []
  } catch {
    return []
  }
}

export function rulesForModel(
  all: VideoPriceRule[],
  model: string,
): VideoPriceRule[] {
  return all.filter((rule) => rule.model === model)
}

/**
 * Replaces one model's rules, preserving every other model's. The editor only
 * ever sees one model, so a wholesale write would delete the rest of the table.
 */
export function mergeModelRules(
  all: VideoPriceRule[],
  model: string,
  next: VideoPriceRule[],
): VideoPriceRule[] {
  const others = all.filter((rule) => rule.model !== model)
  return [...others, ...next.map((rule) => ({ ...rule, model }))]
}
