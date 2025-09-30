/**
 * 清理过滤器对象，移除空值
 */
export function cleanFilters<T extends Record<string, any>>(
  filters: T
): Partial<T> {
  const cleaned: Partial<T> = {}

  for (const [key, value] of Object.entries(filters)) {
    // 跳过 undefined 和 null
    if (value === undefined || value === null) continue

    // 字符串类型：trim 后非空才保留
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        cleaned[key as keyof T] = trimmed as any
      }
      continue
    }

    // 其他类型直接保留
    cleaned[key as keyof T] = value
  }

  return cleaned
}

/**
 * 构建 API 查询参数
 */
export function buildQueryParams(
  timeRange: { start_timestamp: number; end_timestamp: number },
  filters?: {
    model_name?: string
    token_name?: string
    [key: string]: any
  }
) {
  return {
    ...timeRange,
    ...(filters?.model_name && { model_name: filters.model_name }),
    ...(filters?.token_name && { token_name: filters.token_name }),
  }
}
