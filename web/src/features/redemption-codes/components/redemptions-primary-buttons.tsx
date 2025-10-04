import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRedemptions } from './redemptions-provider'

export function RedemptionsPrimaryButtons() {
  const { setOpen } = useRedemptions()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('create')}>
        <span>Create Code</span> <Plus size={18} />
      </Button>
    </div>
  )
}
