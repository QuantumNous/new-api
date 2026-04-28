import { DescriptionDialog } from './dialogs/description-dialog'
import { MissingModelsDialog } from './dialogs/missing-models-dialog'
import { PrefillGroupManagement } from './dialogs/prefill-group-management'
import { SyncWizardDialog } from './dialogs/sync-wizard-dialog'
import { UpstreamConflictDialog } from './dialogs/upstream-conflict-dialog'
import { VendorMutateDialog } from './dialogs/vendor-mutate-dialog'
import { ModelMutateDrawer } from './drawers/model-mutate-drawer'
import { useModels } from './models-provider'

export function ModelsDialogs() {
  const {
    open,
    setOpen,
    currentRow,
    currentVendor,
    descriptionData,
    setDescriptionData,
  } = useModels()

  return (
    <>
      {/* Model Create/Update Drawer */}
      <ModelMutateDrawer
        open={open === 'create-model' || open === 'update-model'}
        onOpenChange={(v) => !v && setOpen(null)}
        currentRow={currentRow}
      />

      {/* Vendor Create/Update Dialog */}
      <VendorMutateDialog
        open={open === 'create-vendor' || open === 'update-vendor'}
        onOpenChange={(v) => !v && setOpen(null)}
        currentVendor={open === 'update-vendor' ? currentVendor : null}
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

      {/* Upstream Conflict Dialog */}
      <UpstreamConflictDialog
        open={open === 'upstream-conflict'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Prefill Groups Management */}
      <PrefillGroupManagement
        open={open === 'prefill-groups'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Description Dialog */}
      <DescriptionDialog
        open={open === 'description'}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null)
            setDescriptionData(null)
          }
        }}
        modelName={descriptionData?.modelName || ''}
        description={descriptionData?.description || ''}
      />
    </>
  )
}
