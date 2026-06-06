export const DEFAULT_PAGE_SIZE = 20

export function getDefaultDateRange(): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { start, end }
}
