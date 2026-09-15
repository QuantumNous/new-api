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
import type { PricingModel } from '@/features/pricing/types'

import type { GuideAudience, GuideRuntime } from '../types'

export const GUIDE_API_KEY_PLACEHOLDER = 'sk-••••••'

const AUDIENCE_ENDPOINT: Exclude<GuideAudience, 'all'>[] = [
  'openai',
  'openai-response',
  'anthropic',
]

export function fillGuideTemplate(
  template: string,
  runtime: GuideRuntime
): string {
  const values: Record<string, string> = {
    '{{HOST}}': runtime.host,
    '{{BASE_URL}}': runtime.baseUrl,
    '{{FULL_URL}}': runtime.fullUrl,
    '{{MODEL}}': runtime.model,
    '{{GROUP}}': runtime.group,
    '{{API_KEY_PLACEHOLDER}}': GUIDE_API_KEY_PLACEHOLDER,
  }

  let resolved = template
  for (const [placeholder, value] of Object.entries(values)) {
    resolved = resolved.replaceAll(placeholder, value)
  }
  return resolved
}

export function filterModelsForAudience(
  accountModels: readonly string[],
  pricing: ReadonlyArray<
    Pick<PricingModel, 'model_name' | 'supported_endpoint_types'>
  >,
  audience: GuideAudience
): string[] {
  const models = [...new Set(accountModels)].sort((left, right) =>
    left.localeCompare(right)
  )
  if (audience === 'all') return models

  const endpoint = AUDIENCE_ENDPOINT.find((item) => item === audience)
  if (!endpoint) return []
  const supportedModels = new Set(
    pricing
      .filter((model) => model.supported_endpoint_types?.includes(endpoint))
      .map((model) => model.model_name)
  )
  return models.filter((model) => supportedModels.has(model))
}
