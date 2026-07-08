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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Building2,
  Download,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { searchUsers } from '@/features/users/api'
import type { User } from '@/features/users/types'
import {
  formatNumber,
  formatPercent,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  addAdminOrganizationMember,
  addCurrentOrganizationMember,
  buildAdminOrganizationExportUrl,
  buildOrganizationExportUrl,
  createAdminOrganization,
  getAdminOrganization,
  getAdminOrganizationBillingChannels,
  getAdminOrganizationBillingLogs,
  getAdminOrganizationBillingMembers,
  getAdminOrganizationBillingModels,
  getAdminOrganizationBillingSummary,
  getAdminOrganizationBillingTrend,
  getAdminOrganizationMembers,
  getAdminOrganizations,
  getCurrentOrganizationMembers,
  getOrganizationBillingChannels,
  getOrganizationBillingLogs,
  getOrganizationBillingModels,
  getOrganizationBillingSummary,
  getOrganizationBillingTrend,
  getOrganizationSelf,
  organizationKeys,
  removeAdminOrganizationMember,
  removeCurrentOrganizationMember,
  updateAdminOrganization,
  updateAdminOrganizationMember,
  updateCurrentOrganization,
  updateCurrentOrganizationMember,
} from './api'
import {
  ORGANIZATION_STATUS_DISABLED,
  ORGANIZATION_STATUS_ENABLED,
  type Organization,
  type OrganizationDimensionRow,
  type OrganizationMember,
  type OrganizationRole,
  type OrganizationStatus,
  type OrganizationSummary,
  type OrganizationTrendRow,
  type OrganizationUsageParams,
  type OrganizationUsageRow,
} from './types'

const ROLE_OPTIONS: OrganizationRole[] = ['owner', 'admin', 'billing', 'member']
const MANAGE_ROLES = new Set<OrganizationRole>(['owner', 'admin'])
const BILLING_ROLES = new Set<OrganizationRole>(['owner', 'admin', 'billing'])

function canManageMembers(role?: OrganizationRole) {
  return role ? MANAGE_ROLES.has(role) : false
}

function canViewBilling(role?: OrganizationRole) {
  return role ? BILLING_ROLES.has(role) : false
}

function roleLabel(role: OrganizationRole, t: (key: string) => string) {
  const labels: Record<OrganizationRole, string> = {
    owner: t('Owner'),
    admin: t('Admin'),
    billing: t('Billing'),
    member: t('Member'),
  }
  return labels[role]
}

function statusLabel(status: OrganizationStatus, t: (key: string) => string) {
  return status === ORGANIZATION_STATUS_ENABLED ? t('Active') : t('Suspended')
}

function roleBadgeVariant(role: OrganizationRole) {
  return role === 'owner' || role === 'admin' ? 'default' : 'outline'
}

function organizationDetailTabLabel(
  tab: 'members' | 'billing' | 'logs',
  t: (key: string) => string
) {
  if (tab === 'members') return t('Members')
  if (tab === 'billing') return t('Billing')
  return t('Logs')
}

function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border bg-background', className)}>
      <div className='flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'>
          <h2 className='truncate text-base font-medium'>{title}</h2>
          {description ? (
            <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
          ) : null}
        </div>
        {actions ? <div className='flex shrink-0 gap-2'>{actions}</div> : null}
      </div>
      <div className='p-4'>{children}</div>
    </section>
  )
}

function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <div className='min-w-0'>
        <h1 className='truncate text-2xl font-semibold tracking-normal'>
          {title}
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
      </div>
      {actions ? <div className='flex shrink-0 gap-2'>{actions}</div> : null}
    </div>
  )
}

function OrganizationEmptyState() {
  const { t } = useTranslation()
  return (
    <Empty className='min-h-[360px] border'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Building2 />
        </EmptyMedia>
        <EmptyTitle>{t('No organization')}</EmptyTitle>
        <EmptyDescription>
          {t('You are not a member of an organization yet.')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{t('Ask an administrator to add you first.')}</EmptyContent>
    </Empty>
  )
}

function AccessDeniedState() {
  const { t } = useTranslation()
  return (
    <Empty className='min-h-[320px] border'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Settings />
        </EmptyMedia>
        <EmptyTitle>{t('No permission')}</EmptyTitle>
        <EmptyDescription>
          {t('Your organization role cannot access this page.')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className='text-muted-foreground flex min-h-[180px] items-center justify-center rounded-lg border border-dashed text-sm'>
      {label}
    </div>
  )
}

function useOrganizationContext() {
  return useQuery({
    queryKey: organizationKeys.self,
    queryFn: getOrganizationSelf,
  })
}

function utcDateBoundaryToUnix(value: string, endOfDay: boolean) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  const ms = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59)
    : Date.UTC(year, month - 1, day, 0, 0, 0)
  if (!Number.isFinite(ms)) return undefined
  return Math.floor(ms / 1000)
}

function dateToUnix(value: string) {
  return utcDateBoundaryToUnix(value, false)
}

function unixEndOfDate(value: string) {
  return utcDateBoundaryToUnix(value, true)
}

function useUsageFilters() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userId, setUserId] = useState('')
  const [modelName, setModelName] = useState('')
  const [channelId, setChannelId] = useState('')
  const [page, setPage] = useState(1)

  const params = useMemo<OrganizationUsageParams>(
    () => ({
      start_timestamp: dateToUnix(startDate),
      end_timestamp: unixEndOfDate(endDate),
      user_id: userId ? Number(userId) : undefined,
      model_name: modelName || undefined,
      channel: channelId ? Number(channelId) : undefined,
      p: page,
      page_size: 20,
    }),
    [channelId, endDate, modelName, page, startDate, userId]
  )

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    userId,
    setUserId,
    modelName,
    setModelName,
    channelId,
    setChannelId,
    page,
    setPage,
    params,
  }
}

function UsageFilters({
  filters,
  onRefresh,
  onExport,
  showMemberFilter,
}: {
  filters: ReturnType<typeof useUsageFilters>
  onRefresh: () => void
  onExport?: () => void
  showMemberFilter: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]'>
      <Input
        type='date'
        value={filters.startDate}
        onChange={(event) => {
          filters.setStartDate(event.target.value)
          filters.setPage(1)
        }}
        aria-label={t('Start date')}
      />
      <Input
        type='date'
        value={filters.endDate}
        onChange={(event) => {
          filters.setEndDate(event.target.value)
          filters.setPage(1)
        }}
        aria-label={t('End date')}
      />
      {showMemberFilter ? (
        <Input
          value={filters.userId}
          onChange={(event) => {
            filters.setUserId(event.target.value)
            filters.setPage(1)
          }}
          placeholder={t('User ID')}
        />
      ) : null}
      <Input
        value={filters.modelName}
        onChange={(event) => {
          filters.setModelName(event.target.value)
          filters.setPage(1)
        }}
        placeholder={t('Model')}
      />
      <Input
        value={filters.channelId}
        onChange={(event) => {
          filters.setChannelId(event.target.value)
          filters.setPage(1)
        }}
        placeholder={t('Channel ID')}
      />
      <div className='flex gap-2'>
        <Button variant='outline' size='icon' onClick={onRefresh}>
          <RefreshCw />
          <span className='sr-only'>{t('Refresh')}</span>
        </Button>
        {onExport ? (
          <Button variant='outline' size='icon' onClick={onExport}>
            <Download />
            <span className='sr-only'>{t('Export')}</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function SummaryGrid({ summary }: { summary?: OrganizationSummary }) {
  const { t } = useTranslation()
  const items = [
    { label: t('Requests'), value: formatNumber(summary?.request_count) },
    { label: t('Amount'), value: formatQuota(summary?.total_quota ?? 0) },
    { label: t('Raw Quota'), value: formatNumber(summary?.total_quota) },
    {
      label: t('Prompt tokens'),
      value: formatNumber(summary?.prompt_tokens),
    },
    {
      label: t('Completion tokens'),
      value: formatNumber(summary?.completion_tokens),
    },
    {
      label: t('Active members'),
      value: formatNumber(summary?.active_member_count),
    },
  ]

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-6'>
      {items.map((item) => (
        <div key={item.label} className='rounded-lg border p-4'>
          <div className='text-muted-foreground text-xs'>{item.label}</div>
          <div className='mt-2 text-xl font-semibold'>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function dimensionRowName(row: OrganizationDimensionRow) {
  if (row.display_name && row.username) {
    return `${row.display_name} (${row.username})`
  }
  return (
    row.display_name ||
    row.username ||
    row.model_name ||
    row.channel_name ||
    row.channel_id ||
    row.user_id ||
    '-'
  )
}

function dimensionRowKey(row: OrganizationDimensionRow, fallback: string) {
  if (row.user_id != null) return `user:${row.user_id}`
  if (row.model_name != null) return `model:${row.model_name || '__empty__'}`
  if (row.channel_id != null) return `channel:${row.channel_id}`
  return `fallback:${fallback}`
}

function dimensionTokenCount(row: OrganizationDimensionRow) {
  return (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)
}

function formatQuotaShare(rowQuota: number, totalQuota?: number) {
  if (!totalQuota || totalQuota <= 0) return formatPercent(0)
  return formatPercent((rowQuota / totalQuota) * 100)
}

function formatPricingSnapshot(
  row: OrganizationDimensionRow,
  t: (key: string) => string
) {
  const pricing = row.pricing
  if (!pricing) return '-'
  if (pricing.billing_mode === 'tiered_expr' && pricing.billing_expr) {
    return t('Tiered')
  }
  if (pricing.quota_type === 1) {
    return `${t('Fixed price')} ${formatNumber(pricing.model_price)}`
  }
  return `${t('Ratio')} ${formatNumber(pricing.model_ratio)}`
}

function DimensionTable(props: {
  rows?: OrganizationDimensionRow[]
  nameLabel: string
  totalQuota?: number
  showPricing?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{props.nameLabel}</TableHead>
            <TableHead className='text-right'>{t('Amount')}</TableHead>
            <TableHead className='text-right'>{t('Raw Quota')}</TableHead>
            <TableHead className='text-right'>{t('Share')}</TableHead>
            <TableHead className='text-right'>{t('Requests')}</TableHead>
            <TableHead className='text-right'>{t('Prompt tokens')}</TableHead>
            <TableHead className='text-right'>
              {t('Completion tokens')}
            </TableHead>
            <TableHead className='text-right'>{t('Tokens')}</TableHead>
            {props.showPricing ? <TableHead>{t('Pricing')}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(props.rows ?? []).map((row) => {
            const rowName = dimensionRowName(row)
            return (
              <TableRow key={String(dimensionRowKey(row, String(rowName)))}>
                <TableCell className='min-w-36 max-w-72 truncate'>
                  {rowName}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatQuota(row.total_quota)}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatNumber(row.total_quota)}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatQuotaShare(row.total_quota, props.totalQuota)}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatNumber(row.request_count)}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatNumber(row.prompt_tokens)}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatNumber(row.completion_tokens)}
                </TableCell>
                <TableCell className='whitespace-nowrap text-right'>
                  {formatNumber(dimensionTokenCount(row))}
                </TableCell>
                {props.showPricing ? (
                  <TableCell className='whitespace-nowrap'>
                    {formatPricingSnapshot(row, t)}
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
          {!props.rows?.length ? (
            <EmptyTableRow colSpan={props.showPricing ? 9 : 8} />
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

function TrendTable({ rows }: { rows?: OrganizationTrendRow[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Date')}</TableHead>
          <TableHead className='text-right'>{t('Amount')}</TableHead>
          <TableHead className='text-right'>{t('Raw Quota')}</TableHead>
          <TableHead className='text-right'>{t('Requests')}</TableHead>
          <TableHead className='text-right'>{t('Tokens')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row) => (
          <TableRow key={row.period}>
            <TableCell>{row.period}</TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatQuota(row.total_quota)}
            </TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatNumber(row.total_quota)}
            </TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatNumber(row.request_count)}
            </TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatNumber(
                (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)
              )}
            </TableCell>
          </TableRow>
        ))}
        {!rows?.length ? <EmptyTableRow colSpan={5} /> : null}
      </TableBody>
    </Table>
  )
}

function LogsTable({ rows }: { rows?: OrganizationUsageRow[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Time')}</TableHead>
          <TableHead>{t('User')}</TableHead>
          <TableHead>{t('Model')}</TableHead>
          <TableHead>{t('Channel')}</TableHead>
          <TableHead className='text-right'>{t('Amount')}</TableHead>
          <TableHead className='text-right'>{t('Raw Quota')}</TableHead>
          <TableHead className='text-right'>{t('Tokens')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`${row.id ?? index}-${row.created_at ?? ''}`}>
            <TableCell>{formatTimestampToDate(row.created_at)}</TableCell>
            <TableCell>{row.username || row.user_id || '-'}</TableCell>
            <TableCell>{row.model_name || '-'}</TableCell>
            <TableCell>{row.channel_name || row.channel_id || '-'}</TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatQuota(row.quota ?? 0)}
            </TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatNumber(row.quota)}
            </TableCell>
            <TableCell className='whitespace-nowrap text-right'>
              {formatNumber(
                (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)
              )}
            </TableCell>
          </TableRow>
        ))}
        {!rows?.length ? <EmptyTableRow colSpan={7} /> : null}
      </TableBody>
    </Table>
  )
}

function EmptyTableRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation()
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className='text-muted-foreground h-24 text-center'
      >
        {t('No data')}
      </TableCell>
    </TableRow>
  )
}

function Pager({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className='flex items-center justify-end gap-3 pt-3'>
      <div className='text-muted-foreground text-sm'>
        {t('Page')} {page} / {pageCount}
      </div>
      <Button
        variant='outline'
        size='sm'
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('Previous')}
      </Button>
      <Button
        variant='outline'
        size='sm'
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {t('Next')}
      </Button>
    </div>
  )
}

function UserSearchPicker({
  selectedUser,
  onSelect,
}: {
  selectedUser: User | null
  onSelect: (user: User) => void
}) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const usersQuery = useQuery({
    queryKey: ['organization', 'user-search', keyword],
    queryFn: () => searchUsers({ keyword, page_size: 8 }),
    enabled: keyword.trim().length > 0,
  })
  const users = usersQuery.data?.data?.items ?? []

  return (
    <div className='space-y-3'>
      <div className='relative'>
        <Search className='text-muted-foreground absolute top-2.5 left-2.5 size-4' />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className='pl-8'
          placeholder={t('Search users')}
        />
      </div>
      {selectedUser ? (
        <div className='rounded-lg border p-3 text-sm'>
          <div className='font-medium'>
            {selectedUser.display_name || selectedUser.username}
          </div>
          <div className='text-muted-foreground'>
            {selectedUser.username} · ID {selectedUser.id}
          </div>
        </div>
      ) : null}
      <div className='max-h-56 overflow-auto rounded-lg border'>
        {users.map((user) => (
          <button
            key={user.id}
            type='button'
            className='hover:bg-muted flex w-full items-center justify-between gap-3 border-b p-3 text-left text-sm last:border-0'
            onClick={() => onSelect(user)}
          >
            <span className='min-w-0'>
              <span className='block truncate font-medium'>
                {user.display_name || user.username}
              </span>
              <span className='text-muted-foreground block truncate'>
                {user.username} · ID {user.id}
              </span>
            </span>
            {selectedUser?.id === user.id ? (
              <Badge>{t('Selected')}</Badge>
            ) : null}
          </button>
        ))}
        {keyword && !usersQuery.isLoading && users.length === 0 ? (
          <div className='text-muted-foreground p-4 text-center text-sm'>
            {t('No users found')}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MemberDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  allowOwner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (userId: number, role: OrganizationRole) => void
  isPending: boolean
  allowOwner?: boolean
}) {
  const { t } = useTranslation()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [role, setRole] = useState<OrganizationRole>('member')
  const roleOptions = allowOwner
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((item) => item !== 'owner')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Add organization member')}</DialogTitle>
          <DialogDescription>
            {t('Search a user and choose an organization role.')}
          </DialogDescription>
        </DialogHeader>
        <UserSearchPicker
          selectedUser={selectedUser}
          onSelect={setSelectedUser}
        />
        <NativeSelect
          className='w-full'
          value={role}
          onChange={(event) => setRole(event.target.value as OrganizationRole)}
        >
          {roleOptions.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {roleLabel(item, t)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <DialogFooter>
          <Button
            disabled={!selectedUser || isPending}
            onClick={() => selectedUser && onSubmit(selectedUser.id, role)}
          >
            <UserPlus />
            {t('Add member')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettingsDialog({
  organization,
  open,
  onOpenChange,
  onSubmit,
  isPending,
  canEditStatus,
}: {
  organization: Organization
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { name: string; status?: OrganizationStatus }) => void
  isPending: boolean
  canEditStatus?: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(organization.name)
  const [status, setStatus] = useState(String(organization.status))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Organization settings')}</DialogTitle>
          <DialogDescription>
            {t('Update the organization name and status.')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {canEditStatus ? (
            <NativeSelect
              className='w-full'
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <NativeSelectOption value={String(ORGANIZATION_STATUS_ENABLED)}>
                {t('Active')}
              </NativeSelectOption>
              <NativeSelectOption value={String(ORGANIZATION_STATUS_DISABLED)}>
                {t('Suspended')}
              </NativeSelectOption>
            </NativeSelect>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || isPending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                status: canEditStatus
                  ? (Number(status) as OrganizationStatus)
                  : undefined,
              })
            }
          >
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MembersTable({
  members,
  currentRole,
  onRoleChange,
  onRemove,
  isMutating,
  allowOwnerRole,
  ownerAssigned,
}: {
  members?: OrganizationMember[]
  currentRole?: OrganizationRole
  onRoleChange: (userId: number, role: OrganizationRole) => void
  onRemove: (member: OrganizationMember) => void
  isMutating: boolean
  allowOwnerRole?: boolean
  ownerAssigned?: boolean
}) {
  const { t } = useTranslation()
  const canEdit = canManageMembers(currentRole)
  const canEditOwner = currentRole === 'owner'
  const roleOptions =
    allowOwnerRole && !ownerAssigned
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter((item) => item !== 'owner')

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('User')}</TableHead>
          <TableHead>{t('Role')}</TableHead>
          <TableHead>{t('Joined at')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead className='text-right'>{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(members ?? []).map((member) => {
          const displayName =
            member.display_name || member.username || `ID ${member.user_id}`
          const secondaryName = member.username
            ? `${member.username} · ID ${member.user_id}`
            : `ID ${member.user_id}`
          const secondaryInfo = member.email
            ? `${secondaryName} · ${member.email}`
            : secondaryName
          const disabled =
            isMutating ||
            !canEdit ||
            member.role === 'owner' ||
            (member.role === 'admin' && !canEditOwner)
          return (
            <TableRow key={`${member.user_id}-${member.left_at ?? 0}`}>
              <TableCell>
                <div className='font-medium'>{displayName}</div>
                <div className='text-muted-foreground text-xs'>
                  {secondaryInfo}
                </div>
              </TableCell>
              <TableCell>
                {canEdit && member.role !== 'owner' ? (
                  <NativeSelect
                    size='sm'
                    value={member.role}
                    disabled={disabled}
                    onChange={(event) =>
                      onRoleChange(
                        member.user_id,
                        event.target.value as OrganizationRole
                      )
                    }
                  >
                    {roleOptions.map((item) => (
                      <NativeSelectOption key={item} value={item}>
                        {roleLabel(item, t)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge variant={roleBadgeVariant(member.role)}>
                    {roleLabel(member.role, t)}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{formatTimestampToDate(member.joined_at)}</TableCell>
              <TableCell>
                {member.left_at ? (
                  <Badge variant='outline'>{t('Removed')}</Badge>
                ) : (
                  <Badge variant='secondary'>{t('Active')}</Badge>
                )}
              </TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  disabled={disabled || Boolean(member.left_at)}
                  onClick={() => onRemove(member)}
                >
                  <Trash2 />
                  <span className='sr-only'>{t('Remove')}</span>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
        {!members?.length ? <EmptyTableRow colSpan={5} /> : null}
      </TableBody>
    </Table>
  )
}

export function OrganizationUsagePage() {
  const { t } = useTranslation()
  const contextQuery = useOrganizationContext()
  const filters = useUsageFilters()
  const self = contextQuery.data?.data
  const role = self?.member.role
  const enabled = Boolean(self && canViewBilling(role))

  const summaryQuery = useQuery({
    queryKey: organizationKeys.summary(filters.params),
    queryFn: () => getOrganizationBillingSummary(filters.params),
    enabled,
  })
  const trendQuery = useQuery({
    queryKey: organizationKeys.trend(filters.params),
    queryFn: () => getOrganizationBillingTrend(filters.params),
    enabled,
  })
  const modelsQuery = useQuery({
    queryKey: organizationKeys.models(filters.params),
    queryFn: () => getOrganizationBillingModels(filters.params),
    enabled,
  })
  const channelsQuery = useQuery({
    queryKey: organizationKeys.channels(filters.params),
    queryFn: () => getOrganizationBillingChannels(filters.params),
    enabled,
  })

  if (contextQuery.isLoading) return <LoadingBlock label={t('Loading...')} />
  if (!self) return <OrganizationEmptyState />
  if (!canViewBilling(role)) return <AccessDeniedState />

  const refresh = () => {
    void summaryQuery.refetch()
    void trendQuery.refetch()
    void modelsQuery.refetch()
    void channelsQuery.refetch()
  }

  return (
    <div className='space-y-4'>
      <PageHeader
        title={t('Organization billing')}
        description={self.organization.name}
        actions={
          <Badge
            variant={
              self.organization.status === ORGANIZATION_STATUS_ENABLED
                ? 'secondary'
                : 'outline'
            }
          >
            {statusLabel(self.organization.status, t)}
          </Badge>
        }
      />
      <UsageFilters
        filters={filters}
        showMemberFilter
        onRefresh={refresh}
        onExport={() => {
          window.location.href = buildOrganizationExportUrl(filters.params)
        }}
      />
      <SummaryGrid summary={summaryQuery.data?.data} />
      <div className='grid gap-4 xl:grid-cols-2'>
        <Panel title={t('Usage trend')}>
          <TrendTable rows={trendQuery.data?.data} />
        </Panel>
        <Panel title={t('Model usage')}>
          <DimensionTable
            rows={modelsQuery.data?.data}
            nameLabel={t('Model')}
            totalQuota={summaryQuery.data?.data?.total_quota}
            showPricing
          />
        </Panel>
        <Panel title={t('Channel usage')}>
          <DimensionTable
            rows={channelsQuery.data?.data}
            nameLabel={t('Channel')}
            totalQuota={summaryQuery.data?.data?.total_quota}
          />
        </Panel>
      </div>
    </div>
  )
}

export function OrganizationMembersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [removingMember, setRemovingMember] =
    useState<OrganizationMember | null>(null)
  const contextQuery = useOrganizationContext()
  const self = contextQuery.data?.data
  const role = self?.member.role
  const enabled = Boolean(self && canManageMembers(role))

  const membersQuery = useQuery({
    queryKey: organizationKeys.members(showHistory),
    queryFn: () => getCurrentOrganizationMembers(showHistory),
    enabled,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization'] })
  }

  const addMutation = useMutation({
    mutationFn: ({
      userId,
      memberRole,
    }: {
      userId: number
      memberRole: OrganizationRole
    }) => addCurrentOrganizationMember({ user_id: userId, role: memberRole }),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Member added'))
      setMemberDialogOpen(false)
      invalidate()
    },
  })
  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      memberRole,
    }: {
      userId: number
      memberRole: OrganizationRole
    }) => updateCurrentOrganizationMember(userId, { role: memberRole }),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Role updated'))
      invalidate()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeCurrentOrganizationMember(userId),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Member removed'))
      setRemovingMember(null)
      invalidate()
    },
  })
  const settingsMutation = useMutation({
    mutationFn: updateCurrentOrganization,
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Organization updated'))
      setSettingsOpen(false)
      invalidate()
    },
  })

  if (contextQuery.isLoading) return <LoadingBlock label={t('Loading...')} />
  if (!self) return <OrganizationEmptyState />
  if (!canManageMembers(role)) return <AccessDeniedState />

  return (
    <div className='space-y-4'>
      <PageHeader
        title={t('Organization members')}
        description={self.organization.name}
        actions={
          <>
            <Button variant='outline' onClick={() => setSettingsOpen(true)}>
              <Settings />
              {t('Settings')}
            </Button>
            <Button onClick={() => setMemberDialogOpen(true)}>
              <Plus />
              {t('Add member')}
            </Button>
          </>
        }
      />
      <Panel
        title={t('Members')}
        description={t('Manage roles and organization membership.')}
        actions={
          <NativeSelect
            size='sm'
            value={showHistory ? 'history' : 'active'}
            onChange={(event) =>
              setShowHistory(event.target.value === 'history')
            }
          >
            <NativeSelectOption value='active'>
              {t('Active')}
            </NativeSelectOption>
            <NativeSelectOption value='history'>
              {t('Include removed')}
            </NativeSelectOption>
          </NativeSelect>
        }
      >
        <MembersTable
          members={membersQuery.data?.data}
          currentRole={role}
          isMutating={
            addMutation.isPending ||
            roleMutation.isPending ||
            removeMutation.isPending
          }
          onRoleChange={(userId, memberRole) =>
            roleMutation.mutate({ userId, memberRole })
          }
          onRemove={setRemovingMember}
        />
      </Panel>
      <MemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        isPending={addMutation.isPending}
        onSubmit={(userId, memberRole) =>
          addMutation.mutate({ userId, memberRole })
        }
      />
      <SettingsDialog
        organization={self.organization}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isPending={settingsMutation.isPending}
        onSubmit={(payload) => settingsMutation.mutate(payload)}
      />
      <ConfirmDialog
        open={Boolean(removingMember)}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title={t('Remove member')}
        desc={t('This user will lose access to the organization.')}
        destructive
        isLoading={removeMutation.isPending}
        handleConfirm={() =>
          removingMember && removeMutation.mutate(removingMember.user_id)
        }
      />
    </div>
  )
}

export function OrganizationLogsPage() {
  const { t } = useTranslation()
  const contextQuery = useOrganizationContext()
  const filters = useUsageFilters()
  const self = contextQuery.data?.data
  const role = self?.member.role
  const enabled = Boolean(self && canViewBilling(role))

  const logsQuery = useQuery({
    queryKey: organizationKeys.logs(filters.params),
    queryFn: () => getOrganizationBillingLogs(filters.params),
    enabled,
  })

  if (contextQuery.isLoading) return <LoadingBlock label={t('Loading...')} />
  if (!self) return <OrganizationEmptyState />
  if (!canViewBilling(role)) return <AccessDeniedState />

  const pageData = logsQuery.data?.data

  return (
    <div className='space-y-4'>
      <PageHeader
        title={t('Organization billing logs')}
        description={self.organization.name}
      />
      <UsageFilters
        filters={filters}
        showMemberFilter
        onRefresh={() => void logsQuery.refetch()}
        onExport={() => {
          window.location.href = buildOrganizationExportUrl(filters.params)
        }}
      />
      <Panel title={t('Billing logs')}>
        <LogsTable rows={pageData?.items} />
        <Pager
          page={pageData?.page ?? filters.page}
          total={pageData?.total ?? 0}
          pageSize={pageData?.page_size ?? 20}
          onPageChange={filters.setPage}
        />
      </Panel>
    </div>
  )
}

function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Create organization')}</DialogTitle>
          <DialogDescription>
            {t('Create an organization first, then add members later.')}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('Organization name')}
        />
        <DialogFooter>
          <Button
            disabled={!name.trim() || isPending}
            onClick={() => onSubmit(name.trim())}
          >
            <Plus />
            {t('Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminOrganizationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const params = useMemo(
    () => ({ p: page, page_size: 20, keyword, status }),
    [keyword, page, status]
  )

  const organizationsQuery = useQuery({
    queryKey: organizationKeys.organizations(params),
    queryFn: () => getAdminOrganizations(params),
  })
  const createMutation = useMutation({
    mutationFn: (name: string) => createAdminOrganization({ name }),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Organization created'))
      setCreateOpen(false)
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'organizations'],
      })
    },
  })

  const pageData = organizationsQuery.data?.data

  return (
    <div className='space-y-4'>
      <PageHeader
        title={t('Organizations')}
        description={t('Manage organizations, owners, members, and billing.')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t('Create organization')}
          </Button>
        }
      />
      <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]'>
        <Input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
          placeholder={t('Search organizations')}
        />
        <NativeSelect
          className='w-full'
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <NativeSelectOption value=''>{t('All statuses')}</NativeSelectOption>
          <NativeSelectOption value={String(ORGANIZATION_STATUS_ENABLED)}>
            {t('Active')}
          </NativeSelectOption>
          <NativeSelectOption value={String(ORGANIZATION_STATUS_DISABLED)}>
            {t('Suspended')}
          </NativeSelectOption>
        </NativeSelect>
        <Button
          variant='outline'
          size='icon'
          onClick={() => void organizationsQuery.refetch()}
        >
          <RefreshCw />
          <span className='sr-only'>{t('Refresh')}</span>
        </Button>
      </div>
      <Panel title={t('Organizations')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Owner ID')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Updated at')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pageData?.items ?? []).map((organization) => (
              <TableRow key={organization.id}>
                <TableCell>
                  <div className='font-medium'>{organization.name}</div>
                  <div className='text-muted-foreground text-xs'>
                    ID {organization.id}
                  </div>
                </TableCell>
                <TableCell>{organization.owner_id || '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      organization.status === ORGANIZATION_STATUS_ENABLED
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {statusLabel(organization.status, t)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatTimestampToDate(organization.updated_at)}
                </TableCell>
                <TableCell className='text-right'>
                  <Button
                    variant='outline'
                    size='sm'
                    nativeButton={false}
                    render={
                      <Link
                        to='/admin/organizations/$id'
                        params={{ id: String(organization.id) }}
                      />
                    }
                  >
                    {t('Manage')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!pageData?.items?.length ? <EmptyTableRow colSpan={5} /> : null}
          </TableBody>
        </Table>
        <Pager
          page={pageData?.page ?? page}
          total={pageData?.total ?? 0}
          pageSize={pageData?.page_size ?? 20}
          onPageChange={setPage}
        />
      </Panel>
      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isPending={createMutation.isPending}
        onSubmit={(name) => createMutation.mutate(name)}
      />
    </div>
  )
}

export function AdminOrganizationDetailPage({ id }: { id: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'members' | 'billing' | 'logs'>('members')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [removingMember, setRemovingMember] =
    useState<OrganizationMember | null>(null)
  const filters = useUsageFilters()

  const organizationQuery = useQuery({
    queryKey: organizationKeys.adminDetail(id),
    queryFn: () => getAdminOrganization(id),
  })
  const membersQuery = useQuery({
    queryKey: organizationKeys.adminMembers(id, showHistory),
    queryFn: () => getAdminOrganizationMembers(id, showHistory),
  })
  const summaryQuery = useQuery({
    queryKey: organizationKeys.adminSummary(id, filters.params),
    queryFn: () => getAdminOrganizationBillingSummary(id, filters.params),
    enabled: tab === 'billing',
  })
  const billingTrendQuery = useQuery({
    queryKey: organizationKeys.adminBillingTrend(id, filters.params),
    queryFn: () => getAdminOrganizationBillingTrend(id, filters.params),
    enabled: tab === 'billing',
  })
  const billingMembersQuery = useQuery({
    queryKey: organizationKeys.adminBillingMembers(id, filters.params),
    queryFn: () => getAdminOrganizationBillingMembers(id, filters.params),
    enabled: tab === 'billing',
  })
  const billingModelsQuery = useQuery({
    queryKey: organizationKeys.adminBillingModels(id, filters.params),
    queryFn: () => getAdminOrganizationBillingModels(id, filters.params),
    enabled: tab === 'billing',
  })
  const billingChannelsQuery = useQuery({
    queryKey: organizationKeys.adminBillingChannels(id, filters.params),
    queryFn: () => getAdminOrganizationBillingChannels(id, filters.params),
    enabled: tab === 'billing',
  })
  const logsQuery = useQuery({
    queryKey: organizationKeys.adminLogs(id, filters.params),
    queryFn: () => getAdminOrganizationBillingLogs(id, filters.params),
    enabled: tab === 'logs',
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['admin', 'organizations', id],
    })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] })
  }

  const addMutation = useMutation({
    mutationFn: ({
      userId,
      memberRole,
    }: {
      userId: number
      memberRole: OrganizationRole
    }) => addAdminOrganizationMember(id, { user_id: userId, role: memberRole }),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Member added'))
      setMemberDialogOpen(false)
      invalidate()
    },
  })
  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      memberRole,
    }: {
      userId: number
      memberRole: OrganizationRole
    }) => updateAdminOrganizationMember(id, userId, { role: memberRole }),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Role updated'))
      invalidate()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeAdminOrganizationMember(id, userId),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Member removed'))
      setRemovingMember(null)
      invalidate()
    },
  })
  const settingsMutation = useMutation({
    mutationFn: (payload: { name: string; status?: OrganizationStatus }) =>
      updateAdminOrganization(id, payload),
    onSuccess: (res) => {
      if (!res.success) return
      toast.success(t('Organization updated'))
      setSettingsOpen(false)
      invalidate()
    },
  })

  const organization = organizationQuery.data?.data
  const logsData = logsQuery.data?.data

  if (organizationQuery.isLoading) {
    return <LoadingBlock label={t('Loading...')} />
  }
  if (!organization) {
    return <OrganizationEmptyState />
  }

  return (
    <div className='space-y-4'>
      <PageHeader
        title={organization.name}
        description={`${t('Organization')} ID ${organization.id}`}
        actions={
          <>
            <Badge
              variant={
                organization.status === ORGANIZATION_STATUS_ENABLED
                  ? 'secondary'
                  : 'outline'
              }
            >
              {statusLabel(organization.status, t)}
            </Badge>
            <Button variant='outline' onClick={() => setSettingsOpen(true)}>
              <Settings />
              {t('Settings')}
            </Button>
          </>
        }
      />
      <div className='flex flex-wrap gap-2 border-b'>
        {(['members', 'billing', 'logs'] as const).map((item) => (
          <button
            key={item}
            type='button'
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium',
              tab === item
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab(item)}
          >
            {organizationDetailTabLabel(item, t)}
          </button>
        ))}
      </div>
      {tab === 'members' ? (
        <Panel
          title={t('Members')}
          actions={
            <>
              <NativeSelect
                size='sm'
                value={showHistory ? 'history' : 'active'}
                onChange={(event) =>
                  setShowHistory(event.target.value === 'history')
                }
              >
                <NativeSelectOption value='active'>
                  {t('Active')}
                </NativeSelectOption>
                <NativeSelectOption value='history'>
                  {t('Include removed')}
                </NativeSelectOption>
              </NativeSelect>
              <Button size='sm' onClick={() => setMemberDialogOpen(true)}>
                <Plus />
                {t('Add member')}
              </Button>
            </>
          }
        >
          <MembersTable
            members={membersQuery.data?.data}
            currentRole='owner'
            allowOwnerRole
            ownerAssigned={Boolean(organization.owner_id)}
            isMutating={
              addMutation.isPending ||
              roleMutation.isPending ||
              removeMutation.isPending
            }
            onRoleChange={(userId, memberRole) =>
              roleMutation.mutate({ userId, memberRole })
            }
            onRemove={setRemovingMember}
          />
        </Panel>
      ) : null}
      {tab === 'billing' ? (
        <div className='space-y-4'>
          <UsageFilters
            filters={filters}
            showMemberFilter
            onRefresh={() => {
              void summaryQuery.refetch()
              void billingTrendQuery.refetch()
              void billingMembersQuery.refetch()
              void billingModelsQuery.refetch()
              void billingChannelsQuery.refetch()
            }}
            onExport={() => {
              window.location.href = buildAdminOrganizationExportUrl(
                id,
                filters.params
              )
            }}
          />
          <SummaryGrid summary={summaryQuery.data?.data} />
          <div className='grid gap-4 xl:grid-cols-2'>
            <Panel title={t('Usage trend')}>
              <TrendTable rows={billingTrendQuery.data?.data} />
            </Panel>
            <Panel title={t('Members')}>
              <DimensionTable
                rows={billingMembersQuery.data?.data}
                nameLabel={t('Member')}
                totalQuota={summaryQuery.data?.data?.total_quota}
              />
            </Panel>
            <Panel title={t('Model usage')}>
              <DimensionTable
                rows={billingModelsQuery.data?.data}
                nameLabel={t('Model')}
                totalQuota={summaryQuery.data?.data?.total_quota}
                showPricing
              />
            </Panel>
            <Panel title={t('Channel usage')}>
              <DimensionTable
                rows={billingChannelsQuery.data?.data}
                nameLabel={t('Channel')}
                totalQuota={summaryQuery.data?.data?.total_quota}
              />
            </Panel>
          </div>
        </div>
      ) : null}
      {tab === 'logs' ? (
        <div className='space-y-4'>
          <UsageFilters
            filters={filters}
            showMemberFilter
            onRefresh={() => void logsQuery.refetch()}
            onExport={() => {
              window.location.href = buildAdminOrganizationExportUrl(
                id,
                filters.params
              )
            }}
          />
          <Panel title={t('Billing logs')}>
            <LogsTable rows={logsData?.items} />
            <Pager
              page={logsData?.page ?? filters.page}
              total={logsData?.total ?? 0}
              pageSize={logsData?.page_size ?? 20}
              onPageChange={filters.setPage}
            />
          </Panel>
        </div>
      ) : null}
      <MemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        isPending={addMutation.isPending}
        allowOwner={!organization.owner_id}
        onSubmit={(userId, memberRole) =>
          addMutation.mutate({ userId, memberRole })
        }
      />
      <SettingsDialog
        organization={organization}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isPending={settingsMutation.isPending}
        canEditStatus
        onSubmit={(payload) => settingsMutation.mutate(payload)}
      />
      <ConfirmDialog
        open={Boolean(removingMember)}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title={t('Remove member')}
        desc={t('This user will lose access to the organization.')}
        destructive
        isLoading={removeMutation.isPending}
        handleConfirm={() =>
          removingMember && removeMutation.mutate(removingMember.user_id)
        }
      />
    </div>
  )
}
