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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PlaygroundMode } from '../types'

interface PlaygroundModeToggleProps {
  value: PlaygroundMode
  onChange: (value: PlaygroundMode) => void
}

export function PlaygroundModeToggle({
  value,
  onChange,
}: PlaygroundModeToggleProps) {
  const { t } = useTranslation()

  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as PlaygroundMode)}
    >
      <TabsList aria-label={t('Playground mode')}>
        <TabsTrigger value='chat'>
          <MessageSquareIcon className='size-4' />
          {t('Chat')}
        </TabsTrigger>
        <TabsTrigger value='image'>
          <ImageIcon className='size-4' />
          {t('Image')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
