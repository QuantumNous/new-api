import { createContext, useContext, useState, type ReactNode } from 'react'

interface UsageLogsContextValue {
  refreshTrigger: number
  triggerRefresh: () => void
  expandedRows: Set<number>
  toggleExpandRow: (id: number) => void
  isRowExpanded: (id: number) => boolean
}

const UsageLogsContext = createContext<UsageLogsContextValue | undefined>(
  undefined
)

export function UsageLogsProvider({ children }: { children: ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const toggleExpandRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const isRowExpanded = (id: number) => {
    return expandedRows.has(id)
  }

  return (
    <UsageLogsContext.Provider
      value={{
        refreshTrigger,
        triggerRefresh,
        expandedRows,
        toggleExpandRow,
        isRowExpanded,
      }}
    >
      {children}
    </UsageLogsContext.Provider>
  )
}

export function useUsageLogsContext() {
  const context = useContext(UsageLogsContext)
  if (!context) {
    throw new Error('useUsageLogsContext must be used within UsageLogsProvider')
  }
  return context
}
