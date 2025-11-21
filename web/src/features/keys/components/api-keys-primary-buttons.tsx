import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useApiKeys } from './api-keys-provider'

export function ApiKeysPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useApiKeys()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('create')}>
        <span>{t('Create API Key')}</span> <Plus size={18} />
      </Button>
    </div>
  )
}
