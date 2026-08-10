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

import type { Team, TeamsDialogType } from '../types'

type TeamsContextType = {
  open: TeamsDialogType | null
  setOpen: (str: TeamsDialogType | null) => void
  currentRow: Team | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Team | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const TeamsContext = React.createContext<TeamsContextType | null>(null)

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<TeamsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Team | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <TeamsContext
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
    </TeamsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTeams = () => {
  const teamsContext = React.useContext(TeamsContext)

  if (!teamsContext) {
    throw new Error('useTeams has to be used within <TeamsProvider>')
  }

  return teamsContext
}
