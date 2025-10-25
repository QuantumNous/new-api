import React, { createContext, useContext, useState } from 'react'
import type { Model, Vendor } from '../types'

// ============================================================================
// Types
// ============================================================================

type DialogType =
  | 'create-model'
  | 'update-model'
  | 'create-vendor'
  | 'update-vendor'
  | 'missing-models'
  | 'sync-wizard'
  | 'upstream-conflict'
  | 'prefill-groups'
  | null

type ModelsContextType = {
  open: DialogType
  setOpen: (open: DialogType) => void
  currentRow: Model | null
  setCurrentRow: (model: Model | null) => void
  currentVendor: Vendor | null
  setCurrentVendor: (vendor: Vendor | null) => void
  selectedVendor: string | null
  setSelectedVendor: (vendor: string | null) => void
}

// ============================================================================
// Context
// ============================================================================

const ModelsContext = createContext<ModelsContextType | undefined>(undefined)

// ============================================================================
// Provider
// ============================================================================

export function ModelsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<DialogType>(null)
  const [currentRow, setCurrentRow] = useState<Model | null>(null)
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null)

  return (
    <ModelsContext.Provider
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        currentVendor,
        setCurrentVendor,
        selectedVendor,
        setSelectedVendor,
      }}
    >
      {children}
    </ModelsContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useModels() {
  const context = useContext(ModelsContext)
  if (!context) {
    throw new Error('useModels must be used within ModelsProvider')
  }
  return context
}
