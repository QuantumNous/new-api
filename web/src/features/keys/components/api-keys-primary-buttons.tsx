import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApiKeys } from './api-keys-provider'

export function ApiKeysPrimaryButtons() {
  const { setOpen } = useApiKeys()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('create')}>
        <span>Create API Key</span> <Plus size={18} />
      </Button>
    </div>
  )
}
