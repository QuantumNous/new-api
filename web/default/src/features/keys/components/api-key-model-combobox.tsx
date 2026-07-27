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
  InformationCircleIcon,
  ReloadIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { TFunction } from 'i18next'
import { type Ref, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'

import type {
  ApiKeyModel,
  ApiKeyModelEndpoint,
  ApiKeyModelsResult,
} from '../api'
import {
  groupCCSwitchModels,
  type CCSwitchApp,
  type CCSwitchModelField,
  type CCSwitchModelGroupKind,
} from '../lib/model-catalog'

const EMPTY_MODELS: ApiKeyModel[] = []

export type ApiKeyModelSelectionSource = 'catalog' | 'custom'

type ApiKeyModelComboboxProps = {
  app: CCSwitchApp
  describedBy?: string
  disabled?: boolean
  field: CCSwitchModelField
  id: string
  inputRef?: Ref<HTMLInputElement>
  invalid: boolean
  isFetching: boolean
  isPending: boolean
  modelsResult?: ApiKeyModelsResult
  onRetry: () => void
  onValueChange: (value: string, source: ApiKeyModelSelectionSource) => void
  required?: boolean
  source: ApiKeyModelSelectionSource
  value: string
}

type ModelInputProps = {
  describedBy?: string
  disabled: boolean
  id: string
  inputRef?: Ref<HTMLInputElement>
  invalid: boolean
  isFetching: boolean
  onOpen: () => void
  onValueChange: (value: string) => void
  open: boolean
  popoverTrigger: boolean
  required: boolean
  value: string
}

type ModelCatalogContentProps = {
  app: CCSwitchApp
  field: CCSwitchModelField
  isFetching: boolean
  isPending: boolean
  listId: string
  modelsResult?: ApiKeyModelsResult
  onRetry: () => void
  onSelect: (model: string, source: ApiKeyModelSelectionSource) => void
  selectedValue: string
}

function getEndpointLabel(t: TFunction, endpoint: ApiKeyModelEndpoint) {
  switch (endpoint) {
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
    case 'openai-video':
      return t('Video')
  }
}

function getFailureMessage(
  t: TFunction,
  failure: Extract<ApiKeyModelsResult, { success: false }>
) {
  if (failure.message) return failure.message

  switch (failure.failureKind) {
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

function getGroupLabel(t: TFunction, kind: CCSwitchModelGroupKind) {
  switch (kind) {
    case 'protocol':
      return t('Protocol metadata match')
    case 'gateway':
      return t('Gateway compatibility hint')
    case 'other':
      return t('Other models')
  }
}

function ModelInput(props: ModelInputProps) {
  const { t } = useTranslation()
  const listId = `${props.id}-catalog`
  const openButton = (
    <InputGroupButton
      type='button'
      size='icon-xs'
      aria-label={t('Select Model')}
      aria-expanded={props.open}
      disabled={props.disabled}
    />
  )

  return (
    <InputGroup>
      <InputGroupInput
        ref={props.inputRef}
        id={props.id}
        role='combobox'
        aria-autocomplete='list'
        aria-haspopup='listbox'
        aria-controls={props.open ? listId : undefined}
        aria-describedby={props.describedBy}
        aria-expanded={props.open}
        aria-invalid={props.invalid}
        aria-required={props.required || undefined}
        autoComplete='off'
        disabled={props.disabled}
        placeholder={t('Select or enter model name')}
        value={props.value}
        onChange={(event) => props.onValueChange(event.target.value)}
        onClick={() => {
          if (!props.open) props.onOpen()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            props.onOpen()
          }
        }}
      />
      <InputGroupAddon align='inline-end'>
        {props.isFetching ? <Spinner aria-label={t('Loading')} /> : null}
        {props.popoverTrigger ? (
          <PopoverTrigger render={openButton}>
            <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden='true' />
          </PopoverTrigger>
        ) : (
          <InputGroupButton
            type='button'
            size='icon-xs'
            aria-label={t('Select Model')}
            aria-expanded={props.open}
            disabled={props.disabled}
            onClick={props.onOpen}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden='true' />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

function ModelCatalogSkeleton() {
  return (
    <div className='space-y-2 p-3'>
      <Skeleton className='h-4 w-24' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
    </div>
  )
}

function ModelCatalogEmpty(props: { description: string; title: string }) {
  return (
    <Empty className='min-h-44 rounded-none border-0'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
        </EmptyMedia>
        <EmptyTitle>{props.title}</EmptyTitle>
        <EmptyDescription>{props.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function ModelRow(props: {
  model: ApiKeyModel
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const searchableValue = [
    props.model.id,
    props.model.ownedBy ?? '',
    ...props.model.supportedEndpointTypes,
  ].join(' ')

  return (
    <CommandItem
      value={searchableValue}
      data-checked={props.selected}
      onSelect={props.onSelect}
      className='min-h-11 items-start py-2'
    >
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-mono text-xs'>
          {props.model.id}
        </span>
        <span className='mt-1 flex flex-wrap items-center gap-1'>
          {props.model.ownedBy ? (
            <span className='text-muted-foreground mr-1 truncate text-xs'>
              {props.model.ownedBy}
            </span>
          ) : null}
          {props.model.supportedEndpointTypes.map((endpoint) => (
            <Badge key={endpoint} variant='outline' className='font-normal'>
              {getEndpointLabel(t, endpoint)}
            </Badge>
          ))}
        </span>
      </span>
    </CommandItem>
  )
}

function ModelCatalogContent(props: ModelCatalogContentProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const models = props.modelsResult?.success
    ? props.modelsResult.models
    : EMPTY_MODELS
  const groups = useMemo(
    () => groupCCSwitchModels(models, props.app, props.field, search),
    [models, props.app, props.field, search]
  )
  const normalizedSearch = search.trim()
  const exactSearchMatch = models.some(
    (model) => model.id.toLowerCase() === normalizedSearch.toLowerCase()
  )
  const showCustomOption = Boolean(normalizedSearch && !exactSearchMatch)
  const hasVisibleModels = groups.some((group) => group.models.length > 0)
  const failure =
    props.modelsResult?.success === false ? props.modelsResult : null

  let catalogBody = null
  if (props.isPending && !props.modelsResult) {
    catalogBody = <ModelCatalogSkeleton />
  } else if (failure) {
    catalogBody = (
      <Alert variant='destructive' className='m-2 w-auto'>
        <HugeiconsIcon icon={AlertCircleIcon} aria-hidden='true' />
        <AlertTitle>{t('Failed to fetch models')}</AlertTitle>
        <AlertDescription>{getFailureMessage(t, failure)}</AlertDescription>
        <AlertAction>
          <Button
            type='button'
            size='icon-sm'
            aria-label={t('Retry')}
            onClick={props.onRetry}
          >
            <HugeiconsIcon icon={ReloadIcon} aria-hidden='true' />
          </Button>
        </AlertAction>
      </Alert>
    )
  } else if (props.modelsResult?.success && models.length === 0) {
    catalogBody = (
      <ModelCatalogEmpty
        title={t('No available models')}
        description={t('No available models were returned for this API key.')}
      />
    )
  } else if (props.modelsResult?.success && !hasVisibleModels) {
    catalogBody = (
      <ModelCatalogEmpty
        title={t('No matching results')}
        description={t('Try a different search term or use a custom model.')}
      />
    )
  }

  return (
    <Command shouldFilter={false} className='min-h-0 rounded-lg!'>
      <CommandInput
        autoFocus
        placeholder={t('Search models...')}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList
        id={props.listId}
        className='max-h-[min(420px,60dvh)] min-h-0 flex-1'
      >
        {catalogBody}
        {props.modelsResult?.success && hasVisibleModels
          ? groups.map((group) =>
              group.models.length > 0 ? (
                <CommandGroup
                  key={group.kind}
                  heading={`${getGroupLabel(t, group.kind)} (${group.models.length})`}
                >
                  {group.models.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      selected={model.id === props.selectedValue}
                      onSelect={() => props.onSelect(model.id, 'catalog')}
                    />
                  ))}
                </CommandGroup>
              ) : null
            )
          : null}
        {showCustomOption ? (
          <CommandGroup heading={t('Custom')}>
            <CommandItem
              value={normalizedSearch}
              onSelect={() => props.onSelect(normalizedSearch, 'custom')}
            >
              <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                {t('Use custom model "{{model}}"', {
                  model: normalizedSearch,
                })}
              </span>
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
      <Separator />
      <div className='text-muted-foreground flex min-h-9 items-center justify-between gap-3 px-3 py-1.5 text-xs'>
        <span aria-live='polite'>
          {props.modelsResult?.success
            ? t('{{count}} models', { count: models.length })
            : t('Model catalog')}
        </span>
        <Button
          type='button'
          size='icon-xs'
          aria-label={t('Refresh')}
          disabled={props.isFetching}
          onClick={props.onRetry}
        >
          {props.isFetching ? (
            <Spinner aria-label={t('Loading')} />
          ) : (
            <HugeiconsIcon icon={ReloadIcon} aria-hidden='true' />
          )}
        </Button>
      </div>
    </Command>
  )
}

export function ApiKeyModelCombobox(props: ApiKeyModelComboboxProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const listId = `${props.id}-catalog`
  const [open, setOpen] = useState(false)
  const models = props.modelsResult?.success
    ? props.modelsResult.models
    : EMPTY_MODELS
  const selectedInCatalog = models.some((model) => model.id === props.value)
  const isStaleSelection = Boolean(
    props.value &&
    props.source === 'catalog' &&
    props.modelsResult?.success &&
    !selectedInCatalog
  )
  const isCustomSelection = Boolean(
    props.value && props.source === 'custom' && !selectedInCatalog
  )

  const catalogContent = (
    <ModelCatalogContent
      app={props.app}
      field={props.field}
      isFetching={props.isFetching}
      isPending={props.isPending}
      listId={listId}
      modelsResult={props.modelsResult}
      onRetry={props.onRetry}
      selectedValue={props.value}
      onSelect={(value, source) => {
        props.onValueChange(value, source)
        setOpen(false)
      }}
    />
  )

  return (
    <div className='space-y-1.5'>
      {isMobile ? (
        <ModelInput
          disabled={Boolean(props.disabled)}
          describedBy={props.describedBy}
          id={props.id}
          inputRef={props.inputRef}
          invalid={Boolean(props.invalid)}
          isFetching={props.isFetching}
          open={open}
          popoverTrigger={false}
          required={Boolean(props.required)}
          value={props.value}
          onOpen={() => setOpen(true)}
          onValueChange={(value) => props.onValueChange(value, 'custom')}
        />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <ModelInput
            disabled={Boolean(props.disabled)}
            describedBy={props.describedBy}
            id={props.id}
            inputRef={props.inputRef}
            invalid={Boolean(props.invalid)}
            isFetching={props.isFetching}
            open={open}
            popoverTrigger
            required={Boolean(props.required)}
            value={props.value}
            onOpen={() => setOpen(true)}
            onValueChange={(value) => props.onValueChange(value, 'custom')}
          />
          <PopoverContent
            align='end'
            side='bottom'
            collisionPadding={8}
            className='max-h-(--available-height) w-[32rem] max-w-[calc(100vw-2rem)] overflow-hidden p-0'
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            {catalogContent}
          </PopoverContent>
        </Popover>
      )}

      <div className='min-h-5' aria-live='polite'>
        {isStaleSelection ? (
          <Badge variant='destructive'>{t('Not in current catalog')}</Badge>
        ) : null}
        {isCustomSelection ? (
          <Badge variant='outline'>{t('Custom')}</Badge>
        ) : null}
      </div>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent
            className='flex max-h-[80dvh] min-h-[60dvh] flex-col'
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <DrawerHeader className='pb-2 text-left'>
              <DrawerTitle>{t('Select Model')}</DrawerTitle>
              <DrawerDescription>
                {t('Select or enter model name')}
              </DrawerDescription>
            </DrawerHeader>
            <div className='min-h-0 flex-1 overflow-hidden px-3 pb-4'>
              {catalogContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  )
}
