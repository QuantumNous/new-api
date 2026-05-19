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
import { DEFAULT_SYSTEM_NAME, normalizeSystemName } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const UNKNOWN_VERSION_KEYS = new Set([
  'unknown version',
  '未知版本',
  'version inconnue',
  'неизвестная версия',
  'phiên bản không xác định',
  '不明なバージョン',
])

function resolveDisplayVersion(
  raw: string | undefined,
  unknownLabel: string
): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  const normalized = trimmed.toLowerCase()
  if (normalized === unknownLabel.trim().toLowerCase()) return null
  if (UNKNOWN_VERSION_KEYS.has(normalized)) return null

  return trimmed
}

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
  const { logo } = useSystemConfig()

  const variant = props.variant ?? 'sidebar'
  const name = normalizeSystemName(
    status?.system_name || props.defaultName || DEFAULT_SYSTEM_NAME
  )
  const displayVersion = resolveDisplayVersion(
    status?.version || props.defaultVersion,
    t('Unknown version')
  )

  if (variant === 'inline') {
    return (
      <Link
        to='/'
        aria-label={t('Go to home')}
        className={cn(
          'inline-flex h-8 max-w-[min(100%,18rem)] items-center gap-2 rounded-lg border px-2 text-sm font-semibold transition-colors outline-none select-none',
          'border-white/10 bg-white/5 text-slate-100 shadow-sm backdrop-blur-sm',
          'hover:bg-white/10 hover:text-slate-50',
          'focus-visible:ring-2 focus-visible:ring-indigo-400/40'
        )}
      >
        <div className='flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-indigo-400/20'>
          <img
            src={logo}
            alt={t('Logo')}
            className='size-full rounded-md object-cover'
          />
        </div>
        <span className='truncate'>{name}</span>
      </Link>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className={cn(
            'cursor-default rounded-lg border border-white/10 bg-white/5 px-2 hover:bg-white/5 active:bg-white/5',
            'hover:text-slate-50 active:text-slate-50'
          )}
          render={<div />}
        >
          <div className='flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/15'>
            <img
              src={logo}
              alt={t('Logo')}
              className='size-full rounded-lg object-cover'
            />
          </div>
          <div
            className={cn(
              'flex flex-1 flex-col text-start text-sm leading-tight group-data-[collapsible=icon]:hidden',
              !displayVersion && 'justify-center'
            )}
          >
            <span className='truncate font-semibold text-slate-50'>{name}</span>
            {displayVersion ? (
              <span className='truncate text-xs text-slate-400'>
                {displayVersion}
              </span>
            ) : null}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
