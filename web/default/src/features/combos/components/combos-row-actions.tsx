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
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCombos } from './combos-provider'
import { updateComboStatus } from '../api'
import type { Combo } from '../types'

export function CombosRowActions({ row }: { row: { original: Combo } }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow, triggerRefresh } = useCombos()
  const combo = row.original

  const handleToggleStatus = async () => {
    try {
      const newStatus = combo.status === 1 ? 0 : 1
      await updateComboStatus(combo.id, newStatus)
      triggerRefresh()
    } catch {
      // handled by interceptor
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon' className='h-8 w-8' />}
      >
        <MoreHorizontal className='h-4 w-4' aria-hidden='true' />
        <span className='sr-only'>{t('Open menu')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => { setCurrentRow(combo); setOpen('update') }}>
          {t('Edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleStatus}>
          {combo.status === 1 ? t('Disable') : t('Enable')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { setCurrentRow(combo); setOpen('delete') }}
          className='text-destructive'
        >
          {t('Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
