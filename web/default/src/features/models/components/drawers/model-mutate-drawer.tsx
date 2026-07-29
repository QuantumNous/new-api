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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
  sideDrawerSwitchItemClassName,
} from '@/components/drawer-layout'
import { JsonEditor } from '@/components/json-editor'
import { MultiSelect } from '@/components/multi-select'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useIntegrationProfiles } from '@/features/pricing/hooks/use-integration-profiles'
import type {
  ModelCapability,
  ModelIntegration,
  Modality,
} from '@/features/pricing/types'

import { createModel, updateModel, getModel, getVendors } from '../../api'
import { getNameRuleOptions, ENDPOINT_TEMPLATES } from '../../constants'
import { modelsQueryKeys, vendorsQueryKeys, parseModelTags } from '../../lib'
import type { Model } from '../../types'

const MODALITIES: Modality[] = [
  'text',
  'image',
  'audio',
  'video',
  'pdf',
  'file',
]
const MODALITY_LABELS: Record<Modality, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  pdf: 'PDF',
  file: 'File',
}
const CAPABILITIES: ModelCapability[] = [
  'function_calling',
  'streaming',
  'vision',
  'json_mode',
  'structured_output',
  'reasoning',
  'tools',
  'system_prompt',
  'web_search',
  'code_interpreter',
  'caching',
  'embeddings',
]
const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  function_calling: 'Function calling',
  streaming: 'Streaming',
  vision: 'Vision',
  json_mode: 'JSON mode',
  structured_output: 'Structured output',
  reasoning: 'Reasoning',
  tools: 'Tools',
  system_prompt: 'System prompt',
  web_search: 'Web search',
  code_interpreter: 'Code interpreter',
  caching: 'Cache',
  embeddings: 'Embeddings',
}
const MAX_METADATA_TOKENS = 2_147_483_647

function parseArray<T>(value?: string): T[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

// Model metadata form state. Billing is managed separately in Pricing Center.
const extendedModelFormSchema = z.object({
  id: z.number().optional(),
  model_name: z.string().min(1, 'Model name is required'),
  description: z.string(),
  icon: z.string(),
  tags: z.array(z.string()),
  vendor_id: z.number().optional(),
  endpoints: z.string(),
  display_name: z.string(),
  official_discount: z.number().min(0).lt(100).optional(),
  context_length: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_METADATA_TOKENS)
    .optional(),
  max_output_tokens: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_METADATA_TOKENS)
    .optional(),
  knowledge_cutoff: z.string(),
  release_date: z.string(),
  parameter_count: z.string(),
  usage_notes: z.string(),
  input_modalities: z.array(z.enum(MODALITIES)),
  output_modalities: z.array(z.enum(MODALITIES)),
  capabilities: z.array(z.enum(CAPABILITIES)),
  integrations: z.array(
    z.object({
      profile_id: z.string(),
      groups: z
        .array(z.string())
        .refine(
          (groups) => groups.some((group) => group.trim()),
          'At least one group is required'
        ),
    })
  ),
  name_rule: z.number(),
  status: z.boolean(),
  sync_official: z.boolean(),
})

type ExtendedModelFormValues = z.infer<typeof extendedModelFormSchema>

type ModelMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Model | null
}

export function ModelMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ModelMutateDrawerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentModelId = currentRow?.id
  const isEditing = Boolean(currentModelId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: integrationProfiles = [], isLoading: profilesLoading } =
    useIntegrationProfiles(open)

  // Fetch vendors for dropdown
  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = vendorsData?.data?.items || []

  // Fetch model detail if editing
  const { data: modelData } = useQuery({
    queryKey: modelsQueryKeys.detail(currentModelId || 0),
    queryFn: () => {
      if (!currentModelId) {
        throw new Error('Model ID is required')
      }
      return getModel(currentModelId)
    },
    enabled: open && isEditing,
  })

  const form = useForm<ExtendedModelFormValues>({
    resolver: zodResolver(extendedModelFormSchema),
    defaultValues: {
      model_name: '',
      description: '',
      icon: '',
      tags: [],
      vendor_id: undefined,
      endpoints: '',
      display_name: '',
      official_discount: undefined,
      context_length: undefined,
      max_output_tokens: undefined,
      knowledge_cutoff: '',
      release_date: '',
      parameter_count: '',
      usage_notes: '',
      input_modalities: [],
      output_modalities: [],
      capabilities: [],
      integrations: [],
      name_rule: 0,
      status: true,
      sync_official: true,
    },
  })

  // Load model metadata for editing.
  useEffect(() => {
    if (open && isEditing && modelData?.data) {
      const model = modelData.data
      form.reset({
        id: model.id,
        model_name: model.model_name,
        description: model.description || '',
        icon: model.icon || '',
        tags: parseModelTags(model.tags),
        vendor_id: model.vendor_id,
        endpoints: model.endpoints || '',
        display_name: model.display_name || '',
        official_discount: model.official_discount || undefined,
        context_length: model.context_length,
        max_output_tokens: model.max_output_tokens,
        knowledge_cutoff: model.knowledge_cutoff || '',
        release_date: model.release_date || '',
        parameter_count: model.parameter_count || '',
        usage_notes: model.usage_notes || '',
        input_modalities: parseArray<Modality>(model.input_modalities),
        output_modalities: parseArray<Modality>(model.output_modalities),
        capabilities: parseArray<ModelCapability>(model.capabilities),
        integrations: parseArray<ModelIntegration>(model.integrations).map(
          (item) => ({ profile_id: item.profile_id, groups: item.groups || [] })
        ),
        name_rule: model.name_rule || 0,
        status: model.status === 1,
        sync_official: model.sync_official === 1,
      })
    } else if (open && !isEditing) {
      // Pre-fill model name if passed from missing models
      form.reset({
        model_name: currentRow?.model_name || '',
        description: '',
        icon: '',
        tags: [],
        vendor_id: undefined,
        endpoints: '',
        display_name: '',
        official_discount: undefined,
        context_length: undefined,
        max_output_tokens: undefined,
        knowledge_cutoff: '',
        release_date: '',
        parameter_count: '',
        usage_notes: '',
        input_modalities: [],
        output_modalities: [],
        capabilities: [],
        integrations: [],
        name_rule: 0,
        status: true,
        sync_official: true,
      })
    }
  }, [open, isEditing, modelData, currentRow, form])

  const onSubmit = useCallback(
    async (values: ExtendedModelFormValues): Promise<void> => {
      setIsSubmitting(true)
      try {
        const submitData = {
          ...values,
          id: isEditing ? currentModelId : undefined,
          official_discount: values.official_discount ?? 0,
          tags: Array.isArray(values.tags) ? values.tags.join(',') : '',
          status: values.status ? 1 : 0,
          sync_official: values.sync_official ? 1 : 0,
          input_modalities: JSON.stringify([...values.input_modalities].sort()),
          output_modalities: JSON.stringify(
            [...values.output_modalities].sort()
          ),
          capabilities: JSON.stringify([...values.capabilities].sort()),
          integrations: JSON.stringify(
            values.integrations
              .map((item) => ({
                profile_id: item.profile_id,
                groups: [
                  ...new Set(
                    item.groups.map((group) => group.trim()).filter(Boolean)
                  ),
                ].sort(),
              }))
              .sort((a, b) => a.profile_id.localeCompare(b.profile_id))
          ),
        }

        const response =
          isEditing && currentModelId
            ? await updateModel({ ...submitData, id: currentModelId })
            : await createModel(submitData)

        if (response.success) {
          toast.success(
            isEditing
              ? 'Model updated successfully'
              : 'Model created successfully'
          )
          queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
          onOpenChange(false)
        } else {
          toast.error(response.message || 'Operation failed')
        }
      } catch (error: unknown) {
        toast.error((error as Error)?.message || 'Operation failed')
      } finally {
        setIsSubmitting(false)
      }
    },
    [isEditing, currentModelId, queryClient, onOpenChange]
  )

  const handleFillEndpointTemplate = (templateKey: string) => {
    const template = ENDPOINT_TEMPLATES[templateKey]
    if (template) {
      const templateJson = JSON.stringify({ [templateKey]: template }, null, 2)
      form.setValue('endpoints', templateJson)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-2xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isEditing ? t('Edit Model') : t('Create Model')}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t("Update model configuration and click save when you're done.")
              : t(
                  'Add a new model to the system by providing the necessary information.'
                )}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='model-form'
            onSubmit={form.handleSubmit(
              onSubmit as Parameters<typeof form.handleSubmit>[0]
            )}
            className={sideDrawerFormClassName()}
          >
            {/* Basic Information */}
            <SideDrawerSection>
              <h3 className='text-sm font-semibold'>
                {t('Basic Information')}
              </h3>

              <FormField
                control={form.control}
                name='model_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Model Name *')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('gpt-4, claude-3-opus, etc.')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('The unique identifier for this model')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('Describe this model...')}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='icon'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Icon')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('OpenAI, Anthropic, etc.')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className='text-xs'>
                      {t('@lobehub/icons key')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='vendor_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Vendor')}</FormLabel>
                    <Select
                      items={vendors.map((vendor) => ({
                        value: String(vendor.id),
                        label: vendor.name,
                      }))}
                      onValueChange={(value) =>
                        field.onChange(
                          value ? Number.parseInt(value) : undefined
                        )
                      }
                      value={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select vendor')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {vendors.map((vendor) => (
                            <SelectItem
                              key={vendor.id}
                              value={String(vendor.id)}
                            >
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tags'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Tags')}</FormLabel>
                    <FormControl>
                      <TagInput
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder={t('Add tags...')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Press Enter or comma to add tags')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <div>
                <h3 className='text-sm font-semibold'>
                  {t('Discovery metadata')}
                </h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Describe how this model appears in discovery and documentation.'
                  )}
                </p>
              </div>
              <FormField
                control={form.control}
                name='display_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Display name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='official_discount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Official price discount (%)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={99.99}
                        step={0.01}
                        value={field.value ?? ''}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ''
                              ? undefined
                              : event.target.valueAsNumber
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Optional marketplace badge compared with the official price. This does not change billing.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='grid gap-4 sm:grid-cols-2'>
                {(['context_length', 'max_output_tokens'] as const).map(
                  (name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {name === 'context_length'
                              ? t('Context length')
                              : t('Max output tokens')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type='number'
                              min={0}
                              max={MAX_METADATA_TOKENS}
                              step={1}
                              value={field.value ?? ''}
                              onChange={(event) =>
                                field.onChange(
                                  event.target.value === ''
                                    ? undefined
                                    : event.target.valueAsNumber
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )
                )}
                <FormField
                  control={form.control}
                  name='release_date'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Release date')}</FormLabel>
                      <FormControl>
                        <Input type='date' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='knowledge_cutoff'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Knowledge cutoff')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='parameter_count'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Parameter count')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('For example: 70B')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(['input_modalities', 'output_modalities'] as const).map(
                (name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {name === 'input_modalities'
                            ? t('Input modalities')
                            : t('Output modalities')}
                        </FormLabel>
                        <FormControl>
                          <MultiSelect
                            options={MODALITIES.map((value) => ({
                              value,
                              label: t(MODALITY_LABELS[value]),
                            }))}
                            selected={field.value}
                            onChange={field.onChange}
                            placeholder={t('Select modalities...')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )
              )}
              <FormField
                control={form.control}
                name='capabilities'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Capabilities')}</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={CAPABILITIES.map((value) => ({
                          value,
                          label: t(CAPABILITY_LABELS[value]),
                        }))}
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder={t('Select capabilities...')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='usage_notes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Usage notes')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <div>
                <h3 className='text-sm font-semibold'>{t('Integrations')}</h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Assign documented integration profiles and the groups that may use them.'
                  )}
                </p>
              </div>
              {profilesLoading && (
                <p className='text-muted-foreground text-sm'>
                  {t('Loading integration profiles...')}
                </p>
              )}
              <FormField
                control={form.control}
                name='integrations'
                render={({ field }) => (
                  <FormItem>
                    <div className='space-y-3'>
                      {integrationProfiles.map((profile) => {
                        const assignment = field.value.find(
                          (item) => item.profile_id === profile.id
                        )
                        return (
                          <div
                            key={profile.id}
                            className='rounded-lg border p-4'
                          >
                            <div className='flex items-start justify-between gap-4'>
                              <div>
                                <p className='font-medium'>
                                  {t(profile.name_key)}
                                </p>
                                <p className='text-muted-foreground text-xs'>
                                  {profile.protocol} · {profile.method} ·{' '}
                                  <code>{profile.gateway_path_template}</code>
                                </p>
                                <p className='text-muted-foreground text-xs'>
                                  {t('Authentication')}: {profile.auth_scheme} ·{' '}
                                  {t('Streaming')}:{' '}
                                  {profile.streaming
                                    ? t('Enabled')
                                    : t('Disabled')}
                                </p>
                              </div>
                              <Switch
                                checked={Boolean(assignment)}
                                aria-label={t('Enable integration')}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([
                                      ...field.value,
                                      { profile_id: profile.id, groups: [] },
                                    ])
                                  } else {
                                    field.onChange(
                                      field.value.filter(
                                        (item) => item.profile_id !== profile.id
                                      )
                                    )
                                  }
                                }}
                              />
                            </div>
                            {assignment && (
                              <div className='mt-3'>
                                <Label>{t('Required groups')}</Label>
                                <MultiSelect
                                  options={(
                                    currentRow?.enable_groups || []
                                  ).map((group) => ({
                                    value: group,
                                    label: group,
                                  }))}
                                  selected={assignment.groups}
                                  allowCreate
                                  onChange={(groups) =>
                                    field.onChange(
                                      field.value.map((item) =>
                                        item.profile_id === profile.id
                                          ? { ...item, groups }
                                          : item
                                      )
                                    )
                                  }
                                  placeholder={t('Select or enter groups...')}
                                />
                                {assignment.groups.length === 0 && (
                                  <p className='text-destructive mt-1 text-sm'>
                                    {t('At least one group is required')}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            {/* Matching Configuration */}
            <SideDrawerSection>
              <h3 className='text-sm font-semibold'>{t('Matching Rules')}</h3>

              <FormField
                control={form.control}
                name='name_rule'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name Rule')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) =>
                          field.onChange(Number.parseInt(value))
                        }
                        value={String(field.value)}
                        className='grid grid-cols-2 gap-4'
                      >
                        {getNameRuleOptions(t).map((option) => (
                          <div
                            key={option.value}
                            className='flex items-center space-x-2'
                          >
                            <RadioGroupItem
                              value={String(option.value)}
                              id={`rule-${option.value}`}
                            />
                            <Label
                              htmlFor={`rule-${option.value}`}
                              className='cursor-pointer font-normal'
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      {t('How this model name should match requests')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            {/* Endpoints Configuration */}
            <SideDrawerSection>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-semibold'>
                  {t('Legacy / advanced routing configuration')}
                </h3>
                <Select<string>
                  items={Object.keys(ENDPOINT_TEMPLATES).map((key) => ({
                    value: key,
                    label: key,
                  }))}
                  onValueChange={(v) =>
                    v !== null && handleFillEndpointTemplate(v)
                  }
                >
                  <SelectTrigger size='sm' className='w-[200px]'>
                    <SelectValue placeholder={t('Load template...')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {Object.keys(ENDPOINT_TEMPLATES).map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <FormField
                control={form.control}
                name='endpoints'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Endpoint Configuration')}</FormLabel>
                    <FormControl>
                      <JsonEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        keyPlaceholder='endpoint_type'
                        valuePlaceholder='{"path": "/v1/...", "method": "POST"}'
                        keyLabel='Endpoint Type'
                        valueLabel='Configuration'
                        valueType='any'
                        emptyMessage={t(
                          'No endpoints configured. Switch to JSON mode or add rows to define endpoints.'
                        )}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Legacy endpoint routing only. This does not control the new integration documentation.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            {/* Pricing is intentionally managed in one dedicated domain. */}
            <SideDrawerSection>
              <h3 className='text-sm font-semibold'>{t('Model pricing')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Pricing is managed in Pricing Center and is bound to the exact model name used by clients.'
                )}
              </p>
              {isEditing && (
                <Button
                  type='button'
                  variant='outline'
                  render={
                    <Link
                      to='/pricing-center'
                      search={{ model: modelData?.data?.model_name }}
                    />
                  }
                >
                  {t('Configure pricing')}
                </Button>
              )}
            </SideDrawerSection>

            {/* Status & Sync */}
            <SideDrawerSection>
              <h3 className='text-sm font-semibold'>{t('Status & Sync')}</h3>

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className={sideDrawerSwitchItemClassName()}>
                    <div className='flex flex-col gap-0.5'>
                      <FormLabel className='text-base'>
                        {t('Enabled')}
                      </FormLabel>
                      <FormDescription>
                        {t('Enable or disable this model')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='sync_official'
                render={({ field }) => (
                  <FormItem className={sideDrawerSwitchItemClassName()}>
                    <div className='flex flex-col gap-0.5'>
                      <FormLabel className='text-base'>
                        {t('Official Sync')}
                      </FormLabel>
                      <FormDescription>
                        {t('Sync this model with official upstream')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>

        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose
            render={<Button variant='outline' disabled={isSubmitting} />}
          >
            {t('Cancel')}
          </SheetClose>
          <Button form='model-form' type='submit' disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? t('Update Model') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
