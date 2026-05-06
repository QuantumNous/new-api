import * as React from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { getWorkspaceByPath, WORKSPACE_IDS } from '../lib/workspace-registry'
import { type Workspace } from '../types'

type WorkspaceSwitcherProps = {
  workspaces: Workspace[]
  defaultName?: string
  defaultVersion?: string
  /**
   * Visual layout:
   * - 'sidebar': stacked card style (used inside the sidebar header).
   * - 'inline': compact horizontal pill (used inside the top app bar).
   */
  variant?: 'sidebar' | 'inline'
}

/**
 * Workspace switcher component
 * Allows users to switch between different workspaces
 * - Regular users can only see the default workspace
 * - Super administrators can see the system settings workspace
 */
export function WorkspaceSwitcher({
  workspaces,
  defaultName = 'New API',
  defaultVersion,
  variant = 'sidebar',
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useSidebar()
  const { status } = useStatus()
  const { logo } = useSystemConfig()
  const isSuperAdmin = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  const { activeWorkspace, setActiveWorkspace } = useWorkspace()

  // Handle workspace list:
  // 1. Populate first workspace with system info
  // 2. Filter based on user permissions (non-super admins cannot see system settings)
  const availableWorkspaces = React.useMemo(
    () =>
      workspaces
        .map((workspace, index) =>
          index === 0
            ? {
                ...workspace,
                name: status?.system_name || defaultName,
                plan: status?.version || defaultVersion || t('Unknown version'),
              }
            : workspace
        )
        .filter(
          (workspace) =>
            isSuperAdmin || workspace.id !== WORKSPACE_IDS.SYSTEM_SETTINGS
        ),
    [
      workspaces,
      status?.system_name,
      status?.version,
      defaultName,
      defaultVersion,
      isSuperAdmin,
      t,
    ]
  )

  // Initialize and synchronize active workspace
  // Detect from URL first, then sync from activeWorkspace
  React.useEffect(() => {
    // Detect which workspace should be active from workspace registry
    const detectedWorkspace = getWorkspaceByPath(pathname)

    if (detectedWorkspace.id === WORKSPACE_IDS.SYSTEM_SETTINGS) {
      // Currently in system settings route, should activate System Settings workspace
      const systemSettingsWorkspace = availableWorkspaces.find(
        (w) => w.id === WORKSPACE_IDS.SYSTEM_SETTINGS
      )
      if (systemSettingsWorkspace) {
        setActiveWorkspace(systemSettingsWorkspace)
      }
    } else {
      // Currently in main workspace route, should activate main workspace
      const mainWorkspace =
        availableWorkspaces.find((w) => w.id === WORKSPACE_IDS.DEFAULT) ||
        availableWorkspaces[0]
      if (mainWorkspace) {
        setActiveWorkspace(mainWorkspace)
      }
    }
  }, [pathname, availableWorkspaces, setActiveWorkspace])

  const handleWorkspaceChange = (workspace: Workspace) => {
    // Only navigate, let useEffect synchronize workspace state based on new pathname
    // This avoids race conditions and context loss issues
    if (workspace.id === WORKSPACE_IDS.SYSTEM_SETTINGS) {
      navigate({ to: '/system-settings/general' })
    } else {
      navigate({ to: '/dashboard' })
    }
  }

  if (!activeWorkspace) {
    return null
  }

  const canSwitchWorkspace = availableWorkspaces.length > 1

  const renderWorkspaceList = () => (
    <DropdownMenuGroup>
      <DropdownMenuLabel className='text-muted-foreground text-xs'>
        {t('Workspaces')}
      </DropdownMenuLabel>
      {availableWorkspaces.map((workspace, index) => (
        <DropdownMenuItem
          key={workspace.id}
          onClick={() => handleWorkspaceChange(workspace)}
          className='gap-2 p-2'
        >
          {index === 0 ? (
            <div className='flex size-6 items-center justify-center overflow-hidden rounded-sm border'>
              <img src={logo} alt='Logo' className='size-full object-cover' />
            </div>
          ) : (
            <div className='flex size-6 items-center justify-center rounded-sm border'>
              <workspace.logo className='size-4 shrink-0' />
            </div>
          )}
          {workspace.name}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )

  if (variant === 'inline') {
    const inlineLogo =
      activeWorkspace.id === WORKSPACE_IDS.SYSTEM_SETTINGS ? (
        <div className='bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-md'>
          <activeWorkspace.logo className='size-3' />
        </div>
      ) : (
        <div className='flex size-5 items-center justify-center overflow-hidden rounded-md'>
          <img
            src={logo}
            alt={t('Logo')}
            className='size-full rounded-md object-cover'
          />
        </div>
      )

    const inlineButtonClass = cn(
      'inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-foreground outline-none select-none transition-colors',
      'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40',
      'data-popup-open:bg-accent'
    )

    if (!canSwitchWorkspace) {
      return (
        <div
          className={cn(
            inlineButtonClass,
            'cursor-default hover:bg-transparent'
          )}
        >
          {inlineLogo}
          <span className='max-w-[12rem] truncate'>{activeWorkspace.name}</span>
        </div>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={inlineButtonClass}>
          {inlineLogo}
          <span className='max-w-[12rem] truncate'>{activeWorkspace.name}</span>
          <ChevronsUpDown className='text-muted-foreground size-3.5' />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className='min-w-56 rounded-lg'
          align='start'
          side='bottom'
          sideOffset={6}
        >
          {renderWorkspaceList()}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const workspaceButtonContent = (
    <>
      {activeWorkspace.id === WORKSPACE_IDS.SYSTEM_SETTINGS ? (
        <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
          <activeWorkspace.logo className='size-4' />
        </div>
      ) : (
        <div className='flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg'>
          <img
            src={logo}
            alt={t('Logo')}
            className='size-full rounded-lg object-cover'
          />
        </div>
      )}
      <div className='grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden'>
        <span className='truncate font-semibold'>{activeWorkspace.name}</span>
        <span className='truncate text-xs'>{activeWorkspace.plan}</span>
      </div>
      {canSwitchWorkspace && (
        <ChevronsUpDown className='ms-auto group-data-[collapsible=icon]:hidden' />
      )}
    </>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {canSwitchWorkspace ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size='lg'
                  className='data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground'
                />
              }
            >
              {workspaceButtonContent}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--anchor-width) min-w-56 rounded-lg'
              align='start'
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
              {renderWorkspaceList()}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SidebarMenuButton
            size='lg'
            className='hover:text-sidebar-foreground active:text-sidebar-foreground cursor-default hover:bg-transparent active:bg-transparent'
            render={<div />}
          >
            {workspaceButtonContent}
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
