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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  getPayloadLogDetail,
  getPayloadLogs,
  getSwitchAudits,
  getSwitchStatus,
  setSwitch,
} from './api'
import type { PayloadLogItem } from './types'

const PAGE_SIZE = 100

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function dayOf(seconds: number) {
  const d = new Date(seconds * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function timeOf(seconds: number) {
  const d = new Date(seconds * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function fullTime(seconds: number) {
  return `${dayOf(seconds)} ${timeOf(seconds)}`
}

export function PayloadLogs() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.auth.user)
  const isRoot = user?.role === ROLE.SUPER_ADMIN

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<number | null>(null)

  const { data: enabled } = useQuery({
    queryKey: ['payload-log-switch'],
    queryFn: getSwitchStatus,
  })

  const { data: audits } = useQuery({
    queryKey: ['payload-log-switch-audits'],
    queryFn: () => getSwitchAudits({ page: 1, page_size: 20 }),
  })

  const { data: list, isLoading } = useQuery({
    queryKey: ['payload-logs', isRoot],
    queryFn: () => getPayloadLogs({ page: 1, page_size: PAGE_SIZE }, isRoot),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['payload-log', detailId, isRoot],
    queryFn: () => getPayloadLogDetail(detailId as number, isRoot),
    enabled: detailId != null,
  })

  const onToggle = async (next: boolean) => {
    await setSwitch(next)
    queryClient.invalidateQueries({ queryKey: ['payload-log-switch'] })
    queryClient.invalidateQueries({ queryKey: ['payload-log-switch-audits'] })
  }

  const items = list?.items ?? []
  const groups = useMemo(() => {
    const map = new Map<string, PayloadLogItem[]>()
    for (const it of items) {
      const day = dayOf(it.created_at)
      const arr = map.get(day)
      if (arr) arr.push(it)
      else map.set(day, [it])
    }
    return Array.from(map.entries())
  }, [items])

  const toggleDay = (day: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Payload Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto max-w-4xl space-y-6'>
          {/* Status + switch */}
          <div className='bg-card rounded-lg border p-4'>
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-1'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  {t('Business payload logging')}
                  <Badge
                    variant={enabled ? 'destructive' : 'secondary'}
                    className={
                      enabled
                        ? ''
                        : 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {enabled ? t('On') : t('Off')}
                  </Badge>
                </div>
                <p className='text-muted-foreground max-w-2xl text-xs'>
                  {enabled
                    ? t(
                        'Enabling stores the full request and response of every call ensure this complies with your customer agreements'
                      )
                    : t(
                        'Off by default the platform stores only billing metadata never your prompts or responses'
                      )}
                </p>
                {!isRoot && (
                  <p className='text-muted-foreground text-xs italic'>
                    {t('Only root can change this switch')}
                  </p>
                )}
              </div>
              <Switch
                checked={!!enabled}
                disabled={!isRoot}
                onCheckedChange={onToggle}
              />
            </div>
          </div>

          {/* Switch change history */}
          <div className='space-y-2'>
            <div className='text-sm font-medium'>
              {t('Switch change history')}
            </div>
            <div className='rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Time')}</TableHead>
                    <TableHead>{t('User')}</TableHead>
                    <TableHead className='text-right'>{t('Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(audits?.items ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className='text-muted-foreground py-6 text-center'
                      >
                        {t('No changes yet')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (audits?.items ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className='whitespace-nowrap'>
                          {fullTime(a.created_at)}
                        </TableCell>
                        <TableCell>{a.username || a.user_id}</TableCell>
                        <TableCell className='text-right'>
                          <Badge
                            variant={a.enabled ? 'destructive' : 'secondary'}
                          >
                            {a.enabled ? t('Turned on') : t('Turned off')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Drill-down: date folders -> call files -> detail */}
          <div className='space-y-2'>
            <div className='text-sm font-medium'>
              {isRoot ? t('All calls') : t('My calls')}
            </div>
            {isLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : groups.length === 0 ? (
              <div className='text-muted-foreground rounded-lg border py-10 text-center text-sm'>
                {t('No payload logs yet')}
              </div>
            ) : (
              <div className='space-y-2'>
                {groups.map(([day, calls]) => {
                  const open = expanded.has(day)
                  return (
                    <div key={day} className='overflow-hidden rounded-lg border'>
                      <button
                        type='button'
                        onClick={() => toggleDay(day)}
                        className='hover:bg-muted/50 flex w-full items-center gap-2 p-3 text-left text-sm font-medium'
                      >
                        {open ? (
                          <ChevronDown className='h-4 w-4 shrink-0' />
                        ) : (
                          <ChevronRight className='h-4 w-4 shrink-0' />
                        )}
                        {open ? (
                          <FolderOpen className='h-4 w-4 shrink-0 text-amber-500' />
                        ) : (
                          <Folder className='h-4 w-4 shrink-0 text-amber-500' />
                        )}
                        <span>{day}</span>
                        <Badge variant='secondary'>{calls.length}</Badge>
                      </button>
                      {open && (
                        <div className='divide-y border-t'>
                          {calls.map((call) => (
                            <button
                              type='button'
                              key={call.id}
                              onClick={() => setDetailId(call.id)}
                              className='hover:bg-muted/50 flex w-full items-center gap-3 py-2 pr-3 pl-10 text-left text-sm'
                            >
                              <FileText className='text-muted-foreground h-4 w-4 shrink-0' />
                              <span className='whitespace-nowrap tabular-nums'>
                                {timeOf(call.created_at)}
                              </span>
                              <span className='truncate font-mono text-xs'>
                                {call.model_name || '-'}
                              </span>
                              <Badge
                                variant={
                                  call.status_code >= 200 &&
                                  call.status_code < 300
                                    ? 'secondary'
                                    : 'destructive'
                                }
                                className='ml-auto'
                              >
                                {call.status_code || '-'}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Dialog
            open={detailId != null}
            onOpenChange={(o) => !o && setDetailId(null)}
          >
            <DialogContent className='max-w-3xl'>
              <DialogHeader>
                <DialogTitle>{t('Call detail')}</DialogTitle>
              </DialogHeader>
              {detailLoading || !detail ? (
                <div className='space-y-3'>
                  <Skeleton className='h-40 w-full' />
                  <Skeleton className='h-40 w-full' />
                </div>
              ) : (
                <div className='space-y-4'>
                  <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                    <span>{fullTime(detail.created_at)}</span>
                    <span className='font-mono'>{detail.model_name}</span>
                    <span className='font-mono'>{detail.request_id}</span>
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-medium'>
                      {t('Request body')}
                    </div>
                    <div className='bg-muted max-h-56 overflow-auto rounded-md border p-3'>
                      <pre className='text-xs break-all whitespace-pre-wrap'>
                        {detail.request_body || '-'}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-sm font-medium'>
                      {t('Response body')}
                    </div>
                    <div className='bg-muted max-h-56 overflow-auto rounded-md border p-3'>
                      <pre className='text-xs break-all whitespace-pre-wrap'>
                        {detail.response_body || '-'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
