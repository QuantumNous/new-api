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
  Alert02Icon,
  AlertCircleIcon,
  InformationCircleIcon,
  ReloadIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { TFunction } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import type { ApiKeyModelsResult } from '../../api'
import { useApiKeyModelCatalog } from '../../hooks/use-api-key-model-catalog'
import { buildCCSwitchImportUrl } from '../../lib/cc-switch-import'
import type { CCSwitchApp, CCSwitchModelField } from '../../lib/model-catalog'
import type { ApiKey } from '../../types'
import {
  ApiKeyModelCombobox,
  type ApiKeyModelSelectionSource,
} from '../api-key-model-combobox'

const CCSWITCH_RELEASES_URL = 'https://github.com/farion1231/cc-switch/releases'

const APP_CONFIGS = {
  claude: {
    modelFields: [
      { key: 'model', required: true },
      { key: 'haikuModel', required: false },
      { key: 'sonnetModel', required: false },
      { key: 'opusModel', required: false },
    ],
  },
  codex: {
    modelFields: [{ key: 'model', required: true }],
  },
  gemini: {
    modelFields: [{ key: 'model', required: true }],
  },
} as const satisfies Record<
  CCSwitchApp,
  {
    modelFields: readonly {
      key: CCSwitchModelField
      required: boolean
    }[]
  }
>

type ModelSelection = {
  source: ApiKeyModelSelectionSource
  value: string
}

type AppDraft = {
  models: Partial<Record<CCSwitchModelField, ModelSelection>>
  name: string
}

type CCSwitchDialogProps = {
  apiBaseUrl: string
  apiKey: ApiKey | null
  onOpenChange: (open: boolean) => void
  open: boolean
  serverAddress: string
  tokenKey: string
}

function getAppLabel(t: TFunction, app: CCSwitchApp): string {
  switch (app) {
    case 'claude':
      return t('Claude')
    case 'codex':
      return t('Codex')
    case 'gemini':
      return t('Gemini')
  }
}

function getDefaultName(t: TFunction, app: CCSwitchApp): string {
  switch (app) {
    case 'claude':
      return t('My Claude')
    case 'codex':
      return t('My Codex')
    case 'gemini':
      return t('My Gemini')
  }
}

function getModelFieldLabel(t: TFunction, field: CCSwitchModelField): string {
  switch (field) {
    case 'model':
      return t('Primary Model')
    case 'haikuModel':
      return t('Haiku Model')
    case 'sonnetModel':
      return t('Sonnet Model')
    case 'opusModel':
      return t('Opus Model')
  }
}

function createInitialDrafts(t: TFunction): Record<CCSwitchApp, AppDraft> {
  return {
    claude: { models: {}, name: getDefaultName(t, 'claude') },
    codex: { models: {}, name: getDefaultName(t, 'codex') },
    gemini: { models: {}, name: getDefaultName(t, 'gemini') },
  }
}

function getRoutingLabel(t: TFunction, apiKey: ApiKey | null): string {
  if (!apiKey) return t('Not available')
  if (apiKey.group_candidates.length > 0) {
    return apiKey.group_candidates.join(' -> ')
  }
  if (apiKey.group === 'auto') return t('System routing')
  if (apiKey.group) return apiKey.group
  return t('User group')
}

export function CCSwitchDialog(props: CCSwitchDialogProps) {
  const resetKey = `${props.apiKey?.id ?? 'none'}:${props.open ? 'open' : 'closed'}`
  return <CCSwitchDialogContent key={resetKey} {...props} />
}

function CCSwitchDialogContent(props: CCSwitchDialogProps) {
  const { t } = useTranslation()
  const [app, setApp] = useState<CCSwitchApp>('claude')
  const [drafts, setDrafts] = useState(() => createInitialDrafts(t))
  const [launchState, setLaunchState] = useState<'idle' | 'opening' | 'help'>(
    'idle'
  )
  const [primaryModelError, setPrimaryModelError] = useState(false)
  const primaryModelRef = useRef<HTMLInputElement>(null)
  const launchCleanupRef = useRef<() => void>(() => {})
  const normalizedServerAddress = props.serverAddress.trim().replace(/\/+$/, '')
  const isConfigurationReady = Boolean(
    props.apiKey &&
    props.tokenKey &&
    normalizedServerAddress &&
    props.apiBaseUrl.trim()
  )
  const modelsQuery = useApiKeyModelCatalog({
    apiBaseUrl: props.apiBaseUrl,
    apiKey: props.apiKey,
    enabled: props.open && isConfigurationReady,
    tokenKey: props.tokenKey,
  })
  const currentConfig = APP_CONFIGS[app]
  const currentDefaultName = getDefaultName(t, app)
  const currentDraft = drafts[app]
  const primarySelection = currentDraft.models.model
  const modelsCount = modelsQuery.data?.success
    ? modelsQuery.data.models.length
    : null
  const modelsFailure: Extract<ApiKeyModelsResult, { success: false }> | null =
    modelsQuery.data?.success === false ? modelsQuery.data : null

  useEffect(() => {
    return () => launchCleanupRef.current()
  }, [])

  const updateName = (name: string) => {
    setDrafts((current) => ({
      ...current,
      [app]: { ...current[app], name },
    }))
  }

  const updateModel = (
    field: CCSwitchModelField,
    value: string,
    source: ApiKeyModelSelectionSource
  ) => {
    setDrafts((current) => ({
      ...current,
      [app]: {
        ...current[app],
        models: {
          ...current[app].models,
          [field]: { source, value },
        },
      },
    }))
    if (field === 'model' && value.trim()) setPrimaryModelError(false)
  }

  const handleAppChange = (values: string[]) => {
    const nextApp = values[0]
    if (nextApp !== 'claude' && nextApp !== 'codex' && nextApp !== 'gemini') {
      return
    }

    launchCleanupRef.current()
    setLaunchState('idle')
    setPrimaryModelError(false)
    setApp(nextApp)
  }

  const handleSubmit = () => {
    if (!primarySelection?.value.trim()) {
      setPrimaryModelError(true)
      requestAnimationFrame(() => primaryModelRef.current?.focus())
      return
    }
    if (!isConfigurationReady) return

    const models = Object.fromEntries(
      Object.entries(currentDraft.models)
        .map(([field, selection]) => [field, selection?.value.trim() ?? ''])
        .filter(([, value]) => value)
    )
    const url = buildCCSwitchImportUrl({
      app,
      apiKey: props.tokenKey,
      models,
      name: currentDraft.name.trim() || currentDefaultName,
      serverAddress: normalizedServerAddress,
    })

    launchCleanupRef.current()
    setLaunchState('opening')

    const timerId = window.setTimeout(() => {
      launchCleanupRef.current = () => {}
      setLaunchState('help')
    }, 1800)
    const cleanup = () => {
      window.clearTimeout(timerId)
      launchCleanupRef.current = () => {}
    }
    launchCleanupRef.current = cleanup

    const link = document.createElement('a')
    link.href = url
    link.rel = 'noreferrer'
    link.style.display = 'none'
    document.body.appendChild(link)
    try {
      link.click()
    } catch {
      cleanup()
      setLaunchState('help')
    } finally {
      link.remove()
    }
  }

  const renderModelField = (field: {
    key: CCSwitchModelField
    required: boolean
  }) => {
    const selection = currentDraft.models[field.key]
    const isPrimaryInvalid = field.key === 'model' && primaryModelError
    const fieldId = `cc-switch-${app}-${field.key}`
    const errorId = `${fieldId}-error`

    return (
      <Field key={`${app}-${field.key}`} data-invalid={isPrimaryInvalid}>
        <FieldLabel htmlFor={fieldId}>
          {getModelFieldLabel(t, field.key)}
          {field.required ? (
            <span className='text-destructive' aria-hidden='true'>
              *
            </span>
          ) : null}
        </FieldLabel>
        <ApiKeyModelCombobox
          app={app}
          describedBy={isPrimaryInvalid ? errorId : undefined}
          disabled={launchState === 'opening' || !isConfigurationReady}
          field={field.key}
          id={fieldId}
          inputRef={field.key === 'model' ? primaryModelRef : undefined}
          invalid={isPrimaryInvalid}
          isFetching={modelsQuery.isFetching}
          isPending={modelsQuery.isPending}
          modelsResult={modelsQuery.data}
          source={selection?.source ?? 'custom'}
          value={selection?.value ?? ''}
          onRetry={() => void modelsQuery.refetch()}
          required={field.required}
          onValueChange={(value, source) =>
            updateModel(field.key, value, source)
          }
        />
        {isPrimaryInvalid ? (
          <FieldError id={errorId}>
            {t('Please select a primary model')}
          </FieldError>
        ) : null}
      </Field>
    )
  }

  const primaryField = currentConfig.modelFields[0]
  const optionalFields = currentConfig.modelFields.slice(1)

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      contentClassName='sm:max-w-xl'
      contentHeight='auto'
      bodyClassName='space-y-5'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={launchState === 'opening' || !isConfigurationReady}
          >
            {launchState === 'opening' ? (
              <Spinner data-icon='inline-start' aria-label={t('Loading')} />
            ) : null}
            {launchState === 'help' ? t('Retry') : t('Open CC Switch')}
          </Button>
        </>
      }
    >
      <div className='bg-muted/40 flex min-w-0 flex-col gap-2 rounded-lg px-3 py-2.5 sm:flex-row sm:items-center'>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-sm font-medium'>
            {props.apiKey?.name ?? t('API Key')}
          </div>
          <div className='text-muted-foreground mt-0.5 truncate text-xs'>
            {getRoutingLabel(t, props.apiKey)}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-2' aria-live='polite'>
          {modelsQuery.isPending && isConfigurationReady ? (
            <Skeleton className='h-5 w-20' />
          ) : null}
          {modelsCount !== null ? (
            <Badge variant='secondary'>
              {t('{{count}} models', { count: modelsCount })}
            </Badge>
          ) : null}
          {modelsQuery.isFetching && !modelsQuery.isPending ? (
            <Spinner aria-label={t('Loading')} />
          ) : null}
        </div>
      </div>

      {!isConfigurationReady ? (
        <Alert variant='destructive'>
          <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('CC Switch import unavailable')}</AlertTitle>
          <AlertDescription>
            {t('The API key or server address is missing.')}
          </AlertDescription>
        </Alert>
      ) : null}

      {modelsFailure ? (
        <Alert variant='destructive'>
          <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Failed to fetch models')}</AlertTitle>
          <AlertDescription>
            {modelsFailure.message || t('Please retry the model request.')}
          </AlertDescription>
          <AlertAction>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Retry')}
              disabled={modelsQuery.isFetching}
              onClick={() => void modelsQuery.refetch()}
            >
              {modelsQuery.isFetching ? (
                <Spinner aria-label={t('Loading')} />
              ) : (
                <HugeiconsIcon icon={ReloadIcon} aria-hidden='true' />
              )}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {modelsCount === 0 ? (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('No available models')}</AlertTitle>
          <AlertDescription>
            {t('No available models were returned for this API key.')}
          </AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <FieldSet disabled={launchState === 'opening'}>
          <FieldLegend variant='label'>{t('Application')}</FieldLegend>
          <ToggleGroup
            value={[app]}
            onValueChange={handleAppChange}
            aria-label={t('Application')}
            variant='outline'
            className='grid w-full grid-cols-3'
          >
            {(Object.keys(APP_CONFIGS) as CCSwitchApp[]).map((appKey) => (
              <ToggleGroupItem key={appKey} value={appKey} className='w-full'>
                {getAppLabel(t, appKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldSet>

        <Field data-disabled={launchState === 'opening'}>
          <FieldLabel htmlFor={`cc-switch-${app}-name`}>{t('Name')}</FieldLabel>
          <Input
            id={`cc-switch-${app}-name`}
            disabled={launchState === 'opening'}
            placeholder={currentDefaultName}
            value={currentDraft.name}
            onChange={(event) => updateName(event.target.value)}
          />
        </Field>

        {renderModelField(primaryField)}

        {optionalFields.length > 0 ? (
          <FieldSet disabled={launchState === 'opening'}>
            <FieldLegend variant='label'>
              {t('Claude model mapping')}
              <span className='text-muted-foreground ml-1 font-normal'>
                ({t('Optional')})
              </span>
            </FieldLegend>
            <FieldGroup>{optionalFields.map(renderModelField)}</FieldGroup>
          </FieldSet>
        ) : null}
      </FieldGroup>

      {launchState === 'help' ? (
        <Alert>
          <HugeiconsIcon
            icon={Alert02Icon}
            aria-hidden='true'
            className='text-amber-600 dark:text-amber-400'
          />
          <AlertTitle>{t('Having trouble opening CC Switch?')}</AlertTitle>
          <AlertDescription className='flex flex-col items-start gap-2'>
            <span>
              {t(
                'If CC Switch did not open, install it or check that the ccswitch:// protocol is registered, then try again.'
              )}
            </span>
            <Button
              variant='outline'
              size='sm'
              nativeButton={false}
              render={
                <a
                  href={CCSWITCH_RELEASES_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                />
              }
            >
              {t('Download CC Switch')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </Dialog>
  )
}
