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
export const SEEDANCE_PRICE_OPTION_KEY = 'seedance_price_setting.prices'
export const SEEDANCE_SUPER_RESOLUTION_OPTION_KEY =
  'seedance_price_setting.super_resolution'

export const SEEDANCE_RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const
export const SEEDANCE_FRAME_RATE = 24

export type SeedanceResolution = (typeof SEEDANCE_RESOLUTIONS)[number]

export type SeedanceModelPrice = {
  text: Partial<Record<SeedanceResolution, number>>
  video: Partial<Record<SeedanceResolution, number>>
}

export type SeedancePriceTable = Record<string, SeedanceModelPrice>

export type SeedanceSuperResolutionPrice = {
  '480_to_720': number
  '720_to_1080': number
}

export const SEEDANCE_PIXELS: Record<
  SeedanceResolution,
  { width: number; height: number }
> = {
  '480p': { width: 864, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
}

export const DEFAULT_SEEDANCE_PRICES: SeedancePriceTable = {
  'doubao-seedance-2-0-260128': {
    text: { '480p': 69, '720p': 69, '1080p': 76.5, '4k': 39 },
    video: { '480p': 42, '720p': 42, '1080p': 46.5, '4k': 24 },
  },
  'doubao-seedance-2-0-fast-260128': {
    text: { '480p': 55.5, '720p': 55.5 },
    video: { '480p': 33, '720p': 33 },
  },
  'doubao-seedance-2-5-260628': {
    text: { '480p': 105, '720p': 105 },
    video: { '480p': 63, '720p': 63 },
  },
}

export const DEFAULT_SEEDANCE_SUPER_RESOLUTION: SeedanceSuperResolutionPrice = {
  '480_to_720': 0.02,
  '720_to_1080': 0.04,
}

export function seedanceTokensPerSecond(resolution: SeedanceResolution) {
  const size = SEEDANCE_PIXELS[resolution]
  return (size.width * size.height * SEEDANCE_FRAME_RATE) / 1024
}

export function seedancePerSecondRMB(
  unitPriceRMB: number,
  resolution: SeedanceResolution
) {
  if (!Number.isFinite(unitPriceRMB) || unitPriceRMB <= 0) return 0
  return (seedanceTokensPerSecond(resolution) / 1_000_000) * unitPriceRMB
}

export function hasSeedancePricing(
  modelName: string,
  table: SeedancePriceTable
) {
  const name = modelName.trim()
  if (!name) return false
  if (table[name]) return true
  return Object.keys(table).some(
    (key) =>
      name === key || name.startsWith(`${key}-`) || name.startsWith(`${key}_`)
  )
}

export function parseSeedanceSuperResolution(
  rawValue: string | undefined
): SeedanceSuperResolutionPrice {
  if (!rawValue?.trim()) return { ...DEFAULT_SEEDANCE_SUPER_RESOLUTION }
  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_SEEDANCE_SUPER_RESOLUTION }
    }
    const record = parsed as Record<string, unknown>
    const from480 = Number(record['480_to_720'])
    const from720 = Number(record['720_to_1080'])
    return {
      '480_to_720':
        Number.isFinite(from480) && from480 >= 0
          ? from480
          : DEFAULT_SEEDANCE_SUPER_RESOLUTION['480_to_720'],
      '720_to_1080':
        Number.isFinite(from720) && from720 >= 0
          ? from720
          : DEFAULT_SEEDANCE_SUPER_RESOLUTION['720_to_1080'],
    }
  } catch {
    return { ...DEFAULT_SEEDANCE_SUPER_RESOLUTION }
  }
}

export type SeedancePriceRow = {
  id: number
  model: string
  text: Record<SeedanceResolution, string>
  video: Record<SeedanceResolution, string>
}

function emptyResolutionValues(): Record<SeedanceResolution, string> {
  return {
    '480p': '',
    '720p': '',
    '1080p': '',
    '4k': '',
  }
}

function valuesFromPriceMap(
  prices?: Partial<Record<SeedanceResolution, number>>
): Record<SeedanceResolution, string> {
  const values = emptyResolutionValues()
  for (const resolution of SEEDANCE_RESOLUTIONS) {
    const price = prices?.[resolution]
    if (typeof price === 'number' && Number.isFinite(price) && price >= 0) {
      values[resolution] = String(price)
    }
  }
  return values
}

export function parseSeedancePriceCell(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const price = Number(trimmed)
  if (!Number.isFinite(price) || price < 0) return null
  return price
}

function priceMapFromValues(
  values: Record<SeedanceResolution, string>
): Partial<Record<SeedanceResolution, number>> {
  const prices: Partial<Record<SeedanceResolution, number>> = {}
  for (const resolution of SEEDANCE_RESOLUTIONS) {
    const price = parseSeedancePriceCell(values[resolution])
    if (price === null) continue
    prices[resolution] = price
  }
  return prices
}

export function tableToRows(table: SeedancePriceTable): SeedancePriceRow[] {
  return Object.entries(table).map(([model, price], index) => ({
    id: index + 1,
    model,
    text: valuesFromPriceMap(price.text),
    video: valuesFromPriceMap(price.video),
  }))
}

export function rowsToTable(rows: SeedancePriceRow[]): SeedancePriceTable {
  const table: SeedancePriceTable = {}
  for (const row of rows) {
    const model = row.model.trim()
    if (!model) continue
    table[model] = {
      text: priceMapFromValues(row.text),
      video: priceMapFromValues(row.video),
    }
  }
  return table
}

export function parseSeedancePriceTable(rawValue: string | undefined) {
  if (!rawValue?.trim()) return { ...DEFAULT_SEEDANCE_PRICES }
  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_SEEDANCE_PRICES }
    }
    const table: SeedancePriceTable = {}
    for (const [model, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const name = model.trim()
      if (
        !name ||
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
      ) {
        continue
      }
      const record = value as Record<string, unknown>
      table[name] = {
        text: priceMapFromValues(
          valuesFromPriceMap(isPriceMap(record.text) ? record.text : undefined)
        ),
        video: priceMapFromValues(
          valuesFromPriceMap(
            isPriceMap(record.video) ? record.video : undefined
          )
        ),
      }
    }
    if (Object.keys(table).length === 0) return { ...DEFAULT_SEEDANCE_PRICES }
    return table
  } catch {
    return { ...DEFAULT_SEEDANCE_PRICES }
  }
}

function isPriceMap(
  value: unknown
): value is Partial<Record<SeedanceResolution, number>> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function createEmptySeedanceRow(id: number): SeedancePriceRow {
  return {
    id,
    model: '',
    text: emptyResolutionValues(),
    video: emptyResolutionValues(),
  }
}

export function rowHasInvalidPrice(row: SeedancePriceRow) {
  return SEEDANCE_RESOLUTIONS.some(
    (resolution) =>
      (row.text[resolution].trim() !== '' &&
        parseSeedancePriceCell(row.text[resolution]) === null) ||
      (row.video[resolution].trim() !== '' &&
        parseSeedancePriceCell(row.video[resolution]) === null)
  )
}
