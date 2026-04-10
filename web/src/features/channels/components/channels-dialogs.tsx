import { useChannels } from './channels-provider'
import { BalanceQueryDialog } from './dialogs/balance-query-dialog'
import { ChannelTestDialog } from './dialogs/channel-test-dialog'
import { CopyChannelDialog } from './dialogs/copy-channel-dialog'
import { EditTagDialog } from './dialogs/edit-tag-dialog'
import { FetchModelsDialog } from './dialogs/fetch-models-dialog'
import { MultiKeyManageDialog } from './dialogs/multi-key-manage-dialog'
import { OllamaModelsDialog } from './dialogs/ollama-models-dialog'
import { TagBatchEditDialog } from './dialogs/tag-batch-edit-dialog'
import { UpstreamUpdateDialog } from './dialogs/upstream-update-dialog'
import { ChannelMutateDrawer } from './drawers/channel-mutate-drawer'

export function ChannelsDialogs() {
  const { open, setOpen, currentRow, upstream } = useChannels()

  return (
    <>
      {/* Channel Create/Update Drawer */}
      <ChannelMutateDrawer
        open={open === 'create-channel' || open === 'update-channel'}
        onOpenChange={(v) => !v && setOpen(null)}
        currentRow={open === 'update-channel' ? currentRow : null}
      />

      {/* Test Channel Dialog */}
      <ChannelTestDialog
        open={open === 'test-channel'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Balance Query Dialog */}
      <BalanceQueryDialog
        open={open === 'balance-query'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Fetch Models Dialog */}
      <FetchModelsDialog
        open={open === 'fetch-models'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Ollama Models Dialog */}
      <OllamaModelsDialog
        open={open === 'ollama-models'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Copy Channel Dialog */}
      <CopyChannelDialog
        open={open === 'copy-channel'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Multi-Key Management Dialog */}
      <MultiKeyManageDialog
        open={open === 'multi-key-manage'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Tag Batch Edit Dialog */}
      <TagBatchEditDialog
        open={open === 'tag-batch-edit'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Edit Tag Dialog */}
      <EditTagDialog
        open={open === 'edit-tag'}
        onOpenChange={(v) => !v && setOpen(null)}
      />

      {/* Upstream Model Update Dialog */}
      <UpstreamUpdateDialog
        open={upstream.showModal}
        addModels={upstream.addModels}
        removeModels={upstream.removeModels}
        preferredTab={upstream.preferredTab}
        confirmLoading={upstream.applyLoading}
        onConfirm={upstream.applyUpdates}
        onCancel={upstream.closeModal}
      />
    </>
  )
}
