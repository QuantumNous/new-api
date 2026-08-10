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

import type { SlaIncident, SlaIncidentsDialogType } from '../types'

type SlaIncidentsContextType = {
  open: SlaIncidentsDialogType | null
  setOpen: (str: SlaIncidentsDialogType | null) => void
  currentRow: SlaIncident | null
  setCurrentRow: React.Dispatch<React.SetStateAction<SlaIncident | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const SlaIncidentsContext = React.createContext<SlaIncidentsContextType | null>(
  null
)

export function SlaIncidentsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<SlaIncidentsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<SlaIncident | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <SlaIncidentsContext
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
    </SlaIncidentsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSlaIncidents = () => {
  const slaIncidentsContext = React.useContext(SlaIncidentsContext)

  if (!slaIncidentsContext) {
    throw new Error(
      'useSlaIncidents has to be used within <SlaIncidentsProvider>'
    )
  }

  return slaIncidentsContext
}
