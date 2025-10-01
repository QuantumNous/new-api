import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type ApiKey } from '../data/schema'

type ApiKeysDialogType = 'create' | 'update' | 'delete' | 'batch-delete'

type ApiKeysContextType = {
  open: ApiKeysDialogType | null
  setOpen: (str: ApiKeysDialogType | null) => void
  currentRow: ApiKey | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ApiKey | null>>
  visibleKeys: Record<number, boolean>
  setVisibleKeys: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const ApiKeysContext = React.createContext<ApiKeysContextType | null>(null)

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<ApiKeysDialogType>(null)
  const [currentRow, setCurrentRow] = useState<ApiKey | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({})
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <ApiKeysContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        visibleKeys,
        setVisibleKeys,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </ApiKeysContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApiKeys = () => {
  const apiKeysContext = React.useContext(ApiKeysContext)

  if (!apiKeysContext) {
    throw new Error('useApiKeys has to be used within <ApiKeysContext>')
  }

  return apiKeysContext
}
