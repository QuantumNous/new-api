/**
 * 验证相关工具函数
 * 包括JSON验证、布尔值转换、数据校验等
 */

/**
 * 验证JSON字符串
 * @param str JSON字符串
 * @returns 是否为有效JSON
 */
export function verifyJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 验证JSON字符串（Promise版本）
 * @param value JSON字符串
 * @returns Promise，成功解析则resolve，否则reject
 */
export function verifyJSONPromise(value: string): Promise<void> {
  try {
    JSON.parse(value)
    return Promise.resolve()
  } catch (e) {
    return Promise.reject('不是合法的 JSON 字符串')
  }
}

/**
 * 布尔值转换
 * @param value 待转换的值
 * @returns 布尔值
 */
export function toBoolean(value: unknown): boolean {
  // 兼容字符串、数字以及布尔原生类型
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const v = value.toLowerCase()
    return v === 'true' || v === '1'
  }
  return false
}

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 是否为有效邮箱
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证URL格式
 * @param url URL地址
 * @returns 是否为有效URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 验证手机号格式（中国大陆）
 * @param phone 手机号
 * @returns 是否为有效手机号
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 密码强度等级 (weak|medium|strong)
 */
export function validatePasswordStrength(
  password: string
): 'weak' | 'medium' | 'strong' {
  if (password.length < 6) return 'weak'

  let score = 0

  // 长度检查
  if (password.length >= 8) score++
  if (password.length >= 12) score++

  // 字符类型检查
  if (/[a-z]/.test(password)) score++ // 小写字母
  if (/[A-Z]/.test(password)) score++ // 大写字母
  if (/\d/.test(password)) score++ // 数字
  if (/[^a-zA-Z0-9]/.test(password)) score++ // 特殊字符

  if (score <= 2) return 'weak'
  if (score <= 4) return 'medium'
  return 'strong'
}

/**
 * 验证IP地址格式
 * @param ip IP地址
 * @returns 是否为有效IP地址
 */
export function isValidIP(ip: string): boolean {
  const ipv4Regex =
    /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/

  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * 验证端口号
 * @param port 端口号
 * @returns 是否为有效端口号
 */
export function isValidPort(port: number | string): boolean {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535
}

/**
 * 验证域名格式
 * @param domain 域名
 * @returns 是否为有效域名
 */
export function isValidDomain(domain: string): boolean {
  const domainRegex =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/
  return domainRegex.test(domain)
}

/**
 * 验证用户名格式
 * @param username 用户名
 * @returns 是否为有效用户名
 */
export function isValidUsername(username: string): boolean {
  // 3-20位字母、数字、下划线、横线
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
  return usernameRegex.test(username)
}

/**
 * 验证API Key格式
 * @param apiKey API密钥
 * @returns 是否为有效API Key
 */
export function isValidApiKey(apiKey: string): boolean {
  // 基本格式验证：至少20位字符，包含字母和数字
  if (apiKey.length < 20) return false

  // 检查是否包含字母和数字
  const hasLetter = /[a-zA-Z]/.test(apiKey)
  const hasNumber = /\d/.test(apiKey)

  return hasLetter && hasNumber
}

/**
 * 验证模型名称格式
 * @param modelName 模型名称
 * @returns 是否为有效模型名称
 */
export function isValidModelName(modelName: string): boolean {
  // 允许字母、数字、横线、下划线、点号
  const modelNameRegex = /^[a-zA-Z0-9._-]+$/
  return modelNameRegex.test(modelName) && modelName.length > 0
}

/**
 * 验证数值范围
 * @param value 数值
 * @param min 最小值
 * @param max 最大值
 * @returns 是否在有效范围内
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * 验证正整数
 * @param value 值
 * @returns 是否为正整数
 */
export function isPositiveInteger(value: unknown): boolean {
  const num = typeof value === 'string' ? parseInt(value, 10) : value
  return typeof num === 'number' && Number.isInteger(num) && num > 0
}

/**
 * 验证非负数
 * @param value 值
 * @returns 是否为非负数
 */
export function isNonNegativeNumber(value: unknown): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return typeof num === 'number' && !isNaN(num) && num >= 0
}

/**
 * 深度比较两个对象
 * @param obj1 对象1
 * @param obj2 对象2
 * @returns 是否相等
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true

  if (obj1 == null || obj2 == null) return false

  if (typeof obj1 !== typeof obj2) return false

  if (typeof obj1 !== 'object') return obj1 === obj2

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (!keys2.includes(key)) return false
    if (!deepEqual(obj1[key], obj2[key])) return false
  }

  return true
}

/**
 * 清理和验证文本输入
 * @param text 输入文本
 * @param maxLength 最大长度
 * @returns 清理后的文本
 */
export function sanitizeText(text: string, maxLength?: number): string {
  if (!text) return ''

  // 移除多余的空白字符
  let cleaned = text.trim().replace(/\s+/g, ' ')

  // 限制长度
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength)
  }

  return cleaned
}
