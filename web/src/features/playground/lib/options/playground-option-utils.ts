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
import { modelNameIndexes } from '@/features/hw/lib/model-name-indexes'

import type { GroupOption, ModelOption } from '../../types'

/** Best value first: the cheap default, then the everyday coding model. */
const PREFERRED_MODELS = ['gpt-6-luna', 'gpt-6.1-sol']

/** Retired names (hwRetiredModels in service/hw_pricing.go) and the model that replaced them. */
const MODEL_SUCCESSORS: Readonly<Record<string, string>> = {
  'claude-haiku-4-5': 'gpt-6-luna',
  'claude-sonnet-5': 'gpt-6.1-sol',
}

/**
 * Returns the model to switch to, or null to keep the current one. A saved
 * older model moves to its successor, and a missing model falls back to the
 * best-value model the user can reach.
 */
export function getModelFallback(
  models: ModelOption[],
  currentModel: string
): string | null {
  const has = (value: string | undefined) =>
    value !== undefined && models.some((model) => model.value === value)

  const successor = MODEL_SUCCESSORS[currentModel]
  if (has(successor)) {
    return successor
  }

  if (has(currentModel) || models.length === 0) {
    return null
  }

  return PREFERRED_MODELS.find(has) ?? models[0].value
}

export function shouldClearModelForGroup(
  models: ModelOption[],
  currentModel: string
): boolean {
  if (currentModel === '') {
    return false
  }

  return !models.some((model) => model.value === currentModel)
}

/**
 * Returns the group to switch to, or null to keep the current one. A missing
 * group falls back to the account's own group, so a paid customer never lands
 * in another group by accident, then to 'default', then to the first group.
 */
export function getGroupFallback(
  groups: GroupOption[],
  currentGroup: string,
  userGroup?: string
): string | null {
  const has = (value: string | undefined) =>
    value !== undefined && groups.some((group) => group.value === value)

  if (has(currentGroup) || groups.length === 0) {
    return null
  }

  return [userGroup, 'default'].find(has) ?? groups[0].value
}

export function getOptionLoadErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  return error instanceof Error ? error.message : fallbackMessage
}

/** The 503 code of a model that is temporarily unavailable at the supplier. */
export const MODEL_UNAVAILABLE_ERROR_CODE = 'model_unavailable'

/**
 * Marks every temporarily unavailable model in the picker with the suffix.
 * `unavailable` maps a sick model to its healthy alternative.
 */
export function labelUnavailableModels(
  models: ModelOption[],
  unavailable: Readonly<Record<string, string>>,
  suffix: string
): ModelOption[] {
  if (!models.some((model) => model.value in unavailable)) {
    return models
  }
  return models.map((model) =>
    model.value in unavailable
      ? { ...model, label: `${model.label} (${suffix})` }
      : model
  )
}

/**
 * The model a model_unavailable error suggests, when the user can pick it.
 * The server names the failed model first and the suggestion after it, in
 * Turkish and English alike; the stored message may carry a title in front.
 * The model mentioned first is the failed one and is never offered; of the
 * reachable models after it the one mentioned last wins, and on a tie the
 * longer name wins (gpt-6-astra over gpt-6).
 */
export function getUnavailableAlternative(
  errorCode: string | null | undefined,
  content: string,
  models: ModelOption[]
): string | null {
  if (errorCode !== MODEL_UNAVAILABLE_ERROR_CODE) {
    return null
  }
  let failed: string | null = null
  let failedIndex = -1
  for (const model of models) {
    const index = modelNameIndexes(content, model.value)[0] ?? -1
    if (index < 0) continue
    if (
      failed === null ||
      index < failedIndex ||
      (index === failedIndex && model.value.length > failed.length)
    ) {
      failed = model.value
      failedIndex = index
    }
  }
  if (failed === null) {
    return null
  }
  const suggestionFrom = failedIndex + failed.length
  let best: string | null = null
  let bestIndex = -1
  for (const model of models) {
    const index = modelNameIndexes(content, model.value).at(-1) ?? -1
    if (index < suggestionFrom || model.value === failed) continue
    if (
      index > bestIndex ||
      (index === bestIndex && best !== null && model.value.length > best.length)
    ) {
      best = model.value
      bestIndex = index
    }
  }
  return best
}
