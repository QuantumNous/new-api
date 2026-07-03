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

type YahooTagFn = (payload: {
  type: 'yjad_conversion'
  config: {
    yahoo_ydn_conv_io: string
    yahoo_ydn_conv_label: string
    yahoo_ydn_conv_transaction_id: string
    yahoo_ydn_conv_value: string
    yahoo_email?: string
    yahoo_phone_number?: string
  }
}) => void

declare global {
  interface Window {
    ytag?: YahooTagFn
  }
}

export function trackYahooApiKeyCreatedConversion(): void {
  if (typeof window === 'undefined' || typeof window.ytag !== 'function') {
    return
  }

  try {
    window.ytag({
      type: 'yjad_conversion',
      config: {
        yahoo_ydn_conv_io: 'Dz41bC3JfMG6OsI3rXzAdw..',
        yahoo_ydn_conv_label: 'SN1YX2683R54C0FZG61360132',
        yahoo_ydn_conv_transaction_id: '',
        yahoo_ydn_conv_value: '0',
      },
    })
  } catch {
    /* tracking must never break key creation UX */
  }
}

export function trackYahooSignupConversion(): void {
  if (typeof window === 'undefined' || typeof window.ytag !== 'function') {
    return
  }

  try {
    window.ytag({
      type: 'yjad_conversion',
      config: {
        yahoo_ydn_conv_io: 'Dz41bC3JfMG6OsI3rXzAdw..',
        yahoo_ydn_conv_label: '90OT1DQUJF9RHTGO631360311',
        yahoo_ydn_conv_transaction_id: '',
        yahoo_ydn_conv_value: '0',
        yahoo_email: '',
        yahoo_phone_number: '',
      },
    })
  } catch {
    /* tracking must never break signup UX */
  }
}
