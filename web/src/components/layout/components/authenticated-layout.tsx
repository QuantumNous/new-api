import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { WorkspaceProvider } from '../context/workspace-context'
import { AppSidebar } from './app-sidebar'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

/**
 * 已认证用户的根布局组件
 * 提供以下功能：
 * - 布局配置（LayoutProvider）
 * - 搜索功能（SearchProvider）
 * - 工作区管理（WorkspaceProvider）
 * - 侧边栏（SidebarProvider + AppSidebar）
 * - 无障碍支持（SkipToMain）
 */
export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  return (
    <LayoutProvider>
      <SearchProvider>
        <WorkspaceProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <SkipToMain />
            <AppSidebar />
            <SidebarInset
              className={cn(
                // 设置容器查询上下文
                '@container/content',
                // 固定布局时，设置高度为 100svh 防止溢出
                'has-[[data-layout=fixed]]:h-svh',
                // 固定布局 + inset 变体时，减去间距
                'peer-data-[variant=inset]:has-[[data-layout=fixed]]:h-[calc(100svh-(var(--spacing)*4))]'
              )}
            >
              {children ?? <Outlet />}
            </SidebarInset>
          </SidebarProvider>
        </WorkspaceProvider>
      </SearchProvider>
    </LayoutProvider>
  )
}
