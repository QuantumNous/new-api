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
