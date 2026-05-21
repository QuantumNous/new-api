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
import { type Column } from '@tanstack/react-table'
import {
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  ChevronsUpDown as CaretSortIcon,
  EyeOff as EyeNoneIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  keysHeaderSortButtonClassName,
  keysHeaderSortIconClassName,
  keysHeaderVisualCenterClassName,
} from '../lib/keys-ui-styles'

type KeysSortableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: React.ReactNode
  className?: string
}

/**
 * Sortable header with title visually centered; sort icon sits to the right of
 * the title and does not shift the title's center point.
 */
export function KeysSortableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: KeysSortableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation()

  if (!column.getCanSort()) {
    return (
      <div className={cn(keysHeaderVisualCenterClassName, className)}>
        <span className='text-center text-sm font-medium text-slate-100'>
          {title}
        </span>
      </div>
    )
  }

  const SortIcon =
    column.getIsSorted() === 'desc'
      ? ArrowDownIcon
      : column.getIsSorted() === 'asc'
        ? ArrowUpIcon
        : CaretSortIcon

  return (
    <div className={cn(keysHeaderVisualCenterClassName, className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant='ghost' size='sm' className={keysHeaderSortButtonClassName} />
          }
        >
          <span className='whitespace-nowrap text-center'>{title}</span>
          <SortIcon className={keysHeaderSortIconClassName} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='center'>
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUpIcon className='text-muted-foreground/70 size-3.5' />
            {t('Asc')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDownIcon className='text-muted-foreground/70 size-3.5' />
            {t('Desc')}
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeNoneIcon className='text-muted-foreground/70 size-3.5' />
                {t('Hide')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
