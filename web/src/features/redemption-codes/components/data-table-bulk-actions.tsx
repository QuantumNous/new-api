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
import { useQueryClient } from '@tanstack/react-query'
import type { Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { deleteRedemptionBatch } from '../api'
import { SUCCESS_MESSAGES } from '../constants'
import type { Redemption } from '../types'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getSelectedRowModel().rows

  const selectedIds = selectedRows.reduce<number[]>((ids, row) => {
    const id = (row.original as Redemption).id
    if (typeof id === 'number') {
      ids.push(id)
    }
    return ids
  }, [])

  const contentToCopy = useMemo(() => {
    const selectedCodes = selectedRows.map((row) => {
      const redemption = row.original as Redemption
      return `${redemption.name}\t${redemption.key}`
    })
    return selectedCodes.join('\n')
  }, [selectedRows])

  const handleClearSelection = () => {
    table.resetRowSelection()
  }

  const handleDeleteAll = async () => {
    try {
      const result = await deleteRedemptionBatch(selectedIds)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.REDEMPTION_DELETED))
        setShowDeleteConfirm(false)
        handleClearSelection()
        queryClient.invalidateQueries({ queryKey: ['redemptions'] })
      }
    } catch {
      toast.error(t('Failed to delete redemption codes'))
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName={t('redemption code')}>
        <CopyButton
          value={contentToCopy}
          variant='outline'
          size='icon'
          className='size-8'
          tooltip={t('Copy selected codes')}
          successTooltip={t('Codes copied!')}
          aria-label={t('Copy selected codes')}
        />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='destructive'
                size='icon'
                onClick={() => setShowDeleteConfirm(true)}
                className='size-8'
                aria-label={t('Delete selected codes')}
                title={t('Delete selected codes')}
              />
            }
          >
            <Trash2 />
            <span className='sr-only'>{t('Delete selected codes')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Delete selected codes')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('Delete redemption codes?')}
        description={
          <>
            {t('Are you sure you want to delete')}
            {selectedIds.length}{' '}
            {t('redemption code(s)? This action cannot be undone.')}
          </>
        }
        contentHeight='auto'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setShowDeleteConfirm(false)}
            >
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={handleDeleteAll}>
              {t('Delete')}
            </Button>
          </>
        }
      >
        {' '}
      </Dialog>
    </>
  )
}
