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
import { cn } from '@/lib/utils'
import {
  publicPortalContentScopeClassName,
  publicPortalPageShellClassName,
} from '@/lib/ops-ui-styles'
import type { TopNavLink } from '../types'
import { PublicHeader, type PublicHeaderProps } from './public-header'

type PublicLayoutProps = {
  children: React.ReactNode
  showMainContainer?: boolean
  /** Dark 昀河星泽 portal shell + bright header nav (pricing / rankings / about). */
  portalShell?: boolean
  /** Light text on dark hero (home portal shell). */
  headerTone?: PublicHeaderProps['headerTone']
  navContent?: React.ReactNode
  headerProps?: Omit<PublicHeaderProps, 'navContent' | 'headerTone'>
  navLinks?: TopNavLink[]
  showThemeSwitch?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  logo?: React.ReactNode
  siteName?: string
}

export function PublicLayout(props: PublicLayoutProps) {
  const portalShell = props.portalShell === true
  const headerTone =
    props.headerTone ?? props.headerProps?.headerTone ?? (portalShell ? 'portal' : 'default')

  return (
    <div
      className={cn(
        portalShell
          ? publicPortalPageShellClassName
          : 'bg-background text-foreground relative min-h-svh overflow-x-clip'
      )}
    >
      <PublicHeader
        headerTone={headerTone}
        navContent={props.navContent}
        navLinks={props.navLinks}
        showThemeSwitch={props.showThemeSwitch}
        showAuthButtons={props.showAuthButtons}
        showNotifications={props.showNotifications}
        logo={props.logo}
        siteName={props.siteName}
        {...props.headerProps}
      />

      {props.showMainContainer !== false ? (
        <main
          className={cn(
            'container px-4 py-6 pt-20 md:px-4',
            portalShell && publicPortalContentScopeClassName
          )}
        >
          {props.children}
        </main>
      ) : (
        <div className={cn(portalShell && publicPortalContentScopeClassName)}>
          {props.children}
        </div>
      )}
    </div>
  )
}
