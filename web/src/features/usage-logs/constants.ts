/**
 * Shared constants for usage logs feature
 */

// ============================================================================
// Log Type Enum
// ============================================================================

/**
 * Log type enum values
 */
export const LOG_TYPE_ENUM = {
  UNKNOWN: 0,
  TOPUP: 1,
  CONSUME: 2,
  MANAGE: 3,
  SYSTEM: 4,
  ERROR: 5,
} as const

// ============================================================================
// Time Range Presets
// ============================================================================

/**
 * Quick time range presets for filter dialog
 */
export const TIME_RANGE_PRESETS = [
  { days: 1, label: '24H' },
  { days: 7, label: '7D' },
  { days: 14, label: '14D' },
  { days: 30, label: '30D' },
] as const

// ============================================================================
// Common Logs Configuration
// ============================================================================

/**
 * Log types configuration for filtering and display
 */
export const LOG_TYPES = [
  { value: 0, label: 'All', color: 'default' },
  { value: 1, label: 'Top-up', color: 'cyan' },
  { value: 2, label: 'Consume', color: 'green' },
  { value: 3, label: 'Manage', color: 'orange' },
  { value: 4, label: 'System', color: 'purple' },
  { value: 5, label: 'Error', color: 'red' },
] as const

/**
 * Log types for DataTableToolbar filters (exclude 'All')
 */
export const LOG_TYPE_FILTERS = LOG_TYPES.slice(1).map((type) => ({
  label: type.label,
  value: String(type.value),
}))

// ============================================================================
// Drawing Logs (Midjourney) Constants
// ============================================================================

/**
 * Midjourney task types
 * Must match backend constants in constant/midjourney.go
 */
export const MJ_TASK_TYPES = {
  IMAGINE: 'IMAGINE', // 绘图
  UPSCALE: 'UPSCALE', // 放大
  VIDEO: 'VIDEO', // 视频
  EDITS: 'EDITS', // 编辑
  VARIATION: 'VARIATION', // 变换
  HIGH_VARIATION: 'HIGH_VARIATION', // 强变换
  LOW_VARIATION: 'LOW_VARIATION', // 弱变换
  PAN: 'PAN', // 平移
  DESCRIBE: 'DESCRIBE', // 图生文
  BLEND: 'BLEND', // 图混合
  UPLOAD: 'UPLOAD', // 上传文件
  SHORTEN: 'SHORTEN', // 缩词
  REROLL: 'REROLL', // 重绘
  INPAINT: 'INPAINT', // 局部重绘
  SWAP_FACE: 'SWAP_FACE', // 换脸
  ZOOM: 'ZOOM', // 缩放
  CUSTOM_ZOOM: 'CUSTOM_ZOOM', // 自定义缩放
  MODAL: 'MODAL', // 窗口
} as const

/**
 * Midjourney task status
 */
export const MJ_TASK_STATUS = {
  NOT_START: 'NOT_START', // 未启动
  SUBMITTED: 'SUBMITTED', // 队列中
  IN_PROGRESS: 'IN_PROGRESS', // 执行中
  SUCCESS: 'SUCCESS', // 成功
  FAILURE: 'FAILURE', // 失败
  MODAL: 'MODAL', // 窗口等待
} as const

// ============================================================================
// Task Logs Constants
// ============================================================================

/**
 * Task action types
 * Must match backend constants in constant/task.go
 */
export const TASK_ACTIONS = {
  // Suno (uppercase)
  MUSIC: 'MUSIC', // 生成音乐
  LYRICS: 'LYRICS', // 生成歌词

  // Video generation (camelCase)
  GENERATE: 'generate', // 图生视频
  TEXT_GENERATE: 'textGenerate', // 文生视频
  FIRST_TAIL_GENERATE: 'firstTailGenerate', // 首尾生视频
  REFERENCE_GENERATE: 'referenceGenerate', // 参照生视频
} as const

/**
 * Task status
 */
export const TASK_STATUS = {
  NOT_START: 'NOT_START', // 未启动
  SUBMITTED: 'SUBMITTED', // 队列中
  IN_PROGRESS: 'IN_PROGRESS', // 执行中
  SUCCESS: 'SUCCESS', // 成功
  FAILURE: 'FAILURE', // 失败
  QUEUED: 'QUEUED', // 排队中
  UNKNOWN: 'UNKNOWN', // 未知
} as const

/**
 * Task platforms
 */
export const TASK_PLATFORMS = {
  SUNO: 'suno',
  KLING: 'kling',
  RUNWAY: 'runway',
  LUMA: 'luma',
  VIGGLE: 'viggle',
} as const
