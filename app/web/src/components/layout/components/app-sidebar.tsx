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
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from '@tanstack/react-router'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLayout } from '@/context/layout-provider'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { MOTION_TRANSITION, MOTION_VARIANTS } from '@/lib/motion'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { checkIsActive } from '../lib/url-utils'
import { NavGroup } from './nav-group'

export type SidebarTabMode = 'user' | 'admin'

/**
 * Application sidebar.
 *
 * Renders the root navigation. When the logged-in user is
 * Admin/SuperAdmin/Root, a top Tab switcher toggles between the User
 * workspace (Chat, General, Personal) and the Admin workspace
 * (Channels, Models, Users, Redemption, Subscriptions, Proxy,
 * System Info, System Settings theme collapsibles).
 */
export function AppSidebar() {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()
  const { state, isMobile } = useSidebar()
  const pathname = useLocation({ select: (location) => location.pathname })
  const { key, navGroups } = useSidebarView()
  const shouldReduce = useReducedMotion()

  const userRole = useAuthStore((s) => s.auth.user?.role)
  const isAdmin = (userRole ?? ROLE.GUEST) >= ROLE.ADMIN

  const [activeTab, setActiveTab] = useState<SidebarTabMode>('user')

  // Check if current location or view is inside admin workspace
  const isAdminActive = useMemo(() => {
    const adminGroup = navGroups.find((g) => g.id === 'admin')
    if (!adminGroup) return false
    return adminGroup.items.some((item) => checkIsActive(pathname, item))
  }, [navGroups, pathname])

  // Keep the selected workspace aligned with the current route.
  useEffect(() => {
    setActiveTab(isAdminActive ? 'admin' : 'user')
  }, [isAdminActive])

  // Filter groups depending on active tab when admin tabs are enabled
  const displayedNavGroups = useMemo(() => {
    if (!isAdmin) {
      return navGroups
    }
    if (activeTab === 'admin') {
      return navGroups.filter((g) => g.id === 'admin')
    }
    return navGroups.filter((g) => g.id !== 'admin')
  }, [isAdmin, activeTab, navGroups])

  const showTabs = isAdmin

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      {showTabs && (
        <SidebarHeader
          className={cn(
            'p-2 pb-1 transition-opacity duration-200',
            state === 'collapsed' && !isMobile && 'hidden'
          )}
        >
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as SidebarTabMode)}
            className='w-full'
          >
            <TabsList className='grid w-full grid-cols-2 bg-muted/60 p-1'>
              <TabsTrigger
                value='user'
                className='text-xs font-medium data-active:bg-background data-active:shadow-sm'
              >
                {t('User')}
              </TabsTrigger>
              <TabsTrigger
                value='admin'
                className='text-xs font-medium data-active:bg-background data-active:shadow-sm'
              >
                {t('Admin')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SidebarHeader>
      )}

      <SidebarContent className='py-2'>
        <AnimatePresence mode='wait' initial={false}>
          <motion.div
            key={`${key}-${activeTab}`}
            initial={
              shouldReduce ? false : MOTION_VARIANTS.sidebarSlide.initial
            }
            animate={MOTION_VARIANTS.sidebarSlide.animate}
            exit={shouldReduce ? undefined : MOTION_VARIANTS.sidebarSlide.exit}
            transition={MOTION_TRANSITION.fast}
            className='flex flex-col'
          >
            {displayedNavGroups.map((props) => (
              <NavGroup key={props.id || props.title} {...props} />
            ))}
          </motion.div>
        </AnimatePresence>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
