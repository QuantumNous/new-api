import { Link } from '@tanstack/react-router'
import { Code } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { ThemeSwitch } from '@/components/theme-switch'

type PublicLayoutProps = {
  children: React.ReactNode
  /**
   * 是否显示 main 容器
   * @default true
   */
  showMainContainer?: boolean
  /**
   * 自定义导航内容（在 Logo 之后显示）
   */
  navContent?: React.ReactNode
}

/**
 * 公共页面布局组件
 * 用于非 console 页面（如 pricing、about、home 等）
 * 提供统一的 header 和布局结构
 */
export function PublicLayout({
  children,
  showMainContainer = true,
  navContent,
}: PublicLayoutProps) {
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

  return (
    <div className='min-h-screen'>
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur'>
        <div className='container flex h-14 items-center justify-between'>
          <div className='flex items-center space-x-8'>
            <Link to='/' className='flex items-center space-x-2'>
              <Code className='h-6 w-6' />
              <span className='text-xl font-bold'>New API</span>
            </Link>
            {navContent}
          </div>
          <div className='flex items-center space-x-4'>
            <ThemeSwitch />
            {isAuthenticated ? (
              <Button variant='ghost' asChild>
                <Link to='/dashboard'>控制台</Link>
              </Button>
            ) : (
              <>
                <Button variant='ghost' asChild>
                  <Link to='/sign-in'>登录</Link>
                </Button>
                <Button asChild>
                  <Link to='/sign-up'>注册</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {showMainContainer ? (
        <main className='container px-4 py-6 md:px-4'>{children}</main>
      ) : (
        children
      )}
    </div>
  )
}
