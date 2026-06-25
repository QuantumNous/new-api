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
import { isPlaygroundChatModelName } from './playground-model-filter'

const FIRST_RUN_MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'claude-haiku-4-5',
]

export function pickFirstRunModel(
  availableModels: Array<{ value: unknown }>,
  configuredModel?: string
): string | undefined {
  const validModels = availableModels
    .map((model) => ({
      value: typeof model.value === 'string' ? model.value.trim() : '',
    }))
    .filter(
      (model): model is { value: string } =>
        isPlaygroundChatModelName(model.value)
    )
  const configured = configuredModel?.trim()
  if (configured && validModels.some((model) => model.value === configured)) {
    return configured
  }

  for (const preferredModel of FIRST_RUN_MODEL_PRIORITY) {
    const match = validModels.find((model) => model.value === preferredModel)
    if (match) return match.value
  }

  const flashGemini = validModels.find((model) => {
    const value = model.value.toLowerCase()
    return value.includes('gemini') && value.includes('flash')
  })
  if (flashGemini) return flashGemini.value

  const haiku = validModels.find((model) =>
    model.value.toLowerCase().includes('haiku')
  )
  if (haiku) return haiku.value

  return validModels[0]?.value
}
