import { cn } from '@/lib/utils'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  /**
   * 是否使用固定布局（防止内容溢出）
   */
  fixed?: boolean
  /**
   * 是否使用流式布局（不限制最大宽度）
   */
  fluid?: boolean
}

/**
 * Main 内容区域组件
 * - fixed=true 时会使用 flexbox 布局并防止内容溢出
 * - fluid=true 时不会限制最大宽度
 */
export function Main({ fixed, className, fluid, ...props }: MainProps) {
  return (
    <main
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        'px-4 py-6',
        // 固定布局：使用 flex 并防止溢出
        fixed && 'flex grow flex-col overflow-hidden',
        // 非流式布局：在大屏幕上限制最大宽度
        !fluid &&
          '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...props}
    />
  )
}
