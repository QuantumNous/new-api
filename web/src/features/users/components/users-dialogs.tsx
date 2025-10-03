import { UsersDeleteDialog } from './users-delete-dialog'
import { UsersMutateDrawer } from './users-mutate-drawer'
import { useUsers } from './users-provider'

export function UsersDialogs() {
  const { open, setOpen, currentRow } = useUsers()

  return (
    <>
      <UsersMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={open === 'update' ? currentRow || undefined : undefined}
      />
      <UsersDeleteDialog />
    </>
  )
}
