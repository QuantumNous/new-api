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
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, GitBranch, Plus, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import dayjs from '@/lib/dayjs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  createAdminSkill,
  createAdminSkillVersion,
  getAdminSkillVersion,
  listAdminSkillAuditLog,
  listAdminSkillVersions,
  patchAdminSkill,
} from '../api'
import {
  ADMIN_SKILL_KIDS_STATUSES,
  ADMIN_SKILL_PLANS,
  labelFromValue,
} from '../constants'
import type {
  AdminSkill,
  AdminSkillMonetizationType,
  AdminSkillPatchPayload,
} from '../types'

const MONETIZATION_TYPES: AdminSkillMonetizationType[] = [
  'free',
  'plan_included',
  'token_markup',
  'one_time',
  'plus_exclusive',
]

interface AdminSkillEditorDialogProps {
  skill: AdminSkill | null
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface EditorFormState {
  slug: string
  name: string
  short_description: string
  description: string
  category: string
  tags: string
  icon_url: string
  input_hints: string
  example_inputs: string
  example_outputs: string
  required_plan: AdminSkill['required_plan']
  monetization_type: AdminSkillMonetizationType
  price_markup: string
  free_quota_per_month: string
  instruction_template: string
  output_schema: string
  download_instructions: string
  usage_instructions: string
  prerequisites: string
  quickstart: string
  example_io: string
  model_whitelist: string
  timeout_seconds: string
  max_input_tokens: string
  is_kids_safe: boolean
  is_kids_exclusive: boolean
  kids_approval_status: AdminSkill['kids_approval_status']
  ai_disclosure_required: boolean
  featured_flag: boolean
  featured_rank: string
}

function emptyForm(): EditorFormState {
  return {
    slug: '',
    name: '',
    short_description: '',
    description: '',
    category: '',
    tags: '',
    icon_url: '',
    input_hints: '[]',
    example_inputs: '[]',
    example_outputs: '[]',
    required_plan: 'free',
    monetization_type: 'free',
    price_markup: '',
    free_quota_per_month: '',
    instruction_template: '',
    output_schema: '',
    download_instructions: '',
    usage_instructions: '',
    prerequisites: '[]',
    quickstart: '[]',
    example_io: '[]',
    model_whitelist: '',
    timeout_seconds: '45',
    max_input_tokens: '',
    is_kids_safe: false,
    is_kids_exclusive: false,
    kids_approval_status: 'not_required',
    ai_disclosure_required: true,
    featured_flag: false,
    featured_rank: '',
  }
}

function formFromSkill(skill: AdminSkill | null): EditorFormState {
  if (!skill) return emptyForm()
  return {
    ...emptyForm(),
    slug: skill.slug,
    name: skill.name,
    short_description: skill.short_description ?? '',
    description: skill.description ?? '',
    category: skill.category,
    tags: arrayToLines(skill.tags),
    icon_url: skill.icon_url ?? '',
    input_hints: prettyJSON(skill.input_hints ?? []),
    example_inputs: prettyJSON(skill.example_inputs ?? []),
    example_outputs: prettyJSON(skill.example_outputs ?? []),
    required_plan: skill.required_plan,
    monetization_type: skill.monetization_type,
    price_markup: skill.price_markup ? String(skill.price_markup) : '',
    free_quota_per_month:
      skill.free_quota_per_month == null
        ? ''
        : String(skill.free_quota_per_month),
    model_whitelist: arrayToLines(skill.model_whitelist),
    timeout_seconds: String(skill.timeout_seconds ?? 45),
    max_input_tokens:
      skill.max_input_tokens == null ? '' : String(skill.max_input_tokens),
    is_kids_safe: skill.is_kids_safe,
    is_kids_exclusive: skill.is_kids_exclusive,
    kids_approval_status: skill.kids_approval_status,
    ai_disclosure_required: skill.ai_disclosure_required,
    featured_flag: skill.featured_flag,
    featured_rank:
      skill.featured_rank == null ? '' : String(skill.featured_rank),
  }
}

export function AdminSkillEditorDialog({
  skill,
  mode,
  open,
  onOpenChange,
}: AdminSkillEditorDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EditorFormState>(() => formFromSkill(skill))
  const [fieldError, setFieldError] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const activeVersionQuery = useQuery({
    queryKey: [
      'admin-skill-version-detail',
      skill?.id,
      skill?.active_version_id,
    ],
    enabled:
      open && mode === 'edit' && !!skill?.id && !!skill.active_version_id,
    queryFn: () => getAdminSkillVersion(skill!.id, skill!.active_version_id!),
  })

  const versionsQuery = useQuery({
    queryKey: ['admin-skill-versions', skill?.id],
    enabled: open && mode === 'edit' && !!skill?.id,
    queryFn: () => listAdminSkillVersions(skill!.id),
  })

  const auditQuery = useQuery({
    queryKey: ['admin-skill-audit-log', skill?.id],
    enabled: open && mode === 'edit' && !!skill?.id,
    queryFn: () => listAdminSkillAuditLog(skill!.id),
  })

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(formFromSkill(skill))
    setFieldError({})
    setFormError(null)
  }, [open, skill])

  useEffect(() => {
    if (!activeVersionQuery.data?.data || !open) return
    const version = activeVersionQuery.data.data
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((current) => ({
      ...current,
      instruction_template: version.instruction_template,
      output_schema: version.output_schema
        ? prettyJSON(version.output_schema)
        : current.output_schema,
      download_instructions: version.download_instructions,
      usage_instructions: version.usage_instructions,
      prerequisites: prettyJSON(version.prerequisites ?? []),
      quickstart: prettyJSON(version.quickstart ?? []),
      example_io: prettyJSON(version.example_io ?? []),
    }))
  }, [activeVersionQuery.data, open])

  const activeVersion = activeVersionQuery.data?.data
  const originalVersionForm = activeVersion
    ? {
        instruction_template: activeVersion.instruction_template,
        output_schema: activeVersion.output_schema
          ? prettyJSON(activeVersion.output_schema)
          : '',
        download_instructions: activeVersion.download_instructions,
        usage_instructions: activeVersion.usage_instructions,
        prerequisites: prettyJSON(activeVersion.prerequisites ?? []),
        quickstart: prettyJSON(activeVersion.quickstart ?? []),
        example_io: prettyJSON(activeVersion.example_io ?? []),
      }
    : null
  const versionChanged =
    form.instruction_template.trim() !== '' &&
    (mode === 'create' ||
      originalVersionForm == null ||
      form.instruction_template !== originalVersionForm.instruction_template ||
      form.output_schema !== originalVersionForm.output_schema ||
      form.download_instructions !==
        originalVersionForm.download_instructions ||
      form.usage_instructions !== originalVersionForm.usage_instructions ||
      form.prerequisites !== originalVersionForm.prerequisites ||
      form.quickstart !== originalVersionForm.quickstart ||
      form.example_io !== originalVersionForm.example_io)
  const requiresMaxInputTokens =
    form.required_plan === 'free' ||
    form.monetization_type === 'free' ||
    form.free_quota_per_month.trim() !== ''
  const validationError = (error?: string) => (error ? t(error) : undefined)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseForm(form, mode)
      setFieldError(parsed.errors)
      if (!parsed.ok) {
        throw new Error(t('Please fix the highlighted fields.'))
      }
      let savedSkill = skill
      if (mode === 'create') {
        const created = await createAdminSkill(parsed.createPayload)
        savedSkill = created.data
        const patchPayload = parsed.patchPayload
        if (Object.keys(patchPayload).length > 0) {
          const patched = await patchAdminSkill(savedSkill.id, patchPayload)
          savedSkill = patched.data
        }
      } else if (skill) {
        const patched = await patchAdminSkill(skill.id, parsed.patchPayload)
        savedSkill = patched.data
      }
      const shouldCreateVersion = versionChanged
      if (savedSkill && parsed.versionPayload && shouldCreateVersion) {
        await createAdminSkillVersion(savedSkill.id, parsed.versionPayload)
      }
      return savedSkill
    },
    onSuccess: async () => {
      toast.success(t('Skill saved.'))
      await queryClient.invalidateQueries({ queryKey: ['admin-skills'] })
      if (skill?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['admin-skill-versions', skill.id],
        })
        await queryClient.invalidateQueries({
          queryKey: ['admin-skill-audit-log', skill.id],
        })
      }
      onOpenChange(false)
    },
    onError: (error) => {
      const message = apiErrorMessage(error) ?? t('Unable to save Skill.')
      setFormError(message)
      toast.error(message)
    },
  })

  const title = mode === 'create' ? t('Create Skill Draft') : t('Edit Skill')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[92vh] max-w-6xl overflow-hidden p-0'>
        <DialogHeader className='border-b px-5 py-4'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t('Complete the admin Skill sections and save the draft config.')}
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[calc(92vh-9rem)] overflow-y-auto px-5 py-4'>
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'>
            <div className='space-y-4'>
              {formError ? (
                <Alert variant='destructive'>
                  <AlertTriangle className='size-4' />
                  <AlertTitle>{t('Save failed')}</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              {versionChanged ? (
                <Alert>
                  <GitBranch className='size-4' />
                  <AlertTitle>{t('Version change pending')}</AlertTitle>
                  <AlertDescription>
                    {t(
                      'Saving this template change will create a new Skill version.'
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}

              <EditorSection title={t('Metadata')}>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {mode === 'create' ? (
                    <TextInput
                      label={t('Slug')}
                      value={form.slug}
                      error={validationError(fieldError.slug)}
                      onChange={(slug) => update('slug', slug)}
                    />
                  ) : null}
                  <TextInput
                    label={t('Name')}
                    value={form.name}
                    error={validationError(fieldError.name)}
                    onChange={(name) => update('name', name)}
                  />
                  <TextInput
                    label={t('Category')}
                    value={form.category}
                    error={validationError(fieldError.category)}
                    onChange={(category) => update('category', category)}
                  />
                  <TextInput
                    label={t('Icon URL')}
                    value={form.icon_url}
                    onChange={(iconURL) => update('icon_url', iconURL)}
                  />
                </div>
                <TextInput
                  label={t('Short Description')}
                  value={form.short_description}
                  error={validationError(fieldError.short_description)}
                  onChange={(shortDescription) =>
                    update('short_description', shortDescription)
                  }
                />
                <TextAreaInput
                  label={t('Description')}
                  value={form.description}
                  error={validationError(fieldError.description)}
                  rows={4}
                  onChange={(description) => update('description', description)}
                />
                <TextAreaInput
                  label={t('Tags')}
                  value={form.tags}
                  rows={3}
                  onChange={(tags) => update('tags', tags)}
                />
              </EditorSection>

              <EditorSection title={t('User Guidance')}>
                <TextAreaInput
                  label={t('Input Hints')}
                  value={form.input_hints}
                  error={validationError(fieldError.input_hints)}
                  rows={4}
                  onChange={(inputHints) => update('input_hints', inputHints)}
                />
                <div className='grid gap-3 md:grid-cols-2'>
                  <TextAreaInput
                    label={t('Example Inputs')}
                    value={form.example_inputs}
                    error={validationError(fieldError.example_inputs)}
                    rows={5}
                    onChange={(exampleInputs) =>
                      update('example_inputs', exampleInputs)
                    }
                  />
                  <TextAreaInput
                    label={t('Example Outputs')}
                    value={form.example_outputs}
                    error={validationError(fieldError.example_outputs)}
                    rows={5}
                    onChange={(exampleOutputs) =>
                      update('example_outputs', exampleOutputs)
                    }
                  />
                </div>
              </EditorSection>

              <EditorSection title={t('Entitlement')}>
                <div className='grid gap-3 md:grid-cols-4'>
                  <SelectInput
                    label={t('Required Plan')}
                    value={form.required_plan}
                    options={ADMIN_SKILL_PLANS}
                    onChange={(value) => update('required_plan', value)}
                  />
                  <SelectInput
                    label={t('Monetization Type')}
                    value={form.monetization_type}
                    options={MONETIZATION_TYPES}
                    onChange={(value) => update('monetization_type', value)}
                  />
                  <TextInput
                    label={t('Markup')}
                    value={form.price_markup}
                    error={validationError(fieldError.price_markup)}
                    type='number'
                    onChange={(priceMarkup) =>
                      update('price_markup', priceMarkup)
                    }
                  />
                  <TextInput
                    label={t('Free Quota')}
                    value={form.free_quota_per_month}
                    error={validationError(fieldError.free_quota_per_month)}
                    type='number'
                    onChange={(freeQuota) =>
                      update('free_quota_per_month', freeQuota)
                    }
                  />
                </div>
              </EditorSection>

              <EditorSection title={t('Execution')}>
                <TextAreaInput
                  label={t('Instruction Template')}
                  value={form.instruction_template}
                  error={validationError(fieldError.instruction_template)}
                  rows={8}
                  onChange={(template) =>
                    update('instruction_template', template)
                  }
                />
                <div className='grid gap-3 md:grid-cols-2'>
                  <TextAreaInput
                    label={t('Output Schema')}
                    value={form.output_schema}
                    error={validationError(fieldError.output_schema)}
                    rows={5}
                    onChange={(schema) => update('output_schema', schema)}
                  />
                  <TextAreaInput
                    label={t('Model Whitelist')}
                    value={form.model_whitelist}
                    error={validationError(fieldError.model_whitelist)}
                    rows={5}
                    onChange={(models) => update('model_whitelist', models)}
                  />
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  <TextAreaInput
                    label={t('Download Instructions')}
                    value={form.download_instructions}
                    error={validationError(fieldError.download_instructions)}
                    rows={5}
                    onChange={(instructions) =>
                      update('download_instructions', instructions)
                    }
                  />
                  <TextAreaInput
                    label={t('Usage Instructions')}
                    value={form.usage_instructions}
                    error={validationError(fieldError.usage_instructions)}
                    rows={5}
                    onChange={(instructions) =>
                      update('usage_instructions', instructions)
                    }
                  />
                </div>
                <div className='grid gap-3 md:grid-cols-3'>
                  <TextAreaInput
                    label={t('Prerequisites')}
                    value={form.prerequisites}
                    error={validationError(fieldError.prerequisites)}
                    rows={5}
                    onChange={(value) => update('prerequisites', value)}
                  />
                  <TextAreaInput
                    label={t('Quickstart')}
                    value={form.quickstart}
                    error={validationError(fieldError.quickstart)}
                    rows={5}
                    onChange={(value) => update('quickstart', value)}
                  />
                  <TextAreaInput
                    label={t('Example I/O')}
                    value={form.example_io}
                    error={validationError(fieldError.example_io)}
                    rows={5}
                    onChange={(value) => update('example_io', value)}
                  />
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <TextInput
                    label={t('Timeout Seconds')}
                    value={form.timeout_seconds}
                    error={validationError(fieldError.timeout_seconds)}
                    type='number'
                    onChange={(timeout) => update('timeout_seconds', timeout)}
                  />
                  <TextInput
                    label={t('Max Input Tokens')}
                    value={form.max_input_tokens}
                    error={
                      validationError(fieldError.max_input_tokens) ||
                      (requiresMaxInputTokens
                        ? t('Required for Free/free-quota Skills.')
                        : undefined)
                    }
                    type='number'
                    onChange={(tokens) => update('max_input_tokens', tokens)}
                  />
                </div>
              </EditorSection>

              <EditorSection title={t('Safety')}>
                <div className='grid gap-3 md:grid-cols-3'>
                  <SwitchInput
                    label={t('Kids Safe')}
                    checked={form.is_kids_safe}
                    onCheckedChange={(checked) =>
                      update('is_kids_safe', checked)
                    }
                  />
                  <SwitchInput
                    label={t('Kids Exclusive')}
                    checked={form.is_kids_exclusive}
                    error={validationError(fieldError.is_kids_exclusive)}
                    onCheckedChange={(checked) =>
                      update('is_kids_exclusive', checked)
                    }
                  />
                  <SwitchInput
                    label={t('AI Disclosure Required')}
                    checked={form.ai_disclosure_required}
                    onCheckedChange={(checked) =>
                      update('ai_disclosure_required', checked)
                    }
                  />
                </div>
                <SelectInput
                  label={t('Approval Status')}
                  value={form.kids_approval_status}
                  options={ADMIN_SKILL_KIDS_STATUSES}
                  onChange={(value) => update('kids_approval_status', value)}
                />
              </EditorSection>

              <EditorSection title={t('Promotion')}>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <SwitchInput
                    label={t('Featured')}
                    checked={form.featured_flag}
                    onCheckedChange={(checked) =>
                      update('featured_flag', checked)
                    }
                  />
                  <TextInput
                    label={t('Featured Rank')}
                    value={form.featured_rank}
                    error={validationError(fieldError.featured_rank)}
                    type='number'
                    onChange={(rank) => update('featured_rank', rank)}
                  />
                </div>
              </EditorSection>
            </div>

            <aside className='space-y-4'>
              <SidePanel title={t('Version History')}>
                {mode === 'create' ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('Versions appear after the draft is saved.')}
                  </p>
                ) : versionsQuery.data?.data.length ? (
                  <div className='space-y-2'>
                    {versionsQuery.data.data.map((version) => (
                      <div
                        key={version.id}
                        className='bg-card rounded-[7px] border px-3 py-2'
                      >
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-sm font-medium'>
                            {t('Version {{version}}', {
                              version: version.version_number,
                            })}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            {t(labelFromValue(version.status))}
                          </span>
                        </div>
                        <p className='text-muted-foreground mt-1 truncate text-xs tabular-nums'>
                          {version.instruction_template_sha256}
                        </p>
                        <p className='text-muted-foreground mt-1 text-xs tabular-nums'>
                          {dayjs(version.created_at).format(
                            'YYYY-MM-DD HH:mm:ss'
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    {t('No versions yet.')}
                  </p>
                )}
              </SidePanel>

              <SidePanel title={t('Audit Log')}>
                {mode === 'create' ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('Audit entries appear after the draft is saved.')}
                  </p>
                ) : auditQuery.data?.data.length ? (
                  <div className='space-y-2'>
                    {auditQuery.data.data.map((entry) => (
                      <div
                        key={entry.id}
                        className='bg-card rounded-[7px] border px-3 py-2'
                      >
                        <div className='text-sm font-medium'>
                          {t(labelFromValue(entry.action))}
                        </div>
                        <div className='text-muted-foreground mt-1 text-xs tabular-nums'>
                          {dayjs(entry.created_at).format(
                            'YYYY-MM-DD HH:mm:ss'
                          )}
                        </div>
                        <div className='text-muted-foreground mt-1 text-xs'>
                          {entry.changed_fields.join(', ') || t('No fields')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    {t('No audit entries yet.')}
                  </p>
                )}
              </SidePanel>
            </aside>
          </div>
        </div>

        <DialogFooter className='px-5'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {mode === 'create' ? (
              <Plus className='size-4' />
            ) : (
              <Save className='size-4' />
            )}
            {saveMutation.isPending ? t('Saving...') : t('Save Skill')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  function update<K extends keyof EditorFormState>(
    key: K,
    value: EditorFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldError((current) => ({ ...current, [key]: '' }))
  }
}

function parseForm(form: EditorFormState, mode: 'create' | 'edit') {
  const errors: Record<string, string> = {}
  const required = (field: keyof EditorFormState, message: string) => {
    if (String(form[field]).trim() === '') errors[field] = message
  }
  required('name', 'Name is required.')
  required('short_description', 'Short description is required.')
  required('description', 'Description is required.')
  required('category', 'Category is required.')
  if (mode === 'create') required('slug', 'Slug is required.')

  const tags = parseLines(form.tags)
  const modelWhitelist = parseLines(form.model_whitelist)
  const inputHints = parseJSONField(form.input_hints, [], errors, 'input_hints')
  const exampleInputs = parseJSONField(
    form.example_inputs,
    [],
    errors,
    'example_inputs'
  )
  const exampleOutputs = parseJSONField(
    form.example_outputs,
    [],
    errors,
    'example_outputs'
  )
  const outputSchema = parseOptionalJSONField(
    form.output_schema,
    errors,
    'output_schema'
  )
  const prerequisites = parseJSONArrayField(
    form.prerequisites,
    errors,
    'prerequisites'
  )
  const quickstart = parseJSONArrayField(form.quickstart, errors, 'quickstart')
  const exampleIO = parseJSONArrayField(form.example_io, errors, 'example_io')
  const timeoutSeconds = parseOptionalInt(
    form.timeout_seconds,
    errors,
    'timeout_seconds'
  )
  const priceMarkup = parseOptionalNumber(
    form.price_markup,
    errors,
    'price_markup'
  )
  const freeQuota = parseOptionalInt(
    form.free_quota_per_month,
    errors,
    'free_quota_per_month'
  )
  const maxInputTokens = parseOptionalInt(
    form.max_input_tokens,
    errors,
    'max_input_tokens'
  )
  const featuredRank = parseOptionalInt(
    form.featured_rank,
    errors,
    'featured_rank'
  )

  if (
    (form.required_plan === 'free' ||
      form.monetization_type === 'free' ||
      form.free_quota_per_month.trim() !== '') &&
    maxInputTokens == null
  ) {
    errors.max_input_tokens =
      'max_input_tokens is required for Free/free-quota Skills.'
  }
  if (form.monetization_type === 'token_markup' && !priceMarkup) {
    errors.price_markup = 'Markup must be greater than 0 for token markup.'
  }
  if (form.monetization_type !== 'token_markup' && priceMarkup) {
    errors.price_markup = 'Markup is only allowed for token markup.'
  }
  if (timeoutSeconds != null && (timeoutSeconds < 1 || timeoutSeconds > 120)) {
    errors.timeout_seconds = 'Timeout must be between 1 and 120 seconds.'
  }
  if (form.is_kids_exclusive && !form.is_kids_safe) {
    errors.is_kids_exclusive = 'Kids Exclusive requires Kids Safe.'
  }
  if (form.instruction_template.trim() !== '') {
    if (form.download_instructions.trim() === '') {
      errors.download_instructions = 'Download instructions are required.'
    }
    if (form.usage_instructions.trim() === '') {
      errors.usage_instructions = 'Usage instructions are required.'
    }
  }

  const hasErrors = Object.values(errors).some(Boolean)
  const createPayload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    short_description: form.short_description.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    required_plan: form.required_plan,
    monetization_type: form.monetization_type,
    ...(priceMarkup != null ? { price_markup: priceMarkup } : {}),
    free_quota_per_month: freeQuota,
    max_input_tokens: maxInputTokens,
  }
  const patchPayload: AdminSkillPatchPayload = {
    name: form.name.trim(),
    short_description: form.short_description.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    tags,
    icon_url: form.icon_url.trim() || null,
    input_hints: inputHints,
    example_inputs: exampleInputs,
    example_outputs: exampleOutputs,
    required_plan: form.required_plan,
    monetization_type: form.monetization_type,
    price_markup: priceMarkup ?? 0,
    free_quota_per_month: freeQuota,
    max_input_tokens: maxInputTokens,
    model_whitelist: modelWhitelist,
    timeout_seconds: timeoutSeconds ?? 45,
    is_kids_safe: form.is_kids_safe,
    is_kids_exclusive: form.is_kids_exclusive,
    kids_approval_status: form.kids_approval_status,
    ai_disclosure_required: form.ai_disclosure_required,
    featured_flag: form.featured_flag,
    featured_rank: featuredRank,
  }
  const versionPayload =
    form.instruction_template.trim() === ''
      ? null
      : {
          instruction_template: form.instruction_template,
          output_schema: outputSchema,
          download_instructions: form.download_instructions.trim(),
          usage_instructions: form.usage_instructions.trim(),
          prerequisites,
          quickstart,
          example_io: exampleIO,
        }

  return {
    ok: !hasErrors,
    errors,
    createPayload,
    patchPayload,
    versionPayload,
  }
}

function parseLines(value: unknown): string[] {
  if (!Array.isArray(value) && typeof value !== 'string') return []
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean)
  }
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseJSONField(
  value: string,
  fallback: unknown,
  errors: Record<string, string>,
  field: string
) {
  if (value.trim() === '') return fallback
  try {
    return JSON.parse(value)
  } catch {
    errors[field] = 'Enter valid JSON.'
    return fallback
  }
}

function parseOptionalJSONField(
  value: string,
  errors: Record<string, string>,
  field: string
) {
  if (value.trim() === '') return null
  try {
    return JSON.parse(value)
  } catch {
    errors[field] = 'Enter valid JSON.'
    return null
  }
}

function parseJSONArrayField(
  value: string,
  errors: Record<string, string>,
  field: string
) {
  const parsed = parseJSONField(value, [], errors, field)
  if (!Array.isArray(parsed)) {
    errors[field] = 'Enter a valid JSON array.'
    return []
  }
  return parsed
}

function parseOptionalInt(
  value: string,
  errors: Record<string, string>,
  field: string
) {
  if (value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    errors[field] = 'Enter a valid number.'
    return null
  }
  return parsed
}

function parseOptionalNumber(
  value: string,
  errors: Record<string, string>,
  field: string
) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    errors[field] = 'Enter a valid number.'
    return null
  }
  return parsed
}

function arrayToLines(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(String).join('\n')
}

function prettyJSON(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2)
}

function apiErrorMessage(error: unknown): string | null {
  return (
    (
      error as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
    )?.response?.data?.error?.message ??
    (error as Error | null)?.message ??
    null
  )
}

function EditorSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className='bg-card rounded-[7px] border p-4'>
      <h3 className='text-base font-semibold'>{title}</h3>
      <div className='mt-4 space-y-3'>{children}</div>
    </section>
  )
}

function SidePanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className='bg-card rounded-[7px] border p-4'>
      <h3 className='text-sm font-semibold'>{title}</h3>
      <div className='mt-3'>{children}</div>
    </section>
  )
}

function TextInput({
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
}) {
  const id = useMemo(() => label.toLowerCase().replace(/\s+/g, '-'), [label])
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
      />
      {error ? <p className='text-destructive text-sm'>{error}</p> : null}
    </div>
  )
}

function TextAreaInput({
  label,
  value,
  onChange,
  error,
  rows,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  rows: number
}) {
  const id = useMemo(() => label.toLowerCase().replace(/\s+/g, '-'), [label])
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        className='font-mono text-sm'
      />
      {error ? <p className='text-destructive text-sm'>{error}</p> : null}
    </div>
  )
}

function SelectInput<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger className='h-10 w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labelFromValue(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SwitchInput({
  label,
  checked,
  onCheckedChange,
  error,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  error?: string
}) {
  return (
    <div className='grid gap-2'>
      <div className='bg-card flex min-h-10 items-center justify-between gap-3 rounded-[7px] border px-3 py-2'>
        <Label>{label}</Label>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-invalid={!!error}
        />
      </div>
      {error ? <p className='text-destructive text-sm'>{error}</p> : null}
    </div>
  )
}

export const adminSkillEditorTestUtils = {
  emptyForm,
  parseForm,
}
