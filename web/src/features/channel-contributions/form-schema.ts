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
import type { TFunction } from 'i18next'
import * as z from 'zod'

import {
  formatContributionModelMapping,
  getContributionRevision,
  parseContributionModelMapping,
  parseContributionModels,
} from './lib'
import type { ChannelContribution, ChannelContributionPayload } from './types'

function isValidContributionBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    )
  } catch {
    return false
  }
}

export function createContributionFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('Channel name is required'))
      .max(128, t('Channel name must not exceed 128 characters')),
    type: z.number().int().positive(t('Channel type is required')),
    base_url: z
      .string()
      .trim()
      .url(t('Enter a valid API endpoint'))
      .max(2048, t('API endpoint is too long'))
      .refine(isValidContributionBaseUrl, t('Enter a valid API endpoint')),
    key: z
      .string()
      .max(16384, t('API key is too long'))
      .refine(
        (value) => !/[\r\n]/.test(value),
        t('API key must be a single line')
      ),
    group: z
      .string()
      .trim()
      .min(1, t('Group is required'))
      .max(64, t('Group must not exceed 64 characters')),
    models: z
      .array(z.string().trim().min(1))
      .max(100, t('A contribution can contain at most 100 models')),
    model_mapping: z.string().superRefine((value, context) => {
      if (!value.trim()) return
      try {
        const parsed = JSON.parse(value) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          context.addIssue({
            code: 'custom',
            message: t('Model mapping must be a valid JSON object'),
          })
          return
        }
        if (
          Object.values(parsed).some((target) => typeof target !== 'string')
        ) {
          context.addIssue({
            code: 'custom',
            message: t('Model mapping values must be strings'),
          })
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: t('Model mapping must be valid JSON format'),
        })
      }
    }),
  })
}

export type ContributionFormValues = z.infer<
  ReturnType<typeof createContributionFormSchema>
>

export const emptyContributionFormValues: ContributionFormValues = {
  name: '',
  type: 1,
  base_url: '',
  key: '',
  group: '',
  models: [],
  model_mapping: '',
}

export function contributionToFormValues(
  contribution: ChannelContribution
): ContributionFormValues {
  const revision = getContributionRevision(contribution)
  if (!revision) return { ...emptyContributionFormValues }
  return {
    name: revision.name,
    type: revision.type,
    base_url: revision.base_url,
    key: '',
    group: revision.group,
    models: parseContributionModels(revision.models),
    model_mapping: formatContributionModelMapping(revision.model_mapping),
  }
}

export function contributionFormToPayload(
  values: ContributionFormValues
): ChannelContributionPayload {
  const payload: ChannelContributionPayload = {
    name: values.name.trim(),
    type: values.type,
    base_url: values.base_url.trim(),
    group: values.group.trim(),
    models: parseContributionModels(values.models),
    model_mapping: parseContributionModelMapping(values.model_mapping),
  }
  if (values.key.trim()) payload.api_key = values.key.trim()
  return payload
}

export function filterContributionModelMappingToModels(
  mapping: string,
  models: string[]
): string {
  const allowedModels = new Set(parseContributionModels(models))
  const filtered = Object.fromEntries(
    Object.entries(parseContributionModelMapping(mapping)).filter(([source]) =>
      allowedModels.has(source)
    )
  )
  return formatContributionModelMapping(filtered)
}
