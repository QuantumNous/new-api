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
export { DataTablePagination } from './pagination'
export { DataTableColumnHeader } from './column-header'
export { DataTableViewOptions } from './view-options'
export { DataTableToolbar } from './toolbar'
export { DataTableBulkActions } from './bulk-actions'
export {
  StaticDataTable,
  StaticDataTableEmptyRow,
  type StaticDataTableColumn,
} from './static-data-table'
export { staticDataTableClassNames } from './static-data-table-classnames'
export {
  DataTableRow,
  DataTableView,
  type DataTableColumnClassName,
  type DataTablePinnedColumn,
  type DataTableRenderRowHelpers,
  type DataTableViewProps,
} from './data-table-view'
export { MobileCardList } from './mobile-card-list'
export { DataTablePage, type DataTablePageProps } from './data-table-page'
export { useDataTable } from './use-data-table'
export { useDebouncedColumnFilter } from './use-debounced-column-filter'

export const DISABLED_ROW_DESKTOP =
  'bg-muted/85 hover:bg-muted [&>td:first-child]:border-l-muted-foreground/35 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1'

export const DISABLED_ROW_MOBILE =
  'border-l-4 border-l-muted-foreground/35 bg-muted/85'
