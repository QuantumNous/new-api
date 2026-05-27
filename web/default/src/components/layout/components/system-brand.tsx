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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { FlatkeyBrandLogo } from '@/components/brand/flatkey-brand-logo'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type SystemBrandProps = {
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
 * System brand component
 * Displays current system logo + name.
 * - inline: compact pill in the top app bar; clicking navigates to home (/)
 * - sidebar: stacked card in the sidebar header (display only)
 */
export function SystemBrand(props: SystemBrandProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  const variant = props.variant ?? 'sidebar'
  const name = status?.system_name || props.defaultName || 'New API'
  const version =
    status?.version || props.defaultVersion || t('Unknown version')

  if (variant === 'inline') {
    return (
      <Link
        to='/'
        aria-label={t('Go to home')}
        className={cn(
          'text-foreground inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium transition-colors outline-none select-none',
          'hover:bg-accent focus-visible:ring-ring/40 focus-visible:ring-2'
        )}
      >
        <div className='flex h-9 items-center justify-center'>
          <FlatkeyBrandLogo alt={t('Logo')} className='h-9 scale-[0.88]' />
        </div>
        <span className='sr-only'>{name}</span>
      </Link>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='hover:text-sidebar-foreground active:text-sidebar-foreground cursor-default hover:bg-transparent active:bg-transparent'
          render={<div />}
        >
          <div className='flex h-10 items-center justify-center group-data-[collapsible=icon]:aspect-square group-data-[collapsible=icon]:size-8'>
            <FlatkeyBrandLogo alt={t('Logo')} className='h-10 scale-[0.88] origin-left group-data-[collapsible=icon]:scale-75' />
          </div>
          <div className='grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden'>
            <span className='truncate font-semibold'>{name}</span>
            <span className='truncate text-xs'>{version}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
