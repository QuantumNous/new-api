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
import { type Table } from '@tanstack/react-table'
import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { BatchAssignSubscriptionDialog } from '@/features/subscriptions/components/dialogs/batch-assign-subscription-dialog'

import { type User } from '../types'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigned, setAssigned] = useState(false)
  const userIds = table.getSelectedRowModel().rows.map((row) => row.original.id)

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Button
          variant='outline'
          size='sm'
          className='h-8'
          onClick={() => {
            setAssigned(false)
            setAssignOpen(true)
          }}
        >
          <CreditCard className='mr-1 h-4 w-4' />
          {t('Batch assign subscription')}
        </Button>
      </BulkActionsToolbar>

      <BatchAssignSubscriptionDialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open)
          if (!open && assigned) table.resetRowSelection()
        }}
        userIds={userIds}
        onSuccess={() => setAssigned(true)}
      />
    </>
  )
}
