/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { stringToColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

export const dotColorMap = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  neutral: 'bg-neutral',
  purple: 'bg-chart-4',
  amber: 'bg-warning',
  blue: 'bg-chart-1',
  cyan: 'bg-chart-2',
  green: 'bg-success',
  grey: 'bg-neutral',
  indigo: 'bg-chart-1',
  'light-blue': 'bg-info',
  'light-green': 'bg-success',
  lime: 'bg-chart-3',
  orange: 'bg-warning',
  pink: 'bg-chart-5',
  red: 'bg-destructive',
  teal: 'bg-chart-2',
  violet: 'bg-chart-4',
  yellow: 'bg-warning',
} as const

export const textColorMap = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
  neutral: 'text-muted-foreground',
  purple: 'text-chart-4',
  amber: 'text-warning',
  blue: 'text-chart-1',
  cyan: 'text-chart-2',
  green: 'text-success',
  grey: 'text-muted-foreground',
  indigo: 'text-chart-1',
  'light-blue': 'text-info',
  'light-green': 'text-success',
  lime: 'text-chart-3',
  orange: 'text-warning',
  pink: 'text-chart-5',
  red: 'text-destructive',
  teal: 'text-chart-2',
  violet: 'text-chart-4',
  yellow: 'text-warning',
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

  const content =
    children ?? (label ? <span className='truncate'>{label}</span> : null)

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
