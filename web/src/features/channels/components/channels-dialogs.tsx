import { useChannels } from './channels-provider'
import { BalanceQueryDialog } from './dialogs/balance-query-dialog'
import { ChannelTestDialog } from './dialogs/channel-test-dialog'
import { CopyChannelDialog } from './dialogs/copy-channel-dialog'
import { FetchModelsDialog } from './dialogs/fetch-models-dialog'
import { MultiKeyManageDialog } from './dialogs/multi-key-manage-dialog'
import { TagBatchEditDialog } from './dialogs/tag-batch-edit-dialog'
import { ChannelMutateDrawer } from './drawers/channel-mutate-drawer'

export function ChannelsDialogs() {
  const { open, setOpen, currentRow } = useChannels()

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
    </>
  )
}
