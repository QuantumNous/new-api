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
*/
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { REGION_ROUTE_VALIDATION } from '../constants'
import type { RegionRoute, RegionRouteFormData } from '../types'
import { joinChannelIds, splitChannelIds } from './utils'

// ============================================================================
// Form Schema (use getRegionRouteFormSchema(t) in components for i18n messages)
// ============================================================================

export function getRegionRouteFormSchema(t: TFunction) {
  return z
    .object({
      region: z
        .string()
        .min(1, t('Region is required'))
        .max(
          REGION_ROUTE_VALIDATION.REGION_MAX_LENGTH,
          t('Region is too long')
        ),
      model: z
        .string()
        .max(
          REGION_ROUTE_VALIDATION.MODEL_MAX_LENGTH,
          t('Model is too long')
        ),
      channel_ids: z.array(z.number()),
      tag: z
        .string()
        .max(
          REGION_ROUTE_VALIDATION.TAG_MAX_LENGTH,
          t('Tag is too long')
        ),
      strategy: z.string().min(1, t('Strategy is required')),
      priority: z.number().min(REGION_ROUTE_VALIDATION.PRIORITY_MIN, t('Priority must be >= 0')),
      weight: z.number().min(REGION_ROUTE_VALIDATION.WEIGHT_MIN, t('Weight must be >= 1')),
      enabled: z.boolean(),
    })
    .refine(
      (data) => data.channel_ids.length > 0 || data.tag.trim() !== '',
      {
        message: t(
          'At least one of channel ids or tag must be specified'
        ),
        path: ['channel_ids'],
      }
    )
}

export type RegionRouteFormValues = {
  region: string
  model: string
  channel_ids: number[]
  tag: string
  strategy: string
  priority: number
  weight: number
  enabled: boolean
}

// ============================================================================
// Form Defaults
// ============================================================================

export const REGION_ROUTE_FORM_DEFAULT_VALUES: RegionRouteFormValues = {
  region: '',
  model: '',
  channel_ids: [],
  tag: '',
  strategy: 'availability',
  priority: 0,
  weight: 1,
  enabled: true,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

export function transformFormDataToPayload(
  data: RegionRouteFormValues
): RegionRouteFormData {
  return {
    region: data.region.trim(),
    model: data.model.trim() === '' ? '*' : data.model.trim(),
    channel_ids: joinChannelIds(data.channel_ids),
    tag: data.tag.trim(),
    strategy: data.strategy,
    priority: data.priority,
    weight: data.weight,
    enabled: data.enabled,
  }
}

export function transformRegionRouteToFormDefaults(
  route: RegionRoute
): RegionRouteFormValues {
  return {
    region: route.region,
    model: route.model === '*' ? '' : route.model,
    channel_ids: splitChannelIds(route.channel_ids),
    tag: route.tag,
    strategy: route.strategy,
    priority: route.priority,
    weight: route.weight,
    enabled: route.enabled,
  }
}
