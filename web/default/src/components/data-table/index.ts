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
export {
  BadgeListCellDisplayContext,
  type BadgeListCellDisplay,
} from './core/badge-list-cell-context'
export { TruncatedCell } from './core/truncated-cell'
export { DataTableViewOptions } from './toolbar/view-options'
export { DataTableToolbar } from './toolbar/toolbar'
export { DataTableRefreshControl } from './toolbar/refresh-control'
export {
  DataTableFilterField,
  DataTableFilterInput,
  DataTableFilterPanel,
  type DataTableFilterPanelProps,
} from './toolbar/filter-panel'
export { DataTableBulkActions } from './toolbar/bulk-actions'
export {
  StaticDataTable,
  type StaticDataTableColumn,
} from './static/static-data-table'
export { StaticRowActions } from './static/static-row-actions'
export { staticDataTableClassNames } from './static/static-data-table-classnames'
export {
  DataTableRow,
  DataTableRowActionMenu,
  DataTableView,
  type DataTableColumnClassName,
  type DataTablePinnedColumn,
  type DataTableRenderRowHelpers,
} from './core/data-table-view'
export {
  MobileCardList,
  type MobileCardListProps,
} from './layout/mobile-card-list'
export {
  DataTableCardGrid,
  type DataTableCardGridProps,
  type DataTableCardHelpers,
} from './layout/card-grid'
export { CardRowContent } from './layout/card-row-content'
export {
  DataTableCardField,
  DataTableCardRow,
  type DataTableContentMode,
} from './layout/card-field'
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

// Shared "status row" treatment: tinted background with a hover step and a
// 4px accent stripe on the first cell (desktop), tinted background only
// (mobile cards). The palette classes below just bind the three CSS
// variables, so every status row is structurally identical — only the hue
// changes (disabled = gray, error = red, info = blue, warning = amber).
const STATUS_ROW_DESKTOP =
  '[background-color:var(--status-row-bg)] hover:[background-color:var(--status-row-bg-hover)] [--data-table-card-bg:var(--status-row-bg)] hover:[--data-table-card-bg:var(--status-row-bg-hover)] data-[state=selected]:![--data-table-card-bg:var(--status-row-bg)] data-[state=selected]:hover:![--data-table-card-bg:var(--status-row-bg-hover)] [&>td:first-child]:[border-left-color:var(--status-row-border)] [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1'

const STATUS_ROW_MOBILE =
  '[background-color:var(--status-row-bg)] [--data-table-card-bg:var(--status-row-bg)] data-[state=selected]:![--data-table-card-bg:var(--status-row-bg)]'

const DISABLED_PALETTE =
  '[--status-row-bg:var(--table-disabled)] [--status-row-bg-hover:var(--table-disabled-hover)] [--status-row-border:var(--table-disabled-border)]'
const ERROR_PALETTE =
  '[--status-row-bg:var(--table-error)] [--status-row-bg-hover:var(--table-error-hover)] [--status-row-border:var(--table-error-border)]'
const INFO_PALETTE =
  '[--status-row-bg:var(--table-info)] [--status-row-bg-hover:var(--table-info-hover)] [--status-row-border:var(--table-info-border)]'
const WARNING_PALETTE =
  '[--status-row-bg:var(--table-warning)] [--status-row-bg-hover:var(--table-warning-hover)] [--status-row-border:var(--table-warning-border)]'

export const DISABLED_ROW_DESKTOP = `${STATUS_ROW_DESKTOP} ${DISABLED_PALETTE}`
export const DISABLED_ROW_MOBILE = `${STATUS_ROW_MOBILE} ${DISABLED_PALETTE}`
export const ERROR_ROW_DESKTOP = `${STATUS_ROW_DESKTOP} ${ERROR_PALETTE}`
export const ERROR_ROW_MOBILE = `${STATUS_ROW_MOBILE} ${ERROR_PALETTE}`
export const INFO_ROW_DESKTOP = `${STATUS_ROW_DESKTOP} ${INFO_PALETTE}`
export const INFO_ROW_MOBILE = `${STATUS_ROW_MOBILE} ${INFO_PALETTE}`
export const WARNING_ROW_DESKTOP = `${STATUS_ROW_DESKTOP} ${WARNING_PALETTE}`
export const WARNING_ROW_MOBILE = `${STATUS_ROW_MOBILE} ${WARNING_PALETTE}`
