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
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  Check,
  Download,
  FileArchive,
  FileJson,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  createSkillHubSkill,
  batchDeleteSkillHubSkills,
  batchExportSkillHubSkills,
  deleteSkillHubSkill,
  discardSkillHubUpload,
  getAdminSkillHubSkill,
  listAdminSkillHubSkillsByTags,
  listAdminSkillHubTags,
  listAdminSkillHubSkills,
  setSkillHubSkillPublished,
  skillToForm,
  uploadSkillHubIcon,
  updateSkillHubSkill,
  uploadSkillHubZip,
} from './api'
import type {
  SkillHubEvaluationForm,
  SkillHubForm,
  SkillHubSkill,
  SkillHubTag,
  SkillHubTestcases,
} from './types'

export function SkillHub() {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillHubSkill[]>([])
  const [tagOptions, setTagOptions] = useState<SkillHubTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [batchWorking, setBatchWorking] = useState(false)
  const [form, setForm] = useState<SkillHubForm>(() => skillToForm())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [iconUploading, setIconUploading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [recommendedOnly, setRecommendedOnly] = useState(false)
  const zipInputRef = useRef<HTMLInputElement | null>(null)
  const iconInputRef = useRef<HTMLInputElement | null>(null)
  const testcasesInputRef = useRef<HTMLInputElement | null>(null)
  const detailRequestIdRef = useRef(0)
  const pendingZipUploadRef = useRef<{
    ticket: string
    object: string
  } | null>(null)
  const pendingIconUploadRef = useRef<{
    ticket: string
    url: string
  } | null>(null)

  const selected = useMemo(
    () => skills.find((skill) => skill.id === selectedId),
    [selectedId, skills]
  )
  const tagNames = useMemo(
    () => tagOptions.map((tag) => tag.name),
    [tagOptions]
  )

  async function loadSkills(
    tagIds = selectedTagIds,
    nextRecommendedOnly = recommendedOnly
  ) {
    setLoading(true)
    try {
      const params = {
        keyword: keyword.trim(),
        recommended: nextRecommendedOnly || undefined,
        page_size: 100,
      }
      const payload = tagIds.length
        ? await listAdminSkillHubSkillsByTags(tagIds, params)
        : await listAdminSkillHubSkills(params)
      if (!payload.success) {
        throw new Error(payload.message || t('Failed to load Skill Hub'))
      }
      const items = payload.data?.items || []
      setSkills(items)
      setCheckedIds((current) =>
        current.filter((id) => items.some((item) => item.id === id))
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to load Skill Hub')
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadTags() {
    try {
      const payload = await listAdminSkillHubTags({ page_size: 500 })
      if (!payload.success) {
        throw new Error(payload.message || '标签加载失败')
      }
      const items = payload.data?.items || []
      setTagOptions(items)
      setSelectedTagIds((current) =>
        current.filter((id) => items.some((tag) => tag.id === id))
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '标签加载失败')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSkills()
      void loadTags()
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      const pendingZip = pendingZipUploadRef.current
      const pendingIcon = pendingIconUploadRef.current
      if (pendingZip?.ticket) {
        void discardSkillHubUpload(pendingZip.ticket).catch(() => undefined)
      }
      if (pendingIcon?.ticket) {
        void discardSkillHubUpload(pendingIcon.ticket).catch(() => undefined)
      }
    }
  }, [])

  async function selectSkill(skill: SkillHubSkill) {
    discardPendingUploads()
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId
    setSelectedId(skill.id)
    setForm(skillToForm(skill))
    setDetailLoading(true)
    try {
      const payload = await getAdminSkillHubSkill(skill.id)
      if (detailRequestIdRef.current !== requestId) return
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || t('Failed to load skill details'))
      }
      setForm(skillToForm(payload.data))
    } catch (error) {
      if (detailRequestIdRef.current !== requestId) return
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to load skill details')
      )
    } finally {
      if (detailRequestIdRef.current === requestId) setDetailLoading(false)
    }
  }

  function createDraft() {
    discardPendingUploads()
    detailRequestIdRef.current += 1
    setDetailLoading(false)
    setSelectedId('')
    setForm(skillToForm())
  }

  function applyTagFilter(tagId: number) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]
    setSelectedTagIds(next)
    void loadSkills(next, recommendedOnly)
  }

  function clearTagFilter() {
    setSelectedTagIds([])
    void loadSkills([], recommendedOnly)
  }

  function applyRecommendedFilter(nextRecommendedOnly: boolean) {
    setRecommendedOnly(nextRecommendedOnly)
    void loadSkills(selectedTagIds, nextRecommendedOnly)
  }

  async function saveSkill() {
    if (!form.id.trim() || !form.name.trim() || !form.version.trim()) {
      toast.error(t('Please enter Skill ID, name, and version'))
      return
    }
    if (Array.from(form.name.trim()).length > 100) {
      toast.error('Skill 名称最多 100 个字符')
      return
    }
    if (!isAllowedZipUrl(form.sourceUrl)) {
      toast.error(
        t(
          'Zip URL must use HTTPS, except localhost or private network hosts during development'
        )
      )
      return
    }
    if (!isAllowedOriginUrl(form.originUrl)) {
      toast.error(t('Source project URL must use HTTP or HTTPS'))
      return
    }
    if (form.license.trim().length > 128) {
      toast.error(t('License must be 128 characters or fewer'))
      return
    }
    const evaluationError = validateEvaluationForm(form.evaluation)
    if (evaluationError) {
      toast.error(t(evaluationError))
      return
    }
    setSaving(true)
    try {
      const payload = selected
        ? await updateSkillHubSkill(selected.id, form)
        : await createSkillHubSkill(form)
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || t('Failed to save skill'))
      }
      toast.success(t('Skill saved'))
      settlePendingUploads(payload.data)
      setSelectedId(payload.data.id)
      setForm(skillToForm(payload.data))
      await loadSkills()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to save skill')
      )
    } finally {
      setSaving(false)
    }
  }

  async function uploadZip(file?: File) {
    if (!file) return
    if (!form.id.trim()) {
      toast.error(t('Please enter Skill ID before uploading'))
      return
    }
    if (!form.version.trim()) {
      toast.error(t('Please enter version before uploading'))
      return
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error(t('Please upload a zip file'))
      return
    }
    setUploading(true)
    try {
      const payload = await uploadSkillHubZip(file, form)
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || t('Failed to upload zip'))
      }
      replacePendingZip(payload.data.uploadTicket, payload.data.object)
      update('sourceUrl', payload.data.url)
      update('sourceRef', payload.data.object)
      update('sourceChecksum', payload.data.checksum)
      toast.success(t('Zip uploaded'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to upload zip')
      )
    } finally {
      setUploading(false)
      if (zipInputRef.current) {
        zipInputRef.current.value = ''
      }
    }
  }

  async function uploadIcon(file?: File) {
    if (!file) return
    if (!form.id.trim()) {
      toast.error(t('Please enter Skill ID before uploading'))
      return
    }
    if (!isAllowedIconFile(file)) {
      toast.error(t('Please upload a png, jpg, jpeg, or webp image'))
      return
    }
    setIconUploading(true)
    try {
      const payload = await uploadSkillHubIcon(file, form)
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || t('Failed to upload icon'))
      }
      replacePendingIcon(payload.data.uploadTicket, payload.data.url)
      update('icon', payload.data.url)
      toast.success(t('Icon uploaded'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to upload icon')
      )
    } finally {
      setIconUploading(false)
      if (iconInputRef.current) {
        iconInputRef.current.value = ''
      }
    }
  }

  async function uploadTestcases(file?: File) {
    if (!file) return
    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(t('Test cases JSON must be 2 MB or smaller'))
      }
      const parsed = JSON.parse(await file.text()) as unknown
      const testcases = parseSkillHubTestcases(parsed)
      update('testcases', testcases)
      toast.success(
        t('{{count}} test cases loaded', { count: testcases.testcases.length })
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to read test cases JSON')
      )
    } finally {
      if (testcasesInputRef.current) testcasesInputRef.current.value = ''
    }
  }

  async function removeSkill(skill: SkillHubSkill) {
    if (!window.confirm(t('Delete this skill?'))) return
    setSaving(true)
    try {
      const payload = await deleteSkillHubSkill(skill.id)
      if (!payload.success) {
        throw new Error(payload.message || t('Failed to delete skill'))
      }
      toast.success(t('Skill deleted'))
      if (selectedId === skill.id) createDraft()
      await loadSkills()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to delete skill')
      )
    } finally {
      setSaving(false)
    }
  }

  async function batchDelete() {
    if (
      !checkedIds.length ||
      !window.confirm(
        t('Delete {{count}} selected skills?', { count: checkedIds.length })
      )
    )
      return
    setBatchWorking(true)
    try {
      const payload = await batchDeleteSkillHubSkills(checkedIds)
      if (!payload.success)
        throw new Error(
          payload.message || t('Failed to delete selected skills')
        )
      if (checkedIds.includes(selectedId)) createDraft()
      setCheckedIds([])
      toast.success(
        t('{{count}} skills deleted', {
          count: payload.data?.deleted || checkedIds.length,
        })
      )
      await loadSkills()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to delete selected skills')
      )
    } finally {
      setBatchWorking(false)
    }
  }

  async function batchExport() {
    if (!checkedIds.length) return
    setBatchWorking(true)
    try {
      const blob = await batchExportSkillHubSkills(checkedIds)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'skill-hub-export.zip'
      link.click()
      URL.revokeObjectURL(url)
      toast.success(
        t('{{count}} skills exported', { count: checkedIds.length })
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to export selected skills')
      )
    } finally {
      setBatchWorking(false)
    }
  }

  async function togglePublish(skill: SkillHubSkill) {
    setSaving(true)
    try {
      const next = !(skill.published || skill.status === 1)
      const payload = await setSkillHubSkillPublished(skill.id, next)
      if (!payload.success) {
        throw new Error(payload.message || t('Failed to update publish state'))
      }
      toast.success(next ? t('Skill published') : t('Skill unpublished'))
      await loadSkills()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to update publish state')
      )
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof SkillHubForm>(
    key: K,
    value: SkillHubForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateEvaluation(next: SkillHubEvaluationForm | null) {
    update('evaluation', next)
  }

  function updateEvaluationDimension(
    key: keyof SkillHubEvaluationForm['dimensions'],
    field: 'score' | 'review',
    value: string
  ) {
    if (!form.evaluation) return
    updateEvaluation({
      ...form.evaluation,
      dimensions: {
        ...form.evaluation.dimensions,
        [key]: {
          ...form.evaluation.dimensions[key],
          [field]: value,
        },
      },
    })
  }

  function discardPendingUploads() {
    const pendingZip = pendingZipUploadRef.current
    const pendingIcon = pendingIconUploadRef.current
    pendingZipUploadRef.current = null
    pendingIconUploadRef.current = null
    if (pendingZip?.ticket) {
      void discardSkillHubUpload(pendingZip.ticket).catch(() => undefined)
    }
    if (pendingIcon?.ticket) {
      void discardSkillHubUpload(pendingIcon.ticket).catch(() => undefined)
    }
  }

  function replacePendingZip(uploadTicket?: string, objectKey?: string) {
    const previous = pendingZipUploadRef.current
    pendingZipUploadRef.current =
      uploadTicket && objectKey
        ? { ticket: uploadTicket, object: objectKey }
        : null
    if (previous?.ticket && previous.ticket !== uploadTicket) {
      void discardSkillHubUpload(previous.ticket).catch(() => undefined)
    }
  }

  function replacePendingIcon(uploadTicket?: string, url?: string) {
    const previous = pendingIconUploadRef.current
    pendingIconUploadRef.current =
      uploadTicket && url ? { ticket: uploadTicket, url } : null
    if (previous?.ticket && previous.ticket !== uploadTicket) {
      void discardSkillHubUpload(previous.ticket).catch(() => undefined)
    }
  }

  function settlePendingUploads(savedSkill: SkillHubSkill) {
    const pendingZip = pendingZipUploadRef.current
    const pendingIcon = pendingIconUploadRef.current
    pendingZipUploadRef.current = null
    pendingIconUploadRef.current = null
    if (
      pendingZip?.ticket &&
      pendingZip.object &&
      pendingZip.object !== savedSkill.source?.ref
    ) {
      void discardSkillHubUpload(pendingZip.ticket).catch(() => undefined)
    }
    if (
      pendingIcon?.ticket &&
      pendingIcon.url &&
      pendingIcon.url !== savedSkill.icon
    ) {
      void discardSkillHubUpload(pendingIcon.ticket).catch(() => undefined)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>技能管理</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          disabled={loading}
          onClick={() => void loadSkills()}
        >
          <RefreshCw className='h-4 w-4' />
          {loading ? t('Refreshing') : t('Refresh')}
        </Button>
        <Button onClick={createDraft}>
          <Plus className='h-4 w-4' />
          {t('New skill')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]'>
          <Card className='min-h-[520px] lg:max-h-[calc(100vh-8rem)]'>
            <CardHeader>
              <CardTitle>{t('Catalog')}</CardTitle>
              <CardDescription>
                {t('Skills returned to local connectors.')}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex min-h-0 flex-1 flex-col gap-3'>
              <div className='flex gap-2'>
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t('Search skills')}
                />
                <Button variant='outline' onClick={() => void loadSkills()}>
                  {t('Search')}
                </Button>
              </div>
              <div className='flex flex-wrap gap-1.5'>
                <Button
                  type='button'
                  size='sm'
                  variant={recommendedOnly ? 'outline' : 'secondary'}
                  onClick={() => applyRecommendedFilter(false)}
                >
                  {t('All')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={recommendedOnly ? 'default' : 'outline'}
                  onClick={() => applyRecommendedFilter(true)}
                >
                  {t('Recommended')}
                </Button>
              </div>
              {tagOptions.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  <Button
                    type='button'
                    size='sm'
                    variant={selectedTagIds.length ? 'outline' : 'secondary'}
                    onClick={clearTagFilter}
                  >
                    {t('All Tags')}
                  </Button>
                  {tagOptions.map((tag) => {
                    const selectedTag = selectedTagIds.includes(tag.id)
                    return (
                      <Button
                        key={tag.id || tag.name}
                        type='button'
                        size='sm'
                        variant={selectedTag ? 'default' : 'outline'}
                        onClick={() => applyTagFilter(tag.id)}
                      >
                        {tag.name}
                      </Button>
                    )
                  })}
                </div>
              )}
              <div className='flex flex-wrap items-center gap-2 border-y py-2'>
                <label className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={
                      skills.length > 0 && checkedIds.length === skills.length
                    }
                    onCheckedChange={(checked) =>
                      setCheckedIds(
                        checked ? skills.map((skill) => skill.id) : []
                      )
                    }
                  />
                  {t('Select all')}
                </label>
                <span className='text-muted-foreground text-sm'>
                  {t('{{count}} selected', { count: checkedIds.length })}
                </span>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!checkedIds.length || batchWorking}
                  onClick={() => void batchExport()}
                >
                  <Download data-icon='inline-start' />
                  {t('Export selected')}
                </Button>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={!checkedIds.length || batchWorking}
                  onClick={() => void batchDelete()}
                >
                  <Trash2 data-icon='inline-start' />
                  {t('Delete selected')}
                </Button>
              </div>
              <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 pb-2'>
                {skills.map((skill) => {
                  const published = skill.published || skill.status === 1
                  const tags = normalizeSkillTags(skill.tags)
                  return (
                    <div
                      key={skill.id}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedId === skill.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className='mb-2 flex items-center gap-2'>
                        <Checkbox
                          aria-label={t('Select {{name}}', {
                            name: skill.name,
                          })}
                          checked={checkedIds.includes(skill.id)}
                          onCheckedChange={(checked) =>
                            setCheckedIds((current) =>
                              checked
                                ? [...new Set([...current, skill.id])]
                                : current.filter((id) => id !== skill.id)
                            )
                          }
                        />
                        <button
                          type='button'
                          className='min-w-0 flex-1 text-left'
                          onClick={() => void selectSkill(skill)}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                              <div className='truncate font-medium'>
                                {skill.name}
                              </div>
                              <div className='text-muted-foreground truncate text-xs'>
                                {skill.id} · {skill.version}
                                {skill.author ? ` · ${skill.author}` : ''}
                                {skill.origin ? ` · ${skill.origin}` : ''}
                              </div>
                            </div>
                            <div className='flex shrink-0 flex-wrap justify-end gap-1'>
                              {skill.recommended && (
                                <Badge variant='secondary'>
                                  {t('Recommended')}
                                </Badge>
                              )}
                              <Badge
                                variant={published ? 'default' : 'outline'}
                              >
                                {published ? t('Published') : t('Draft')}
                              </Badge>
                            </div>
                          </div>
                          <div className='text-foreground/90 mt-2 line-clamp-2 min-h-10 text-sm'>
                            {skill.description?.trim() ||
                              t('No description available.')}
                          </div>
                          <div className='mt-2 flex max-h-7 min-h-7 flex-wrap gap-1 overflow-hidden'>
                            {tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className='bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs'
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </button>
                      </div>
                    </div>
                  )
                })}
                {!skills.length && (
                  <div className='text-muted-foreground rounded-lg border p-4 text-sm'>
                    {loading ? t('Loading...') : t('No skills configured')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {selected ? t('Edit skill') : t('Create skill')}
              </CardTitle>
              <CardDescription>
                {t(
                  'Configure the catalog card, zip package, and publish state.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detailLoading && (
                <div className='text-muted-foreground mb-4 flex items-center gap-2 text-sm'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  {t('Loading skill details...')}
                </div>
              )}
              <div
                className={`grid gap-4 ${detailLoading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <FormSection
                  title={t('Basic info')}
                  description={t(
                    'Controls the skill card shown in the catalog.'
                  )}
                >
                  <div className='grid gap-3 md:grid-cols-3'>
                    <Field label={t('Skill ID')}>
                      <Input
                        value={form.id}
                        onChange={(event) => update('id', event.target.value)}
                      />
                    </Field>
                    <Field label={`${t('Name')}（最多 100 个字符）`}>
                      <Input
                        value={form.name}
                        onChange={(event) =>
                          update(
                            'name',
                            Array.from(event.target.value)
                              .slice(0, 100)
                              .join('')
                          )
                        }
                      />
                      <p className='text-muted-foreground mt-1 text-right text-xs'>
                        {Array.from(form.name).length} / 100
                      </p>
                    </Field>
                  </div>
                  <Field label={t('Description')}>
                    <Textarea
                      value={form.description}
                      onChange={(event) =>
                        update('description', event.target.value)
                      }
                    />
                  </Field>
                  <div className='grid gap-3 md:grid-cols-3'>
                    <Field label={t('Author')}>
                      <Input
                        value={form.author}
                        onChange={(event) =>
                          update('author', event.target.value)
                        }
                      />
                    </Field>
                    <Field label={t('Source')}>
                      <Input
                        value={form.origin}
                        maxLength={64}
                        placeholder='Clawhub'
                        onChange={(event) =>
                          update('origin', event.target.value)
                        }
                      />
                    </Field>
                    <Field label={t('Source project URL')}>
                      <Input
                        type='url'
                        value={form.originUrl}
                        maxLength={2048}
                        placeholder='https://...'
                        onChange={(event) =>
                          update('originUrl', event.target.value)
                        }
                      />
                    </Field>
                    <Field label={t('License')}>
                      <Input
                        value={form.license}
                        maxLength={128}
                        placeholder='MIT License'
                        onChange={(event) =>
                          update('license', event.target.value)
                        }
                      />
                    </Field>
                    <Field label={t('Icon')}>
                      <div className='flex items-start gap-2'>
                        <div className='bg-muted flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border text-sm'>
                          {isImageIcon(form.icon) ? (
                            <img
                              src={form.icon}
                              alt=''
                              className='h-full w-full object-cover'
                              referrerPolicy='no-referrer'
                            />
                          ) : (
                            <ImageIcon className='text-muted-foreground h-4 w-4' />
                          )}
                        </div>
                        <ReadonlyValue
                          value={
                            form.icon.trim()
                              ? form.icon.trim()
                              : t('No icon uploaded')
                          }
                        />
                        <input
                          ref={iconInputRef}
                          type='file'
                          accept='image/png,image/jpeg,image/webp'
                          className='hidden'
                          onChange={(event) =>
                            void uploadIcon(event.target.files?.[0])
                          }
                        />
                        <Button
                          type='button'
                          variant='outline'
                          disabled={iconUploading}
                          onClick={() => iconInputRef.current?.click()}
                        >
                          <ImageIcon className='h-4 w-4' />
                          {iconUploading ? t('Uploading') : t('Upload')}
                        </Button>
                      </div>
                    </Field>
                    <Field label={t('Tags')}>
                      <TagEditor
                        value={form.tags}
                        suggestions={tagNames}
                        placeholder='搜索已有标签后按 Enter 添加'
                        onChange={(tags) => update('tags', tags)}
                      />
                      <p className='text-muted-foreground text-xs'>
                        新增或删除标签请到「标签管理」维护。
                      </p>
                    </Field>
                    <Field label={t('Sort')}>
                      <Input
                        type='number'
                        value={form.sort}
                        onChange={(event) =>
                          update('sort', Number(event.target.value))
                        }
                      />
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  title='SKILL.md'
                  description={t(
                    'Extracted securely from the uploaded package when the skill is saved.'
                  )}
                >
                  {form.skillMarkdown ? (
                    <pre className='bg-muted max-h-72 overflow-auto rounded-md border p-3 text-xs leading-5 whitespace-pre-wrap'>
                      {form.skillMarkdown}
                    </pre>
                  ) : (
                    <div className='text-muted-foreground rounded-md border border-dashed p-3 text-sm'>
                      {t(
                        'No SKILL.md snapshot yet. Upload a package and save the skill.'
                      )}
                    </div>
                  )}
                </FormSection>

                <FormSection
                  title={t('Evaluation report')}
                  description='四个固定维度的分数范围均为 0–5 分（可输入小数）；综合评分留空时取四维平均值。'
                >
                  <SwitchField
                    label={t('Enable evaluation report')}
                    checked={Boolean(form.evaluation)}
                    onChange={(checked) =>
                      updateEvaluation(checked ? createEmptyEvaluation() : null)
                    }
                  />
                  {form.evaluation && (
                    <div className='grid gap-4'>
                      <div className='grid gap-3 md:grid-cols-2'>
                        <Field label='综合评分（可选，0–5 分）'>
                          <Input
                            type='number'
                            min='0'
                            max='5'
                            step='0.1'
                            value={form.evaluation.overallScore}
                            placeholder={evaluationAverage(form.evaluation)}
                            onChange={(event) =>
                              updateEvaluation({
                                ...form.evaluation!,
                                overallScore: event.target.value,
                              })
                            }
                          />
                          <p className='text-muted-foreground mt-1 text-xs'>
                            允许范围：0 ≤ 综合评分 ≤
                            5；留空时自动计算四维平均分。
                          </p>
                        </Field>
                        <Field label={t('Overall rating')}>
                          <Input
                            value={form.evaluation.overallRating}
                            maxLength={80}
                            placeholder={t('Automatically derived when empty')}
                            onChange={(event) =>
                              updateEvaluation({
                                ...form.evaluation!,
                                overallRating: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label={t('Overall review')}>
                        <Textarea
                          value={form.evaluation.overallReview}
                          maxLength={8000}
                          onChange={(event) =>
                            updateEvaluation({
                              ...form.evaluation!,
                              overallReview: event.target.value,
                            })
                          }
                        />
                      </Field>
                      {EVALUATION_DIMENSIONS.map((dimension) => (
                        <div
                          key={dimension.key}
                          className='grid gap-3 rounded-md border p-3 md:grid-cols-[160px_minmax(0,1fr)]'
                        >
                          <Field label={dimension.label}>
                            <Input
                              type='number'
                              min='0'
                              max='5'
                              step='0.1'
                              value={
                                form.evaluation!.dimensions[dimension.key].score
                              }
                              onChange={(event) =>
                                updateEvaluationDimension(
                                  dimension.key,
                                  'score',
                                  event.target.value
                                )
                              }
                            />
                            <p className='text-muted-foreground mt-1 text-xs'>
                              允许范围：0 ≤ 分数 ≤ 5
                            </p>
                          </Field>
                          <Field label={t('Dimension review')}>
                            <Textarea
                              value={
                                form.evaluation!.dimensions[dimension.key]
                                  .review
                              }
                              maxLength={4000}
                              onChange={(event) =>
                                updateEvaluationDimension(
                                  dimension.key,
                                  'review',
                                  event.target.value
                                )
                              }
                            />
                          </Field>
                        </div>
                      ))}
                    </div>
                  )}
                </FormSection>

                <FormSection
                  title={t('Effect preview cases')}
                  description={t(
                    'Upload the JSON payload used by the desktop client. The slug is preserved without matching the skill ID.'
                  )}
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <input
                      ref={testcasesInputRef}
                      type='file'
                      accept='.json,application/json'
                      className='hidden'
                      onChange={(event) =>
                        void uploadTestcases(event.target.files?.[0])
                      }
                    />
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => testcasesInputRef.current?.click()}
                    >
                      <FileJson className='h-4 w-4' />
                      {t('Upload JSON')}
                    </Button>
                    {form.testcases && (
                      <Button
                        type='button'
                        variant='ghost'
                        onClick={() => update('testcases', null)}
                      >
                        {t('Clear cases')}
                      </Button>
                    )}
                    <span className='text-muted-foreground text-xs'>
                      {form.testcases
                        ? t('{{count}} cases loaded', {
                            count: form.testcases.testcases.length,
                          })
                        : t('No cases uploaded')}
                    </span>
                  </div>
                  {form.testcases && (
                    <div className='bg-muted rounded-md border p-3 text-xs'>
                      <div>slug: {form.testcases.slug || t('(empty)')}</div>
                      <div className='mt-1 line-clamp-2'>
                        {form.testcases.testcases[0]?.question ||
                          t('No cases in this file')}
                      </div>
                    </div>
                  )}
                </FormSection>

                <FormSection
                  title={t('Zip package')}
                  description={t(
                    'Upload a zip package to private OSS. New API will serve a signed download URL.'
                  )}
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <input
                      ref={zipInputRef}
                      type='file'
                      accept='.zip,application/zip'
                      className='hidden'
                      onChange={(event) =>
                        void uploadZip(event.target.files?.[0])
                      }
                    />
                    <Button
                      type='button'
                      variant='outline'
                      disabled={uploading}
                      onClick={() => zipInputRef.current?.click()}
                    >
                      <FileArchive className='h-4 w-4' />
                      {uploading ? t('Uploading') : t('Upload zip to OSS')}
                    </Button>
                    <span className='text-muted-foreground text-xs'>
                      {t(
                        'Max 50 MB. URL, OSS object, and SHA256 will be filled automatically.'
                      )}
                    </span>
                  </div>
                  <div className='grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]'>
                    <Field label={t('Version')}>
                      <Input
                        value={form.version}
                        onChange={(event) =>
                          update('version', event.target.value)
                        }
                      />
                    </Field>
                    <Field label={t('Zip URL')}>
                      <Input
                        value={form.sourceUrl}
                        onChange={(event) =>
                          update('sourceUrl', event.target.value)
                        }
                        placeholder='https://example.com/skill.zip'
                      />
                    </Field>
                  </div>
                  <div className='grid gap-3'>
                    <Field label={t('SHA256 checksum')}>
                      <Input
                        value={form.sourceChecksum}
                        onChange={(event) =>
                          update('sourceChecksum', event.target.value)
                        }
                        placeholder='sha256:...'
                      />
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  title={t('Publishing')}
                  description={t(
                    'Control catalog visibility and trust badges.'
                  )}
                >
                  <div className='flex flex-wrap gap-4'>
                    <CheckboxField
                      label={t('Published')}
                      checked={form.published}
                      onChange={(checked) => update('published', checked)}
                    />
                    <CheckboxField
                      label={t('Verified')}
                      checked={form.verified}
                      onChange={(checked) => update('verified', checked)}
                    />
                    <SwitchField
                      label={t('Recommended')}
                      checked={form.recommended}
                      onChange={(checked) => update('recommended', checked)}
                    />
                  </div>
                </FormSection>

                <div className='flex flex-wrap justify-between gap-2'>
                  <div className='flex gap-2'>
                    {selected && (
                      <>
                        <Button
                          variant='outline'
                          disabled={saving}
                          onClick={() => togglePublish(selected)}
                        >
                          <Check className='h-4 w-4' />
                          {selected.published || selected.status === 1
                            ? t('Unpublish')
                            : t('Publish')}
                        </Button>
                        <Button
                          variant='destructive'
                          disabled={saving}
                          onClick={() => removeSkill(selected)}
                        >
                          <Trash2 className='h-4 w-4' />
                          {t('Delete')}
                        </Button>
                      </>
                    )}
                  </div>
                  <Button
                    disabled={
                      saving || uploading || iconUploading || detailLoading
                    }
                    onClick={saveSkill}
                  >
                    <Save className='h-4 w-4' />
                    {saving ? t('Saving') : t('Save skill')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

const EVALUATION_DIMENSIONS: Array<{
  key: keyof SkillHubEvaluationForm['dimensions']
  label: string
}> = [
  { key: 'safety', label: 'S · Safety 安全检测（0–5 分）' },
  { key: 'access', label: 'A · Access 权限控制（0–5 分）' },
  { key: 'frontier', label: 'F · Frontier 能力先进性（0–5 分）' },
  { key: 'economy', label: 'E · Economy Token 效率（0–5 分）' },
]

function createEmptyEvaluation(): SkillHubEvaluationForm {
  const dimension = () => ({ score: '', review: '' })
  return {
    overallScore: '',
    overallRating: '',
    overallReview: '',
    dimensions: {
      safety: dimension(),
      access: dimension(),
      frontier: dimension(),
      economy: dimension(),
    },
  }
}

function validateEvaluationForm(evaluation: SkillHubEvaluationForm | null) {
  if (!evaluation) return ''
  for (const dimension of EVALUATION_DIMENSIONS) {
    const raw = evaluation.dimensions[dimension.key].score.trim()
    const score = Number(raw)
    if (!raw || !Number.isFinite(score) || score < 0 || score > 5) {
      return '四个维度的分数都必须在 0 到 5 之间'
    }
  }
  if (evaluation.overallScore.trim()) {
    const score = Number(evaluation.overallScore)
    if (!Number.isFinite(score) || score < 0 || score > 5) {
      return '综合评分必须在 0 到 5 之间'
    }
  }
  return ''
}

function evaluationAverage(evaluation: SkillHubEvaluationForm) {
  const scores = EVALUATION_DIMENSIONS.map(({ key }) =>
    Number(evaluation.dimensions[key].score)
  )
  if (scores.some((score) => !Number.isFinite(score))) return 'Auto'
  return (
    scores.reduce((sum, score) => sum + score, 0) / scores.length
  ).toFixed(1)
}

function parseSkillHubTestcases(value: unknown): SkillHubTestcases {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Test cases JSON must be an object')
  }
  const record = value as Record<string, unknown>
  if (typeof record.slug !== 'string') {
    throw new Error('Test cases JSON slug must be a string')
  }
  if (!Array.isArray(record.testcases)) {
    throw new Error('Test cases JSON must contain a testcases array')
  }
  if (record.testcases.length > 50) {
    throw new Error('Test cases JSON must contain 50 cases or fewer')
  }
  return {
    slug: record.slug,
    testcases: record.testcases.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`Test case ${index + 1} must be an object`)
      }
      const testcase = item as Record<string, unknown>
      if (
        typeof testcase.id !== 'number' ||
        !Number.isSafeInteger(testcase.id) ||
        typeof testcase.question !== 'string' ||
        !testcase.question.trim() ||
        typeof testcase.answer !== 'string' ||
        !testcase.answer.trim() ||
        typeof testcase.sortOrder !== 'number' ||
        !Number.isSafeInteger(testcase.sortOrder)
      ) {
        throw new Error(`Test case ${index + 1} has invalid fields`)
      }
      if (testcase.question.length > 10000 || testcase.answer.length > 250000) {
        throw new Error(`Test case ${index + 1} is too large`)
      }
      return {
        id: testcase.id,
        question: testcase.question.trim(),
        answer: testcase.answer.trim(),
        sortOrder: testcase.sortOrder,
      }
    }),
  }
}

function isAllowedZipUrl(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.protocol === 'https:') return true
    if (url.protocol !== 'http:') return false
    return isLocalHTTPHost(url.hostname)
  } catch {
    return false
  }
}

function isAllowedOriginUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    const url = new URL(trimmed)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

function isLocalHTTPHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (host === 'localhost') return true
  if (isPrivateIPv4Host(host)) return true
  if (!host.includes(':')) return false
  return (
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    /^fe[89ab]/.test(host)
  )
}

function isPrivateIPv4Host(host: string) {
  const octets = host.split('.')
  if (octets.length !== 4) return false

  const values = octets.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN
    return Number(part)
  })
  if (
    values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false
  }

  const [first, second] = values
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isAllowedIconFile(file: File) {
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return true
  }
  return /\.(png|jpe?g|webp)$/i.test(file.name)
}

function isImageIcon(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed.startsWith('https://')
}

function TagEditor(props: {
  value: string[]
  suggestions: string[]
  placeholder: string
  onChange: (value: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const selectedKeys = useMemo(
    () => new Set(props.value.map((tag) => tag.toLowerCase())),
    [props.value]
  )
  const availableSuggestions = props.suggestions
    .filter((tag) => !selectedKeys.has(tag.toLowerCase()))
    .slice(0, 10)

  function commit(input: string) {
    const next = mergeTags(props.value, resolveKnownTags(input))
    props.onChange(next)
    setDraft('')
  }

  function remove(tag: string) {
    props.onChange(props.value.filter((item) => item !== tag))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(draft)
      return
    }

    if (event.key === 'Backspace' && !draft && props.value.length > 0) {
      props.onChange(props.value.slice(0, -1))
    }
  }

  function resolveKnownTags(input: string) {
    const known = new Map(
      props.suggestions.map((tag) => [tag.toLowerCase(), tag])
    )
    return splitTagText(input)
      .map((tag) => known.get(tag.toLowerCase()))
      .filter((tag): tag is string => Boolean(tag))
  }

  return (
    <div className='grid gap-2'>
      <div className='focus-within:ring-ring bg-background flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2 focus-within:ring-offset-2'>
        {props.value.map((tag) => (
          <button
            key={tag}
            type='button'
            className='bg-muted text-foreground hover:bg-muted/80 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium'
            onClick={() => remove(tag)}
          >
            <span>{tag}</span>
            <X className='h-3 w-3' />
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft)
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text')
            if (/[,;|\n]/.test(text)) {
              event.preventDefault()
              commit(text)
            }
          }}
          placeholder={props.value.length ? '' : props.placeholder}
          className='min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none'
        />
      </div>
      {availableSuggestions.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {availableSuggestions.map((tag) => (
            <button
              key={tag}
              type='button'
              className='text-muted-foreground hover:border-primary hover:text-foreground rounded-md border px-2 py-1 text-xs transition-colors'
              onClick={() => commit(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function splitTagText(value: string) {
  return value
    .split(/[,;|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeSkillTags(value?: string[]) {
  if (!Array.isArray(value)) return []
  return value.map((item) => item.trim()).filter(Boolean)
}

function mergeTags(current: string[], incoming: string[]) {
  const seen = new Set<string>()
  const next: string[] = []

  for (const value of [...current, ...incoming]) {
    const tag = value.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    next.push(tag)
  }

  return next
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className='grid min-w-0 gap-1.5 text-sm font-medium'>
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

function ReadonlyValue(props: { value: string }) {
  return (
    <div className='bg-muted text-muted-foreground min-h-9 min-w-0 flex-1 overflow-hidden rounded-md border px-3 py-2 text-xs leading-relaxed break-all'>
      {props.value || '-'}
    </div>
  )
}

function FormSection(props: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className='rounded-lg border p-4'>
      <div className='mb-4'>
        <h3 className='text-sm font-semibold'>{props.title}</h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          {props.description}
        </p>
      </div>
      <div className='grid gap-3'>{props.children}</div>
    </section>
  )
}

function CheckboxField(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className='flex items-center gap-2 text-sm font-medium'>
      <input
        type='checkbox'
        className='h-4 w-4'
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  )
}

function SwitchField(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className='flex items-center gap-2 text-sm font-medium'>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
      <span>{props.label}</span>
    </label>
  )
}
