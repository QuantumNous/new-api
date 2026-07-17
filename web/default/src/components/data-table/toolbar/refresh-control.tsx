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
import { ChevronDown, RefreshCw } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Auto-refresh interval presets (Grafana-style). Labels use universal
 * duration notation, so they are intentionally not translated.
 */
const AUTO_REFRESH_INTERVALS = [
  { label: '5s', ms: 5_000 },
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
] as const

const AUTO_REFRESH_OFF = 0

function readStoredInterval(storageKey: string | undefined): number {
  if (!storageKey || typeof window === 'undefined') return AUTO_REFRESH_OFF

  try {
    const stored = Number(window.localStorage.getItem(storageKey))
    // Only accept known presets — stale or tampered values fall back to off.
    return AUTO_REFRESH_INTERVALS.some((option) => option.ms === stored)
      ? stored
      : AUTO_REFRESH_OFF
  } catch {
    return AUTO_REFRESH_OFF
  }
}

export type DataTableRefreshControlProps = {
  /**
   * Refreshes the table data. Typically invalidates the list query.
   */
  onRefresh: () => void
  /**
   * Disables the manual button and spins the icon while a refetch is
   * in flight. Typically the query's `isFetching`.
   */
  isRefreshing?: boolean
  /**
   * localStorage key persisting the chosen auto-refresh interval per table.
   * Omit for session-only behavior.
   */
  storageKey?: string
}

/**
 * Manual refresh button paired with an auto-refresh interval picker.
 *
 * While an interval is active the table refreshes periodically; ticks are
 * skipped for hidden tabs and a refresh fires when the tab becomes visible
 * again, so background pages never poll the API yet never look stale.
 */
export function DataTableRefreshControl(props: DataTableRefreshControlProps) {
  const { t } = useTranslation()
  const [intervalMs, setIntervalMs] = React.useState(() =>
    readStoredInterval(props.storageKey)
  )

  // Keep the timer independent from the callback identity so a re-created
  // onRefresh (new closure per render) does not reset the refresh cadence.
  const onRefreshRef = React.useRef(props.onRefresh)
  onRefreshRef.current = props.onRefresh

  React.useEffect(() => {
    if (intervalMs <= AUTO_REFRESH_OFF) return

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      onRefreshRef.current()
    }, intervalMs)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onRefreshRef.current()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs])

  const handleIntervalChange = (value: number) => {
    setIntervalMs(value)

    if (!props.storageKey) return
    try {
      if (value > AUTO_REFRESH_OFF) {
        window.localStorage.setItem(props.storageKey, String(value))
      } else {
        window.localStorage.removeItem(props.storageKey)
      }
    } catch {
      // Storage can be unavailable in private mode; auto refresh still works.
    }
  }

  const activeInterval = AUTO_REFRESH_INTERVALS.find(
    (option) => option.ms === intervalMs
  )

  return (
    <div className='flex items-center'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              onClick={props.onRefresh}
              disabled={props.isRefreshing}
              aria-label={t('Refresh')}
              className='text-muted-foreground hover:text-foreground'
            />
          }
        >
          <RefreshCw className={cn(props.isRefreshing && 'animate-spin')} />
        </TooltipTrigger>
        <TooltipContent>{t('Refresh')}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              aria-label={t('Auto refresh')}
              className={cn(
                'gap-0.5 px-1',
                activeInterval
                  ? 'text-primary hover:text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            />
          }
        >
          {activeInterval && (
            <span className='text-xs tabular-nums'>{activeInterval.label}</span>
          )}
          <ChevronDown className='size-3.5' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuRadioGroup
            value={intervalMs}
            onValueChange={handleIntervalChange}
          >
            <DropdownMenuLabel>{t('Auto refresh')}</DropdownMenuLabel>
            <DropdownMenuRadioItem value={AUTO_REFRESH_OFF}>
              {t('Off')}
            </DropdownMenuRadioItem>
            {AUTO_REFRESH_INTERVALS.map((option) => (
              <DropdownMenuRadioItem key={option.ms} value={option.ms}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
