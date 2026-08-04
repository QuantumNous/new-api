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
import { normalizeInterfaceLanguage } from '@/i18n/languages'

export type ContentTranslations = Record<
  string,
  Record<string, string | undefined> | undefined
>

export interface TranslatableContent {
  translations?: ContentTranslations
}

type Translate = (key: string) => string

export function getLocalizedField<
  Item extends object,
  Field extends keyof Item,
>(
  item: Item,
  field: Field,
  language?: string | null,
  translate?: Translate
): string {
  const locale = normalizeInterfaceLanguage(language)
  const translations = (item as TranslatableContent).translations
  const requested = translations?.[locale]?.[String(field)]?.trim()
  if (requested) return requested

  const english = translations?.en?.[String(field)]?.trim()
  if (english) return english

  const fallback = item[field]
  if (typeof fallback !== 'string') return ''
  return translate ? translate(fallback) : fallback
}
