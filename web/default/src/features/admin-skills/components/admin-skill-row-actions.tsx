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
import { type Row } from '@tanstack/react-table'
import {
  Archive,
  ClipboardList,
  Eye,
  MoreHorizontal,
  Pencil,
  Send,
  ShieldOff,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AdminSkill } from '../types'

interface AdminSkillRowActionsProps {
  row: Row<AdminSkill>
  onEdit: (skill: AdminSkill) => void
  onPreview: (skill: AdminSkill) => void
}

export function AdminSkillRowActions({
  row,
  onEdit,
  onPreview,
}: AdminSkillRowActionsProps) {
  const { t } = useTranslation()
  const skill = row.original

  return (
    <div className='flex justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => onEdit(skill)}
        aria-label={t('Edit Skill')}
      >
        <Pencil className='size-4' />
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => onPreview(skill)}
        aria-label={t('Preview Skill')}
      >
        <Eye className='size-4' />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Open menu')}
            />
          }
        >
          <MoreHorizontal className='size-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[190px]'>
          <DropdownMenuItem disabled>
            {t('Publish')}
            <DropdownMenuShortcut>
              <Send size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {t('Deprecate')}
            <DropdownMenuShortcut>
              <ShieldOff size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {t('Archive')}
            <DropdownMenuShortcut>
              <Archive size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            {t('Audit')}
            <DropdownMenuShortcut>
              <ClipboardList size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
