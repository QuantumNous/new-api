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
import {
  portalHeaderIconGroupClassName,
  topNavBarRowClassName,
  topNavBrandZoneClassName,
  topNavCenterZoneClassName,
  topNavRightZoneClassName,
  topNavSearchSlotClassName,
} from '@/lib/ops-ui-styles'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationButton } from '@/components/notification-button'
import { NotificationDialog } from '@/components/notification-dialog'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { defaultTopNavLinks } from '../config/top-nav.config'
import { type TopNavLink } from '../types'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Header } from './header'
import { SystemBrand } from './system-brand'
import { TopNavDesktop } from './top-nav-desktop'

/**
 * General application Header component
 * Integrates navigation bar, search, configuration and profile functions
 *
 * @example
 * // Basic usage
 * <AppHeader />
 *
 * @example
 * // Custom navigation links
 * <AppHeader navLinks={customLinks} />
 *
 * @example
 * // Hide navigation bar and search box
 * <AppHeader showTopNav={false} showSearch={false} />
 *
 * @example
 * // Fully customize left and right content
 * <AppHeader
 *   leftContent={<CustomLeft />}
 *   rightContent={<CustomRight />}
 * />
 */
type AppHeaderProps = {
  /**
   * Custom navigation links, uses default global navigation or dynamically generated from backend if not provided
   */
  navLinks?: TopNavLink[]
  /**
   * Whether to show top navigation bar
   * @default true
   */
  showTopNav?: boolean
  /**
   * Left content, overrides TopNav if provided
   */
  leftContent?: React.ReactNode
  /**
   * Whether to show search box
   * @default true
   */
  showSearch?: boolean
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

export function AppHeader({
  navLinks = defaultTopNavLinks,
  showTopNav = true,
  leftContent,
  showSearch = true,
  rightContent,
  showNotifications = true,
  showConfigDrawer = true,
  showProfileDropdown = true,
}: AppHeaderProps) {
  // Prioritize dynamically generated links from backend
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  // Notifications hook
  const notifications = useNotifications()

  return (
    <>
      <Header className='border-b border-white/10 bg-slate-950/90 text-slate-100 shadow-sm shadow-black/20 backdrop-blur-md'>
        <div className={cn(topNavBarRowClassName, 'h-full')}>
          <div className={cn(topNavBrandZoneClassName, 'gap-1.5')}>
            <SidebarTrigger
              variant='ghost'
              className='size-8 shrink-0 text-slate-200 hover:bg-white/10 hover:text-slate-50'
            />
            <SystemBrand variant='inline' className='shrink-0' />
            {leftContent ? (
              <div className='flex shrink-0 items-center'>{leftContent}</div>
            ) : null}
          </div>

          {showTopNav && (
            <TopNavDesktop
              links={links}
              tone='portal'
              className={topNavCenterZoneClassName}
            />
          )}

          {rightContent ?? (
            <div className={topNavRightZoneClassName}>
              {showSearch && (
                <div className={topNavSearchSlotClassName}>
                  <Search className='w-full' />
                </div>
              )}

              <div
                className={cn(
                  'flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-1 py-0.5 text-slate-100 sm:gap-1 sm:px-1.5',
                  portalHeaderIconGroupClassName
                )}
              >
                {showNotifications && (
                  <NotificationButton
                    unreadCount={notifications.unreadCount}
                    onClick={() => notifications.openDialog()}
                  />
                )}
                <LanguageSwitcher />
                {showConfigDrawer && <ConfigDrawer />}
                {showProfileDropdown && <ProfileDropdown />}
              </div>
            </div>
          )}
        </div>
      </Header>

      {/* Notification Dialog */}
      {showNotifications && (
        <NotificationDialog
          open={notifications.dialogOpen}
          onOpenChange={notifications.setDialogOpen}
          activeTab={notifications.activeTab}
          onTabChange={notifications.setActiveTab}
          notice={notifications.notice}
          announcements={notifications.announcements}
          loading={notifications.loading}
          onCloseToday={notifications.closeToday}
        />
      )}
    </>
  )
}
