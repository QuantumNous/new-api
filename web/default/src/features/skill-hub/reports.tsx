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
import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  getAdminSkillHubReport,
  listAdminSkillHubReports,
  updateAdminSkillHubReport,
} from './api'
import type { SkillHubAdminReport, SkillHubReportStatus } from './types'

const pageSize = 20

const statusLabels: Record<SkillHubReportStatus, string> = {
  pending: '待处理',
  resolved: '已处理',
  dismissed: '已忽略',
}

export function SkillHubReports() {
  const [reports, setReports] = useState<SkillHubAdminReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<SkillHubReportStatus | ''>('pending')
  const [loading, setLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selected, setSelected] = useState<SkillHubAdminReport | null>(null)
  const [resolutionStatus, setResolutionStatus] =
    useState<SkillHubReportStatus>('pending')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  async function loadReports(nextPage = page) {
    const requestId = listRequestRef.current + 1
    listRequestRef.current = requestId
    setLoading(true)
    try {
      const payload = await listAdminSkillHubReports({
        keyword: keyword.trim(),
        status,
        p: nextPage,
        page_size: pageSize,
      })
      if (listRequestRef.current !== requestId) return
      if (!payload.success) {
        throw new Error(payload.message || '举报列表加载失败')
      }
      setReports(payload.data?.items || [])
      setTotal(payload.data?.total || 0)
      setPage(nextPage)
    } catch (error) {
      if (listRequestRef.current === requestId) {
        toast.error(error instanceof Error ? error.message : '举报列表加载失败')
      }
    } finally {
      if (listRequestRef.current === requestId) setLoading(false)
    }
  }

  async function openReport(reportId: number) {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setSheetOpen(true)
    setDetailLoading(true)
    try {
      const payload = await getAdminSkillHubReport(reportId)
      if (detailRequestRef.current !== requestId) return
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || '举报详情加载失败')
      }
      setSelected(payload.data)
      setResolutionStatus(payload.data.status)
      setAdminNote(payload.data.adminNote || '')
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        toast.error(error instanceof Error ? error.message : '举报详情加载失败')
        setSheetOpen(false)
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports(1)
      const reportId = Number(
        new URLSearchParams(window.location.search).get('report') || ''
      )
      if (Number.isSafeInteger(reportId) && reportId > 0) {
        void openReport(reportId)
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      listRequestRef.current += 1
      detailRequestRef.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveResolution() {
    if (!selected) return
    setSaving(true)
    try {
      const payload = await updateAdminSkillHubReport(selected.id, {
        status: resolutionStatus,
        adminNote: adminNote.trim(),
        revision: selected.revision,
      })
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || '举报处理结果保存失败')
      }
      setSelected(payload.data)
      setResolutionStatus(payload.data.status)
      setAdminNote(payload.data.adminNote || '')
      setReports((current) =>
        current.map((report) =>
          report.id === payload.data!.id ? payload.data! : report
        )
      )
      toast.success('举报处理结果已保存')
      if (status && payload.data.status !== status) {
        await loadReports(page)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '举报处理结果保存失败'
      )
      await openReport(selected.id)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>举报管理</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          disabled={loading}
          onClick={() => void loadReports(page)}
        >
          <RefreshCw className='h-4 w-4' />
          刷新
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <Card>
          <CardContent className='space-y-4 pt-6'>
            <div className='flex flex-col gap-2 md:flex-row'>
              <div className='relative flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  className='pl-9'
                  value={keyword}
                  placeholder='搜索 Skill、举报内容或举报用户'
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadReports(1)
                  }}
                />
              </div>
              <select
                aria-label='处理状态'
                className='border-input bg-background h-9 rounded-md border px-3 text-sm md:w-36'
                value={status}
                onChange={(event) => {
                  const next = event.target.value as SkillHubReportStatus | ''
                  setStatus(next)
                }}
              >
                <option value=''>全部状态</option>
                <option value='pending'>待处理</option>
                <option value='resolved'>已处理</option>
                <option value='dismissed'>已忽略</option>
              </select>
              <Button onClick={() => void loadReports(1)}>查询</Button>
            </div>

            <div className='overflow-x-auto rounded-lg border'>
              <div className='bg-muted/40 grid min-w-[760px] grid-cols-[90px_minmax(180px,1fr)_120px_160px_90px] gap-3 px-4 py-2 text-xs font-medium'>
                <span>编号</span>
                <span>Skill / 摘要</span>
                <span>举报用户</span>
                <span>提交时间</span>
                <span>状态</span>
              </div>
              <div className='divide-y'>
                {reports.map((report) => (
                  <button
                    className='hover:bg-muted/30 grid w-full min-w-[760px] grid-cols-[90px_minmax(180px,1fr)_120px_160px_90px] items-center gap-3 px-4 py-3 text-left text-sm transition'
                    key={report.id}
                    onClick={() => void openReport(report.id)}
                    type='button'
                  >
                    <span className='font-mono'>#{report.id}</span>
                    <span className='min-w-0'>
                      <span className='block truncate font-medium'>
                        {report.skillName}
                      </span>
                      <span className='text-muted-foreground block truncate text-xs'>
                        {report.description}
                      </span>
                    </span>
                    <span className='truncate'>
                      {report.reporterUsername || `ID ${report.reporterUserId}`}
                    </span>
                    <span>{formatTimestamp(report.createdTime)}</span>
                    <StatusBadge status={report.status} />
                  </button>
                ))}
                {!reports.length && (
                  <div className='text-muted-foreground px-4 py-12 text-center text-sm'>
                    {loading ? '加载中…' : '暂无举报'}
                  </div>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>共 {total} 条</span>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={loading || page <= 1}
                  onClick={() => void loadReports(page - 1)}
                >
                  上一页
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={loading || page >= totalPages}
                  onClick={() => void loadReports(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </SectionPageLayout.Content>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            detailRequestRef.current += 1
            setSelected(null)
          }
        }}
      >
        <SheetContent className='flex h-dvh w-full flex-col overflow-hidden sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle>
              举报详情 {selected ? `#${selected.id}` : ''}
            </SheetTitle>
            <SheetDescription>
              用户提交内容属于不受信任文本，请勿复制其中地址到浏览器访问。
            </SheetDescription>
          </SheetHeader>
          {detailLoading || !selected ? (
            <div className='text-muted-foreground grid flex-1 place-items-center text-sm'>
              加载中…
            </div>
          ) : (
            <div className='flex-1 space-y-5 overflow-y-auto pr-1'>
              <div className='border-warning/40 bg-warning/10 flex gap-3 rounded-lg border p-3 text-sm'>
                <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0' />
                <span>
                  下方举报正文只按纯文本显示，不会渲染链接、HTML 或 Markdown。
                </span>
              </div>
              <div className='grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2'>
                <Info
                  label='Skill'
                  value={`${selected.skillName} (${selected.skillId})`}
                />
                <Info label='版本' value={selected.skillVersion || '-'} />
                <Info
                  label='举报用户'
                  value={`${selected.reporterUsername || '-'} / ID ${selected.reporterUserId}`}
                />
                <Info label='用户邮箱' value={selected.reporterEmail || '-'} />
                <Info
                  label='提交时间'
                  value={formatTimestamp(selected.createdTime)}
                />
                <Info label='邮件状态' value={selected.notificationStatus} />
              </div>
              <section>
                <h3 className='mb-2 text-sm font-semibold'>举报正文</h3>
                <pre className='bg-muted/40 max-h-80 overflow-auto rounded-lg border p-4 font-sans text-sm leading-6 break-words whitespace-pre-wrap'>
                  {selected.description}
                </pre>
              </section>
              <label className='grid gap-2 text-sm font-medium'>
                <span>处理状态</span>
                <select
                  className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                  value={resolutionStatus}
                  onChange={(event) =>
                    setResolutionStatus(
                      event.target.value as SkillHubReportStatus
                    )
                  }
                >
                  <option value='pending'>待处理</option>
                  <option value='resolved'>已处理</option>
                  <option value='dismissed'>已忽略</option>
                </select>
              </label>
              <label className='grid gap-2 text-sm font-medium'>
                <span>处理备注</span>
                <Textarea
                  maxLength={2000}
                  rows={6}
                  value={adminNote}
                  placeholder='记录核查结果、处置措施或忽略原因'
                  onChange={(event) => setAdminNote(event.target.value)}
                />
                <span className='text-muted-foreground text-right text-xs font-normal'>
                  {adminNote.length} / 2000
                </span>
              </label>
            </div>
          )}
          <SheetFooter className='mt-4'>
            <Button
              disabled={!selected || detailLoading || saving}
              onClick={() => void saveResolution()}
            >
              {saving ? '保存中…' : '保存处理结果'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </SectionPageLayout>
  )
}

function StatusBadge({ status }: { status: SkillHubReportStatus }) {
  return (
    <Badge
      variant={
        status === 'pending'
          ? 'destructive'
          : status === 'resolved'
            ? 'default'
            : 'secondary'
      }
    >
      {statusLabels[status]}
    </Badge>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 font-medium break-words'>{value}</div>
    </div>
  )
}

function formatTimestamp(value?: number) {
  if (!value) return '-'
  return new Date(value * 1000).toLocaleString()
}
