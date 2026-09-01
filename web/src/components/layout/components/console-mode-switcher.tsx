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
import { ArrowLeftRight, Code2, Leaf } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useConsoleModeStore } from '@/stores/console-mode-store'

export function ConsoleModeSwitcher() {
  const { t } = useTranslation()
  const mode = useConsoleModeStore((state) => state.mode)
  const setMode = useConsoleModeStore((state) => state.setMode)
  const isEasyMode = mode === 'easy'
  const nextMode = isEasyMode ? 'developer' : 'easy'
  const currentLabel = isEasyMode ? t('Easy mode') : t('Developer mode')
  const actionLabel = isEasyMode
    ? t('Switch to developer mode')
    : t('Switch to easy mode')
  const ModeIcon = isEasyMode ? Leaf : Code2

  return (
    <SidebarFooter className='border-sidebar-border border-t p-2'>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setMode(nextMode)}
            tooltip={actionLabel}
            aria-label={actionLabel}
            className='bg-sidebar-accent/40 h-10 rounded-xl border'
          >
            <ModeIcon className='text-primary' aria-hidden='true' />
            <span className='font-medium'>{currentLabel}</span>
            <ArrowLeftRight
              className='text-muted-foreground ms-auto group-data-[collapsible=icon]:hidden'
              aria-hidden='true'
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
