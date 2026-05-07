import { KeyRound, Plus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const { setOpen, setCurrentRow } = useUsers()

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }
  const handleFeishuBatchInit = () => {
    setOpen('feishu_batch_init')
  }
  const handleFeishuTokenManager = () => {
    setOpen('feishu_token_manager')
  }

  return (
    <div className='flex gap-2'>
      {(user?.role ?? 0) >= ROLE.ADMIN && (
        <Button size='sm' variant='outline' onClick={handleFeishuTokenManager}>
          <KeyRound className='h-4 w-4' />
          {t('Feishu Keys')}
        </Button>
      )}
      <Button size='sm' variant='outline' onClick={handleFeishuBatchInit}>
        <Users className='h-4 w-4' />
        {t('Feishu Batch Init')}
      </Button>
      <Button size='sm' onClick={handleCreate}>
        <Plus className='h-4 w-4' />
        {t('Add User')}
      </Button>
    </div>
  )
}
