/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { DifferencesMap, RatioDifference } from '../types'

export type PriceMatchKind = 'exact' | 'normalized' | 'fuzzy'

export type ModelPriceMatch = {
  sourceModel: string
  kind: PriceMatchKind
  score: number
  ratio: number
  completionRatio?: number
  cacheRatio?: number
}

const normalizeModelName = (name: string): string => {
  const unscopedName = name.toLowerCase().split('/').at(-1) ?? name
  return unscopedName.replaceAll(/[^a-z0-9]/g, '')
}

const bigrams = (value: string): Set<string> => {
  if (value.length < 2) return new Set([value])
  const pairs = new Set<string>()
  for (let index = 0; index < value.length - 1; index += 1) {
    pairs.add(value.slice(index, index + 2))
  }
  return pairs
}

const modelNameSimilarity = (target: string, candidate: string): number => {
  const normalizedTarget = normalizeModelName(target)
  const normalizedCandidate = normalizeModelName(candidate)
  if (!normalizedTarget || !normalizedCandidate) return 0
  if (normalizedTarget === normalizedCandidate) return 1

  const targetPairs = bigrams(normalizedTarget)
  const candidatePairs = bigrams(normalizedCandidate)
  let intersectionSize = 0
  for (const pair of targetPairs) {
    if (candidatePairs.has(pair)) intersectionSize += 1
  }
  return (2 * intersectionSize) / (targetPairs.size + candidatePairs.size)
}

const firstNumericUpstreamValue = (
  difference?: RatioDifference
): number | undefined => {
  for (const value of Object.values(difference?.upstreams ?? {})) {
    if (value === 'same') continue
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) return numericValue
  }
  return undefined
}

export function findModelPriceMatches(
  targetModel: string,
  differences: DifferencesMap,
  limit = 8
): ModelPriceMatch[] {
  const normalizedTarget = normalizeModelName(targetModel)

  return Object.entries(differences)
    .flatMap(([sourceModel, ratioDifferences]) => {
      const ratio = firstNumericUpstreamValue(ratioDifferences.model_ratio)
      if (ratio === undefined) return []

      const rawExact = sourceModel.toLowerCase() === targetModel.toLowerCase()
      const normalizedExact =
        normalizeModelName(sourceModel) === normalizedTarget
      const score = modelNameSimilarity(targetModel, sourceModel)
      if (!rawExact && !normalizedExact && score < 0.45) return []

      let kind: PriceMatchKind = 'fuzzy'
      if (rawExact) kind = 'exact'
      else if (normalizedExact) kind = 'normalized'

      return [
        {
          sourceModel,
          kind,
          score,
          ratio,
          completionRatio: firstNumericUpstreamValue(
            ratioDifferences.completion_ratio
          ),
          cacheRatio: firstNumericUpstreamValue(ratioDifferences.cache_ratio),
        },
      ]
    })
    .sort((left, right) => {
      const kindPriority: Record<PriceMatchKind, number> = {
        exact: 3,
        normalized: 2,
        fuzzy: 1,
      }
      return (
        kindPriority[right.kind] - kindPriority[left.kind] ||
        right.score - left.score ||
        left.sourceModel.localeCompare(right.sourceModel)
      )
    })
    .slice(0, limit)
}
