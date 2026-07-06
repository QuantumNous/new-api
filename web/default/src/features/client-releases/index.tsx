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
  type ClipboardEvent,
  type ReactNode,
} from 'react'
import {
  Check,
  Download,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  clientReleaseToForm,
  createClientRelease,
  deleteClientRelease,
  discardClientReleaseUpload,
  listAdminClientReleases,
  setClientReleasePublished,
  updateClientRelease,
  uploadClientRelease,
} from './api'
import type {
  ClientRelease,
  ClientReleaseArch,
  ClientReleaseChannel,
  ClientReleaseForm,
  ClientReleasePlatform,
} from './types'

const platformOptions: ClientReleasePlatform[] = ['windows', 'darwin', 'linux']
const archOptions: ClientReleaseArch[] = ['x64', 'arm64', 'ia32', 'universal']
const channelOptions: ClientReleaseChannel[] = ['stable', 'beta']

export function ClientReleases() {
  const { t } = useTranslation()
  const [releases, setReleases] = useState<ClientRelease[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<ClientReleaseForm>(() =>
    clientReleaseToForm()
  )
  const [keyword, setKeyword] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [archFilter, setArchFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadRef = useRef<{ ticket: string; object: string } | null>(
    null
  )

  const selected = useMemo(
    () => releases.find((release) => release.id === selectedId),
    [selectedId, releases]
  )

  async function loadReleases() {
    setLoading(true)
    try {
      const payload = await listAdminClientReleases({
        keyword: keyword.trim(),
        platform: platformFilter || undefined,
        arch: archFilter || undefined,
        channel: channelFilter.trim() || undefined,
        page_size: 100,
      })
      if (!payload.success) {
        throw new Error(payload.message || t('Failed to load client releases'))
      }
      setReleases(payload.data?.items || [])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to load client releases')
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReleases()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      const pending = pendingUploadRef.current
      if (pending?.ticket) {
        void discardClientReleaseUpload(pending.ticket).catch(() => undefined)
      }
    }
  }, [])

  function createDraft() {
    discardPendingUpload()
    setSelectedId(null)
    setForm(clientReleaseToForm())
  }

  function selectRelease(release: ClientRelease) {
    discardPendingUpload()
    setSelectedId(release.id)
    setForm(clientReleaseToForm(release))
  }

  function update<K extends keyof ClientReleaseForm>(
    key: K,
    value: ClientReleaseForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function discardPendingUpload() {
    const pending = pendingUploadRef.current
    pendingUploadRef.current = null
    if (pending?.ticket) {
      void discardClientReleaseUpload(pending.ticket).catch(() => undefined)
    }
  }

  function replacePendingUpload(uploadTicket?: string, objectKey?: string) {
    const previous = pendingUploadRef.current
    pendingUploadRef.current =
      uploadTicket && objectKey
        ? { ticket: uploadTicket, object: objectKey }
        : null
    if (previous?.ticket && previous.ticket !== uploadTicket) {
      void discardClientReleaseUpload(previous.ticket).catch(() => undefined)
    }
  }

  function settlePendingUpload(savedObjectKey?: string) {
    const pending = pendingUploadRef.current
    pendingUploadRef.current = null
    if (
      pending?.ticket &&
      pending.object &&
      savedObjectKey &&
      pending.object !== savedObjectKey
    ) {
      void discardClientReleaseUpload(pending.ticket).catch(() => undefined)
    }
  }

  async function findConflictingRelease(nextForm: ClientReleaseForm) {
    const payload = await listAdminClientReleases({
      keyword: nextForm.version,
      platform: nextForm.platform,
      arch: nextForm.arch,
      channel: nextForm.channel,
      page_size: 100,
    })
    if (!payload.success) {
      throw new Error(payload.message || t('Failed to check release version'))
    }
    return (payload.data?.items || []).find(
      (release) =>
        release.id !== selected?.id &&
        normalizeVersion(release.version) === nextForm.version &&
        release.platform === nextForm.platform &&
        release.arch === nextForm.arch &&
        (release.channel || 'stable') === nextForm.channel
    )
  }

  async function uploadPackage(file?: File) {
    if (!file) return
    if (!isAllowedPackageFile(file)) {
      toast.error(t('Unsupported installer file type'))
      return
    }
    const version = resolveVersionForFile(form.version, file)
    if (!version) {
      toast.error(t('Please enter a three-part numeric version, such as 1.2.3'))
      return
    }
    if (version !== form.version) {
      update('version', version)
    }
    setUploading(true)
    try {
      const payload = await uploadClientRelease(file, { ...form, version })
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || t('Failed to upload package'))
      }
      replacePendingUpload(payload.data.uploadTicket, payload.data.object)
      update('fileName', payload.data.fileName)
      update('objectKey', payload.data.object)
      update('size', payload.data.size)
      update('sha256', payload.data.sha256)
      update('sha512', payload.data.sha512)
      toast.success(t('Package uploaded'))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to upload package')
      toast.error(
        message === 'Failed to upload package'
          ? t('Failed to upload package')
          : message
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function saveRelease() {
    const version = normalizeVersion(form.version)
    const minVersion = normalizeVersion(form.minVersion)
    if (!isValidVersion(version)) {
      toast.error(t('Please enter a three-part numeric version, such as 1.2.3'))
      return
    }
    if (minVersion && !isValidVersion(minVersion)) {
      toast.error(
        t('Please enter a valid three-part minimum version, such as 1.2.3')
      )
      return
    }
    if (form.forced && !minVersion) {
      toast.error(t('Please enter minimum version for forced update'))
      return
    }
    if (!form.fileName.trim() || !form.objectKey.trim() || form.size <= 0) {
      toast.error(t('Please upload an installer package first'))
      return
    }
    const nextForm = { ...form, version, minVersion }
    setForm(nextForm)
    setSaving(true)
    try {
      const conflict = await findConflictingRelease(nextForm)
      if (
        conflict &&
        !window.confirm(
          t(
            'A client version for this platform, arch, and channel already exists. Overwrite it?'
          )
        )
      ) {
        return
      }
      const payload = conflict
        ? await updateClientRelease(conflict.id, nextForm)
        : selected
          ? await updateClientRelease(selected.id, nextForm)
          : await createClientRelease(nextForm)
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || t('Failed to save release'))
      }
      toast.success(t('Client release saved'))
      settlePendingUpload(payload.data.objectKey)
      setSelectedId(payload.data.id)
      setForm(clientReleaseToForm(payload.data))
      await loadReleases()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to save release')
      )
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish(release: ClientRelease) {
    setSaving(true)
    try {
      const next = !(release.published || release.status === 1)
      const payload = await setClientReleasePublished(release.id, next)
      if (!payload.success) {
        throw new Error(payload.message || t('Failed to update publish state'))
      }
      toast.success(next ? t('Release published') : t('Release unpublished'))
      await loadReleases()
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

  async function removeRelease(release: ClientRelease) {
    if (!window.confirm(t('Delete this client release?'))) return
    setSaving(true)
    try {
      const payload = await deleteClientRelease(release.id)
      if (!payload.success) {
        throw new Error(payload.message || t('Failed to delete release'))
      }
      toast.success(t('Client release deleted'))
      if (selectedId === release.id) {
        discardPendingUpload()
        setSelectedId(null)
        setForm(clientReleaseToForm())
      }
      await loadReleases()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to delete release')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Client Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          disabled={loading}
          onClick={() => void loadReleases()}
        >
          <RefreshCw className='h-4 w-4' />
          {loading ? t('Refreshing') : t('Refresh')}
        </Button>
        <Button onClick={createDraft}>
          <Plus className='h-4 w-4' />
          {t('New version')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]'>
          <Card className='min-h-[520px] lg:max-h-[calc(100vh-8rem)]'>
            <CardHeader>
              <CardTitle>{t('Release list')}</CardTitle>
              <CardDescription>
                {t('Desktop installer packages stored in OSS.')}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex min-h-0 flex-1 flex-col gap-3'>
              <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
                <Input
                  value={keyword}
                  placeholder={t('Search version or file')}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadReleases()
                  }}
                />
                <Button variant='outline' onClick={() => void loadReleases()}>
                  {t('Search')}
                </Button>
              </div>
              <div className='grid gap-2 sm:grid-cols-3'>
                <NativeSelect
                  className='w-full'
                  value={platformFilter}
                  onChange={(event) => setPlatformFilter(event.target.value)}
                >
                  <NativeSelectOption value=''>
                    {t('All platforms')}
                  </NativeSelectOption>
                  {platformOptions.map((platform) => (
                    <NativeSelectOption key={platform} value={platform}>
                      {platform}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <NativeSelect
                  className='w-full'
                  value={archFilter}
                  onChange={(event) => setArchFilter(event.target.value)}
                >
                  <NativeSelectOption value=''>
                    {t('All arches')}
                  </NativeSelectOption>
                  {archOptions.map((arch) => (
                    <NativeSelectOption key={arch} value={arch}>
                      {arch}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <NativeSelect
                  className='w-full'
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value)}
                >
                  <NativeSelectOption value=''>
                    {t('All channels')}
                  </NativeSelectOption>
                  {channelOptions.map((channel) => (
                    <NativeSelectOption key={channel} value={channel}>
                      {channel}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 pb-2'>
                {releases.map((release) => {
                  const published = release.published || release.status === 1
                  const forcedLabel = release.minVersion
                    ? `≥${release.minVersion}`
                    : t('Forced')
                  return (
                    <button
                      key={release.id}
                      type='button'
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedId === release.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => selectRelease(release)}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <div className='truncate font-medium'>
                            {release.version}
                          </div>
                          <div className='text-muted-foreground truncate text-xs'>
                            {release.platform}/{release.arch}/{release.channel}{' '}
                            - {formatBytes(release.size)}
                          </div>
                          <div className='text-muted-foreground mt-1 truncate text-xs'>
                            {release.fileName}
                          </div>
                        </div>
                        <div className='flex shrink-0 flex-wrap justify-end gap-1'>
                          {release.forced && (
                            <Badge variant='destructive'>{forcedLabel}</Badge>
                          )}
                          <Badge variant={published ? 'default' : 'outline'}>
                            {published ? t('Published') : t('Draft')}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {!releases.length && (
                  <div className='text-muted-foreground rounded-lg border p-4 text-sm'>
                    {loading
                      ? t('Loading...')
                      : t('No client versions configured')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {selected ? t('Edit version') : t('Create version')}
              </CardTitle>
              <CardDescription>
                {t('Upload installer assets and publish update metadata.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4'>
                <FormSection
                  title={t('Target')}
                  description={t('Choose the client version and update lane.')}
                >
                  <div className='grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'>
                    <Field label={t('Version')}>
                      <VersionInput
                        value={form.version}
                        onChange={(value) => update('version', value)}
                      />
                    </Field>
                    <Field label={t('Platform')}>
                      <NativeSelect
                        className='w-full'
                        value={form.platform}
                        onChange={(event) =>
                          update(
                            'platform',
                            event.target.value as ClientReleasePlatform
                          )
                        }
                      >
                        {platformOptions.map((platform) => (
                          <NativeSelectOption key={platform} value={platform}>
                            {platform}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label={t('Arch')}>
                      <NativeSelect
                        className='w-full'
                        value={form.arch}
                        onChange={(event) =>
                          update(
                            'arch',
                            event.target.value as ClientReleaseArch
                          )
                        }
                      >
                        {archOptions.map((arch) => (
                          <NativeSelectOption key={arch} value={arch}>
                            {arch}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label={t('Channel')}>
                      <NativeSelect
                        className='w-full'
                        value={form.channel}
                        onChange={(event) =>
                          update(
                            'channel',
                            event.target.value as ClientReleaseChannel
                          )
                        }
                      >
                        {channelOptions.map((channel) => (
                          <NativeSelectOption key={channel} value={channel}>
                            {channel}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  title={t('Installer package')}
                  description={t(
                    'Upload exe, msi, dmg, pkg, zip, AppImage, deb, rpm, yml, or yaml files.'
                  )}
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='.exe,.msi,.dmg,.pkg,.zip,.AppImage,.deb,.rpm,.yml,.yaml'
                      className='hidden'
                      onChange={(event) =>
                        void uploadPackage(event.target.files?.[0])
                      }
                    />
                    <Button
                      type='button'
                      variant='outline'
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className='h-4 w-4' />
                      {uploading ? t('Uploading') : t('Upload to OSS')}
                    </Button>
                    {form.fileName && (
                      <Badge variant='secondary'>
                        {formatBytes(form.size)}
                      </Badge>
                    )}
                  </div>
                  <Field label={t('File name')}>
                    <ReadonlyValue value={form.fileName} />
                  </Field>
                  <Field label={t('OSS object')}>
                    <ReadonlyValue value={form.objectKey} />
                  </Field>
                  <div className='grid gap-3 md:grid-cols-2'>
                    <Field label='SHA256'>
                      <ReadonlyValue value={form.sha256} />
                    </Field>
                    <Field label='SHA512'>
                      <ReadonlyValue value={form.sha512} />
                    </Field>
                  </div>
                  {selected?.downloadUrl && (
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        variant='outline'
                        render={
                          <a
                            href={selected.downloadUrl}
                            target='_blank'
                            rel='noreferrer'
                          />
                        }
                      >
                        <Download className='h-4 w-4' />
                        {t('Download')}
                      </Button>
                      <Button
                        variant='outline'
                        render={
                          <a
                            href={`/api/client-releases/updates/${form.platform}/${form.arch}/${form.channel || 'stable'}/latest.yml`}
                            target='_blank'
                            rel='noreferrer'
                          />
                        }
                      >
                        <Package className='h-4 w-4' />
                        latest.yml
                      </Button>
                    </div>
                  )}
                </FormSection>

                <FormSection
                  title={t('Release policy')}
                  description={t('Control visibility and forced update rules.')}
                >
                  <Field label={t('Minimum supported version')}>
                    <VersionInput
                      value={form.minVersion}
                      onChange={(value) => update('minVersion', value)}
                    />
                  </Field>
                  <Field label={t('Release notes')}>
                    <Textarea
                      value={form.releaseNotes}
                      onChange={(event) =>
                        update('releaseNotes', event.target.value)
                      }
                    />
                  </Field>
                  <div className='flex flex-wrap gap-4'>
                    <SwitchField
                      label={t('Published')}
                      checked={form.published}
                      onChange={(checked) => update('published', checked)}
                    />
                    <SwitchField
                      label={t('Force update below minimum version')}
                      checked={form.forced}
                      onChange={(checked) => update('forced', checked)}
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
                          onClick={() => void togglePublish(selected)}
                        >
                          <Check className='h-4 w-4' />
                          {selected.published || selected.status === 1
                            ? t('Unpublish')
                            : t('Publish')}
                        </Button>
                        <Button
                          variant='destructive'
                          disabled={saving}
                          onClick={() => void removeRelease(selected)}
                        >
                          <Trash2 className='h-4 w-4' />
                          {t('Delete')}
                        </Button>
                      </>
                    )}
                  </div>
                  <Button disabled={saving || uploading} onClick={saveRelease}>
                    <Save className='h-4 w-4' />
                    {saving ? t('Saving') : t('Save version')}
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

const versionPattern = /^\d+\.\d+\.\d+$/

function normalizeVersion(value: string) {
  return value.trim()
}

function isValidVersion(value: string) {
  return versionPattern.test(normalizeVersion(value))
}

function extractVersionFromFileName(fileName: string) {
  const match = fileName.match(/(?:^|[^0-9])v?(\d+\.\d+\.\d+)(?=[^0-9]|$)/i)
  return match?.[1] || ''
}

function resolveVersionForFile(value: string, file: File) {
  const normalized = normalizeVersion(value)
  if (isValidVersion(normalized)) return normalized
  return extractVersionFromFileName(file.name)
}

function isAllowedPackageFile(file: File) {
  return /\.(exe|msi|dmg|pkg|zip|appimage|deb|rpm|ya?ml)$/i.test(file.name)
}

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function Field(props: { label: ReactNode; children: ReactNode }) {
  return (
    <label className='grid gap-1.5 text-sm font-medium'>
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

function VersionInput(props: {
  value: string
  onChange: (value: string) => void
}) {
  const parts = splitVersionParts(props.value)

  function updatePart(index: number, value: string) {
    const next = [...parts] as [string, string, string]
    next[index] = digitsOnly(value)
    props.onChange(formatVersionParts(next))
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const version = extractVersionFromFileName(
      event.clipboardData.getData('text')
    )
    if (!version) return
    event.preventDefault()
    props.onChange(version)
  }

  return (
    <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'>
      <VersionSegmentInput
        value={parts[0]}
        placeholder='0'
        onChange={(value) => updatePart(0, value)}
        onPaste={handlePaste}
      />
      <span className='text-muted-foreground text-center'>.</span>
      <VersionSegmentInput
        value={parts[1]}
        placeholder='1'
        onChange={(value) => updatePart(1, value)}
        onPaste={handlePaste}
      />
      <span className='text-muted-foreground text-center'>.</span>
      <VersionSegmentInput
        value={parts[2]}
        placeholder='0'
        onChange={(value) => updatePart(2, value)}
        onPaste={handlePaste}
      />
    </div>
  )
}

function VersionSegmentInput(props: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void
}) {
  return (
    <Input
      value={props.value}
      placeholder={props.placeholder}
      inputMode='numeric'
      pattern='[0-9]*'
      className='text-center'
      onChange={(event) => props.onChange(event.target.value)}
      onPaste={props.onPaste}
    />
  )
}

function splitVersionParts(value: string): [string, string, string] {
  const parts = normalizeVersion(value).split('.')
  return [
    digitsOnly(parts[0] || ''),
    digitsOnly(parts[1] || ''),
    digitsOnly(parts[2] || ''),
  ]
}

function formatVersionParts(parts: [string, string, string]) {
  if (parts.every((part) => part === '')) return ''
  return parts.join('.')
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
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

function ReadonlyValue(props: { value: string }) {
  return (
    <div className='bg-muted text-muted-foreground min-h-8 overflow-hidden rounded-md border px-3 py-2 text-xs break-all'>
      {props.value || '-'}
    </div>
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
