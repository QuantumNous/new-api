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
type OptionCasBaselines<T extends object> = {
  -readonly [K in keyof T]: string
}

export function createOptionCasBaselines<T extends object>(
  values: T
): OptionCasBaselines<T> {
  const baselines = {} as OptionCasBaselines<T>
  for (const key of Object.keys(values) as Array<keyof T>) {
    baselines[key] = String(values[key])
  }
  return baselines
}

export function advanceOptionCasBaselines<T extends object>(
  current: OptionCasBaselines<T>,
  changedKeys: Array<keyof T>,
  nextValues: T
): OptionCasBaselines<T> {
  const baselines = { ...current }
  for (const key of changedKeys) {
    baselines[key] = String(nextValues[key])
  }
  return baselines
}
