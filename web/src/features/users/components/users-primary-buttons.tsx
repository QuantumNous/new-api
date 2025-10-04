import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { setOpen, setCurrentRow } = useUsers()

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={handleCreate}>
        <span>Add User</span> <Plus size={18} />
      </Button>
    </div>
  )
}
