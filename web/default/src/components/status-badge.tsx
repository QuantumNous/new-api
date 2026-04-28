/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { stringToColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

export const dotColorMap = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  green: 'bg-green-500',
  grey: 'bg-gray-500',
  indigo: 'bg-indigo-500',
  'light-blue': 'bg-sky-500',
  'light-green': 'bg-green-500',
  lime: 'bg-lime-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
  teal: 'bg-teal-500',
  violet: 'bg-violet-500',
  yellow: 'bg-yellow-500',
} as const

export const textColorMap = {
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-rose-700 dark:text-rose-400',
  info: 'text-sky-700 dark:text-sky-400',
  neutral: 'text-muted-foreground',
  purple: 'text-purple-700 dark:text-purple-400',
  amber: 'text-amber-700 dark:text-amber-400',
  blue: 'text-blue-700 dark:text-blue-400',
  cyan: 'text-cyan-700 dark:text-cyan-400',
  green: 'text-green-700 dark:text-green-400',
  grey: 'text-muted-foreground',
  indigo: 'text-indigo-700 dark:text-indigo-400',
  'light-blue': 'text-sky-700 dark:text-sky-400',
  'light-green': 'text-green-600 dark:text-green-400',
  lime: 'text-lime-700 dark:text-lime-400',
  orange: 'text-orange-700 dark:text-orange-400',
  pink: 'text-pink-700 dark:text-pink-400',
  red: 'text-red-700 dark:text-red-400',
  teal: 'text-teal-700 dark:text-teal-400',
  violet: 'text-violet-700 dark:text-violet-400',
  yellow: 'text-yellow-700 dark:text-yellow-400',
} as const

export type StatusVariant = keyof typeof dotColorMap

const sizeMap = {
  sm: 'text-xs gap-1.5',
  md: 'text-xs gap-1.5',
  lg: 'text-sm gap-2',
} as const

export interface StatusBadgeProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  label?: string
  children?: React.ReactNode
  icon?: LucideIcon
  pulse?: boolean
  /** When false, hides the leading dot */
  showDot?: boolean
  variant?: StatusVariant | null
  size?: 'sm' | 'md' | 'lg' | null
  /** @deprecated No longer applicable in flat design */
  rounded?: 'full' | 'md' | 'sm' | 'lg'
  copyable?: boolean
  copyText?: string
  autoColor?: string
}

export function StatusBadge({
  label,
  children,
  icon: Icon,
  variant,
  size = 'sm',
  pulse = false,
  showDot = true,
  rounded: _rounded,
  copyable = true,
  copyText,
  autoColor,
  className,
  onClick,
  ...props
}: StatusBadgeProps) {
  const { copyToClipboard } = useCopyToClipboard()

  const computedVariant: StatusVariant = autoColor
    ? (stringToColor(autoColor) as StatusVariant)
    : (variant ?? 'neutral')

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (copyable) {
      e.stopPropagation()
      copyToClipboard(copyText || label || '')
    }
    onClick?.(e)
  }

  const content = children ?? (label ? <span className='truncate'>{label}</span> : null)

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center font-medium whitespace-nowrap',
        sizeMap[size ?? 'sm'],
        textColorMap[computedVariant],
        pulse && 'animate-pulse',
        copyable &&
          'cursor-pointer transition-opacity hover:opacity-70 active:scale-95',
        className
      )}
      onClick={handleClick}
      title={copyable ? `Click to copy: ${copyText || label || ''}` : undefined}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            dotColorMap[computedVariant]
          )}
          aria-hidden='true'
        />
      )}
      {Icon && <Icon className='size-3 shrink-0' />}
      {content}
    </span>
  )
}

export const statusPresets = {
  active: {
    variant: 'success' as const,
    label: 'Active',
    showDot: true,
  },
  inactive: {
    variant: 'neutral' as const,
    label: 'Inactive',
    showDot: true,
  },
  invited: {
    variant: 'info' as const,
    label: 'Invited',
    showDot: true,
  },
  suspended: {
    variant: 'danger' as const,
    label: 'Suspended',
    showDot: true,
  },
  pending: {
    variant: 'warning' as const,
    label: 'Pending',
    showDot: true,
    pulse: true,
  },
} as const

export type StatusPreset = keyof typeof statusPresets
