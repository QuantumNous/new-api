import React, { createContext, useContext, useState } from 'react'
import { type ModelsDialogType, type CurrentRowType } from '../types'

// ============================================================================
// Types
// ============================================================================

type ModelsContextType = {
  /** Current open dialog/drawer identifier */
  open: ModelsDialogType

  /** Set which dialog/drawer to open */
  setOpen: (str: ModelsDialogType) => void

  /** Currently selected row for editing */
  currentRow: CurrentRowType

  /** Set the current row */
  setCurrentRow: React.Dispatch<React.SetStateAction<CurrentRowType>>

  /** Refresh trigger counter (increment to trigger data refresh) */
  refreshTrigger: number

  /** Trigger a data refresh */
  triggerRefresh: () => void

  /** Currently active vendor filter key */
  activeVendorKey: string

  /** Set active vendor filter */
  setActiveVendorKey: React.Dispatch<React.SetStateAction<string>>
}

// ============================================================================
// Context
// ============================================================================

const ModelsContext = createContext<ModelsContextType | null>(null)

// ============================================================================
// Provider
// ============================================================================

/**
 * Provider component for models feature state management
 * Manages dialogs, current editing row, refresh triggers, and vendor filters
 *
 * @example
 * ```tsx
 * <ModelsProvider>
 *   <ModelsTable />
 *   <ModelsDialogs />
 * </ModelsProvider>
 * ```
 */
export function ModelsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<ModelsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<CurrentRowType>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeVendorKey, setActiveVendorKey] = useState('all')

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <ModelsContext.Provider
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
        activeVendorKey,
        setActiveVendorKey,
      }}
    >
      {children}
    </ModelsContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access models context
 * Must be used within ModelsProvider
 *
 * @throws Error if used outside ModelsProvider
 *
 * @example
 * ```tsx
 * const { setOpen, currentRow, triggerRefresh } = useModels()
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useModels() {
  const context = useContext(ModelsContext)

  if (!context) {
    throw new Error('useModels must be used within ModelsProvider')
  }

  return context
}
