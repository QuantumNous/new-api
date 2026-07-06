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
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { initializeApply, initializePreview } from '../api'
import { QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import { useGroups } from '../hooks/use-groups'
import type { AutoGroupInitItem } from '../types'

type InitializeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Editable row state for the initialize preview table.
 * `targetGroup` can be overridden by the user before applying.
 */
type EditableRow = AutoGroupInitItem & {
  targetGroup: string
  selected: boolean
}

export function InitializeDialog({
  open,
  onOpenChange,
}: InitializeDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: groupsData } = useGroups()
  const groups = groupsData?.data ?? []

  const previewQuery = useQuery({
    queryKey: ['auto-group-initialize-preview'],
    queryFn: initializePreview,
    enabled: open,
  })

  const [rows, setRows] = useState<EditableRow[]>([])

  // Build editable rows from the preview data: conflicts sorted to top.
  useEffect(() => {
    if (!previewQuery.data?.data) {
      setRows([])
      return
    }
    const items = previewQuery.data.data.items
    const sorted = [...items].sort((a, b) => {
      if (a.conflict && !b.conflict) return -1
      if (!a.conflict && b.conflict) return 1
      return 0
    })
    setRows(
      sorted.map((item) => ({
        ...item,
        targetGroup: item.suggested_group,
        selected: !item.conflict && !item.exists,
      })
      )
    )
  }, [previewQuery.data])

  const applyMutation = useMutation({
    mutationFn: initializeApply,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          t(SUCCESS_MESSAGES.INITIALIZE_APPLIED, {
            count: result.data?.saved ?? 0,
          })
        )
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES })
        onOpenChange(false)
      }
    },
  })

  const toggleRow = (jobTitle: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.job_title === jobTitle ? { ...row, selected: checked } : row
      )
    )
  }

  const changeGroup = (jobTitle: string, group: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.job_title === jobTitle ? { ...row, targetGroup: group } : row
      )
    )
  }

  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected),
    [rows]
  )

  const handleApply = () => {
    applyMutation.mutate({
      rules: selectedRows.map((row) => ({
        job_title: row.job_title,
        target_group: row.targetGroup,
      })),
    })
  }

  const conflictCount = useMemo(
    () => rows.filter((r) => r.conflict).length,
    [rows]
  )

  function renderPreviewBody() {
    if (previewQuery.isLoading) {
      return (
        <div className='text-muted-foreground flex h-32 items-center justify-center text-sm'>
          {t('Loading...')}
        </div>
      )
    }
    if (rows.length === 0) {
      return (
        <div className='text-muted-foreground flex h-32 items-center justify-center text-sm'>
          {t('No job titles found among existing users.')}
        </div>
      )
    }
    return (
      <PreviewTable
        rows={rows}
        groups={groups}
        selectedCount={selectedRows.length}
        onToggleRow={toggleRow}
        onChangeGroup={changeGroup}
        onToggleAll={(checked: boolean) =>
          setRows((prev) =>
            prev.map((row) => ({ ...row, selected: checked }))
          )
        }
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Initialize from Existing')}</DialogTitle>
          <DialogDescription>
            {t(
              'Scan existing users and generate job title to group mappings. Review and save the ones you want.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex items-center justify-between gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => void previewQuery.refetch()}
            disabled={previewQuery.isFetching}
          >
            <RefreshCw
              className={previewQuery.isFetching ? 'animate-spin' : ''}
            />
            {t('Refresh')}
          </Button>
          <span className='text-muted-foreground text-sm'>
            {t('{{selected}} selected', { selected: selectedRows.length })}
            {conflictCount > 0 && (
              <span className='text-warning ml-2'>
                {t('{{count}} conflicts', { count: conflictCount })}
              </span>
            )}
          </span>
        </div>

        <div className='min-h-0 flex-1 overflow-auto rounded-lg border'>
          {renderPreviewBody()}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>
            {t('Cancel')}
          </DialogClose>
          <Button
            onClick={handleApply}
            disabled={
              selectedRows.length === 0 || applyMutation.isPending
            }
          >
            {applyMutation.isPending
              ? t('Saving...')
              : t('Save {{count}} Selected', { count: selectedRows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Render the group distribution as a compact list of badges.
 */
function DistributionBadges({
  distribution,
}: {
  distribution: Record<string, number>
}) {
  const { t } = useTranslation()
  const entries = Object.entries(distribution)
  if (entries.length === 0) {
    return <span className='text-muted-foreground text-sm'>-</span>
  }
  const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 3)
  const remaining = entries.length - sorted.length
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {sorted.map(([group, count]) => (
        <span
          key={group}
          className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs'
        >
          {group}: {count}
        </span>
      ))}
      {remaining > 0 && (
        <span className='text-muted-foreground text-xs'>
          {t('+{{count}} more', { count: remaining })}
        </span>
      )}
    </div>
  )
}

type PreviewTableProps = {
  rows: EditableRow[]
  groups: string[]
  selectedCount: number
  onToggleRow: (jobTitle: string, checked: boolean) => void
  onChangeGroup: (jobTitle: string, group: string) => void
  onToggleAll: (checked: boolean) => void
}

function PreviewTable(props: PreviewTableProps) {
  const { t } = useTranslation()
  const { rows, groups, selectedCount, onToggleRow, onChangeGroup, onToggleAll } =
    props
  const allSelected = rows.length > 0 && selectedCount === rows.length
  const someSelected = selectedCount > 0 && selectedCount < rows.length

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='w-[40px]'>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={(value) => onToggleAll(!!value)}
              aria-label={t('Select all')}
            />
          </TableHead>
          <TableHead>{t('Job Title')}</TableHead>
          <TableHead>{t('Suggested Group')}</TableHead>
          <TableHead className='text-right'>{t('Users')}</TableHead>
          <TableHead>{t('Distribution')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.job_title}
            className={row.conflict ? 'bg-warning/10' : undefined}
          >
            <TableCell>
              <Checkbox
                checked={row.selected}
                onCheckedChange={(value) =>
                  onToggleRow(row.job_title, !!value)
                }
                aria-label={t('Select row')}
              />
            </TableCell>
            <TableCell className='font-medium'>
              <div className='flex items-center gap-1.5'>
                {row.conflict && (
                  <AlertTriangle className='text-warning size-4 shrink-0' />
                )}
                {row.job_title}
                {row.exists && (
                  <StatusBadge
                    label={t('Exists')}
                    variant='neutral'
                    copyable={false}
                    size='sm'
                  />
                )}
              </div>
            </TableCell>
            <TableCell>
              <Select
                value={row.targetGroup}
                onValueChange={(value) =>
                  value !== null && onChangeGroup(row.job_title, value)
                }
              >
                <SelectTrigger size='sm' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {groups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className='text-right font-mono'>
              {row.user_count}
            </TableCell>
            <TableCell>
              <DistributionBadges distribution={row.group_distribution} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
