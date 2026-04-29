import { RedemptionsDeleteDialog } from './redemptions-delete-dialog'
import { RedemptionsMutateDrawer } from './redemptions-mutate-drawer'
import { useRedemptions } from './redemptions-provider'

export function RedemptionsDialogs() {
  const { open, setOpen, currentRow } = useRedemptions()
  const isUpdate = open === 'update'

  return (
    <>
      <RedemptionsMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <RedemptionsDeleteDialog />
    </>
  )
}
