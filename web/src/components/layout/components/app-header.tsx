/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { useConsoleMode } from '@/hooks/use-console-mode'
import { useNotifications } from '@/hooks/use-notifications'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { CommunityHelp } from './community-help'
import { ConsoleModeControl } from './console-mode-switcher'
import { EasyTaskDock } from './easy-task-dock'
import { Header } from './header'
import { SystemBrand } from './system-brand'
import { TopNav } from './top-nav'

/**
 * General application Header component
 * Integrates navigation bar, configuration and profile functions
 *
 * @example
 * // Basic usage
 * <AppHeader />
 *
 * @example
 * // Hide navigation bar
 * <AppHeader showTopNav={false} />
 *
 * @example
 * // Fully customize left and right content
 * <AppHeader
 *   leftContent={<CustomLeft />}
 *   rightContent={<CustomRight />}
 * />
 */
type AppHeaderProps = {
  /** Fallback navigation when no backend links are available. */
  navLinks?: TopNavLink[]
  /** Whether to show the developer navigation. */
  showTopNav?: boolean
  /**
   * Optional content shown after the brand and task dock.
   */
  leftContent?: React.ReactNode
  /**
   * Custom right content, overrides default right content if provided
   */
  rightContent?: React.ReactNode
  /**
   * Whether to show notification button
   * @default true
   */
  showNotifications?: boolean
  /**
   * Whether to show config drawer
   * @default true
   */
  showConfigDrawer?: boolean
  /**
   * Whether to show profile dropdown
   * @default true
   */
  showProfileDropdown?: boolean
}

function AppHeaderNotifications() {
  const notifications = useNotifications()

  return (
    <NotificationPopover
      open={notifications.popoverOpen}
      onOpenChange={notifications.setPopoverOpen}
      unreadCount={notifications.unreadCount}
      activeTab={notifications.activeTab}
      onTabChange={notifications.setActiveTab}
      notice={notifications.notice}
      announcements={notifications.announcements}
      loading={notifications.loading}
    />
  )
}

export function AppHeader({
  navLinks = defaultTopNavLinks,
  showTopNav = true,
  leftContent,
  rightContent,
  showNotifications = true,
  showConfigDrawer = true,
  showProfileDropdown = true,
}: AppHeaderProps) {
  const mode = useConsoleMode()
  const isEasyMode = mode === 'easy'
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  return (
    <Header
      showSidebarTrigger={!isEasyMode}
      className={isEasyMode ? 'dopa-easy-header' : 'dopa-developer-header'}
    >
      <SystemBrand variant='inline' />

      {isEasyMode && <EasyTaskDock />}

      {rightContent == null &&
        showTopNav &&
        !isEasyMode &&
        links.length > 0 && (
          <TopNav links={links} variant='inline' className='dopa-site-nav' />
        )}

      {leftContent ? (
        <div className='ms-2 flex items-center'>{leftContent}</div>
      ) : null}

      {rightContent ?? (
        <div
          className={cn(
            'dopa-header-actions ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5',
            !isEasyMode && showTopNav && links.length > 0 && 'xl:ms-0'
          )}
        >
          {showNotifications && !isEasyMode && <AppHeaderNotifications />}
          <ConsoleModeControl compact />
          <LanguageSwitcher />
          {showConfigDrawer && <ConfigDrawer />}
          <CommunityHelp variant='header' />
          {showProfileDropdown && <ProfileDropdown />}
        </div>
      )}
    </Header>
  )
}
