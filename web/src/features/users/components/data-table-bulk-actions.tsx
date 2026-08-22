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
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { type User } from '../types'
import { SendUserEmailDialog } from './send-user-email-dialog'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions(props: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const [showEmailDialog, setShowEmailDialog] = useState(false)

  return (
    <>
      <BulkActionsToolbar table={props.table} entityName='user'>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                onClick={() => setShowEmailDialog(true)}
                aria-label={t('Send email to selected users')}
              />
            }
          >
            <Mail aria-hidden='true' />
            <span className='sr-only'>{t('Send email to selected users')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Send email to selected users')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <SendUserEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        table={props.table}
      />
    </>
  )
}
