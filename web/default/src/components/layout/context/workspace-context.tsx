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
/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { type Workspace } from '../types'

type WorkspaceContextType = {
  activeWorkspace: Workspace | null
  setActiveWorkspace: (workspace: Workspace) => void
}

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(
  undefined
)

/**
 * 工作区上下文 Provider
 * 管理当前激活的工作区状态，用于切换不同的侧边栏视图
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] =
    React.useState<Workspace | null>(null)

  const value = React.useMemo(
    () => ({ activeWorkspace, setActiveWorkspace }),
    [activeWorkspace]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

/**
 * 使用工作区上下文的 Hook
 * @throws 如果在 WorkspaceProvider 外部使用会抛出错误
 */
export function useWorkspace() {
  const context = React.useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider')
  }
  return context
}
