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
export type StripeCheckoutCurrency = 'USD' | 'JPY' | 'BRL'

export function getStripeCheckoutCurrencyForLanguage(
  language: string | undefined
): StripeCheckoutCurrency {
  const normalized = language?.trim().toLowerCase().replace('_', '-') ?? ''

  if (normalized === 'ja' || normalized.startsWith('ja-')) {
    return 'JPY'
  }

  if (normalized === 'pt' || normalized.startsWith('pt-')) {
    return 'BRL'
  }

  return 'USD'
}
