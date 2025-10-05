import * as React from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { useStatus } from '@/hooks/use-status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useWorkspace } from '../context/workspace-context'
import { type Workspace } from '../types'

type TeamSwitcherProps = {
  workspaces: Workspace[]
  defaultName?: string
  defaultVersion?: string
}

/**
 * 工作区切换器组件
 * 允许用户在不同的工作区（workspace）之间切换
 * - 普通用户只能看到默认工作区
 * - 超级管理员可以看到系统设置工作区
 */
export function TeamSwitcher({
  workspaces,
  defaultName = 'AI Gateway',
  defaultVersion = 'Unknown version',
}: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { status } = useStatus()
  const isSuperAdmin = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  const { activeWorkspace, setActiveWorkspace } = useWorkspace()

  // 处理工作区列表：
  // 1. 用系统信息填充第一个工作区
  // 2. 根据用户权限过滤（非超级管理员看不到系统设置）
  const availableWorkspaces = React.useMemo(
    () =>
      workspaces
        .map((workspace, index) =>
          index === 0
            ? {
                ...workspace,
                name: status?.system_name || defaultName,
                plan: status?.version || defaultVersion,
              }
            : workspace
        )
        .filter(
          (workspace) => isSuperAdmin || workspace.name !== 'System Settings'
        ),
    [
      workspaces,
      status?.system_name,
      status?.version,
      defaultName,
      defaultVersion,
      isSuperAdmin,
    ]
  )

  // 初始化和同步激活的工作区
  React.useEffect(() => {
    if (!activeWorkspace && availableWorkspaces[0]) {
      // 如果没有激活的工作区，设置第一个
      setActiveWorkspace(availableWorkspaces[0])
    } else if (activeWorkspace) {
      // 如果有激活的工作区，确保它仍然在可用列表中
      const updated = availableWorkspaces.find(
        (w) => w.name === activeWorkspace.name
      )
      if (updated) {
        setActiveWorkspace(updated)
      } else if (availableWorkspaces[0]) {
        // 如果当前工作区不可用（比如权限变更），切换到第一个
        setActiveWorkspace(availableWorkspaces[0])
      }
    }
  }, [availableWorkspaces, activeWorkspace, setActiveWorkspace])

  if (!activeWorkspace) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
                <activeWorkspace.logo className='size-4' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeWorkspace.name}
                </span>
                <span className='truncate text-xs'>{activeWorkspace.plan}</span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              Workspaces
            </DropdownMenuLabel>
            {availableWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.name}
                onClick={() => setActiveWorkspace(workspace)}
                className='gap-2 p-2'
              >
                <div className='flex size-6 items-center justify-center rounded-sm border'>
                  <workspace.logo className='size-4 shrink-0' />
                </div>
                {workspace.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
