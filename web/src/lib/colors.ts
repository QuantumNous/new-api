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

export function getBgColorClass(color?: string): string {
  if (!color) return colorToBgClass.blue
  return (colorToBgClass as any)[color] || colorToBgClass.blue
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
