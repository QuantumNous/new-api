import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center justify-center border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-200 w-fit gap-1.5',
  {
    variants: {
      variant: {
        success:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
        warning:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
        danger:
          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800',
        info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
        neutral:
          'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
        purple:
          'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800',
      },
      size: {
        sm: 'text-xs px-2 py-0.5 gap-1',
        md: 'text-xs px-2.5 py-1 gap-1.5',
        lg: 'text-sm px-3 py-1.5 gap-2',
      },
      rounded: {
        full: 'rounded-full',
        md: 'rounded-md',
        sm: 'rounded-sm',
        lg: 'rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'sm',
      rounded: 'md',
    },
  }
)

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof statusBadgeVariants> {
  /** 状态文本 */
  label: string
  /** 图标组件 */
  icon?: LucideIcon
  /** 是否显示动画脉冲效果 */
  pulse?: boolean
  /** 是否显示状态指示点 */
  showDot?: boolean
  /** 圆角样式：full=完全圆角胶囊, md=中等圆角, sm=小圆角, lg=大圆角 */
  rounded?: 'full' | 'md' | 'sm' | 'lg'
}

export function StatusBadge({
  label,
  icon: Icon,
  variant,
  size,
  rounded,
  pulse = false,
  showDot = false,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        statusBadgeVariants({ variant, size, rounded }),
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'danger' && 'bg-rose-500',
            variant === 'info' && 'bg-sky-500',
            variant === 'neutral' && 'bg-slate-400',
            variant === 'purple' && 'bg-purple-500'
          )}
        />
      )}
      {Icon && <Icon className='h-3 w-3' />}
      <span className='capitalize'>{label}</span>
    </span>
  )
}

// 预定义的常用状态配置
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
