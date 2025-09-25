/**
 * 颜色相关工具函数
 * 包括字符串转颜色、模型颜色映射等
 */

// 基础颜色调色板
const baseColors = [
  'rgb(255,99,132)', // 红色
  'rgb(54,162,235)', // 蓝色
  'rgb(255,205,86)', // 黄色
  'rgb(75,192,192)', // 青色
  'rgb(153,102,255)', // 紫色
  'rgb(255,159,64)', // 橙色
  'rgb(199,199,199)', // 灰色
  'rgb(83,102,255)', // 靛色
]

// 扩展颜色调色板
const extendedColors = [
  ...baseColors,
  'rgb(255,192,203)', // 粉红色
  'rgb(255,160,122)', // 浅珊瑚色
  'rgb(219,112,147)', // 苍紫罗兰色
  'rgb(255,105,180)', // 热粉色
  'rgb(255,182,193)', // 浅粉红
  'rgb(255,140,0)', // 深橙色
  'rgb(255,165,0)', // 橙色
  'rgb(255,215,0)', // 金色
  'rgb(245,245,220)', // 米色
  'rgb(65,105,225)', // 皇家蓝
  'rgb(25,25,112)', // 午夜蓝
]

// Semi UI 标准颜色
const semiColors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
]

// 预定义模型颜色映射
const modelColorMap: Record<string, string> = {
  'gpt-3.5-turbo': 'rgb(16,163,127)',
  'gpt-3.5-turbo-0125': 'rgb(16,163,127)',
  'gpt-3.5-turbo-0301': 'rgb(16,163,127)',
  'gpt-3.5-turbo-0613': 'rgb(16,163,127)',
  'gpt-3.5-turbo-1106': 'rgb(16,163,127)',
  'gpt-3.5-turbo-16k': 'rgb(16,163,127)',
  'gpt-3.5-turbo-16k-0613': 'rgb(16,163,127)',
  'gpt-3.5-turbo-instruct': 'rgb(16,163,127)',
  'gpt-4': 'rgb(171,104,255)',
  'gpt-4-0125-preview': 'rgb(171,104,255)',
  'gpt-4-0314': 'rgb(171,104,255)',
  'gpt-4-0613': 'rgb(171,104,255)',
  'gpt-4-1106-preview': 'rgb(171,104,255)',
  'gpt-4-32k': 'rgb(171,104,255)',
  'gpt-4-32k-0314': 'rgb(171,104,255)',
  'gpt-4-32k-0613': 'rgb(171,104,255)',
  'gpt-4-turbo': 'rgb(171,104,255)',
  'gpt-4-turbo-2024-04-09': 'rgb(171,104,255)',
  'gpt-4-turbo-preview': 'rgb(171,104,255)',
  'gpt-4o': 'rgb(171,104,255)',
  'gpt-4o-2024-05-13': 'rgb(171,104,255)',
  'gpt-4o-2024-08-06': 'rgb(171,104,255)',
  'gpt-4o-mini': 'rgb(171,104,255)',
  'gpt-4o-mini-2024-07-18': 'rgb(171,104,255)',
  'claude-3-opus-20240229': 'rgb(255,132,31)',
  'claude-3-sonnet-20240229': 'rgb(253,135,93)',
  'claude-3-haiku-20240307': 'rgb(255,175,146)',
  'claude-2.1': 'rgb(255,209,190)',
}

/**
 * 将字符串转换为颜色（基于哈希算法）
 * @param str 输入字符串
 * @returns 颜色值
 */
export function stringToColor(str: string): string {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  const index = sum % semiColors.length
  return semiColors[index]
}

/**
 * 将字符串转换为RGB颜色（基于哈希算法）
 * @param str 输入字符串
 * @returns RGB颜色值
 */
export function stringToRgbColor(str: string): string {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  const index = sum % baseColors.length
  return baseColors[index]
}

/**
 * 根据模型名称获取颜色
 * @param modelName 模型名称
 * @returns 颜色值
 */
export function modelToColor(modelName: string): string {
  // 1. 如果模型在预定义的 modelColorMap 中，使用预定义颜色
  if (modelColorMap[modelName]) {
    return modelColorMap[modelName]
  }

  // 2. 生成一个稳定的数字作为索引
  let hash = 0
  for (let i = 0; i < modelName.length; i++) {
    hash = (hash << 5) - hash + modelName.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  hash = Math.abs(hash)

  // 3. 根据模型名称长度选择不同的色板
  const colorPalette = modelName.length > 10 ? extendedColors : baseColors

  // 4. 使用hash值选择颜色
  const index = hash % colorPalette.length
  return colorPalette[index]
}

/**
 * 根据比率获取颜色
 * @param ratio 比率值
 * @returns 颜色名称
 */
export function getRatioColor(ratio: number): string {
  if (ratio > 5) return 'red'
  if (ratio > 3) return 'orange'
  if (ratio > 1) return 'blue'
  return 'green'
}

/**
 * 根据分组名获取标签颜色
 * @param group 分组名称
 * @returns 颜色名称
 */
export function getGroupColor(group: string): string {
  const tagColors: Record<string, string> = {
    vip: 'yellow',
    pro: 'yellow',
    svip: 'red',
    premium: 'red',
  }

  return tagColors[group.toLowerCase()] || stringToColor(group)
}

/**
 * 生成十六进制颜色
 * @param str 输入字符串
 * @returns 十六进制颜色值
 */
export function generateHexColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    color += ('00' + value.toString(16)).substr(-2)
  }

  return color
}

/**
 * 检查颜色是否为深色
 * @param color 颜色值（hex格式）
 * @returns 是否为深色
 */
export function isDarkColor(color: string): boolean {
  // 移除 # 符号
  const hex = color.replace('#', '')

  // 解析RGB值
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)

  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  return brightness < 128
}
