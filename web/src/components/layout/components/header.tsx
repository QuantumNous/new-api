import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  /**
   * 是否固定在顶部
   */
  fixed?: boolean
}

/**
 * 基础 Header 组件
 * 包含侧边栏触发器和分隔线
 * - fixed=true 时会固定在顶部，并在滚动时添加阴影效果
 */
export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const [scrollOffset, setScrollOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollOffset(
        document.body.scrollTop || document.documentElement.scrollTop
      )
    }

    document.addEventListener('scroll', handleScroll, { passive: true })
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  const shouldShowShadow = scrollOffset > 10 && fixed

  return (
    <header
      className={cn(
        'z-50 h-16',
        fixed && 'header-fixed peer/header sticky top-0 w-[inherit]',
        shouldShowShadow ? 'shadow' : 'shadow-none',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full items-center gap-3 p-4 sm:gap-4',
          shouldShowShadow &&
            'after:bg-background/20 after:absolute after:inset-0 after:-z-10 after:backdrop-blur-lg'
        )}
      >
        <SidebarTrigger variant='outline' className='max-md:scale-125' />
        <Separator orientation='vertical' className='h-6' />
        {children}
      </div>
    </header>
  )
}
