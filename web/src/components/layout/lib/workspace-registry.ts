import { type TFunction } from 'i18next'
import {
  getSystemSettingsNavGroups,
  WORKSPACE_SYSTEM_SETTINGS_ID,
} from '../config/system-settings.config'
import type { NavGroup } from '../types'

export const WORKSPACE_IDS = {
  SYSTEM_SETTINGS: WORKSPACE_SYSTEM_SETTINGS_ID,
  DEFAULT: 'default',
} as const

export type WorkspaceId = (typeof WORKSPACE_IDS)[keyof typeof WORKSPACE_IDS]

/**
 * Workspace configuration type
 * Each workspace contains name, path matching rules, and corresponding navigation group configuration
 */
export type WorkspaceConfig = {
  /** Workspace identifier (for logic) */
  id: WorkspaceId
  /** Workspace name */
  name: string
  /** Path matching rule, supports string (contains match) or regular expression */
  pathPattern: string | RegExp
  /** Sidebar navigation group configuration for this workspace */
  getNavGroups?: (t: TFunction) => NavGroup[]
}

/**
 * Workspace registry
 *
 * Sorted by priority, first matched workspace will be used
 * Last one should be default workspace (matches all paths)
 *
 * @example
 * // Add new workspace
 * {
 *   name: 'User Management',
 *   pathPattern: /^\/user-management/,
 *   navGroups: userManagementConfig
 * }
 */
const workspaceRegistry: WorkspaceConfig[] = [
  // System Settings workspace
  {
    id: WORKSPACE_IDS.SYSTEM_SETTINGS,
    name: 'System Settings',
    pathPattern: /^\/system-settings/,
    getNavGroups: getSystemSettingsNavGroups,
  },
  // Default workspace (must be last)
  {
    id: WORKSPACE_IDS.DEFAULT,
    name: 'Default',
    pathPattern: /.*/,
    // getNavGroups is undefined, will be handled by consumers (e.g. useSidebarData)
  },
]

/**
 * Get matched workspace configuration based on path
 * @param pathname - Current route path
 * @returns Matched workspace configuration
 */
export function getWorkspaceByPath(pathname: string): WorkspaceConfig {
  const workspace = workspaceRegistry.find((ws) => {
    if (typeof ws.pathPattern === 'string') {
      return pathname.includes(ws.pathPattern)
    }
    return ws.pathPattern.test(pathname)
  })

  // If no match, return default workspace (last one)
  return workspace || workspaceRegistry[workspaceRegistry.length - 1]
}

/**
 * Get corresponding sidebar navigation group configuration based on path
 * @param pathname - Current route path
 * @returns Navigation group configuration for corresponding workspace
 */
export function getNavGroupsForPath(
  pathname: string,
  t: TFunction
): NavGroup[] | undefined {
  const workspace = getWorkspaceByPath(pathname)
  return workspace.getNavGroups?.(t)
}

/**
 * Determine if in specified workspace
 * @param pathname - Current route path
 * @param workspaceId - Workspace identifier
 * @returns Whether in specified workspace
 */
export function isInWorkspace(
  pathname: string,
  workspaceId: WorkspaceId
): boolean {
  return getWorkspaceByPath(pathname).id === workspaceId
}

/**
 * Get all registered workspace configurations
 * @returns Array of workspace configurations
 */
export function getAllWorkspaces(): WorkspaceConfig[] {
  return workspaceRegistry
}
