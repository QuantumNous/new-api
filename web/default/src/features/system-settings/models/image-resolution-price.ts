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
export type ImageResolutionPriceMap = Record<string, Record<string, number>>

const IMAGE_RESOLUTION_PATTERN = /^[1-9]\d*(?:K)?$/

export function normalizeImageResolution(resolution: string): string | null {
  const normalized = resolution.trim().toUpperCase()
  return IMAGE_RESOLUTION_PATTERN.test(normalized) ? normalized : null
}

export function isImageResolutionPriceMap(
  value: unknown
): value is ImageResolutionPriceMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const seenModels = new Set<string>()
  for (const [model, prices] of Object.entries(value)) {
    const normalizedModel = model.trim()
    if (
      normalizedModel.length === 0 ||
      seenModels.has(normalizedModel) ||
      typeof prices !== 'object' ||
      prices === null ||
      Array.isArray(prices)
    ) {
      return false
    }
    seenModels.add(normalizedModel)

    const seenResolutions = new Set<string>()
    for (const [resolution, price] of Object.entries(prices)) {
      const normalizedResolution = normalizeImageResolution(resolution)
      if (
        normalizedResolution === null ||
        seenResolutions.has(normalizedResolution) ||
        typeof price !== 'number' ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return false
      }
      seenResolutions.add(normalizedResolution)
    }
  }

  return true
}

export function removeImageResolutionPriceModel(
  prices: ImageResolutionPriceMap,
  modelName: string
): ImageResolutionPriceMap {
  return removeImageResolutionPriceModels(prices, [modelName])
}

export function removeImageResolutionPriceModels(
  prices: ImageResolutionPriceMap,
  modelNames: string[]
): ImageResolutionPriceMap {
  const normalizedNames = new Set(modelNames.map((name) => name.trim()))
  const nextPrices = Object.fromEntries(
    Object.entries(prices).filter(
      ([configuredModel]) => !normalizedNames.has(configuredModel.trim())
    )
  )
  return nextPrices
}

export function renameImageResolutionPriceModel(
  prices: ImageResolutionPriceMap,
  oldModelName: string,
  newModelName: string
): ImageResolutionPriceMap {
  const normalizedOldModelName = oldModelName.trim()
  const normalizedNewModelName = newModelName.trim()
  const sourceEntry = Object.entries(prices).find(
    ([modelName]) => modelName.trim() === normalizedOldModelName
  )

  if (
    sourceEntry === undefined ||
    normalizedOldModelName === normalizedNewModelName
  ) {
    return { ...prices }
  }

  const nextPrices = removeImageResolutionPriceModel(
    prices,
    normalizedOldModelName
  )
  nextPrices[normalizedNewModelName] = sourceEntry[1]
  return nextPrices
}
