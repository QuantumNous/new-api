export { DataTablePagination } from './pagination'
export { DataTableColumnHeader } from './column-header'
export { DataTableFacetedFilter } from './faceted-filter'
export { DataTableViewOptions } from './view-options'
export { DataTableToolbar } from './toolbar'
export { DataTableBulkActions } from './bulk-actions'
export { TableSkeleton } from './table-skeleton'
export { TableEmpty } from './table-empty'
export { MobileCardList } from './mobile-card-list'
export { DataTablePage, type DataTablePageProps } from './data-table-page'

export const DISABLED_ROW_DESKTOP =
  'bg-muted/85 hover:bg-muted [&>td:first-child]:border-l-muted-foreground/35 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1'

export const DISABLED_ROW_MOBILE =
  'border-l-4 border-l-muted-foreground/35 bg-muted/85'
