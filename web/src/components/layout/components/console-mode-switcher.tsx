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
import { Code2, Leaf } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarFooter } from '@/components/ui/sidebar'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { useConsoleModeStore } from '@/stores/console-mode-store'

type ConsoleModeControlProps = {
  compact?: boolean
}

export function ConsoleModeControl(props: ConsoleModeControlProps) {
  const { t } = useTranslation()
  const mode = useConsoleModeStore((state) => state.mode)
  const setMode = useConsoleModeStore((state) => state.setMode)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const options = [
    { id: 'easy' as const, label: t('Easy mode'), icon: Leaf },
    { id: 'developer' as const, label: t('Developer mode'), icon: Code2 },
  ]

  if (props.compact && isMobile) {
    const CurrentIcon = mode === 'easy' ? Leaf : Code2
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              className='dopa-mode-control text-primary size-10 shrink-0 rounded-full border'
              aria-label={t('Mode')}
            />
          }
        >
          <CurrentIcon className='size-5 shrink-0' aria-hidden='true' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuRadioGroup
            value={mode}
            onValueChange={(next) => {
              if (next === 'easy' || next === 'developer') setMode(next)
            }}
          >
            {options.map((option) => {
              const Icon = option.icon
              return (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  closeOnClick
                  className='min-h-10 gap-3'
                >
                  <Icon className='size-4 shrink-0' aria-hidden='true' />
                  {option.label}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div
      className={cn(
        'dopa-mode-control grid shrink-0 grid-cols-2 gap-1 border p-1',
        props.compact ? 'dopa-mode-control--compact' : 'rounded-xl'
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        const selected = mode === option.id
        return (
          <button
            key={option.id}
            type='button'
            onClick={() => setMode(option.id)}
            aria-pressed={selected}
            aria-label={option.label}
            className={cn(
              'flex min-h-8 items-center justify-center gap-1.5 px-2 text-[11px] font-bold transition-colors',
              selected
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className='size-3.5 shrink-0' aria-hidden='true' />
            <span
              className={cn(
                'truncate group-data-[collapsible=icon]:hidden',
                props.compact && 'hidden 2xl:inline'
              )}
            >
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ConsoleModeSwitcher() {
  const { t } = useTranslation()

  return (
    <SidebarFooter className='border-sidebar-border border-t p-2'>
      <p className='text-muted-foreground px-1 pb-1.5 text-[10px] font-bold tracking-[0.14em] uppercase group-data-[collapsible=icon]:hidden'>
        {t('Mode')}
      </p>
      <ConsoleModeControl />
    </SidebarFooter>
  )
}
