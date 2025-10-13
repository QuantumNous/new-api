import React, { useState } from 'react'
import { type ModelsDialogType, type CurrentRowType } from '../types'

type ModelsContextType = {
  open: ModelsDialogType
  setOpen: (str: ModelsDialogType) => void
  currentRow: CurrentRowType
  setCurrentRow: React.Dispatch<React.SetStateAction<CurrentRowType>>
  refreshTrigger: number
  triggerRefresh: () => void
  activeVendorKey: string
  setActiveVendorKey: React.Dispatch<React.SetStateAction<string>>
}

const ModelsContext = React.createContext<ModelsContextType | null>(null)

export function ModelsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<ModelsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<CurrentRowType>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeVendorKey, setActiveVendorKey] = useState('all')

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <ModelsContext
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
    </ModelsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useModels = () => {
  const modelsContext = React.useContext(ModelsContext)

  if (!modelsContext) {
    throw new Error('useModels has to be used within <ModelsContext>')
  }

  return modelsContext
}
