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
*/
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { RegionRoute, RegionRoutesDialogType } from '../types'

type RegionRoutesContextType = {
  open: RegionRoutesDialogType | null
  setOpen: (str: RegionRoutesDialogType | null) => void
  currentRow: RegionRoute | null
  setCurrentRow: React.Dispatch<React.SetStateAction<RegionRoute | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const RegionRoutesContext = React.createContext<RegionRoutesContextType | null>(
  null
)

export function RegionRoutesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<RegionRoutesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<RegionRoute | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <RegionRoutesContext
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
    </RegionRoutesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRegionRoutes = () => {
  const regionRoutesContext = React.useContext(RegionRoutesContext)

  if (!regionRoutesContext) {
    throw new Error(
      'useRegionRoutes has to be used within <RegionRoutesProvider>'
    )
  }

  return regionRoutesContext
}
