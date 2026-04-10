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
