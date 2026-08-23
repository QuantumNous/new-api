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

export const SEEDANCE_RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const

export type SeedanceResolution = (typeof SEEDANCE_RESOLUTIONS)[number]

export type SeedanceModelPrice = {
  text: Partial<Record<SeedanceResolution, number>>
  video: Partial<Record<SeedanceResolution, number>>
}

export type SeedancePriceTable = Record<string, SeedanceModelPrice>

export const DEFAULT_SEEDANCE_PRICES: SeedancePriceTable = {
  'doubao-seedance-2-0-260128': {
    text: { '480p': 46, '720p': 46, '1080p': 51, '4k': 26 },
    video: { '480p': 28, '720p': 28, '1080p': 31, '4k': 16 },
  },
  'doubao-seedance-2-0-fast-260128': {
    text: { '480p': 37, '720p': 37 },
    video: { '480p': 22, '720p': 22 },
  },
  'doubao-seedance-2-5-260628': {
    text: { '480p': 70, '720p': 70 },
    video: { '480p': 42, '720p': 42 },
  },
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
