import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { type LucideIcon } from 'lucide-react'
import { stringToColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const statusBadgeVariants = cva(
  'inline-flex items-center justify-center border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-200 w-fit gap-1.5',
  {
    variants: {
      variant: {
        // Status variants
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
        // Semantic color variants (for tags, models, groups, etc.)
        amber:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
        blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
        cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-800',
        green:
          'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
        grey: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
        indigo:
          'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800',
        'light-blue':
          'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
        'light-green':
          'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
        lime: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/50 dark:text-lime-400 dark:border-lime-800',
        orange:
          'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
        pink: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-400 dark:border-pink-800',
        red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
        teal: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800',
        violet:
          'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
        yellow:
          'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800',
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
  /** 是否可点击复制（默认 true） */
  copyable?: boolean
  /** 复制的文本（默认使用 label） */
  copyText?: string
  /**
   * 自动根据字符串生成颜色（优先级高于 variant）
   * 相同的字符串总是生成相同的颜色
   * 适用于：模型名、分组名、用户名等需要稳定颜色的场景
   * @example autoColor="gpt-4" // 自动生成蓝色
   * @example autoColor="claude-3" // 自动生成紫色
   */
  autoColor?: string
}

export function StatusBadge({
  label,
  icon: Icon,
  variant,
  size,
  rounded,
  pulse = false,
  showDot = false,
  copyable = true,
  copyText,
  autoColor,
  className,
  onClick,
  ...props
}: StatusBadgeProps) {
  const { copyToClipboard } = useCopyToClipboard()

  // 如果提供了 autoColor，使用 stringToColor 自动生成颜色
  const computedVariant = autoColor ? stringToColor(autoColor) : variant

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (copyable) {
      e.stopPropagation()
      copyToClipboard(copyText || label)
    }
    onClick?.(e)
  }

  return (
    <span
      className={cn(
        statusBadgeVariants({ variant: computedVariant, size, rounded }),
        pulse && 'animate-pulse',
        copyable &&
          'cursor-pointer transition-all hover:opacity-80 active:scale-95',
        className
      )}
      onClick={handleClick}
      title={copyable ? `Click to copy: ${copyText || label}` : undefined}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            computedVariant === 'success' && 'bg-emerald-500',
            computedVariant === 'warning' && 'bg-amber-500',
            computedVariant === 'danger' && 'bg-rose-500',
            computedVariant === 'info' && 'bg-sky-500',
            computedVariant === 'neutral' && 'bg-slate-400',
            computedVariant === 'purple' && 'bg-purple-500',
            computedVariant === 'amber' && 'bg-amber-500',
            computedVariant === 'blue' && 'bg-blue-500',
            computedVariant === 'cyan' && 'bg-cyan-500',
            computedVariant === 'green' && 'bg-green-500',
            computedVariant === 'grey' && 'bg-gray-500',
            computedVariant === 'indigo' && 'bg-indigo-500',
            computedVariant === 'light-blue' && 'bg-sky-500',
            computedVariant === 'light-green' && 'bg-green-500',
            computedVariant === 'lime' && 'bg-lime-500',
            computedVariant === 'orange' && 'bg-orange-500',
            computedVariant === 'pink' && 'bg-pink-500',
            computedVariant === 'red' && 'bg-red-500',
            computedVariant === 'teal' && 'bg-teal-500',
            computedVariant === 'violet' && 'bg-violet-500',
            computedVariant === 'yellow' && 'bg-yellow-500'
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
