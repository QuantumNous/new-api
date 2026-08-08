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

import type { Distributor, DistributorsDialogType } from '../types'

type DistributorsContextType = {
  open: DistributorsDialogType | null
  setOpen: (str: DistributorsDialogType | null) => void
  currentRow: Distributor | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Distributor | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const DistributorsContext = React.createContext<DistributorsContextType | null>(
  null
)

export function DistributorsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<DistributorsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Distributor | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <DistributorsContext
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
    </DistributorsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDistributors = () => {
  const distributorsContext = React.useContext(DistributorsContext)

  if (!distributorsContext) {
    throw new Error(
      'useDistributors has to be used within <DistributorsProvider>'
    )
  }

  return distributorsContext
}
