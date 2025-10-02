/**
 * Log types configuration for filtering and display
 */
export const logTypes = [
  { value: 0, label: 'All', color: 'default' },
  { value: 1, label: 'Top-up', color: 'cyan' },
  { value: 2, label: 'Consume', color: 'green' },
  { value: 3, label: 'Manage', color: 'orange' },
  { value: 4, label: 'System', color: 'purple' },
  { value: 5, label: 'Error', color: 'red' },
] as const

/**
 * Quick time range presets for filter dialog
 */
export const TIME_RANGE_PRESETS = [
  { days: 1, label: '24H' },
  { days: 7, label: '7D' },
  { days: 14, label: '14D' },
  { days: 30, label: '30D' },
] as const
