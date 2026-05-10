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
import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // Extended column metadata for enhanced table functionality
  interface ColumnMeta<_TData, _TValue> {
    // Human-readable label for the column
    label?: string
    // Optional description shown in tooltips or help text
    description?: string
    // Whether this column can be sorted (overrides default behavior)
    sortable?: boolean
    // Custom CSS classes to apply to the column cells
    className?: string
  }
}
