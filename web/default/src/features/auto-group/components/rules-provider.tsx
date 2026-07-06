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
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { AutoGroupRule, RulesDialogType } from '../types'

type RulesContextType = {
  open: RulesDialogType | null
  setOpen: (str: RulesDialogType | null) => void
  currentRow: AutoGroupRule | null
  setCurrentRow: React.Dispatch<React.SetStateAction<AutoGroupRule | null>>
}

const RulesContext = React.createContext<RulesContextType | null>(null)

export function RulesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<RulesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<AutoGroupRule | null>(null)

  return (
    <RulesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </RulesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRulesDialog = () => {
  const ctx = React.useContext(RulesContext)

  if (!ctx) {
    throw new Error('useRulesDialog has to be used within <RulesProvider>')
  }

  return ctx
}
