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
import {
  AiImageIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
  Clock01Icon,
  Download01Icon,
  Image01Icon,
  PlayCircle02Icon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from '@/components/ui/field'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { formatTimestampToDate } from '@/lib/format'

import {
  getAsyncApiErrorMessage,
  getAsyncImageResult,
  getAsyncImageTask,
  submitAsyncImageTask,
} from './api'
import {
  ASYNC_IMAGE_DEFAULT_VALUES,
  ASYNC_MODEL_CONFIGS,
  ASYNC_STATUS_CONFIG,
  TERMINAL_ASYNC_STATUSES,
} from './constants'
import {
  ASYNC_IMAGE_MODELS,
  asyncImageFormSchema,
  type ActiveAsyncImageTask,
  type AsyncImageFormValues,
  type AsyncImageModel,
  type AsyncTaskResultResponse,
  type AsyncTaskStatusResponse,
} from './types'

function apiKeyAllowsModel(apiKey: ApiKey, model: AsyncImageModel) {
  if (!apiKey.model_limits_enabled || !apiKey.model_limits) return true
  return apiKey.model_limits.split(',').includes(model)
}

interface AsyncImageFormProps {
  apiKeys: ApiKey[]
  isLoadingKeys: boolean
  isSubmitting: boolean
  onSubmit: (values: AsyncImageFormValues) => void
}

function AsyncImageForm(props: AsyncImageFormProps) {
  const { t } = useTranslation()
  const form = useForm<AsyncImageFormValues>({
    resolver: zodResolver(asyncImageFormSchema),
    defaultValues: ASYNC_IMAGE_DEFAULT_VALUES,
  })
  const selectedModel = useWatch({ control: form.control, name: 'model' })
  const modelConfig = ASYNC_MODEL_CONFIGS[selectedModel]
  const compatibleKeys = useMemo(
    () =>
      props.apiKeys.filter(
        (apiKey) =>
          apiKey.status === 1 && apiKeyAllowsModel(apiKey, selectedModel)
      ),
    [props.apiKeys, selectedModel]
  )
  const apiKeyItems = useMemo(
    () =>
      compatibleKeys.map((apiKey) => ({
        label: apiKey.name,
        value: String(apiKey.id),
      })),
    [compatibleKeys]
  )

  useEffect(() => {
    const currentTokenId = form.getValues('tokenId')
    if (compatibleKeys.some((apiKey) => String(apiKey.id) === currentTokenId)) {
      return
    }
    form.setValue('tokenId', String(compatibleKeys[0]?.id ?? ''))
  }, [compatibleKeys, form])

  const handleModelChange = (values: string[]) => {
    const model = values[0] as AsyncImageModel | undefined
    if (!model || model === selectedModel) return
    const nextConfig = ASYNC_MODEL_CONFIGS[model]
    form.setValue('model', model, { shouldValidate: true })
    form.setValue('size', nextConfig.defaultSize, { shouldValidate: true })
    form.setValue('quality', nextConfig.defaultQuality, {
      shouldValidate: true,
    })
    const currentTokenId = form.getValues('tokenId')
    const currentKey = props.apiKeys.find(
      (apiKey) => String(apiKey.id) === currentTokenId
    )
    if (!currentKey || !apiKeyAllowsModel(currentKey, model)) {
      const nextKey = props.apiKeys.find(
        (apiKey) => apiKey.status === 1 && apiKeyAllowsModel(apiKey, model)
      )
      form.setValue('tokenId', String(nextKey?.id ?? ''))
    }
  }

  return (
    <Card className='h-fit'>
      <CardHeader className='border-b'>
        <CardTitle>{t('Generation settings')}</CardTitle>
        <CardDescription>
          {t(
            'Choose a model and submit a real task to the isolated staging server.'
          )}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(props.onSubmit)}>
        <CardContent>
          <FieldGroup>
            <Controller
              control={form.control}
              name='model'
              render={({ fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldTitle>{t('Image model')}</FieldTitle>
                  <ToggleGroup
                    value={[selectedModel]}
                    onValueChange={handleModelChange}
                    variant='outline'
                    spacing={1}
                    className='grid w-full grid-cols-1 sm:grid-cols-3'
                    aria-label={t('Image model')}
                  >
                    {ASYNC_IMAGE_MODELS.map((model) => (
                      <ToggleGroupItem
                        key={model}
                        value={model}
                        className='h-auto min-h-14 min-w-0 flex-col items-start px-3 py-2 text-left whitespace-normal'
                      >
                        <span className='font-medium'>
                          {t(ASYNC_MODEL_CONFIGS[model].label)}
                        </span>
                        <span className='text-muted-foreground text-xs font-normal'>
                          {t(ASYNC_MODEL_CONFIGS[model].description)}
                        </span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name='tokenId'
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldTitle>{t('API key')}</FieldTitle>
                  <Select
                    items={apiKeyItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? '')}
                    disabled={
                      props.isLoadingKeys || compatibleKeys.length === 0
                    }
                  >
                    <SelectTrigger
                      className='w-full'
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder={t('Select an API key')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {compatibleKeys.map((apiKey) => (
                          <SelectItem key={apiKey.id} value={String(apiKey.id)}>
                            {apiKey.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {compatibleKeys.length > 0
                      ? t(
                          'Only enabled keys that can access the selected model are shown.'
                        )
                      : t('No enabled API key can access this model.')}
                  </FieldDescription>
                  <FieldError>
                    {fieldState.error?.message
                      ? t(fieldState.error.message)
                      : null}
                  </FieldError>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name='prompt'
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldTitle>{t('Prompt')}</FieldTitle>
                  <Textarea
                    {...field}
                    rows={7}
                    maxLength={8000}
                    placeholder={t('Describe the image you want to generate')}
                    aria-invalid={fieldState.invalid}
                    className='resize-y'
                  />
                  <FieldDescription className='text-right tabular-nums'>
                    {field.value.length} / 8000
                  </FieldDescription>
                  <FieldError>
                    {fieldState.error?.message
                      ? t(fieldState.error.message)
                      : null}
                  </FieldError>
                </Field>
              )}
            />

            <div className='grid gap-5 sm:grid-cols-2'>
              <Controller
                control={form.control}
                name='size'
                render={({ field }) => (
                  <Field>
                    <FieldTitle>{t(modelConfig.sizeLabel)}</FieldTitle>
                    <ToggleGroup
                      value={[field.value]}
                      onValueChange={(values) => {
                        if (values[0]) field.onChange(values[0])
                      }}
                      variant='outline'
                      spacing={1}
                      className='flex w-full flex-wrap'
                    >
                      {modelConfig.sizes.map((size) => (
                        <ToggleGroupItem key={size} value={size}>
                          {size}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name='quality'
                render={({ field }) => (
                  <Field>
                    <FieldTitle>{t('Quality')}</FieldTitle>
                    <ToggleGroup
                      value={[field.value]}
                      onValueChange={(values) => {
                        if (values[0]) field.onChange(values[0])
                      }}
                      variant='outline'
                      spacing={1}
                      className='flex w-full flex-wrap'
                    >
                      {modelConfig.qualities.map((quality) => (
                        <ToggleGroupItem key={quality} value={quality}>
                          {quality}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                )}
              />
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className='mt-4 justify-between gap-3'>
          {compatibleKeys.length === 0 ? (
            <Button variant='outline' render={<Link to='/keys' />}>
              {t('Open API keys')}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                data-icon='inline-end'
              />
            </Button>
          ) : (
            <span className='text-muted-foreground text-xs'>
              {t('Task continues in the cloud')}
            </span>
          )}
          <Button
            type='submit'
            disabled={props.isSubmitting || compatibleKeys.length === 0}
          >
            {props.isSubmitting ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <HugeiconsIcon
                icon={PlayCircle02Icon}
                strokeWidth={2}
                data-icon='inline-start'
              />
            )}
            {props.isSubmitting
              ? t('Submitting task...')
              : t('Submit async task')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

interface AsyncTaskPanelProps {
  activeTask: ActiveAsyncImageTask | null
  status?: AsyncTaskStatusResponse
  result?: AsyncTaskResultResponse
  statusError?: string
  resultError?: string
  isRefreshing: boolean
  onRefresh: () => void
  onReset: () => void
}

function AsyncTaskPanel(props: AsyncTaskPanelProps) {
  const { t } = useTranslation()

  if (!props.activeTask) {
    return (
      <Card className='min-h-96'>
        <CardHeader className='border-b'>
          <CardTitle>{t('Task result')}</CardTitle>
          <CardDescription>
            {t('Your latest task status and archived image will appear here.')}
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-1'>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>{t('No task submitted yet')}</EmptyTitle>
              <EmptyDescription>
                {t('Submit a task to start testing cloud execution.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  const executionStatus =
    props.status?.status ?? props.activeTask.submission.status
  const statusConfig = ASYNC_STATUS_CONFIG[executionStatus]
  const progress = props.status?.progress ?? 0
  const imageUrl =
    props.result?.response?.data?.find((item) => item.url)?.url ??
    props.result?.artifacts.find((artifact) => artifact.url)?.url
  const errorMessage =
    props.status?.error?.message || props.statusError || props.resultError
  let previewContent = null
  if (imageUrl) {
    previewContent = (
      <div className='bg-muted/30 overflow-hidden rounded-xl border'>
        <img
          src={imageUrl}
          alt={t('Generated image preview')}
          className='aspect-square h-auto w-full object-contain'
        />
      </div>
    )
  } else if (executionStatus === 'success' && props.isRefreshing) {
    previewContent = (
      <div className='flex min-h-48 items-center justify-center rounded-xl border border-dashed'>
        <Spinner />
      </div>
    )
  }

  return (
    <Card className='h-fit min-h-96'>
      <CardHeader className='border-b'>
        <CardTitle>{t('Task result')}</CardTitle>
        <CardDescription>
          {t('Your latest task status and archived image will appear here.')}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='min-w-0'>
            <div className='text-muted-foreground text-xs'>{t('Model')}</div>
            <div className='truncate font-medium'>
              {props.activeTask.request.model}
            </div>
          </div>
          <div className='min-w-0'>
            <div className='text-muted-foreground text-xs'>{t('Status')}</div>
            <StatusBadge
              label={t(statusConfig.label)}
              variant={statusConfig.variant}
              pulse={
                executionStatus === 'queued' || executionStatus === 'running'
              }
              copyable={false}
            />
          </div>
          <div className='min-w-0 sm:col-span-2'>
            <div className='text-muted-foreground text-xs'>{t('Task ID')}</div>
            <code className='block truncate text-xs'>
              {props.activeTask.submission.id}
            </code>
          </div>
          {props.status?.created_at ? (
            <div className='min-w-0 sm:col-span-2'>
              <div className='text-muted-foreground text-xs'>
                {t('Created')}
              </div>
              <div>{formatTimestampToDate(props.status.created_at)}</div>
            </div>
          ) : null}
        </div>

        <Separator />

        <Progress value={progress}>
          <ProgressLabel>{t('Progress')}</ProgressLabel>
          <ProgressValue>{() => `${progress}%`}</ProgressValue>
        </Progress>

        {errorMessage ? (
          <Alert variant='destructive'>
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
            <AlertTitle>
              {executionStatus === 'uncertain'
                ? t('Result could not be confirmed')
                : t('Task failed')}
            </AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {executionStatus === 'uncertain' && !errorMessage ? (
          <Alert variant='destructive'>
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
            <AlertTitle>{t('Result could not be confirmed')}</AlertTitle>
            <AlertDescription>
              {t(
                'The upstream request may have completed, but the final result could not be confirmed.'
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {previewContent}

        {(executionStatus === 'queued' || executionStatus === 'running') && (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            {t('Task continues in the cloud')}
          </div>
        )}
      </CardContent>
      <CardFooter className='justify-between gap-3'>
        <Button variant='outline' onClick={props.onReset}>
          <HugeiconsIcon
            icon={AiImageIcon}
            strokeWidth={2}
            data-icon='inline-start'
          />
          {t('Run another test')}
        </Button>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={props.onRefresh}
            disabled={props.isRefreshing}
          >
            {props.isRefreshing ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <HugeiconsIcon
                icon={Refresh01Icon}
                strokeWidth={2}
                data-icon='inline-start'
              />
            )}
            {t('Refresh result')}
          </Button>
          {imageUrl ? (
            <Button
              render={
                <a href={imageUrl} target='_blank' rel='noreferrer' download />
              }
            >
              <HugeiconsIcon
                icon={Download01Icon}
                strokeWidth={2}
                data-icon='inline-start'
              />
              {t('Download image')}
            </Button>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  )
}

export function AsyncImageLab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTask, setActiveTask] = useState<ActiveAsyncImageTask | null>(
    null
  )
  const activeApiKeyRef = useRef('')
  const apiKeysQuery = useQuery({
    queryKey: ['async-image-lab', 'api-keys'],
    queryFn: () => getApiKeys({ p: 1, size: 100 }),
    staleTime: 30_000,
  })
  const apiKeys = apiKeysQuery.data?.data?.items ?? []

  const submitMutation = useMutation({
    mutationFn: async (values: AsyncImageFormValues) => {
      const keyResponse = await fetchTokenKey(Number(values.tokenId))
      const rawKey = keyResponse.data?.key
      if (!keyResponse.success || !rawKey) {
        throw new Error(keyResponse.message || t('Failed to load API key.'))
      }
      const apiKey = rawKey.startsWith('sk-') ? rawKey : `sk-${rawKey}`
      const submission = await submitAsyncImageTask(values, apiKey)
      return { apiKey, submission, request: values }
    },
    onSuccess: ({ apiKey, submission, request }) => {
      activeApiKeyRef.current = apiKey
      setActiveTask({ submission, request })
      toast.success(t('Task submitted successfully'))
    },
    onError: (error) => {
      toast.error(getAsyncApiErrorMessage(error) || t('Failed to submit task.'))
    },
  })

  const statusQuery = useQuery({
    queryKey: ['async-image-lab', 'status', activeTask?.submission.id],
    queryFn: () =>
      getAsyncImageTask(
        activeTask?.submission.id ?? '',
        activeApiKeyRef.current
      ),
    enabled: Boolean(activeTask?.submission.id && activeApiKeyRef.current),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL_ASYNC_STATUSES.has(status) ? false : 2_000
    },
  })

  const resultQuery = useQuery({
    queryKey: ['async-image-lab', 'result', activeTask?.submission.id],
    queryFn: () =>
      getAsyncImageResult(
        activeTask?.submission.id ?? '',
        activeApiKeyRef.current
      ),
    enabled: Boolean(
      activeTask?.submission.id &&
      activeApiKeyRef.current &&
      statusQuery.data?.status === 'success'
    ),
    retry: false,
  })

  const handleRefresh = () => {
    void statusQuery.refetch().then((response) => {
      if (response.data?.status === 'success') {
        void resultQuery.refetch()
      }
    })
  }

  const handleReset = () => {
    const taskId = activeTask?.submission.id
    activeApiKeyRef.current = ''
    setActiveTask(null)
    if (taskId) {
      queryClient.removeQueries({
        queryKey: ['async-image-lab', 'status', taskId],
      })
      queryClient.removeQueries({
        queryKey: ['async-image-lab', 'result', taskId],
      })
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Async image lab')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          render={
            <Link to='/usage-logs/$section' params={{ section: 'task' }} />
          }
        >
          {t('View task logs')}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            data-icon='inline-end'
          />
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
          <div>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Test supported asynchronous image models without keeping the browser connection open.'
              )}
            </p>
          </div>
          <Alert>
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            <AlertTitle>{t('Cloud execution is enabled')}</AlertTitle>
            <AlertDescription>
              {t(
                'You can leave this page after submission. The worker will continue generating and archive the result.'
              )}
            </AlertDescription>
          </Alert>
          {apiKeysQuery.isError ? (
            <Alert variant='destructive'>
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
              <AlertTitle>{t('Failed to load API keys')}</AlertTitle>
              <AlertDescription>
                {getAsyncApiErrorMessage(apiKeysQuery.error) ||
                  t('Refresh the page and try again.')}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className='grid items-start gap-4 lg:grid-cols-2'>
            <AsyncImageForm
              apiKeys={apiKeys}
              isLoadingKeys={apiKeysQuery.isLoading}
              isSubmitting={submitMutation.isPending}
              onSubmit={(values) => submitMutation.mutate(values)}
            />
            <AsyncTaskPanel
              activeTask={activeTask}
              status={statusQuery.data}
              result={resultQuery.data}
              statusError={getAsyncApiErrorMessage(statusQuery.error)}
              resultError={getAsyncApiErrorMessage(resultQuery.error)}
              isRefreshing={statusQuery.isFetching || resultQuery.isFetching}
              onRefresh={handleRefresh}
              onReset={handleReset}
            />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
