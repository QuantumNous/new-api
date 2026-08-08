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
import type { ModelOption, PlaygroundConfig } from '../types'

type PlaygroundHandoffInput = {
  models: readonly ModelOption[]
  model?: string
  prompt?: string
}

type PlaygroundHandoff = {
  models: ModelOption[]
  model?: string
  prompt?: string
}

export function resolvePlaygroundHandoffModel(
  model?: string,
  retainedModel?: string
): string | undefined {
  return model?.trim() || retainedModel?.trim() || undefined
}

export function applyPlaygroundHandoffModel(
  config: PlaygroundConfig,
  model?: string
): PlaygroundConfig {
  const normalizedModel = resolvePlaygroundHandoffModel(model)
  if (!normalizedModel) return config

  return { ...config, model: normalizedModel }
}

export function resolvePlaygroundHandoff(
  input: PlaygroundHandoffInput
): PlaygroundHandoff {
  const model = resolvePlaygroundHandoffModel(input.model)
  const prompt = input.prompt?.trim()
  const models = [...input.models]

  if (model && !models.some((option) => option.value === model)) {
    models.unshift({ label: model, value: model })
  }

  return {
    models,
    ...(model ? { model } : {}),
    ...(prompt ? { prompt } : {}),
  }
}
