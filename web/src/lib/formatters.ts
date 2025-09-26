/**
 * 格式化相关工具函数
 * 包括时间、数字、文本、价格等格式化函数
 */

/**
 * 时间戳转字符串
 * @param timestamp 时间戳（秒）
 * @returns 格式化的时间字符串
 */
export function timestamp2string(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const second = date.getSeconds().toString().padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 时间戳转简化字符串（用于图表）
 * @param timestamp 时间戳（秒）
 * @param granularity 时间粒度
 * @returns 格式化的时间字符串
 */
export function timestamp2string1(
  timestamp: number,
  granularity: 'hour' | 'day' | 'week' = 'hour'
): string {
  const date = new Date(timestamp * 1000)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')

  let str = `${month}-${day}`

  if (granularity === 'hour') {
    str += ` ${hour}:00`
  } else if (granularity === 'week') {
    const nextWeek = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000)
    const nextMonth = (nextWeek.getMonth() + 1).toString().padStart(2, '0')
    const nextDay = nextWeek.getDate().toString().padStart(2, '0')
    str += ` - ${nextMonth}-${nextDay}`
  }

  return str
}

/**
 * 计算相对时间（几天前、几小时前等）
 * @param publishDate 发布日期
 * @returns 相对时间描述
 */
export function getRelativeTime(publishDate: string | number | Date): string {
  if (!publishDate) return ''

  const now = new Date()
  const pubDate = new Date(publishDate)

  // 如果日期无效，返回原始字符串
  if (isNaN(pubDate.getTime())) return publishDate.toString()

  const diffMs = now.getTime() - pubDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // 如果是未来时间，显示具体日期
  if (diffMs < 0) {
    return formatDateString(pubDate)
  }

  // 根据时间差返回相应的描述
  if (diffSeconds < 60) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  if (diffWeeks < 4) return `${diffWeeks} 周前`
  if (diffMonths < 12) return `${diffMonths} 个月前`
  if (diffYears < 2) return '1 年前'

  // 超过2年显示具体日期
  return formatDateString(pubDate)
}

/**
 * 格式化日期字符串
 * @param date 日期对象
 * @returns 格式化的日期字符串
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化日期时间字符串（包含时间）
 * @param date 日期对象
 * @returns 格式化的日期时间字符串
 */
export function formatDateTimeString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 截断文本
 * @param text 原始文本
 * @param limit 长度限制
 * @returns 截断后的文本
 */
export function renderText(text: string, limit: number): string {
  if (!text) return ''
  if (text.length > limit) {
    return text.slice(0, limit - 3) + '...'
  }
  return text
}

/**
 * 格式化配额（金额）
 * @param quota 配额值
 * @returns 格式化的配额字符串
 */
export function formatQuota(quota: number): string {
  if (quota >= 1000000) {
    return `$${(quota / 1000000).toFixed(1)}M`
  } else if (quota >= 1000) {
    return `$${(quota / 1000).toFixed(1)}K`
  } else {
    return `$${quota.toFixed(2)}`
  }
}

/**
 * 格式化数字（带单位）
 * @param value 数值
 * @returns 格式化的数字字符串
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  } else {
    return value.toString()
  }
}

/**
 * 格式化Token数量
 * @param tokens Token数量
 * @returns 格式化的Token字符串
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  } else {
    return tokens.toString()
  }
}

/**
 * 格式化百分比
 * @param value 数值
 * @param total 总数
 * @param precision 精度
 * @returns 格式化的百分比字符串
 */
export function formatPercentage(
  value: number,
  total: number,
  precision: number = 1
): string {
  if (total === 0) return '0.0%'
  const percentage = (value / total) * 100
  return `${percentage.toFixed(precision)}%`
}

/**
 * 格式化字节大小
 * @param bytes 字节数
 * @returns 格式化的大小字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 获取今天开始时间戳
 * @returns 今天0点的时间戳（秒）
 */
export function getTodayStartTimestamp(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.floor(now.getTime() / 1000)
}

/**
 * 移除URL尾部斜杠
 * @param url URL字符串
 * @returns 处理后的URL
 */
export function removeTrailingSlash(url: string): string {
  if (!url) return ''
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * 格式化模型价格
 * @param price 价格值
 * @param currency 货币类型
 * @param precision 精度
 * @returns 格式化的价格字符串
 */
export function formatPrice(
  price: number,
  currency: 'USD' | 'CNY' = 'USD',
  precision: number = 4
): string {
  const symbol = currency === 'CNY' ? '¥' : '$'
  return `${symbol}${price.toFixed(precision)}`
}

/**
 * 格式化API调用次数
 * @param count 调用次数
 * @returns 格式化的次数字符串
 */
export function formatApiCalls(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M calls`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K calls`
  } else {
    return `${count} calls`
  }
}

/**
 * 截断文本（考虑移动端）
 * @param text 原始文本
 * @param maxWidth 最大宽度
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxWidth: number = 200): string {
  const isMobileScreen = window.matchMedia('(max-width: 767px)').matches
  if (!isMobileScreen || !text) return text

  // 简化版本：基于字符长度估算
  const estimatedCharWidth = 14 // 假设每个字符14px宽
  const maxChars = Math.floor(maxWidth / estimatedCharWidth)

  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 3) + '...'
}

/**
 * 格式化货币（通用版本）
 * @param value 数值
 * @returns 格式化的货币字符串
 */
export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

/**
 * 格式化时间戳为图表标签
 * @param timestamp 时间戳（秒）
 * @returns 格式化的时间字符串
 */
export function formatChartTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * 通用数值格式化函数（支持不同类型）
 * @param value 数值
 * @param type 类型：quota（配额）、tokens（令牌）、count（计数）
 * @returns 格式化的字符串
 */
export function formatValue(
  value: number,
  type: 'quota' | 'tokens' | 'count'
): string {
  switch (type) {
    case 'quota':
      return formatCurrency(value)
    case 'tokens':
      return formatTokens(value)
    case 'count':
      return formatNumber(value)
    default:
      return value.toString()
  }
}

/**
 * 格式化余额（配额减去已使用）
 * @param quota 总配额
 * @param usedQuota 已使用配额
 * @returns 格式化的余额字符串
 */
export function formatBalance(quota: number, usedQuota: number): string {
  const remaining = Math.max(0, quota - usedQuota)
  return formatCurrency(remaining)
}

/**
 * 计算配额使用百分比
 * @param quota 总配额
 * @param usedQuota 已使用配额
 * @returns 使用百分比（0-100）
 */
export function calculateUsagePercentage(
  quota: number,
  usedQuota: number
): number {
  if (quota <= 0) return 0
  return Math.min(100, (usedQuota / quota) * 100)
}
