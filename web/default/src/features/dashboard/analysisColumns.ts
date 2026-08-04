export const ANALYSIS_TABLE_DIMENSION_ORDER = [
  'period',
  'username',
  'model_name',
  'token_name',
  'group',
  'channel',
] as const

export type AnalysisTableDimension =
  (typeof ANALYSIS_TABLE_DIMENSION_ORDER)[number]

const ADMIN_ONLY_DIMENSIONS = new Set<AnalysisTableDimension>([
  'username',
  'channel',
])

export function getAnalysisTableDimensions(
  isAdmin: boolean,
  dimensions: readonly string[] | undefined
): AnalysisTableDimension[] {
  const selected = new Set(dimensions ?? [])
  return ANALYSIS_TABLE_DIMENSION_ORDER.filter(
    (dimension) =>
      selected.has(dimension) &&
      (isAdmin || !ADMIN_ONLY_DIMENSIONS.has(dimension))
  )
}
