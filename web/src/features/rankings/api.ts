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
import { z } from 'zod'

import { api } from '@/lib/api'

import type { RankingPeriod, RankingsSnapshot } from './types'

type RankingsResponse = {
  success: boolean
  message?: string
  data: RankingsSnapshot
}

// Go serializes nil slices as null; normalize those, but reject missing or
// malformed snapshots before chart components can dereference their fields.
const goSlice = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullable()
    .transform((items) => items ?? [])
const vendorFields = { vendor: z.string(), vendor_icon: z.string().optional() }
const modelSchema = z.object({
  ...vendorFields,
  rank: z.number(),
  previous_rank: z.number().optional(),
  model_name: z.string(),
  category: z
    .enum([
      'all',
      'programming',
      'roleplay',
      'marketing',
      'translation',
      'science',
      'finance',
      'health',
      'legal',
      'education',
      'productivity',
      'multimodal',
    ])
    .catch('all'),
  total_tokens: z.number(),
  share: z.number(),
  growth_pct: z.number(),
})
const moverSchema = z.object({
  ...vendorFields,
  model_name: z.string(),
  rank_delta: z.number(),
  current_rank: z.number(),
  growth_pct: z.number(),
})
const snapshotSchema: z.ZodType<RankingsSnapshot> = z.object({
  models: goSlice(modelSchema),
  vendors: goSlice(
    z.object({
      ...vendorFields,
      rank: z.number(),
      total_tokens: z.number(),
      share: z.number(),
      growth_pct: z.number(),
      models_count: z.number(),
      top_model: z.string(),
    })
  ),
  top_movers: goSlice(moverSchema),
  top_droppers: goSlice(moverSchema),
  models_history: z.object({
    points: goSlice(
      z.object({
        ts: z.string(),
        label: z.string(),
        model: z.string(),
        vendor: z.string(),
        tokens: z.number(),
      })
    ),
    models: goSlice(
      z.object({ name: z.string(), vendor: z.string(), total: z.number() })
    ),
    buckets: z.number(),
  }),
  vendor_share_history: z.object({
    points: goSlice(
      z.object({
        ts: z.string(),
        label: z.string(),
        vendor: z.string(),
        share: z.number(),
        tokens: z.number(),
      })
    ),
    vendors: goSlice(
      z.object({ name: z.string(), total: z.number(), share: z.number() })
    ),
    buckets: z.number(),
  }),
})
const responseSchema = z.object({
  success: z.literal(true),
  data: snapshotSchema,
})

export async function getRankings(
  period: RankingPeriod
): Promise<RankingsResponse> {
  const res = await api.get<unknown>('/api/rankings', { params: { period } })
  const parsed = responseSchema.safeParse(res.data)
  if (!parsed.success) throw new Error('Unable to load rankings data')
  return parsed.data
}
