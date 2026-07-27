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
  AlertCircleIcon,
  ArrowDown01Icon,
  DashboardSpeed01Icon,
  InformationCircleIcon,
  ReloadIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

import {
  getApiKeys,
  isApiKeyTestEndpoint,
  selectApiKeyTestModel,
  testApiKeyModel,
  type ApiKeyModel,
  type ApiKeyModelsResult,
  type ApiKeyModelTestResult,
  type ApiKeyTestEndpoint,
} from '../../api'
import { API_KEY_STATUS } from '../../constants'
import { useApiKeyModelCatalog } from '../../hooks/use-api-key-model-catalog'
import type { ApiKey } from '../../types'
import { useApiKeys } from '../api-keys-provider'
import { ApiKeyAvailabilityResult } from './api-key-availability-result'

const EMPTY_MODELS: ApiKeyModel[] = []
const EMPTY_ENDPOINTS: ApiKeyTestEndpoint[] = []

type ApiKeyAvailabilityDialogProps = {
  apiBaseUrl: string
  apiKey: ApiKey | null
  onOpenChange: (open: boolean) => void
  open: boolean
  tokenKey: string
}

type ModelComboboxProps = {
  disabled: boolean
  models: ApiKeyModel[]
  onValueChange: (model: ApiKeyModel) => void
  value?: ApiKeyModel
}

type ApiKeyComboboxProps = {
  apiKeys: ApiKey[]
  disabled: boolean
  onValueChange: (apiKey: ApiKey) => void
  value?: ApiKey
}

function getEndpointLabel(t: TFunction, endpointType: ApiKeyTestEndpoint) {
  switch (endpointType) {
    case 'openai':
      return t('Chat completions')
    case 'openai-response':
      return t('Responses API')
    case 'openai-response-compact':
      return t('Response Compaction')
    case 'anthropic':
      return t('Anthropic')
    case 'gemini':
      return t('Gemini')
    case 'jina-rerank':
      return t('Rerank')
    case 'image-generation':
      return t('Image Generation')
    case 'embeddings':
      return t('Embeddings')
  }
}

function getEndpointPath(endpointType: ApiKeyTestEndpoint, model: string) {
  switch (endpointType) {
    case 'openai':
      return '/v1/chat/completions'
    case 'openai-response':
      return '/v1/responses'
    case 'openai-response-compact':
      return '/v1/responses/compact'
    case 'anthropic':
      return '/v1/messages'
    case 'gemini':
      return `/v1beta/models/${model}:generateContent`
    case 'jina-rerank':
      return '/v1/rerank'
    case 'image-generation':
      return '/v1/images/generations'
    case 'embeddings':
      return '/v1/embeddings'
  }
}

function getModelsFailureMessage(
  t: TFunction,
  failure: Extract<ApiKeyModelsResult, { success: false }> | null
) {
  if (failure?.message) return failure.message

  switch (failure?.failureKind) {
    case 'timeout':
      return t('The request timed out.')
    case 'network':
      return t('Unable to reach the API.')
    case 'invalid-response':
      return t('The API response was invalid.')
    default:
      return t('Failed to fetch models')
  }
}

function ModelCombobox(props: ModelComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id='api-key-test-model'
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={props.disabled}
            className='h-10 w-full justify-between font-normal'
          />
        }
      >
        <span className='flex min-w-0 flex-1 items-center gap-2'>
          <span className='min-w-0 flex-1 truncate text-left font-mono text-xs'>
            {props.value?.id || t('Select Model')}
          </span>
          <span className='text-muted-foreground hidden shrink-0 text-xs sm:inline'>
            {t('{{count}} models', { count: props.models.length })}
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          data-icon='inline-end'
          aria-hidden='true'
        />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='max-h-(--available-height) w-[var(--anchor-width)] max-w-(--available-width) overflow-hidden p-0'
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder={t('Search models...')} />
          <CommandList className='max-h-[min(360px,calc(var(--available-height)-2.5rem))]'>
            <CommandEmpty>{t('No models found.')}</CommandEmpty>
            <CommandGroup>
              {props.models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={`${model.id} ${model.ownedBy ?? ''}`}
                  data-checked={model.id === props.value?.id}
                  onSelect={() => {
                    props.onValueChange(model)
                    setOpen(false)
                  }}
                  className='items-start py-2'
                >
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-mono text-xs'>
                      {model.id}
                    </span>
                    {model.ownedBy ? (
                      <span className='text-muted-foreground mt-0.5 block truncate text-xs'>
                        {model.ownedBy}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ApiKeyCombobox(props: ApiKeyComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id='api-key-test-key'
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={props.disabled}
            className='h-10 w-full justify-between font-normal'
          />
        }
      >
        <span className='min-w-0 flex-1 truncate text-left text-sm'>
          {props.value?.name || t('Select API Key')}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          data-icon='inline-end'
          aria-hidden='true'
        />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='max-h-(--available-height) w-[var(--anchor-width)] max-w-(--available-width) overflow-hidden p-0'
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder={t('Search API keys...')} />
          <CommandList className='max-h-[min(360px,calc(var(--available-height)-2.5rem))]'>
            <CommandEmpty>{t('No enabled tokens available')}</CommandEmpty>
            <CommandGroup>
              {props.apiKeys.map((apiKey) => (
                <CommandItem
                  key={apiKey.id}
                  value={`${apiKey.name} ${apiKey.key} ${apiKey.id}`}
                  data-checked={apiKey.id === props.value?.id}
                  onSelect={() => {
                    props.onValueChange(apiKey)
                    setOpen(false)
                  }}
                  className='items-start py-2'
                >
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-medium'>
                      {apiKey.name}
                    </span>
                    <code className='text-muted-foreground mt-0.5 block truncate text-xs'>
                      {apiKey.key}
                    </code>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ApiKeyAvailabilityDialog(props: ApiKeyAvailabilityDialogProps) {
  return (
    <ApiKeyAvailabilityDialogContent
      key={props.apiKey?.id ?? 'global'}
      {...props}
      apiKey={props.apiKey}
    />
  )
}

function ApiKeyAvailabilityDialogContent(props: ApiKeyAvailabilityDialogProps) {
  const { t } = useTranslation()
  const { resolveRealKey, visibleApiKeys, refreshTrigger } = useApiKeys()
  const requestVersionRef = useRef(0)
  const resolveRealKeyRef = useRef(resolveRealKey)
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<number | null>(
    props.apiKey?.id ?? null
  )
  const [selectedTokenKey, setSelectedTokenKey] = useState(
    props.apiKey?.id && props.tokenKey ? props.tokenKey : ''
  )
  const [keyResolutionAttempt, setKeyResolutionAttempt] = useState(0)
  const [isResolvingKey, setIsResolvingKey] = useState(false)
  const [keyResolutionFailed, setKeyResolutionFailed] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<ApiKeyTestEndpoint | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<ApiKeyModelTestResult | null>(
    null
  )

  const apiKeysQuery = useQuery({
    queryKey: ['api-key-availability-keys', refreshTrigger],
    enabled: props.open,
    queryFn: async () => {
      const pageSize = 100
      const firstPage = await getApiKeys({ p: 1, size: pageSize })
      if (!firstPage.success || !firstPage.data) return firstPage

      const totalPages = Math.ceil(firstPage.data.total / pageSize)
      const items = [...firstPage.data.items]
      for (let page = 2; page <= totalPages; page += 3) {
        const pageBatch = await Promise.all(
          Array.from(
            { length: Math.min(3, totalPages - page + 1) },
            (_, index) => getApiKeys({ p: page + index, size: pageSize })
          )
        )
        for (const nextPage of pageBatch) {
          if (!nextPage.success || !nextPage.data) return nextPage
          items.push(...nextPage.data.items)
        }
      }

      return {
        ...firstPage,
        data: { ...firstPage.data, items },
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  const availableApiKeys = useMemo(() => {
    const listedKeys =
      apiKeysQuery.data?.success && apiKeysQuery.data.data
        ? apiKeysQuery.data.data.items
        : []
    const keysById = new Map<number, ApiKey>()
    if (!apiKeysQuery.data?.success || !apiKeysQuery.data.data) {
      for (const apiKey of visibleApiKeys) keysById.set(apiKey.id, apiKey)
    }
    for (const apiKey of listedKeys) keysById.set(apiKey.id, apiKey)
    if (props.apiKey) {
      keysById.set(props.apiKey.id, props.apiKey)
    }

    return [...keysById.values()]
      .filter((apiKey) => apiKey.status === API_KEY_STATUS.ENABLED)
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [apiKeysQuery.data, props.apiKey, visibleApiKeys])

  const selectedApiKey = availableApiKeys.find(
    (apiKey) => apiKey.id === selectedApiKeyId
  )
  const apiKeysFailure =
    apiKeysQuery.data?.success === false ? apiKeysQuery.data : null

  useEffect(() => {
    resolveRealKeyRef.current = resolveRealKey
  }, [resolveRealKey])

  useEffect(() => {
    if (
      !props.open ||
      availableApiKeys.length === 0 ||
      availableApiKeys.some((apiKey) => apiKey.id === selectedApiKeyId)
    ) {
      return
    }

    const defaultApiKey =
      availableApiKeys.find((apiKey) => apiKey.id === props.apiKey?.id) ??
      availableApiKeys[0]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedApiKeyId(defaultApiKey.id)
  }, [availableApiKeys, props.apiKey?.id, props.open, selectedApiKeyId])

  useEffect(() => {
    if (!props.open || selectedApiKeyId === null) return

    const requestVersion = ++requestVersionRef.current
    let cancelled = false
    setIsResolvingKey(true)
    setKeyResolutionFailed(false)
    setSelectedTokenKey('')

    if (selectedApiKeyId === props.apiKey?.id && props.tokenKey) {
      setSelectedTokenKey(props.tokenKey)
      setIsResolvingKey(false)
      return () => {
        cancelled = true
      }
    }

    void resolveRealKeyRef.current(selectedApiKeyId).then((key) => {
      if (cancelled || requestVersionRef.current !== requestVersion) return
      setSelectedTokenKey(key ?? '')
      setKeyResolutionFailed(!key)
      setIsResolvingKey(false)
    })

    return () => {
      cancelled = true
    }
  }, [
    props.apiKey?.id,
    props.open,
    props.tokenKey,
    keyResolutionAttempt,
    selectedApiKeyId,
  ])

  const modelsQuery = useApiKeyModelCatalog({
    apiBaseUrl: props.apiBaseUrl,
    apiKey: selectedApiKey ?? null,
    enabled: props.open && !isResolvingKey,
    tokenKey: selectedTokenKey,
  })

  const modelsResult = modelsQuery.data
  const models = useMemo(() => {
    if (!modelsResult?.success) return EMPTY_MODELS
    return modelsResult.models
      .filter((model) =>
        model.supportedEndpointTypes.some(isApiKeyTestEndpoint)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
  }, [modelsResult])
  const modelsFailure: Extract<ApiKeyModelsResult, { success: false }> | null =
    modelsResult?.success === false ? modelsResult : null
  const selectedModel = selectApiKeyTestModel(
    models,
    selectedModelId,
    selectedApiKey
  )
  const availableEndpoints =
    selectedModel?.supportedEndpointTypes.filter(isApiKeyTestEndpoint) ??
    EMPTY_ENDPOINTS
  const activeEndpoint =
    selectedEndpoint && availableEndpoints.includes(selectedEndpoint)
      ? selectedEndpoint
      : availableEndpoints[0]
  const endpointItems = useMemo(
    () =>
      availableEndpoints.map((endpointType) => ({
        value: endpointType,
        label: getEndpointLabel(t, endpointType),
      })),
    [availableEndpoints, t]
  )

  const resetInteractionState = () => {
    requestVersionRef.current += 1
    setSelectedApiKeyId(null)
    setSelectedTokenKey('')
    setKeyResolutionAttempt(0)
    setIsResolvingKey(false)
    setKeyResolutionFailed(false)
    setSelectedModelId('')
    setSelectedEndpoint(null)
    setIsTesting(false)
    setTestResult(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) resetInteractionState()
    props.onOpenChange(open)
  }

  const handleApiKeyChange = (apiKey: ApiKey) => {
    if (apiKey.id === selectedApiKeyId) return
    requestVersionRef.current += 1
    setSelectedApiKeyId(apiKey.id)
    setSelectedTokenKey('')
    setKeyResolutionAttempt(0)
    setIsResolvingKey(false)
    setKeyResolutionFailed(false)
    setSelectedModelId('')
    setSelectedEndpoint(null)
    setTestResult(null)
  }

  const handleModelChange = (model: ApiKeyModel) => {
    requestVersionRef.current += 1
    setIsTesting(false)
    setSelectedModelId(model.id)
    setSelectedEndpoint(
      model.supportedEndpointTypes.find(isApiKeyTestEndpoint) ?? null
    )
    setTestResult(null)
  }

  const handleEndpointChange = (endpointType: string | null) => {
    if (!endpointType) return
    requestVersionRef.current += 1
    setIsTesting(false)
    setSelectedEndpoint(endpointType as ApiKeyTestEndpoint)
    setTestResult(null)
  }

  const handleTest = async () => {
    if (
      !selectedModel ||
      !activeEndpoint ||
      !selectedApiKey ||
      !selectedTokenKey ||
      isResolvingKey ||
      isTesting
    ) {
      return
    }

    const requestVersion = ++requestVersionRef.current
    setIsTesting(true)
    setTestResult(null)

    const result = await testApiKeyModel(
      props.apiBaseUrl,
      selectedTokenKey,
      selectedModel.id,
      activeEndpoint
    )
    if (requestVersionRef.current !== requestVersion) return

    setTestResult(result)
    setIsTesting(false)
  }

  let testButtonLabel = t('Start test')
  if (isTesting) {
    testButtonLabel = t('Testing...')
  } else if (isResolvingKey || modelsQuery.isPending) {
    testButtonLabel = t('Loading...')
  } else if (testResult) {
    testButtonLabel = t('Test again')
  }

  let apiKeySelectionContent: ReactNode
  if (availableApiKeys.length > 0) {
    apiKeySelectionContent = (
      <div className='flex flex-col gap-2'>
        <Label htmlFor='api-key-test-key'>{t('API Key')}</Label>
        <ApiKeyCombobox
          apiKeys={availableApiKeys}
          value={selectedApiKey}
          onValueChange={handleApiKeyChange}
          disabled={isTesting}
        />
      </div>
    )
  } else if (apiKeysQuery.isPending) {
    apiKeySelectionContent = (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-10 w-full' />
      </div>
    )
  } else if (apiKeysFailure || apiKeysQuery.isError) {
    apiKeySelectionContent = (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
        <AlertTitle>{t('Failed to load API keys')}</AlertTitle>
        <AlertDescription>
          {apiKeysFailure?.message || t('Failed to load API keys')}
        </AlertDescription>
        <AlertAction>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void apiKeysQuery.refetch()}
            disabled={apiKeysQuery.isFetching}
          >
            {apiKeysQuery.isFetching ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <HugeiconsIcon
                icon={ReloadIcon}
                data-icon='inline-start'
                aria-hidden='true'
              />
            )}
            {t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  } else {
    apiKeySelectionContent = (
      <Empty className='bg-muted/20 min-h-28 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={DashboardSpeed01Icon} aria-hidden='true' />
          </EmptyMedia>
          <EmptyTitle>
            {t(
              'No API keys available. Create your first API key to get started.'
            )}
          </EmptyTitle>
          <EmptyDescription>
            {t('No enabled tokens available')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  let modelTestContent: ReactNode
  if (availableApiKeys.length === 0 || !selectedApiKey) {
    modelTestContent = null
  } else if (isResolvingKey) {
    modelTestContent = (
      <div
        className='flex flex-col gap-4'
        role='status'
        aria-live='polite'
        aria-label={t('Loading...')}
      >
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-10 w-full' />
        </div>
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-8 w-full' />
        </div>
      </div>
    )
  } else if (keyResolutionFailed) {
    modelTestContent = (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
        <AlertTitle>{t('Failed to load API keys')}</AlertTitle>
        <AlertDescription>
          {t('Unable to resolve the selected API key.')}
        </AlertDescription>
        <AlertAction>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setKeyResolutionAttempt((attempt) => attempt + 1)}
          >
            <HugeiconsIcon
              icon={ReloadIcon}
              data-icon='inline-start'
              aria-hidden='true'
            />
            {t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  } else if (!props.apiBaseUrl) {
    modelTestContent = (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
        <AlertTitle>{t('Base URL')}</AlertTitle>
        <AlertDescription>{t('Not available')}</AlertDescription>
      </Alert>
    )
  } else if (modelsQuery.isPending) {
    modelTestContent = (
      <div
        className='flex flex-col gap-4'
        role='status'
        aria-live='polite'
        aria-label={t('Loading...')}
      >
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-10 w-full' />
        </div>
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-8 w-full' />
        </div>
      </div>
    )
  } else if (modelsFailure || modelsQuery.isError) {
    modelTestContent = (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
        <AlertTitle>{t('Failed to fetch models')}</AlertTitle>
        <AlertDescription>
          {getModelsFailureMessage(t, modelsFailure)}
        </AlertDescription>
        <AlertAction>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void modelsQuery.refetch()}
            disabled={modelsQuery.isFetching}
          >
            {modelsQuery.isFetching ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <HugeiconsIcon
                icon={ReloadIcon}
                data-icon='inline-start'
                aria-hidden='true'
              />
            )}
            {t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  } else if (!selectedModel) {
    modelTestContent = (
      <Empty className='bg-muted/20 min-h-36 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={DashboardSpeed01Icon} aria-hidden='true' />
          </EmptyMedia>
          <EmptyTitle>{t('No models available')}</EmptyTitle>
          <EmptyDescription>
            {t('No available models were returned for this API key.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    modelTestContent = (
      <>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='api-key-test-model'>{t('Test Model')}</Label>
            <ModelCombobox
              models={models}
              value={selectedModel}
              onValueChange={handleModelChange}
              disabled={isTesting}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='api-key-test-endpoint'>{t('Endpoint')}</Label>
            {endpointItems.length > 0 ? (
              <Select
                items={endpointItems}
                value={activeEndpoint ?? null}
                onValueChange={handleEndpointChange}
                disabled={isTesting}
              >
                <SelectTrigger
                  id='api-key-test-endpoint'
                  className='w-full min-w-0'
                >
                  <SelectValue className='min-w-0 truncate' />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {endpointItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        <span className='flex min-w-0 flex-col py-0.5'>
                          <span>{item.label}</span>
                          <code className='text-muted-foreground text-xs'>
                            {getEndpointPath(item.value, selectedModel.id)}
                          </code>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <p className='text-destructive text-sm'>
                {t('No testable endpoint is available for this model.')}
              </p>
            )}
          </div>
        </div>

        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Notice')}</AlertTitle>
          <AlertDescription>
            {t(
              'The test sends a real model request and consumes quota. Image models may cost more.'
            )}
          </AlertDescription>
        </Alert>

        <ApiKeyAvailabilityResult
          model={selectedModel.id}
          result={testResult}
        />
      </>
    )
  }

  const footer = (
    <>
      <Button variant='outline' onClick={() => handleOpenChange(false)}>
        {t('Cancel')}
      </Button>
      <Button
        onClick={() => void handleTest()}
        disabled={
          isTesting ||
          isResolvingKey ||
          modelsQuery.isPending ||
          modelsQuery.isError ||
          Boolean(modelsFailure) ||
          !selectedApiKey ||
          !selectedTokenKey ||
          !selectedModel ||
          !activeEndpoint
        }
      >
        {isTesting || isResolvingKey || modelsQuery.isPending ? (
          <Spinner data-icon='inline-start' />
        ) : (
          <HugeiconsIcon
            icon={DashboardSpeed01Icon}
            data-icon='inline-start'
            aria-hidden='true'
          />
        )}
        {testButtonLabel}
      </Button>
    </>
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      showCloseButton
      title={
        <span className='flex items-center gap-2'>
          <span className='bg-muted flex size-8 items-center justify-center rounded-lg border'>
            <HugeiconsIcon
              icon={DashboardSpeed01Icon}
              className='size-4'
              aria-hidden='true'
            />
          </span>
          <span>{t('Test API availability')}</span>
        </span>
      }
      description={t(
        'Select an API key and a supported model, then send a short test request.'
      )}
      contentClassName='sm:max-w-xl'
      titleClassName='pr-10'
      bodyClassName='flex flex-col gap-4'
      footer={footer}
    >
      <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end'>
        <div className='min-w-0'>
          <p className='text-muted-foreground text-xs'>{t('API Key')}</p>
          <p
            className='mt-1 truncate text-sm font-medium'
            title={selectedApiKey?.name}
          >
            {selectedApiKey?.name || t('Select API Key')}
          </p>
        </div>
        <div className='min-w-0'>
          <p className='text-muted-foreground text-xs'>{t('Base URL')}</p>
          <code
            className='mt-1 block truncate text-xs'
            title={props.apiBaseUrl}
          >
            {props.apiBaseUrl || t('Not available')}
          </code>
        </div>
        {selectedApiKey ? (
          <StatusBadge
            label={t('Enabled')}
            variant='success'
            copyable={false}
          />
        ) : null}
      </div>

      {apiKeySelectionContent}
      {modelTestContent}
    </Dialog>
  )
}
