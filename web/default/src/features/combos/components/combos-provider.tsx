/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import React, { useCallback } from 'react'

import type { Combo } from '../types'
import type { ComboDialogType } from '../types'

export type CombosContextType = {
  open: ComboDialogType | null
  setOpen: (open: ComboDialogType | null) => void
  currentRow: Combo | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Combo | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const CombosContext = React.createContext<CombosContextType | null>(null)

export function CombosProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState<ComboDialogType | null>(null)
  const [currentRow, setCurrentRow] = React.useState<Combo | null>(null)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((v) => v + 1)
  }, [])

  return (
    <CombosContext.Provider
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
    </CombosContext.Provider>
  )
}

export const useCombos = (): CombosContextType => {
  const ctx = React.useContext(CombosContext)
  if (!ctx) throw new Error('useCombos must be used within CombosProvider')
  return ctx
}
