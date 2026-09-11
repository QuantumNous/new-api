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
import { Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { QuotaResetRunDialog } from './quota-reset-run-dialog'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUsers()
  const [quotaResetDialogOpen, setQuotaResetDialogOpen] = useState(false)

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  return (
    <div className='flex gap-2'>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setQuotaResetDialogOpen(true)}
      >
        <RefreshCw className='h-4 w-4' />
        {t('Reset Quota Now')}
      </Button>
      <Button size='sm' onClick={handleCreate}>
        <Plus className='h-4 w-4' />
        {t('Add User')}
      </Button>
      <QuotaResetRunDialog
        open={quotaResetDialogOpen}
        onOpenChange={setQuotaResetDialogOpen}
      />
    </div>
  )
}
