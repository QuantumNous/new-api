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
import { Download, Plus, RefreshCw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { buildUsersExportUrl, syncFeishuUsersInfo } from '../api'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow, triggerRefresh } = useUsers()
  const [syncing, setSyncing] = useState(false)

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }
  const handleFeishuBatchInit = () => {
    setOpen('feishu_batch_init')
  }
  const handleSyncFeishuUsers = async () => {
    setSyncing(true)
    try {
      const res = await syncFeishuUsersInfo()
      if (!res.success) {
        toast.error(res.message || t('Sync failed'))
        return
      }
      const data = res.data
      toast.success(
        t('Sync done: success {{s}}, skipped {{k}}, failed {{f}}', {
          s: data?.success || 0,
          k: data?.skipped || 0,
          f: data?.failed || 0,
        })
      )
      triggerRefresh()
    } finally {
      setSyncing(false)
    }
  }
  const handleExport = () => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status') || ''
    const role = params.get('role') || ''
    window.open(
      buildUsersExportUrl({
        keyword: params.get('filter') || '',
        group: params.get('group') || '',
        status,
        role,
      }),
      '_blank'
    )
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button size='sm' variant='outline' onClick={handleFeishuBatchInit}>
        <Users className='h-4 w-4' />
        {t('Feishu Batch Init')}
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={handleSyncFeishuUsers}
        disabled={syncing}
      >
        <RefreshCw className='h-4 w-4' />
        {syncing ? t('Syncing...') : t('Sync Feishu User Info')}
      </Button>
      <Button size='sm' variant='outline' onClick={handleExport}>
        <Download className='h-4 w-4' />
        {t('Export Users')}
      </Button>
      <Button size='sm' onClick={handleCreate}>
        <Plus className='h-4 w-4' />
        {t('Add User')}
      </Button>
    </div>
  )
}
