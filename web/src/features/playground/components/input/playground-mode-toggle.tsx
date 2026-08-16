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
import { ImageIcon, MessageSquareIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { PLAYGROUND_MODES } from '../../constants'
import type { PlaygroundMode } from '../../types'

type PlaygroundModeToggleProps = {
  disabled?: boolean
  mode: PlaygroundMode
  onModeChange: (mode: PlaygroundMode) => void
}

function isPlaygroundMode(value: string): value is PlaygroundMode {
  return value === PLAYGROUND_MODES.TEXT || value === PLAYGROUND_MODES.IMAGE
}

const MODE_ITEM_CLASS =
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground aria-pressed:shadow-sm'

export function PlaygroundModeToggle(props: PlaygroundModeToggleProps) {
  const { t } = useTranslation()

  return (
    <ToggleGroup
      aria-label={t('Generation mode')}
      className='bg-background/70'
      onValueChange={(value) => {
        const nextMode = value.find((item) => item !== props.mode)
        if (nextMode && isPlaygroundMode(nextMode)) {
          props.onModeChange(nextMode)
        }
      }}
      size='sm'
      value={[props.mode]}
      variant='outline'
    >
      <ToggleGroupItem
        aria-label={t('Text')}
        className={MODE_ITEM_CLASS}
        disabled={props.disabled}
        value={PLAYGROUND_MODES.TEXT}
      >
        <MessageSquareIcon size={16} />
        <span className='hidden sm:inline'>{t('Text')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label={t('Image')}
        className={MODE_ITEM_CLASS}
        disabled={props.disabled}
        value={PLAYGROUND_MODES.IMAGE}
      >
        <ImageIcon size={16} />
        <span className='hidden sm:inline'>{t('Image')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
