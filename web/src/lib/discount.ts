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

// A settlement discount is a fraction of the list price: greater than 0 and at
// most 1, with at most 4 decimal places. It is judged on the text so a long
// fraction is never rounded into range. A comma is accepted as the decimal
// separator, since some keyboards offer no dot.
export function parseDiscountText(value: string): number {
  return Number(value.replace(',', '.'))
}

export function isValidDiscountText(value: string): boolean {
  if (!/^(?:0(?:[.,]\d{1,4})?|1(?:[.,]0{1,4})?)$/.test(value)) return false
  return parseDiscountText(value) > 0
}
