import { RedemptionsDeleteDialog } from './redemptions-delete-dialog'
import { RedemptionsMutateDrawer } from './redemptions-mutate-drawer'
import { useRedemptions } from './redemptions-provider'

export function RedemptionsDialogs() {
  const { open, setOpen, currentRow } = useRedemptions()

  return (
    <>
      <RedemptionsMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={open === 'update' ? currentRow || undefined : undefined}
      />
      <RedemptionsDeleteDialog />
    </>
  )
}
