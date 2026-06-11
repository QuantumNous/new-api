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
import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { CombosMultiDeleteDialog } from './combos-multi-delete-dialog'
import type { Combo } from '../types'

export function CombosBulkActions({ table }: { table: Table<Combo> }) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedIds = selectedRows.map((r) => r.original.id)

  return (
    <>
      <BulkActionsToolbar table={table} entityName='combo'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='sm'
              className='h-8'
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              {t('Delete Selected')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('Delete selected combos')}</TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>
      <CombosMultiDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        selectedIds={selectedIds}
        count={selectedIds.length}
      />
    </>
  )
}
