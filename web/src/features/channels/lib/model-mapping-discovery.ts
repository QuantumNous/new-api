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
import { normalizeModelName } from './model-mapping-validation'

function normalizeModelNameList(models: readonly string[]): string[] {
  return [
    ...new Set(
      models.map((model) => normalizeModelName(model)).filter(Boolean)
    ),
  ]
}

export function mergeDiscoveredModelMapping(
  currentValue: string | null | undefined,
  discoveredMapping: Record<string, string>,
  selectedModels: readonly string[],
  previousModels: readonly string[]
): string {
  let currentMapping: Record<string, string> = {}
  try {
    const parsed = JSON.parse(currentValue || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      currentMapping = Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] =>
            typeof entry[1] === 'string' &&
            entry[0].trim() !== '' &&
            entry[1].trim() !== ''
        )
      )
    }
  } catch {
    currentMapping = {}
  }

  const selectedSet = new Set(normalizeModelNameList(selectedModels))
  const previousSet = new Set(normalizeModelNameList(previousModels))
  const nextMapping = { ...currentMapping }

  for (const [source, target] of Object.entries(discoveredMapping)) {
    const normalizedSource = normalizeModelName(source)
    const normalizedTarget = target.trim()
    if (
      normalizedSource &&
      normalizedTarget &&
      selectedSet.has(normalizedSource)
    ) {
      nextMapping[normalizedSource] = normalizedTarget
    }
  }

  for (const [source, target] of Object.entries(nextMapping)) {
    if (
      previousSet.has(source) &&
      !selectedSet.has(source) &&
      target.trim().startsWith('ep-')
    ) {
      delete nextMapping[source]
    }
  }

  return JSON.stringify(nextMapping, null, 2)
}
