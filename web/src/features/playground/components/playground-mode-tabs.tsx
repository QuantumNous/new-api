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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { PLAYGROUND_MODES } from '../constants'
import type { PlaygroundMode } from '../types'

interface PlaygroundModeTabsProps {
  mode: PlaygroundMode
  onModeChange: (mode: PlaygroundMode) => void
  hasImageModels: boolean
  hasVideoModels: boolean
}

export function PlaygroundModeTabs({
  mode,
  onModeChange,
  hasImageModels,
  hasVideoModels,
}: PlaygroundModeTabsProps) {
  const { t } = useTranslation()

  const tabs: Array<{
    value: PlaygroundMode
    label: string
    available: boolean
  }> = [
    { value: PLAYGROUND_MODES.CHAT, label: t('Text'), available: true },
    { value: PLAYGROUND_MODES.IMAGE, label: t('Image'), available: hasImageModels },
    { value: PLAYGROUND_MODES.VIDEO, label: t('Video'), available: hasVideoModels },
  ]

  return (
    <div className='flex shrink-0 items-center justify-center py-3'>
      <div
        className='bg-muted/40 border-border/60 inline-flex items-center gap-1 rounded-lg border p-1'
        role='tablist'
      >
        {tabs.map((tab) => {
          const isActive = mode === tab.value
          return (
            <button
              aria-selected={isActive}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                !tab.available && 'cursor-not-allowed opacity-40'
              )}
              disabled={!tab.available}
              key={tab.value}
              onClick={() => onModeChange(tab.value)}
              role='tab'
              type='button'
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
