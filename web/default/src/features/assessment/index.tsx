import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { LoadingState } from '@/components/loading-state'
import { EmptyState } from '@/components/empty-state'
import {
  getActiveAssessments, getMySubmissions, getMyStats,
  getAllAssessments, createAssessment, updateAssessment, deleteAssessment,
  getAssessmentSubmissions, reviewSubmission, getAssessmentStats,
  submitAssessment,
} from './api'
import type {
  Assessment, AssessmentWithSubmission, SubmissionWithAssessment,
  SubmissionWithUser,
} from './types'

const ROLE_ADMIN = 10

function statusLabelKey(status: number) {
  const keys: Record<number, string> = { 0: 'Not Started', 1: 'In Progress', 2: 'Ended' }
  return keys[status] || 'Unknown'
}

function submissionStatusLabelKey(status: number) {
  const keys: Record<number, string> = { 0: 'Pending Review', 1: 'Passed', 2: 'Failed' }
  return keys[status] || 'Unknown'
}

export function AssessmentPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = (user?.role ?? 0) >= ROLE_ADMIN

  if (!user) return <LoadingState />

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('AI Code Review Assessment')}</h1>
      {isAdmin ? <AdminView /> : <UserView />}
    </div>
  )
}

function UserView() {
  const { t } = useTranslation()

  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">{t('Active Assessments')}</TabsTrigger>
        <TabsTrigger value="my">{t('My Submissions')}</TabsTrigger>
        <TabsTrigger value="stats">{t('My Statistics')}</TabsTrigger>
      </TabsList>
      <TabsContent value="active"><ActiveAssessments /></TabsContent>
      <TabsContent value="my"><MySubmissions /></TabsContent>
      <TabsContent value="stats"><MyStatsPanel /></TabsContent>
    </Tabs>
  )
}

function ActiveAssessments() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [submitTarget, setSubmitTarget] = useState<Assessment | null>(null)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-active'],
    queryFn: async () => {
      const res = await getActiveAssessments()
      return res.data ?? []
    },
  })

  const handleSubmit = async () => {
    if (!submitTarget) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('assessment_id', String(submitTarget.id))
      fd.append('content', content)
      for (const f of files) {
        fd.append('screenshots', f)
      }
      const res = await submitAssessment(fd)
      if (res.success) {
        toast.success(t('Submitted successfully'))
        setSubmitTarget(null)
        setContent('')
        setFiles([])
        queryClient.invalidateQueries({ queryKey: ['assessment-active'] })
        queryClient.invalidateQueries({ queryKey: ['assessment-my'] })
      }
    } catch {
      toast.error(t('Submission failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (!data || data.length === 0) return <EmptyState message={t('No active assessments')} />

  return (
    <div className="space-y-4">
      {data.map((item: AssessmentWithSubmission) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{item.title}</CardTitle>
              <Badge variant={item.submitted ? 'secondary' : 'default'}>
                {item.submitted ? t(submissionStatusLabelKey(item.submission_status)) : t('Not Submitted')}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {dayjs.unix(item.start_time).format('YYYY-MM-DD HH:mm')} ~{' '}
              {dayjs.unix(item.end_time).format('YYYY-MM-DD HH:mm')}
            </p>
          </CardHeader>
          <CardContent>
            <p className="mb-3 whitespace-pre-wrap text-sm">{item.description}</p>
            {item.submitted && item.score != null && (
              <p className="text-sm">{t('Score')}: {item.score}</p>
            )}
            {!item.submitted && (
              <Button onClick={() => setSubmitTarget(item)}>{t('Submit Work')}</Button>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!submitTarget} onOpenChange={(v) => { if (!v) setSubmitTarget(null) }}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('Submit Assessment')} - {submitTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('Description')}</Label>
              <Textarea
                placeholder={t('Describe your work')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <Label>{t('Upload screenshots (png/jpg/gif/webp, optional)')}</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) setFiles(Array.from(e.target.files))
                }}
              />
              {files.length > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {files.length} {t('file(s) selected')}
                </p>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('Submitting...') : t('Confirm Submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MySubmissions() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-my'],
    queryFn: async () => {
      const res = await getMySubmissions()
      return res.data ?? []
    },
  })

  if (isLoading) return <LoadingState />
  if (!data || data.length === 0) return <EmptyState message={t('No submissions yet')} />

  return (
    <div className="space-y-4">
      {data.map((sub: SubmissionWithAssessment) => (
        <Card key={sub.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{sub.assessment_title}</CardTitle>
              <Badge variant={sub.status === 1 ? 'default' : sub.status === 2 ? 'destructive' : 'secondary'}>
                {t(submissionStatusLabelKey(sub.status))}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('Submitted at')}: {dayjs.unix(sub.submitted_at).format('YYYY-MM-DD HH:mm')}
            </p>
          </CardHeader>
          <CardContent>
            <p className="mb-2 whitespace-pre-wrap text-sm">{sub.content}</p>
            {sub.screenshots && sub.screenshots.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {sub.screenshots.map((s: string, i: number) => (
                  <img
                    key={i}
                    src={`/api/assessment/screenshot/${s}`}
                    alt={`screenshot-${i}`}
                    className="h-24 w-24 rounded border object-cover"
                  />
                ))}
              </div>
            )}
            {sub.score != null && (
              <p className="text-sm font-semibold">{t('Score')}: {sub.score}</p>
            )}
            {sub.comment && (
              <p className="text-muted-foreground mt-1 text-sm">{t('Comment')}: {sub.comment}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MyStatsPanel() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-my-stats'],
    queryFn: async () => {
      const res = await getMyStats()
      return res.data
    },
  })

  if (isLoading) return <LoadingState />

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('My Assessment Statistics')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{data?.total_submissions ?? 0}</p>
            <p className="text-muted-foreground text-sm">{t('Total Submissions')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data?.passed ?? 0}</p>
            <p className="text-muted-foreground text-sm">{t('Passed')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data?.average_score ?? 0}</p>
            <p className="text-muted-foreground text-sm">{t('Average Score')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminView() {
  const { t } = useTranslation()

  return (
    <Tabs defaultValue="manage">
      <TabsList>
        <TabsTrigger value="manage">{t('Manage Assessments')}</TabsTrigger>
        <TabsTrigger value="review">{t('Review Submissions')}</TabsTrigger>
      </TabsList>
      <TabsContent value="manage"><AdminManage /></TabsContent>
      <TabsContent value="review"><AdminReview /></TabsContent>
    </Tabs>
  )
}

function AdminManage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<Assessment | null>(null)
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '', max_score: 100, status: 0 })
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-all'],
    queryFn: async () => {
      const res = await getAllAssessments()
      return res.data ?? []
    },
  })

  const openCreate = () => {
    setEditItem(null)
    setForm({ title: '', description: '', start_time: '', end_time: '', max_score: 100, status: 0 })
    setDialogOpen(true)
  }

  const openEdit = (item: Assessment) => {
    setEditItem(item)
    setForm({
      title: item.title,
      description: item.description,
      start_time: dayjs.unix(item.start_time).format('YYYY-MM-DDTHH:mm'),
      end_time: dayjs.unix(item.end_time).format('YYYY-MM-DDTHH:mm'),
      max_score: item.max_score,
      status: item.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      title: form.title,
      description: form.description,
      start_time: dayjs(form.start_time).unix(),
      end_time: dayjs(form.end_time).unix(),
      max_score: form.max_score,
      status: form.status,
    }
    try {
      if (editItem) {
        await updateAssessment({ ...payload, id: editItem.id })
        toast.success(t('Updated successfully'))
      } else {
        await createAssessment(payload)
        toast.success(t('Created successfully'))
      }
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['assessment-all'] })
    } catch {
      toast.error(t('Operation failed'))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteAssessment(id)
      toast.success(t('Deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['assessment-all'] })
    } catch {
      toast.error(t('Deletion failed'))
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <Button onClick={openCreate}>{t('Create Assessment')}</Button>
      {(!data || data.length === 0) && <EmptyState message={t('No assessments yet')} />}
      {data?.map((item: Assessment) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{item.title}</CardTitle>
              <div className="flex gap-2">
                <Badge variant={item.status === 1 ? 'default' : item.status === 2 ? 'secondary' : 'outline'}>
                  {t(statusLabelKey(item.status))}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => openEdit(item)}>{t('Edit')}</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>{t('Delete')}</Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              {dayjs.unix(item.start_time).format('YYYY-MM-DD HH:mm')} ~{' '}
              {dayjs.unix(item.end_time).format('YYYY-MM-DD HH:mm')} | {t('Max Score')}: {item.max_score}
            </p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{item.description}</p>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? t('Edit Assessment') : t('Create Assessment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('Title')}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>{t('Description')}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('Start Time')}</Label>
                <Input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>{t('End Time')}</Label>
                <Input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('Max Score')}</Label>
                <Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('Status')}</Label>
                <Select value={String(form.status)} onValueChange={(v) => setForm({ ...form, status: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('Not Started')}</SelectItem>
                    <SelectItem value="1">{t('In Progress')}</SelectItem>
                    <SelectItem value="2">{t('Ended')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave}>{t('Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminReview() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reviewForm, setReviewForm] = useState({ status: 1, score: 0, comment: '' })
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  const { data: assessments } = useQuery({
    queryKey: ['assessment-all'],
    queryFn: async () => {
      const res = await getAllAssessments()
      return res.data ?? []
    },
  })

  const { data: submissions, isLoading: subsLoading } = useQuery({
    queryKey: ['assessment-submissions', selectedId],
    queryFn: async () => {
      if (!selectedId) return []
      const res = await getAssessmentSubmissions(selectedId)
      return res.data ?? []
    },
    enabled: !!selectedId,
  })

  const { data: stats } = useQuery({
    queryKey: ['assessment-stats', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const res = await getAssessmentStats(selectedId)
      return res.data
    },
    enabled: !!selectedId,
  })

  const handleReview = async () => {
    if (!reviewingId) return
    try {
      await reviewSubmission({ id: reviewingId, ...reviewForm })
      toast.success(t('Review submitted successfully'))
      setReviewingId(null)
      queryClient.invalidateQueries({ queryKey: ['assessment-submissions', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['assessment-stats', selectedId] })
    } catch {
      toast.error(t('Review failed'))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('Select Assessment')}</Label>
        <Select value={selectedId ? String(selectedId) : ''} onValueChange={(v) => setSelectedId(Number(v))}>
          <SelectTrigger><SelectValue placeholder={t('Select an assessment')} /></SelectTrigger>
          <SelectContent>
            {(assessments ?? []).map((a: Assessment) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('Statistics')}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 text-center text-sm">
              <div><span className="font-bold">{stats.total}</span><br />{t('Total')}</div>
              <div><span className="font-bold">{stats.pending}</span><br />{t('Pending')}</div>
              <div><span className="font-bold">{stats.passed}</span><br />{t('Passed')}</div>
              <div><span className="font-bold">{stats.failed}</span><br />{t('Failed')}</div>
              <div><span className="font-bold">{stats.average_score}</span><br />{t('Avg Score')}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {subsLoading && <LoadingState />}
      {(!submissions || submissions.length === 0) && selectedId && !subsLoading && (
        <EmptyState message={t('No submissions yet')} />
      )}
      {submissions?.map((sub: SubmissionWithUser) => (
        <Card key={sub.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{sub.username} ({sub.email})</CardTitle>
                <p className="text-muted-foreground text-xs">{dayjs.unix(sub.submitted_at).format('YYYY-MM-DD HH:mm')}</p>
              </div>
              <Badge variant={sub.status === 1 ? 'default' : sub.status === 2 ? 'destructive' : 'secondary'}>
                {t(submissionStatusLabelKey(sub.status))}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-2 whitespace-pre-wrap text-sm">{sub.content}</p>
            {sub.screenshots && sub.screenshots.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {sub.screenshots.map((s: string, i: number) => (
                  <img
                    key={i}
                    src={`/api/assessment/screenshot/${s}`}
                    alt={`screenshot-${i}`}
                    className="h-32 w-32 rounded border object-cover cursor-pointer"
                    onClick={() => window.open(`/api/assessment/screenshot/${s}`, '_blank')}
                  />
                ))}
              </div>
            )}
            {sub.score != null && <p className="text-sm font-semibold">{t('Score')}: {sub.score}</p>}
            {sub.comment && <p className="text-muted-foreground text-sm">{t('Comment')}: {sub.comment}</p>}

            <div className="mt-3 border-t pt-3">
              {reviewingId === sub.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Label className="w-20">{t('Result')}</Label>
                    <Select value={String(reviewForm.status)} onValueChange={(v) => setReviewForm({ ...reviewForm, status: Number(v) })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t('Passed')}</SelectItem>
                        <SelectItem value="2">{t('Failed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Label className="w-20">{t('Score')}</Label>
                    <Input type="number" className="w-32" value={reviewForm.score} onChange={(e) => setReviewForm({ ...reviewForm, score: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>{t('Comment')}</Label>
                    <Textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleReview}>{t('Confirm')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setReviewingId(null)}>{t('Cancel')}</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  setReviewingId(sub.id)
                  setReviewForm({ status: sub.status || 1, score: sub.score ?? 0, comment: sub.comment ?? '' })
                }}>
                  {sub.status === 0 ? t('Review') : t('Re-review')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
