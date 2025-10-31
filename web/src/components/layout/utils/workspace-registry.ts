import { sidebarConfig } from '../config/sidebar.config'
import { systemSettingsConfig } from '../config/system-settings.config'
import type { NavGroup } from '../types'

/**
 * Workspace configuration type
 * Each workspace contains name, path matching rules, and corresponding navigation group configuration
 */
export type WorkspaceConfig = {
  /** Workspace name */
  name: string
  /** Path matching rule, supports string (contains match) or regular expression */
  pathPattern: string | RegExp
  /** Sidebar navigation group configuration for this workspace */
  navGroups: NavGroup[]
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
    name: 'System Settings',
    pathPattern: /^\/system-settings/,
    navGroups: systemSettingsConfig,
  },
  // Default workspace (must be last)
  {
    name: 'Default',
    pathPattern: /.*/,
    navGroups: sidebarConfig.navGroups,
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
export function getNavGroupsForPath(pathname: string): NavGroup[] {
  return getWorkspaceByPath(pathname).navGroups
}

/**
 * Determine if in specified workspace
 * @param pathname - Current route path
 * @param workspaceName - Workspace name
 * @returns Whether in specified workspace
 */
export function isInWorkspace(
  pathname: string,
  workspaceName: string
): boolean {
  return getWorkspaceByPath(pathname).name === workspaceName
}

/**
 * Get all registered workspace configurations
 * @returns Array of workspace configurations
 */
export function getAllWorkspaces(): WorkspaceConfig[] {
  return workspaceRegistry
}
