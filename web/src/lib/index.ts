/**
 * 工具函数统一导出
 * 提供便捷的导入方式
 */

// 通用工具
export { cn, sleep, getPageNumbers } from './utils'

// 颜色工具
export {
  stringToColor,
  stringToRgbColor,
  modelToColor,
  getRatioColor,
  getGroupColor,
  generateHexColor,
  isDarkColor,
} from './colors'

// 格式化工具
export {
  timestamp2string,
  timestamp2string1,
  getRelativeTime,
  formatDateString,
  formatDateTimeString,
  renderText,
  formatQuota,
  formatNumber,
  formatTokens,
  formatPercentage,
  formatBytes,
  getTodayStartTimestamp,
  removeTrailingSlash,
  formatPrice,
  formatApiCalls,
  truncateText,
  formatCurrency,
  formatChartTimestamp,
  formatValue,
  formatBalance,
  calculateUsagePercentage,
} from './formatters'

// 验证工具
export {
  verifyJSON,
  verifyJSONPromise,
  toBoolean,
  isValidEmail,
  isValidUrl,
  isValidPhone,
  validatePasswordStrength,
  isValidIP,
  isValidPort,
  isValidDomain,
  isValidUsername,
  isValidApiKey,
  isValidModelName,
  isInRange,
  isPositiveInteger,
  isNonNegativeNumber,
  deepEqual,
  sanitizeText,
} from './validators'

// 剪贴板工具
export {
  copy,
  paste,
  isClipboardSupported,
  copyJSON,
  copyAsCSV,
  copyLink,
  copyCode,
} from './clipboard'

// 对象比较工具
export {
  compareObjects,
  getDifference,
  deepMerge,
  deepClone,
  isEmpty,
  pick,
  omit,
  flatten,
  unflatten,
} from './comparisons'

// 认证相关
export {
  setStoredUser,
  getStoredUser,
  getStoredUserId,
  clearStoredUser,
  isAdmin,
} from './auth'

// Cookie相关
export { setCookie, getCookie, removeCookie } from './cookies'

// HTTP客户端
export { http } from './http'

// 错误处理
export { handleServerError } from './handle-server-error'
