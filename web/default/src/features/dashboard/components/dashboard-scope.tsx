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
import { createContext, useContext, type ReactNode } from 'react'

/**
 * Dashboard analytics data scope.
 *
 * - `self`: personal consumption only (`/api/data/self`, console entry)
 * - `site`: platform-wide admin view (`/api/data`, admin entry)
 *
 * Scope is chosen by route, not by role alone, so admins still get a true
 * personal console when they open the console Analytics page.
 */
export type DashboardDataScope = 'self' | 'site'

interface DashboardScopeContextValue {
  scope: DashboardDataScope
  /** True when this page should call site-wide admin analytics APIs. */
  isSiteWide: boolean
}

const DashboardScopeContext = createContext<DashboardScopeContextValue>({
  scope: 'self',
  isSiteWide: false,
})

export function DashboardScopeProvider(props: {
  scope: DashboardDataScope
  children: ReactNode
}) {
  return (
    <DashboardScopeContext.Provider
      value={{
        scope: props.scope,
        isSiteWide: props.scope === 'site',
      }}
    >
      {props.children}
    </DashboardScopeContext.Provider>
  )
}

export function useDashboardScope(): DashboardScopeContextValue {
  return useContext(DashboardScopeContext)
}
