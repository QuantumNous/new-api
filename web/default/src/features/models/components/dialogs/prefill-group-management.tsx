import { useEffect, useState } from 'react'
import type { PrefillGroup } from '../../types'
import { PrefillGroupFormDrawer } from '../drawers/prefill-group-form-drawer'
import { PrefillGroupManagementDialog } from './prefill-group-management-dialog'

type PrefillGroupManagementProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PrefillView = 'dialog' | 'drawer'

export function PrefillGroupManagement({
  open,
  onOpenChange,
}: PrefillGroupManagementProps) {
  const [view, setView] = useState<PrefillView>('dialog')
  const [currentGroup, setCurrentGroup] = useState<PrefillGroup | null>(null)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('dialog')

      setCurrentGroup(null)
    }
  }, [open])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setView('dialog')
      setCurrentGroup(null)
      onOpenChange(false)
    }
  }

  const handleDrawerClose = () => {
    setView('dialog')
    setCurrentGroup(null)
  }

  const handleShowDrawer = (group: PrefillGroup | null) => {
    setCurrentGroup(group)
    setView('drawer')
  }

  return (
    <>
      <PrefillGroupManagementDialog
        open={open && view === 'dialog'}
        onOpenChange={handleDialogOpenChange}
        onCreateGroup={() => handleShowDrawer(null)}
        onEditGroup={(group) => handleShowDrawer(group)}
      />
      <PrefillGroupFormDrawer
        open={open && view === 'drawer'}
        onClose={handleDrawerClose}
        currentGroup={currentGroup}
      />
    </>
  )
}
