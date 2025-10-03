import { useState, useCallback } from 'react'

// ============================================================================
// Multiple Dialogs State Management Hook
// ============================================================================

/**
 * Generic hook for managing multiple dialog states
 * @example
 * const dialogs = useDialogs<'create' | 'edit' | 'delete'>()
 * dialogs.open('create')
 * dialogs.close('create')
 * dialogs.isOpen('create') // boolean
 */
export function useDialogs<T extends string>() {
  const [openDialogs, setOpenDialogs] = useState<Set<T>>(new Set())

  const open = useCallback((key: T) => {
    setOpenDialogs((prev) => new Set(prev).add(key))
  }, [])

  const close = useCallback((key: T) => {
    setOpenDialogs((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const toggle = useCallback((key: T) => {
    setOpenDialogs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const closeAll = useCallback(() => {
    setOpenDialogs(new Set())
  }, [])

  // Don't use useCallback here to avoid unnecessary re-creation on every state change
  const isOpen = (key: T) => openDialogs.has(key)

  return { open, close, toggle, isOpen, closeAll }
}

/**
 * Simple hook for managing a single dialog state
 * @example
 * const [open, { open: openDialog, close: closeDialog }] = useDialog()
 */
export function useDialog(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)

  const handlers = {
    open: useCallback(() => setOpen(true), []),
    close: useCallback(() => setOpen(false), []),
    toggle: useCallback(() => setOpen((prev) => !prev), []),
  }

  return [open, handlers, setOpen] as const
}
