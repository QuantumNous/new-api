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
  FileArchive,
  ImageIcon,
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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  createSkillHubSkill,
  deleteSkillHubSkill,
  listAdminSkillHubSkillsByTags,
  listAdminSkillHubTags,
  listAdminSkillHubSkills,
  setSkillHubSkillPublished,
  skillToForm,
  uploadSkillHubIcon,
  updateSkillHubSkill,
  uploadSkillHubZip,
} from './api'
import type { SkillHubForm, SkillHubSkill, SkillHubTag } from './types'

export function SkillHub() {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillHubSkill[]>([])
  const [tagOptions, setTagOptions] = useState<SkillHubTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<SkillHubForm>(() => skillToForm())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [iconUploading, setIconUploading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [recommendedOnly, setRecommendedOnly] = useState(false)
  const zipInputRef = useRef<HTMLInputElement | null>(null)
  const iconInputRef = useRef<HTMLInputElement | null>(null)

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
      setSkills(payload.data?.items || [])
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

  function selectSkill(skill: SkillHubSkill) {
    setSelectedId(skill.id)
    setForm(skillToForm(skill))
  }

  function createDraft() {
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
    if (!isAllowedZipUrl(form.sourceUrl)) {
      toast.error(
        t('Zip URL must use HTTPS, except localhost during development')
      )
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
        <div className='grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]'>
          <Card className='min-h-[520px]'>
            <CardHeader>
              <CardTitle>{t('Catalog')}</CardTitle>
              <CardDescription>
                {t('Skills returned to local connectors.')}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
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
              <div className='space-y-2'>
                {skills.map((skill) => {
                  const published = skill.published || skill.status === 1
                  return (
                    <button
                      key={skill.id}
                      type='button'
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedId === skill.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => selectSkill(skill)}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <div className='truncate font-medium'>
                            {skill.name}
                          </div>
                          <div className='text-muted-foreground truncate text-xs'>
                            {skill.id} · {skill.version}
                            {skill.author ? ` · ${skill.author}` : ''}
                          </div>
                        </div>
                        <div className='flex shrink-0 flex-wrap justify-end gap-1'>
                          {skill.recommended && (
                            <Badge variant='secondary'>
                              {t('Recommended')}
                            </Badge>
                          )}
                          <Badge variant={published ? 'default' : 'outline'}>
                            {published ? t('Published') : t('Draft')}
                          </Badge>
                        </div>
                      </div>
                    </button>
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
              <div className='grid gap-4'>
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
                    <Field label={t('Name')}>
                      <Input
                        value={form.name}
                        onChange={(event) => update('name', event.target.value)}
                      />
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
                    <Field label={t('Icon')}>
                      <div className='flex gap-2'>
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
                        <div className='bg-muted text-muted-foreground flex min-w-0 flex-1 items-center truncate rounded-md border px-3 text-xs'>
                          {form.icon.trim()
                            ? form.icon.trim()
                            : t('No icon uploaded')}
                        </div>
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
                    disabled={saving || uploading || iconUploading}
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

function isAllowedZipUrl(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.protocol === 'https:') return true
    if (url.protocol !== 'http:') return false
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
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
    <label className='grid gap-1.5 text-sm font-medium'>
      <span>{props.label}</span>
      {props.children}
    </label>
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
