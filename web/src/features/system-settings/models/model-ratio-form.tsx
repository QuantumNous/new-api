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
import { useQuery } from '@tanstack/react-query'
import {
  Code2,
  Eye,
  MoreHorizontal,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { LearnMore } from '@/components/learn-more'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { getEnabledModels } from '@/features/channels/api'
import {
  buildPriceChangeRows,
  pricingOptions,
} from '@/features/model-pricing/pricing'
import { useMediaQuery } from '@/hooks'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageActionsPortal } from '../components/settings-page-context'
import {
  ModelRatioVisualEditor,
  type ModelRatioVisualEditorHandle,
} from './model-ratio-visual-editor'
import { PriceChangesDialog } from './price-change-diff'
import { formatJsonForTextarea } from './utils'

type ModelFormValues = {
  ModelPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  ExposeRatioEnabled: boolean
  BillingMode: string
  BillingExpr: string
  PluginBillingExpr: string
}

type ModelRatioFormProps = {
  form: UseFormReturn<ModelFormValues>
  savedValues: ModelFormValues
  onSave: (values: ModelFormValues) => Promise<void>
  onReset: () => void
  isSaving: boolean
  isResetting: boolean
  variant?: 'default' | 'unset'
}

type ModelJsonFieldName =
  | 'ModelPrice'
  | 'ModelRatio'
  | 'CacheRatio'
  | 'CreateCacheRatio'
  | 'CompletionRatio'
  | 'ImageRatio'
  | 'AudioRatio'
  | 'AudioCompletionRatio'

const modelJsonFields: Array<{
  name: ModelJsonFieldName
  labelKey: string
  descriptionKey: string
}> = [
  {
    name: 'ModelPrice',
    labelKey: 'Model fixed pricing',
    descriptionKey:
      'JSON map of model → USD cost per request. Takes precedence over ratio based billing.',
  },
  {
    name: 'ModelRatio',
    labelKey: 'Model ratio',
    descriptionKey: 'JSON map of model → multiplier applied to quota billing.',
  },
  {
    name: 'CacheRatio',
    labelKey: 'Prompt cache ratio',
    descriptionKey: 'Optional ratio used when upstream cache hits occur.',
  },
  {
    name: 'CreateCacheRatio',
    labelKey: 'Create cache ratio',
    descriptionKey:
      'Ratio applied when creating cache entries for supported models.',
  },
  {
    name: 'CompletionRatio',
    labelKey: 'Completion ratio',
    descriptionKey:
      'Applies to custom completion endpoints. JSON map of model → ratio.',
  },
  {
    name: 'ImageRatio',
    labelKey: 'Image ratio',
    descriptionKey: 'Configure per-model ratio for image inputs or outputs.',
  },
  {
    name: 'AudioRatio',
    labelKey: 'Audio ratio',
    descriptionKey:
      'Ratio applied to audio inputs where supported by the upstream model.',
  },
  {
    name: 'AudioCompletionRatio',
    labelKey: 'Audio completion ratio',
    descriptionKey: 'Ratio applied to audio completions for streaming models.',
  },
]

function ModelJsonTextareaField(props: {
  form: UseFormReturn<ModelFormValues>
  name: ModelJsonFieldName
  label: string
  description: string
}) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className='flex min-w-0 flex-col gap-2'>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <JsonCodeEditor
              value={field.value}
              onChange={(value) => field.onChange(value)}
              name={field.name}
              onBlur={field.onBlur}
              textareaRef={field.ref}
            />
          </FormControl>
          <FormDescription className='text-xs leading-5'>
            {props.description}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const ModelRatioForm = memo(function ModelRatioForm({
  form,
  savedValues,
  onSave,
  onReset,
  isSaving,
  isResetting,
  variant = 'default',
}: ModelRatioFormProps) {
  const { t } = useTranslation()
  const isUnsetVariant = variant === 'unset'
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const visualEditorRef = useRef<ModelRatioVisualEditorHandle>(null)
  const isMobile = useMediaQuery('(max-width: 639px)')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const draftOptions = useWatch({
    control: form.control,
    compute: (values: ModelFormValues) => pricingOptions(values),
  })
  const exposeRatioEnabled = useWatch({
    control: form.control,
    name: 'ExposeRatioEnabled',
  })
  const changeRows = useMemo(
    () => buildPriceChangeRows(pricingOptions(savedValues), draftOptions),
    [savedValues, draftOptions]
  )
  // The open editor commits its edits into the draft when saving.
  const pendingEditor = editMode === 'visual' && editorDirty
  const hasChanges =
    changeRows.length > 0 ||
    pendingEditor ||
    exposeRatioEnabled !== savedValues.ExposeRatioEnabled

  const enabledModelsQuery = useQuery({
    queryKey: ['enabled-models'],
    queryFn: async () => requireServerSuccess(await getEnabledModels()),
    enabled: isUnsetVariant,
  })

  const enabledModelsError = isUnsetVariant
    ? enabledModelsQuery.isError ||
      (enabledModelsQuery.data !== undefined &&
        !enabledModelsQuery.data.success)
    : false
  const enabledModelsErrorMessage = enabledModelsQuery.data?.message

  useEffect(() => {
    if (!enabledModelsError) return
    handleServerError(
      enabledModelsQuery.error ?? enabledModelsQuery.data,
      t('Failed to load enabled models')
    )
  }, [
    enabledModelsError,
    enabledModelsErrorMessage,
    enabledModelsQuery.error,
    enabledModelsQuery.data,
    t,
  ])

  const handleFieldChange = useCallback(
    (field: keyof ModelFormValues, value: string) => {
      form.setValue(field, value, {
        shouldValidate: true,
        shouldDirty: true,
      })
    },
    [form]
  )

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => (prev === 'visual' ? 'json' : 'visual'))
  }, [])

  // Every price change is confirmed before it is saved.
  const handleSave = useCallback(async () => {
    if (editMode === 'visual') {
      const committed = await visualEditorRef.current?.commitOpenEditor()
      if (committed === false) return
    }
    if (!(await form.trigger())) return
    const changes = buildPriceChangeRows(
      pricingOptions(savedValues),
      pricingOptions(form.getValues())
    )
    if (changes.length === 0) {
      await form.handleSubmit(onSave)()
      return
    }
    setConfirmOpen(true)
  }, [editMode, form, onSave, savedValues])

  const handleConfirmSave = useCallback(async () => {
    await form.handleSubmit(onSave)()
    setConfirmOpen(false)
  }, [form, onSave])

  const handleDiscard = useCallback(() => {
    visualEditorRef.current?.closeEditor()
    form.reset({
      ...savedValues,
      ModelPrice: formatJsonForTextarea(savedValues.ModelPrice),
      ModelRatio: formatJsonForTextarea(savedValues.ModelRatio),
      CacheRatio: formatJsonForTextarea(savedValues.CacheRatio),
      CreateCacheRatio: formatJsonForTextarea(savedValues.CreateCacheRatio),
      CompletionRatio: formatJsonForTextarea(savedValues.CompletionRatio),
      ImageRatio: formatJsonForTextarea(savedValues.ImageRatio),
      AudioRatio: formatJsonForTextarea(savedValues.AudioRatio),
      AudioCompletionRatio: formatJsonForTextarea(
        savedValues.AudioCompletionRatio
      ),
      BillingMode: formatJsonForTextarea(savedValues.BillingMode),
      BillingExpr: formatJsonForTextarea(savedValues.BillingExpr),
      PluginBillingExpr: formatJsonForTextarea(savedValues.PluginBillingExpr),
    })
  }, [form, savedValues])

  const editModeLabel =
    editMode === 'visual' ? t('Switch to JSON') : t('Switch to Visual')
  const EditModeIcon = editMode === 'visual' ? Code2 : Eye

  return (
    <Form {...form}>
      <div className='flex min-h-0 flex-1 flex-col gap-6'>
        {!isUnsetVariant && (
          <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
            <SettingsPageActionsPortal>
              <FormField
                control={form.control}
                name='ExposeRatioEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem className='gap-2 py-0'>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Expose ratio API')}</FormLabel>
                      <FormDescription className='sr-only'>
                        {t(
                          'Allow clients to query configured prices via `/api/ratio`.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <LearnMore contentProps={{ side: 'bottom', align: 'end' }}>
                      {t(
                        'Allow clients to query configured prices via `/api/ratio`.'
                      )}
                    </LearnMore>
                  </SettingsSwitchItem>
                )}
              />
            </SettingsPageActionsPortal>
            <FormDirtyIndicator
              isDirty={hasChanges}
              message={
                changeRows.length > 0
                  ? t('{{count}} unsaved price changes', {
                      count: changeRows.length,
                    })
                  : undefined
              }
            />
            {isMobile ? (
              // Phones keep Save on the same row and move the rest here.
              <DataTableRowActionMenu
                ariaLabel={t('More actions')}
                trigger={
                  <Button type='button' variant='outline' size='icon-sm'>
                    <MoreHorizontal aria-hidden='true' />
                  </Button>
                }
              >
                <DropdownMenuItem
                  variant='destructive'
                  onClick={onReset}
                  disabled={isResetting}
                >
                  <RotateCcw />
                  {t('Reset prices')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleEditMode}>
                  <EditModeIcon />
                  {editModeLabel}
                </DropdownMenuItem>
                {hasChanges && (
                  <DropdownMenuItem onClick={handleDiscard} disabled={isSaving}>
                    <Undo2 />
                    {t('Discard changes')}
                  </DropdownMenuItem>
                )}
              </DataTableRowActionMenu>
            ) : (
              <>
                <Button
                  type='button'
                  variant='destructive'
                  size='sm'
                  onClick={onReset}
                  disabled={isResetting}
                >
                  <RotateCcw data-icon='inline-start' />
                  {t('Reset prices')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={toggleEditMode}
                >
                  <EditModeIcon data-icon='inline-start' />
                  {editModeLabel}
                </Button>
                {hasChanges && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={handleDiscard}
                    disabled={isSaving}
                  >
                    <Undo2 data-icon='inline-start' />
                    {t('Discard changes')}
                  </Button>
                )}
              </>
            )}
            <Button
              type='button'
              size='sm'
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              <Save data-icon='inline-start' />
              {isSaving ? t('Saving...') : t('Save model prices')}
              {changeRows.length > 0 && (
                <span className='bg-primary-foreground/20 ml-0.5 rounded-full px-1.5 text-xs tabular-nums'>
                  {changeRows.length}
                </span>
              )}
            </Button>
          </div>
        )}

        {editMode === 'visual' ? (
          <div className='flex min-h-0 flex-1 flex-col gap-6'>
            <ModelRatioVisualEditor
              ref={visualEditorRef}
              savedModelPrice={savedValues.ModelPrice}
              savedModelRatio={savedValues.ModelRatio}
              savedCacheRatio={savedValues.CacheRatio}
              savedCreateCacheRatio={savedValues.CreateCacheRatio}
              savedCompletionRatio={savedValues.CompletionRatio}
              savedImageRatio={savedValues.ImageRatio}
              savedAudioRatio={savedValues.AudioRatio}
              savedAudioCompletionRatio={savedValues.AudioCompletionRatio}
              savedBillingMode={savedValues.BillingMode}
              savedBillingExpr={savedValues.BillingExpr}
              savedPluginBillingExpr={savedValues.PluginBillingExpr}
              modelPrice={form.watch('ModelPrice')}
              modelRatio={form.watch('ModelRatio')}
              cacheRatio={form.watch('CacheRatio')}
              createCacheRatio={form.watch('CreateCacheRatio')}
              completionRatio={form.watch('CompletionRatio')}
              imageRatio={form.watch('ImageRatio')}
              audioRatio={form.watch('AudioRatio')}
              audioCompletionRatio={form.watch('AudioCompletionRatio')}
              billingMode={form.watch('BillingMode')}
              billingExpr={form.watch('BillingExpr')}
              pluginBillingExpr={form.watch('PluginBillingExpr')}
              candidateModelNames={
                isUnsetVariant ? enabledModelsQuery.data?.data : undefined
              }
              candidateModelsLoading={
                isUnsetVariant && enabledModelsQuery.isLoading
              }
              filterMode={isUnsetVariant ? 'unset' : 'all'}
              onSave={handleSave}
              isSaving={isSaving}
              onEditorDirtyChange={setEditorDirty}
              onChange={(field, value) => {
                const fieldMap: Record<string, keyof ModelFormValues> = {
                  'billing_setting.billing_mode': 'BillingMode',
                  'billing_setting.billing_expr': 'BillingExpr',
                  'billing_setting.plugin_billing_expr': 'PluginBillingExpr',
                }
                const formField =
                  fieldMap[field] || (field as keyof ModelFormValues)
                handleFieldChange(formField, value)
              }}
            />
          </div>
        ) : (
          <SettingsForm onSubmit={form.handleSubmit(onSave)}>
            <div className='grid min-w-0 gap-x-5 gap-y-8 lg:grid-cols-2 2xl:grid-cols-3'>
              {modelJsonFields.map((config) => (
                <ModelJsonTextareaField
                  key={config.name}
                  form={form}
                  name={config.name}
                  label={t(config.labelKey)}
                  description={t(config.descriptionKey)}
                />
              ))}
            </div>
          </SettingsForm>
        )}
      </div>
      <PriceChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        rows={changeRows}
        onConfirm={handleConfirmSave}
        isLoading={isSaving}
      />
    </Form>
  )
})
