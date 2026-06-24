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
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { DataTablePage, DataTableToolbar } from '@/components/data-table'
import { getAdminSkills } from '../api'
import {
  getAdminSkillKidsOptions,
  getAdminSkillPlanOptions,
  getAdminSkillStatusOptions,
} from '../constants'
import type { AdminSkill, AdminSkillKidsApprovalStatus } from '../types'
import { AdminSkillPreviewDialog } from './admin-skill-dialogs'
import { AdminSkillEditorDialog } from './admin-skill-editor-dialog'
import { useAdminSkillsColumns } from './admin-skills-columns'
import { AdminSkillsMobileList } from './admin-skills-mobile-list'

const route = getRouteApi('/_authenticated/skills/admin/')

function singleFilterValue<T extends string>(
  filters: ColumnFiltersState,
  id: string
): T | undefined {
  const value = filters.find((filter) => filter.id === id)?.value
  return Array.isArray(value) && typeof value[0] === 'string'
    ? (value[0] as T)
    : undefined
}

export function AdminSkillsTable() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [previewSkill, setPreviewSkill] = useState<AdminSkill | null>(null)
  const [editSkill, setEditSkill] = useState<AdminSkill | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const columns = useAdminSkillsColumns({
    onEdit: setEditSkill,
    onPreview: setPreviewSkill,
  })

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'required_plan', searchKey: 'required_plan', type: 'array' },
      {
        columnId: 'kids_approval_status',
        searchKey: 'kids_approval_status',
        type: 'array',
      },
    ],
  })

  const status = singleFilterValue<AdminSkill['status']>(
    columnFilters,
    'status'
  )
  const requiredPlan = singleFilterValue<AdminSkill['required_plan']>(
    columnFilters,
    'required_plan'
  )
  const kidsApprovalStatus = singleFilterValue<AdminSkillKidsApprovalStatus>(
    columnFilters,
    'kids_approval_status'
  )

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      'admin-skills',
      pagination.pageIndex + 1,
      pagination.pageSize,
      status,
      requiredPlan,
      kidsApprovalStatus,
    ],
    queryFn: () =>
      getAdminSkills({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        status,
        required_plan: requiredPlan,
        kids_approval_status: kidsApprovalStatus,
      }),
    placeholderData: (previousData) => previousData,
  })

  useEffect(() => {
    if (!isError) return
    const message =
      (
        error as {
          response?: { data?: { error?: { message?: string } } }
          message?: string
        }
      )?.response?.data?.error?.message ??
      (error as Error | null)?.message ??
      t('Unable to load admin skills.')
    toast.error(message)
  }, [error, isError, t])

  const skills = data?.data ?? []
  const total = data?.pagination?.total ?? 0

  const table = useReactTable({
    data: skills,
    columns,
    state: {
      columnFilters,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onColumnFiltersChange,
    onPaginationChange,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [ensurePageInRange, pageCount])

  return (
    <>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyTitle={t('No Skills Found')}
        emptyDescription={t('No admin skills match the selected filters.')}
        skeletonKeyPrefix='admin-skills-skeleton'
        toolbar={
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <DataTableToolbar
              table={table}
              customSearch={null}
              filters={[
                {
                  columnId: 'status',
                  title: t('Status'),
                  options: getAdminSkillStatusOptions(t),
                  singleSelect: true,
                },
                {
                  columnId: 'required_plan',
                  title: t('Required Plan'),
                  options: getAdminSkillPlanOptions(t),
                  singleSelect: true,
                },
                {
                  columnId: 'kids_approval_status',
                  title: t('Kids Status'),
                  options: getAdminSkillKidsOptions(t),
                  singleSelect: true,
                },
              ]}
            />
            {!isMobile ? (
              <Button onClick={() => setCreateOpen(true)}>
                {t('Create Skill Draft')}
              </Button>
            ) : null}
          </div>
        }
        mobile={
          <AdminSkillsMobileList
            table={table}
            isLoading={isLoading}
            onPreview={setPreviewSkill}
          />
        }
        afterTable={
          isError ? (
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline'
              onClick={() => void refetch()}
            >
              {t('Retry loading admin skills')}
            </button>
          ) : null
        }
      />

      <AdminSkillPreviewDialog
        skill={previewSkill}
        open={!!previewSkill}
        onOpenChange={(open) => !open && setPreviewSkill(null)}
      />
      <AdminSkillEditorDialog
        mode='create'
        skill={null}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <AdminSkillEditorDialog
        mode='edit'
        skill={editSkill}
        open={!!editSkill}
        onOpenChange={(open) => !open && setEditSkill(null)}
      />
    </>
  )
}
