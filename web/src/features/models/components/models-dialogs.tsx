import { type Model, type Vendor, type PrefillGroup } from '../types'
import { MissingModelsDialog } from './dialogs/missing-models-dialog'
import { SyncWizardDialog } from './dialogs/sync-wizard-dialog'
import { UpstreamConflictDialog } from './dialogs/upstream-conflict-dialog'
import { VendorMutateDialog } from './dialogs/vendor-mutate-dialog'
import { ModelsMutateDrawer } from './drawers/models-mutate-drawer'
import { PrefillGroupMutateDrawer } from './drawers/prefill-group-mutate-drawer'
import { PrefillGroupsDrawer } from './drawers/prefill-groups-drawer'
import { useModels } from './models-provider'

export function ModelsDialogs() {
  const { open, setOpen, currentRow } = useModels()

  return (
    <>
      {/* Model Create/Update Drawer */}
      <ModelsMutateDrawer
        open={open === 'create-model' || open === 'update-model'}
        onOpenChange={(v) => !v && setOpen(null)}
        currentRow={open === 'update-model' ? (currentRow as Model) : null}
      />

      {/* Vendor Create/Update Dialog */}
      <VendorMutateDialog
        open={open === 'create-vendor' || open === 'update-vendor'}
        onOpenChange={(v) => !v && setOpen(null)}
        currentRow={open === 'update-vendor' ? (currentRow as Vendor) : null}
      />

      {/* Prefill Groups Management Drawer */}
      <PrefillGroupsDrawer
        open={open === 'prefill-groups'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Prefill Group Create/Update Drawer */}
      <PrefillGroupMutateDrawer
        open={
          open === 'create-prefill-group' || open === 'update-prefill-group'
        }
        onOpenChange={(v) => !v && setOpen(null)}
        currentRow={
          open === 'update-prefill-group' ? (currentRow as PrefillGroup) : null
        }
      />

      {/* Missing Models Dialog */}
      <MissingModelsDialog
        open={open === 'missing-models'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Sync Wizard Dialog */}
      <SyncWizardDialog
        open={open === 'sync-wizard'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Upstream Conflict Resolution Dialog */}
      <UpstreamConflictDialog
        open={open === 'upstream-conflict'}
        onOpenChange={(v) => !v && setOpen(null)}
        currentRow={currentRow as any}
      />
    </>
  )
}
