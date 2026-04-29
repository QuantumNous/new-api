import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog'
import { type Redemption, type RedemptionsDialogType } from '../types'

type RedemptionsContextType = {
  open: RedemptionsDialogType | null
  setOpen: (str: RedemptionsDialogType | null) => void
  currentRow: Redemption | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Redemption | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const RedemptionsContext = React.createContext<RedemptionsContextType | null>(
  null
)

export function RedemptionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<RedemptionsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Redemption | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <RedemptionsContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </RedemptionsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRedemptions = () => {
  const redemptionsContext = React.useContext(RedemptionsContext)

  if (!redemptionsContext) {
    throw new Error(
      'useRedemptions has to be used within <RedemptionsProvider>'
    )
  }

  return redemptionsContext
}
