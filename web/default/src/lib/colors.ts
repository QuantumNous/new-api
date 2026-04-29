export type SemanticColor =
  | 'blue'
  | 'green'
  | 'cyan'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'light-green'
  | 'teal'
  | 'light-blue'
  | 'indigo'
  | 'violet'
  | 'grey'

export const colorToBgClass: Record<SemanticColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  cyan: 'bg-cyan-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-500',
  lime: 'bg-lime-500',
  'light-green': 'bg-green-400',
  teal: 'bg-teal-500',
  'light-blue': 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  grey: 'bg-gray-500',
}

export const avatarColorMap: Record<SemanticColor, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  lime: 'bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-400',
  'light-green': 'bg-green-50 text-green-600 dark:bg-green-400/20 dark:text-green-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
  'light-blue': 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  grey: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
}

export function getAvatarColorClass(name: string): string {
  return avatarColorMap[stringToColor(name)]
}

export function getBgColorClass(color?: string): string {
  if (!color) return colorToBgClass.blue
  return (
    (colorToBgClass as Record<string, string>)[color] || colorToBgClass.blue
  )
}

/**
 * Chart color palette - Modern gradient colors compatible with light/dark themes
 * Uses HSL format for better theme adaptation
 */
export const CHART_COLORS = [
  'hsl(217, 91%, 60%)', // blue
  'hsl(142, 76%, 36%)', // green
  'hsl(38, 92%, 50%)', // amber
  'hsl(258, 90%, 66%)', // violet
  'hsl(330, 81%, 60%)', // pink
  'hsl(189, 94%, 43%)', // cyan
  'hsl(25, 95%, 53%)', // orange
  'hsl(239, 84%, 67%)', // indigo
  'hsl(173, 80%, 40%)', // teal
  'hsl(271, 91%, 65%)', // purple
  'hsl(199, 89%, 48%)', // sky
  'hsl(280, 65%, 60%)', // fuchsia
] as const

/**
 * Get a chart color by index (cycles through the palette)
 */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/**
 * Announcement status types
 */
export type AnnouncementType =
  | 'default'
  | 'ongoing'
  | 'success'
  | 'warning'
  | 'error'

/**
 * Announcement status color mapping
 */
export const ANNOUNCEMENT_TYPE_COLORS: Record<AnnouncementType, string> = {
  default: 'bg-gray-500',
  ongoing: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-orange-500',
  error: 'bg-red-500',
}

/**
 * Get announcement status color class
 */
export function getAnnouncementColorClass(type?: string): string {
  const validType = (type || 'default') as AnnouncementType
  return ANNOUNCEMENT_TYPE_COLORS[validType] || ANNOUNCEMENT_TYPE_COLORS.default
}

/**
 * Semantic colors for tags and badges
 */
const TAG_COLORS = [
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
] as const

/**
 * Convert string to a stable semantic color
 * Used for model tags, group badges, user avatars, etc.
 * Same string always returns the same color
 *
 * @param str - Input string (model name, group name, username, etc.)
 * @returns Semantic color name from TAG_COLORS
 *
 * @example
 * stringToColor('gpt-4') // 'blue'
 * stringToColor('claude-3') // 'purple'
 * stringToColor('default') // 'green'
 */
export function stringToColor(str: string): SemanticColor {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  const index = sum % TAG_COLORS.length
  return TAG_COLORS[index]
}
