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
import { exportUsers, syncFeishuUsersInfo } from '../api'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons({
  accountType = 0,
}: {
  accountType?: number
} = {}) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow, triggerRefresh } = useUsers()
  const [syncing, setSyncing] = useState(false)
  const isOrganization = accountType === 1

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
        toast.error(res.message || '同步失败')
        return
      }
      const data = res.data
      toast.success(
        `同步完成：成功 ${data?.success || 0}，跳过 ${data?.skipped || 0}，失败 ${data?.failed || 0}`
      )
      triggerRefresh()
    } finally {
      setSyncing(false)
    }
  }
  const handleExport = async () => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status') || ''
    const role = params.get('role') || ''
    try {
      await exportUsers({
        keyword: params.get('filter') || '',
        group: params.get('group') || '',
        status,
        role,
        account_type: accountType,
      })
    } catch {
      toast.error('导出用户失败')
    }
  }

  return (
    <div className='flex flex-wrap gap-2'>
      {!isOrganization && (
        <>
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
            {syncing ? '同步中...' : '同步飞书用户信息'}
          </Button>
        </>
      )}
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
