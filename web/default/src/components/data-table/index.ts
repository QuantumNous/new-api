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
export { DataTablePagination } from './core/pagination'
export { DataTableColumnHeader } from './core/column-header'
export { BadgeCell } from './core/badge-cell'
export { BadgeListCell } from './core/badge-list-cell'
export { TruncatedCell } from './core/truncated-cell'
export { DataTableViewOptions } from './toolbar/view-options'
export { DataTableToolbar } from './toolbar/toolbar'
export { DataTableBulkActions } from './toolbar/bulk-actions'
export {
  StaticDataTable,
  type StaticDataTableColumn,
} from './static/static-data-table'
export { staticDataTableClassNames } from './static/static-data-table-classnames'
export {
  DataTableRow,
  DataTableView,
  type DataTableColumnClassName,
  type DataTablePinnedColumn,
  type DataTableRenderRowHelpers,
} from './core/data-table-view'
export { MobileCardList } from './layout/mobile-card-list'
export {
  DataTableCardGrid,
  type DataTableCardGridProps,
  type DataTableCardHelpers,
} from './layout/card-grid'
export { CardRowContent } from './layout/card-row-content'
export { tableHasCompactMeta } from './layout/card-cell-utils'
export {
  DataTablePage,
  type DataTablePageProps,
} from './layout/data-table-page'
export {
  DataTableViewModeToggle,
  type DataTableViewModeToggleProps,
} from './toolbar/view-mode-toggle'
export { useDataTable } from './hooks/use-data-table'
export {
  useDataTableViewMode,
  DATA_TABLE_VIEW_MODES,
  type DataTableViewMode,
} from './hooks/use-data-table-view-mode'
export { useDebouncedColumnFilter } from './hooks/use-debounced-column-filter'

export const DISABLED_ROW_DESKTOP =
  'bg-muted/85 hover:bg-muted [&>td:first-child]:border-l-muted-foreground/35 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1'

export const DISABLED_ROW_MOBILE =
  'border-l-4 border-l-muted-foreground/35 bg-muted/85'
