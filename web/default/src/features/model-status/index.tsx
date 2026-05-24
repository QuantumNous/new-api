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
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { PageTransition } from '@/components/page-transition'
import { StatusFilterBar } from './components/status-filter-bar'
import { StatusGroupSection } from './components/status-group-section'
import { StatusSummary } from './components/status-summary'
import { useModelStatus } from './hooks/use-model-status'
import type {
  ModelStatusFilter,
  ModelStatusViewGroup,
  ModelStatusViewModel,
} from './types'

export function ModelStatusPage() {
  const statusQuery = useModelStatus()
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState<ModelStatusFilter>('all')
  const [search, setSearch] = useState('')

  const visibleGroups = useMemo(
    () =>
      filterGroups(statusQuery.view.groups, {
        selectedGroup,
        selectedStatus,
        search,
      }),
    [search, selectedGroup, selectedStatus, statusQuery.view.groups]
  )

  const groupNames = useMemo(
    () => statusQuery.view.groups.map((group) => group.name),
    [statusQuery.view.groups]
  )

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative min-h-svh overflow-hidden'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-30 dark:opacity-20'
          style={{
            background:
              'radial-gradient(circle at 18% 12%, oklch(0.78 0.18 145 / 35%), transparent 36%), radial-gradient(circle at 82% 8%, oklch(0.74 0.12 210 / 22%), transparent 32%)',
            maskImage:
              'linear-gradient(to bottom, black 50%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 50%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-[1680px] space-y-6 px-4 pt-20 pb-10 sm:px-6 sm:pt-24 xl:px-8'>
          <StatusSummary
            summary={statusQuery.view.summary}
            refreshing={statusQuery.isFetching && !statusQuery.isLoading}
            onRefresh={() => void statusQuery.refetch()}
          />

          {statusQuery.isLoading ? (
            <ModelStatusLoading />
          ) : statusQuery.isError ? (
            <ModelStatusError onRetry={() => void statusQuery.refetch()} />
          ) : statusQuery.view.summary.totalModels === 0 ? (
            <ModelStatusEmpty />
          ) : (
            <>
              <div className='sticky top-16 z-20 -mx-1 px-1 sm:top-20'>
                <StatusFilterBar
                  groupNames={groupNames}
                  selectedGroup={selectedGroup}
                  selectedStatus={selectedStatus}
                  search={search}
                  onGroupChange={setSelectedGroup}
                  onStatusChange={setSelectedStatus}
                  onSearchChange={setSearch}
                />
              </div>

              {visibleGroups.length > 0 ? (
                <div className='grid gap-4 xl:grid-cols-2 2xl:grid-cols-3'>
                  {visibleGroups.map((group) => (
                    <StatusGroupSection key={group.name} group={group} />
                  ))}
                </div>
              ) : (
                <ModelStatusNoMatches />
              )}
            </>
          )}
        </PageTransition>
      </div>
      <Footer />
    </PublicLayout>
  )
}

function filterGroups(
  groups: ModelStatusViewGroup[],
  filter: {
    selectedGroup: string
    selectedStatus: ModelStatusFilter
    search: string
  }
): ModelStatusViewGroup[] {
  const keyword = filter.search.trim().toLowerCase()
  return groups
    .filter(
      (group) =>
        filter.selectedGroup === 'all' || group.name === filter.selectedGroup
    )
    .map((group) => ({
      ...group,
      models: group.models.filter((model) =>
        filterModel(model, filter.selectedStatus, keyword)
      ),
    }))
    .filter((group) => group.models.length > 0)
}

function filterModel(
  model: ModelStatusViewModel,
  selectedStatus: ModelStatusFilter,
  keyword: string
) {
  const statusMatched =
    selectedStatus === 'all' || model.healthLabel === selectedStatus
  const searchMatched =
    keyword.length === 0 || model.model.toLowerCase().includes(keyword)
  return statusMatched && searchMatched
}

function ModelStatusLoading() {
  return (
    <div className='space-y-5'>
      <Skeleton className='h-16 rounded-2xl' />
      <Skeleton className='h-60 rounded-2xl' />
      <Skeleton className='h-60 rounded-2xl' />
    </div>
  )
}

function ModelStatusError(props: { onRetry: () => void }) {
  return (
    <div className='bg-card rounded-2xl border border-dashed px-6 py-12 text-center shadow-sm'>
      <h2 className='text-lg font-semibold'>状态数据加载失败</h2>
      <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm'>
        服务暂时无法读取模型状态缓存，请稍后重试。
      </p>
      <Button className='mt-5' variant='outline' onClick={props.onRetry}>
        重新加载
      </Button>
    </div>
  )
}

function ModelStatusEmpty() {
  return (
    <div className='bg-card rounded-2xl border border-dashed px-6 py-12 text-center shadow-sm'>
      <h2 className='text-lg font-semibold'>暂无模型状态数据</h2>
      <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm'>
        当前还没有完成模型状态同步。请稍后刷新，或联系管理员确认状态同步任务是否已启用。
      </p>
    </div>
  )
}

function ModelStatusNoMatches() {
  return (
    <div className='bg-card rounded-2xl border border-dashed px-6 py-10 text-center shadow-sm'>
      <h2 className='text-base font-semibold'>没有匹配的模型</h2>
      <p className='text-muted-foreground mt-2 text-sm'>
        请调整分组、状态或模型名称筛选条件。
      </p>
    </div>
  )
}
