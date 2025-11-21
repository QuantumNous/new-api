import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUsers()

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={handleCreate}>
        <span>{t('Add User')}</span> <Plus size={18} />
      </Button>
    </div>
  )
}
