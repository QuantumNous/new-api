import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { setOpen, setCurrentRow } = useUsers()

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create')
  }

  return (
    <Button onClick={handleCreate} size='sm' className='gap-2'>
      <UserPlus className='h-4 w-4' />
      Add User
    </Button>
  )
}
