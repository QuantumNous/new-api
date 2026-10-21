/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'

import { fetchUpstreamRatios } from '@/features/system-settings/api'
import {
  MODELS_DEV_PRESET_ENDPOINT,
  MODELS_DEV_PRESET_ID,
  MODELS_DEV_PRESET_NAME,
  OFFICIAL_CHANNEL_BASE_URL,
  OFFICIAL_CHANNEL_ENDPOINT,
  OFFICIAL_CHANNEL_ID,
  OFFICIAL_CHANNEL_NAME,
} from '@/features/system-settings/models/constants'
import type {
  DifferencesMap,
  RatioType,
} from '@/features/system-settings/types'

import { normalizeModelName } from '../lib/model-name-normalize'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type OfficialPricingSource = 'official' | 'models_dev'

/**
 * Structured per-model official pricing snapshot. Every field is USD-anchored
 * (matching how ratios are stored in ModelRatio/CompletionRatio/etc.), so the
 * consumer can compare directly against the form's ratio fields without any
 * currency arithmetic. `modelPrice` is the alternative per-request price.
 */
export type OfficialPricing = {
  modelRatio?: number
  completionRatio?: number
  cacheRatio?: number
  createCacheRatio?: number
  imageRatio?: number
  audioRatio?: number
  audioCompletionRatio?: number
  modelPrice?: number
  source: OfficialPricingSource
  sourceName: string
}

// -----------------------------------------------------------------------------
// Data fetch — one query for BOTH presets, cached for 10 minutes so opening
// the drawer multiple times or across models does not trigger repeat network
// calls. Failures degrade to `null` so the panel can show a "not available"
// state rather than blocking the form.
// -----------------------------------------------------------------------------

const OFFICIAL_PRICING_QUERY_KEY = ['official-pricing'] as const
const STALE_MS = 10 * 60 * 1000

async function fetchOfficialPricing(): Promise<DifferencesMap> {
  const res = await fetchUpstreamRatios({
    upstreams: [
      {
        id: OFFICIAL_CHANNEL_ID,
        name: OFFICIAL_CHANNEL_NAME,
        base_url: OFFICIAL_CHANNEL_BASE_URL,
        endpoint: OFFICIAL_CHANNEL_ENDPOINT,
      },
      {
        id: MODELS_DEV_PRESET_ID,
        name: MODELS_DEV_PRESET_NAME,
        base_url: '',
        endpoint: MODELS_DEV_PRESET_ENDPOINT,
      },
    ],
    timeout: 15,
  })
  if (!res.success) return {}
  return res.data?.differences ?? {}
}

// -----------------------------------------------------------------------------
// Fuzzy model-name resolution
//
// Upstream catalogues (basellm.github.io, models.dev) key their entries in
// canonical marketing form — e.g. `Doubao-Seedream-5.0-pro`. The gateway,
// however, persists and routes with the API-form identifier
// `doubao-seedream-5-0-pro-260628`. A raw `diffs[modelName]` lookup misses.
//
// This helper picks the best catalogue key by lower-casing + swapping
// `-N-M-` for `-N.M-` on BOTH sides and running a substring match. Whichever
// key has the longest overlap wins (so `doubao-seed-1.6-vision` beats the
// bare family key `doubao-seed-1.6`).
//
// The DifferencesMap's shape is `Record<modelName, per-ratio-diff>`; we
// return the resolved key so the caller can use it verbatim in follow-up
// `diffs[resolvedKey]` reads.
// -----------------------------------------------------------------------------

function resolveDiffsKey(
  diffs: DifferencesMap,
  modelName: string
): string | null {
  if (!modelName) return null
  if (Object.prototype.hasOwnProperty.call(diffs, modelName)) return modelName
  const target = normalizeModelName(modelName)
  if (!target) return null

  let bestKey: string | null = null
  let bestOverlap = 0
  for (const key of Object.keys(diffs)) {
    const normKey = normalizeModelName(key)
    if (!normKey) continue
    const overlap =
      target.includes(normKey) || normKey.includes(target)
        ? Math.min(target.length, normKey.length)
        : 0
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestKey = key
    }
  }
  return bestKey
}

// -----------------------------------------------------------------------------
// Extract one model's snapshot from the DifferencesMap. Prefer the official
// preset; fall back to models.dev when the model is missing there.
// -----------------------------------------------------------------------------

function pickNumber(
  diffs: DifferencesMap,
  model: string,
  ratioType: RatioType,
  sourceName: string
): number | undefined {
  const upstream = diffs[model]?.[ratioType]?.upstreams?.[sourceName]
  if (upstream === undefined || upstream === null || upstream === 'same') {
    // 'same' means upstream matches local — treat as absent for reference
    // purposes because we only want the raw upstream value for reuse.
    return undefined
  }
  const num =
    typeof upstream === 'number'
      ? upstream
      : Number.parseFloat(String(upstream))
  return Number.isFinite(num) ? num : undefined
}

function snapshotForSource(
  diffs: DifferencesMap,
  model: string,
  source: OfficialPricingSource,
  sourceName: string
): OfficialPricing | null {
  const modelRatio = pickNumber(diffs, model, 'model_ratio', sourceName)
  const modelPrice = pickNumber(diffs, model, 'model_price', sourceName)
  // Neither ratio-based nor request-based pricing available → nothing usable.
  if (modelRatio === undefined && modelPrice === undefined) return null
  return {
    modelRatio,
    completionRatio: pickNumber(diffs, model, 'completion_ratio', sourceName),
    cacheRatio: pickNumber(diffs, model, 'cache_ratio', sourceName),
    createCacheRatio: pickNumber(
      diffs,
      model,
      'create_cache_ratio',
      sourceName
    ),
    imageRatio: pickNumber(diffs, model, 'image_ratio', sourceName),
    audioRatio: pickNumber(diffs, model, 'audio_ratio', sourceName),
    audioCompletionRatio: pickNumber(
      diffs,
      model,
      'audio_completion_ratio',
      sourceName
    ),
    modelPrice,
    source,
    sourceName,
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useOfficialPricing(modelName: string | undefined | null): {
  data: OfficialPricing | null
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: OFFICIAL_PRICING_QUERY_KEY,
    queryFn: fetchOfficialPricing,
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    enabled: !!modelName,
    retry: false,
  })

  const name = (modelName ?? '').trim()
  if (!name) return { data: null, isLoading: false, isError: false }

  const diffs = query.data ?? {}
  // Resolve API-form -> canonical form via fuzzy matching so
  // `doubao-seedream-5-0-pro-260628` still finds `Doubao-Seedream-5.0-pro`.
  const resolvedKey = resolveDiffsKey(diffs, name) ?? name

  const fromOfficial = snapshotForSource(
    diffs,
    resolvedKey,
    'official',
    OFFICIAL_CHANNEL_NAME
  )
  if (fromOfficial) {
    return {
      data: fromOfficial,
      isLoading: query.isLoading,
      isError: query.isError,
    }
  }
  const fromModelsDev = snapshotForSource(
    diffs,
    resolvedKey,
    'models_dev',
    MODELS_DEV_PRESET_NAME
  )
  return {
    data: fromModelsDev,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
