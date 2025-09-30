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

export const colorToClassName: Record<SemanticColor, string> = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  cyan: 'text-cyan-500',
  purple: 'text-purple-500',
  pink: 'text-pink-500',
  red: 'text-red-500',
  orange: 'text-orange-500',
  amber: 'text-amber-500',
  yellow: 'text-yellow-500',
  lime: 'text-lime-500',
  'light-green': 'text-green-400',
  teal: 'text-teal-500',
  'light-blue': 'text-sky-500',
  indigo: 'text-indigo-500',
  violet: 'text-violet-500',
  grey: 'text-gray-500',
}

export function getColorClass(color?: string): string {
  if (!color) return colorToClassName.blue
  return (colorToClassName as any)[color] || colorToClassName.blue
}
