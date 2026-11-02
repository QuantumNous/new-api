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
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { RouteUnitsSection } from './route-units-section'
import { RoutingReliabilitySection } from './routing-reliability-section'
import type { RoutingReliabilitySectionProps } from './routing-reliability-section'

type RoutingTabId = 'reliability' | 'units'

type RoutingTabContextValue = {
  tab: RoutingTabId
  setTab: (tab: RoutingTabId) => void
}

const RoutingTabContext = createContext<RoutingTabContextValue>({
  tab: 'reliability',
  setTab: () => {},
})

// 路由可靠性与路由单元合并为同一个页签页。Tab 状态由外层页面拥有，
// 标题行渲染 RoutingTabs（与标题同行），内容区渲染 RoutingContent（对应面板）。
export function RoutingTabProvider({
  children,
}: {
  children: ReactNode
}) {
  const [tab, setTab] = useState<RoutingTabId>('reliability')
  return (
    <RoutingTabContext.Provider value={{ tab, setTab }}>
      {children}
    </RoutingTabContext.Provider>
  )
}

// 标题行 Tab 选择器：与页面标题同行，右侧为保存按钮。
export function RoutingTabs() {
  const { tab, setTab } = useContext(RoutingTabContext)
  const { t } = useTranslation()

  return (
    <div className='flex items-center gap-2 shrink-0'>
      <button
        type='button'
        role='tab'
        aria-selected={tab === 'reliability'}
        onClick={() => setTab('reliability')}
        className={cnTab(tab === 'reliability')}
      >
        {t('Routing Reliability')}
      </button>
      <button
        type='button'
        role='tab'
        aria-selected={tab === 'units'}
        onClick={() => setTab('units')}
        className={cnTab(tab === 'units')}
      >
        {t('Route Units')}
      </button>
    </div>
  )
}

// 内容区面板：根据当前 Tab 渲染对应区块。
export function RoutingContent({
  defaultValues,
}: {
  defaultValues: RoutingReliabilitySectionProps['defaultValues']
}) {
  const { tab } = useContext(RoutingTabContext)

  return (
    <div>
      {tab === 'reliability' ? (
        <RoutingReliabilitySection defaultValues={defaultValues} />
      ) : (
        <RouteUnitsSection />
      )}
    </div>
  )
}

function cnTab(active: boolean) {
  return cn(
    'inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm font-medium transition-colors',
    active
      ? 'bg-background text-foreground border-input shadow-sm'
      : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-muted-foreground'
  )
}
