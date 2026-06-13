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
import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert02Icon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Dialog } from '@/components/dialog'
import { createCCSwitchImportLink, getCCSwitchImportOptions } from '../../api'
import type { CCSwitchImportOptions, CCSwitchModelOption } from '../../types'

interface CCSwitchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenId?: number
}

type TargetKey = 'codex' | 'claude'
type ModelField = 'model' | 'haiku_model' | 'sonnet_model' | 'opus_model'
type ModelSelection = Record<ModelField, string>

const emptyModelSelection = (): ModelSelection => ({
  model: '',
  haiku_model: '',
  sonnet_model: '',
  opus_model: '',
})

const targetDetails: Record<
  TargetKey,
  {
    label: string
    abbreviation: string
    descriptionKey: string
    importButtonKey: string
    manualTaskKeys: string[]
  }
> = {
  codex: {
    label: 'Codex',
    abbreviation: 'C',
    descriptionKey: 'Use this token in the Codex desktop app',
    importButtonKey: 'Import to Codex',
    manualTaskKeys: [
      'Enable local route mapping',
      'Enable Codex route',
      'Keep official login when switching third-party',
    ],
  },
  claude: {
    label: 'Claude Code',
    abbreviation: 'CC',
    descriptionKey: 'Use this token in the Claude Code plugin',
    importButtonKey: 'Import to Claude Code',
    manualTaskKeys: [
      'Apply to Claude Code plugin',
      'Skip Claude Code initial install confirmation',
      'Enable Claude route',
    ],
  },
}

export function CCSwitchDialog(props: CCSwitchDialogProps) {
  const { t } = useTranslation()

  const optionsQuery = useQuery({
    queryKey: ['ccswitch-import-options', props.tokenId],
    queryFn: async () => {
      if (!props.tokenId) throw new Error('Missing token id')
      return getCCSwitchImportOptions(props.tokenId)
    },
    enabled: props.open && Boolean(props.tokenId),
  })

  const options = optionsQuery.data?.data

  if (options) {
    return (
      <CCSwitchDialogReady
        key={[
          props.tokenId,
          props.open ? 'open' : 'closed',
          options.default_target,
          options.default_model,
        ].join(':')}
        {...props}
        options={options}
      />
    )
  }

  let bodyContent: ReactNode
  if (optionsQuery.isLoading) {
    bodyContent = (
      <div className='flex flex-col gap-3 py-1' aria-label={t('Loading...')}>
        <Skeleton className='h-24 w-full rounded-2xl' />
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          <Skeleton className='h-20 w-full rounded-2xl' />
          <Skeleton className='h-20 w-full rounded-2xl' />
        </div>
        <Skeleton className='h-16 w-full rounded-2xl' />
        <Skeleton className='h-36 w-full rounded-2xl' />
      </div>
    )
  } else if (
    optionsQuery.isError ||
    (optionsQuery.data && !optionsQuery.data.success)
  ) {
    bodyContent = (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={Alert02Icon} />
        <AlertTitle>{t('Failed to load import options')}</AlertTitle>
        {optionsQuery.data?.message ? (
          <AlertDescription>{optionsQuery.data.message}</AlertDescription>
        ) : null}
      </Alert>
    )
  } else {
    bodyContent = (
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} />
        <AlertTitle>{t('No import options available')}</AlertTitle>
      </Alert>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      contentClassName='border-border/70 shadow-2xl sm:max-w-[35rem]'
      bodyClassName='flex flex-col gap-3'
      footerClassName='border-border/60 border-t bg-background/95'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button disabled>
            {optionsQuery.isLoading ? (
              <Spinner data-icon='inline-start' />
            ) : null}
            {t('Import now')}
          </Button>
        </>
      }
    >
      {bodyContent}
    </Dialog>
  )
}

function getDefaultTarget(options: CCSwitchImportOptions): TargetKey {
  return options.default_target === 'claude' ? 'claude' : 'codex'
}

function getInitialModelSelection(
  options: CCSwitchImportOptions
): Record<TargetKey, ModelSelection> {
  const mainModel = options.default_model || ''
  return {
    codex: { ...emptyModelSelection(), model: mainModel },
    claude: {
      model: mainModel,
      haiku_model: '',
      sonnet_model: '',
      opus_model: '',
    },
  }
}

type CCSwitchDialogReadyProps = CCSwitchDialogProps & {
  options: CCSwitchImportOptions
}

function CCSwitchDialogReady(props: CCSwitchDialogReadyProps) {
  const { t } = useTranslation()
  const { options } = props
  const [selectedTarget, setSelectedTarget] = useState<TargetKey>(() =>
    getDefaultTarget(options)
  )
  const [modelsByTarget, setModelsByTarget] = useState<
    Record<TargetKey, ModelSelection>
  >(() => getInitialModelSelection(options))
  const [expandedModelField, setExpandedModelField] =
    useState<ModelField | null>(null)
  const [modelKeyword, setModelKeyword] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [showLaunchHelp, setShowLaunchHelp] = useState(false)
  const activeModels = modelsByTarget[selectedTarget]
  const selectedTargetDetail = targetDetails[selectedTarget]

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!props.tokenId) throw new Error('Missing token id')
      return createCCSwitchImportLink(props.tokenId, {
        target: selectedTarget,
        model: activeModels.model,
        ...(selectedTarget === 'claude'
          ? {
              haiku_model: activeModels.haiku_model,
              sonnet_model: activeModels.sonnet_model,
              opus_model: activeModels.opus_model,
            }
          : {}),
      })
    },
  })

  const selectedTargetConfig = useMemo(
    () => options?.targets.find((target) => target.key === selectedTarget),
    [options?.targets, selectedTarget]
  )

  const filteredModels = useMemo(() => {
    const words = modelKeyword.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const items = options?.models ?? []
    if (words.length === 0) return items
    return items.filter((item) => {
      const lowerName = item.name.toLowerCase()
      return words.every((word) => lowerName.includes(word))
    })
  }, [modelKeyword, options?.models])

  const groupedModels = useMemo(() => {
    const groups = new Map<string, CCSwitchModelOption[]>()
    for (const item of filteredModels) {
      const key = item.vendor_name || t('Other')
      const group = groups.get(key) ?? []
      group.push(item)
      groups.set(key, group)
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      vendorName: key,
      items,
    }))
  }, [filteredModels, t])

  const canImport =
    Boolean(selectedTargetConfig?.enabled) &&
    Boolean(activeModels.model.trim()) &&
    !importMutation.isPending

  const handleSubmit = async () => {
    if (!selectedTargetConfig?.enabled) {
      toast.warning(t('Please select an available import target'))
      return
    }
    if (!activeModels.model.trim()) {
      toast.warning(t('Please select a model'))
      return
    }

    const response = await importMutation.mutateAsync()
    if (!response.success || !response.data?.url) {
      toast.error(
        response.message || t('Failed to create CC Switch import link')
      )
      return
    }

    toast.info(t('Opening CC Switch...'))
    setShowLaunchHelp(false)
    window.location.href = response.data.url
    window.setTimeout(() => setShowLaunchHelp(true), 1500)
  }

  const setModel = (field: ModelField, value: string) => {
    setModelsByTarget((current) => ({
      ...current,
      [selectedTarget]: {
        ...current[selectedTarget],
        [field]: value,
      },
    }))
    setExpandedModelField(null)
    setModelKeyword('')
    setShowLaunchHelp(false)
  }

  const openModelPicker = (field: ModelField) => {
    setExpandedModelField((current) => (current === field ? null : field))
    setModelKeyword('')
  }

  const renderModelPicker = (field: ModelField, optional = false) => (
    <div className='flex flex-col gap-3'>
      {optional ? (
        <Button
          type='button'
          variant='outline'
          className='w-full'
          onClick={() => setModel(field, '')}
        >
          {t('Follow primary model')}
        </Button>
      ) : null}
      <div className='relative'>
        <HugeiconsIcon
          icon={Search01Icon}
          className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2'
        />
        <Input
          value={modelKeyword}
          onChange={(event) => setModelKeyword(event.target.value)}
          placeholder={t('Enter model name, e.g. codex / sonnet / qwen')}
          className='pl-8'
        />
      </div>
      <div className='text-muted-foreground flex items-center justify-between text-xs'>
        <span>
          {modelKeyword.trim()
            ? t('Search results')
            : t('Recommended / Recently added')}
        </span>
        <span>
          {t('{{count}} matches', {
            count: filteredModels.length,
          })}
        </span>
      </div>
      <ModelList
        groups={groupedModels}
        selectedModel={activeModels[field]}
        defaultModel={options?.default_model}
        onSelect={(model) => setModel(field, model)}
      />
    </div>
  )

  const bodyContent = (
    <div className='flex flex-col gap-3'>
      <section className='flex flex-col gap-2'>
        <div className='text-sm font-semibold'>{t('Current token')}</div>
        <div className='bg-muted/20 ring-foreground/5 overflow-hidden rounded-2xl border p-3 shadow-sm ring-1'>
          <div className='grid min-w-0 gap-2 sm:grid-cols-2'>
            <TokenField label={t('Token Name')} value={options.token.name} />
            <TokenField label={t('API Key')} value={options.token.masked_key} />
            <TokenField
              label={t('Base URL')}
              value={options.token.base_url || '-'}
              className='sm:col-span-2'
            />
          </div>
        </div>
      </section>

      <section className='flex flex-col gap-2'>
        <div className='text-sm font-semibold'>{t('Application')}</div>
        <ToggleGroup
          value={[selectedTarget]}
          onValueChange={(values) => {
            const nextTarget = values[0] as TargetKey | undefined
            if (!nextTarget) return
            setSelectedTarget(nextTarget)
            setExpandedModelField(null)
            setAdvancedOpen(false)
            setShowLaunchHelp(false)
          }}
          variant='outline'
          spacing={2}
          className='grid w-full grid-cols-1 gap-2 sm:grid-cols-2'
        >
          {options.targets.map((target) => {
            const targetKey: TargetKey =
              target.key === 'claude' ? 'claude' : 'codex'
            const targetDetail = targetDetails[targetKey]
            const selected = target.key === selectedTarget
            return (
              <ToggleGroupItem
                key={target.key}
                value={targetKey}
                disabled={!target.enabled}
                className={cn(
                  'h-auto min-w-0 items-stretch justify-start rounded-2xl p-0 text-left whitespace-normal shadow-none transition-[background-color,border-color,box-shadow,transform]',
                  'hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-sm',
                  'aria-pressed:border-primary/70 aria-pressed:bg-primary/5 aria-pressed:text-foreground aria-pressed:ring-primary/15 aria-pressed:shadow-sm aria-pressed:ring-1',
                  !target.enabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className='flex min-h-20 w-full items-start gap-3 p-3'>
                  <div className='flex min-w-0 flex-1 items-start gap-3'>
                    <span
                      className={cn(
                        'bg-muted/50 text-muted-foreground ring-foreground/5 flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs ring-1',
                        selected && 'bg-primary/10 text-primary ring-primary/20'
                      )}
                    >
                      <span className='text-sm leading-none font-bold tracking-tight'>
                        {targetDetail.abbreviation}
                      </span>
                    </span>
                    <span className='flex min-w-0 flex-col gap-1'>
                      <span className='truncate text-sm font-semibold'>
                        {targetDetail.label}
                      </span>
                      <span className='text-muted-foreground text-xs leading-relaxed font-normal'>
                        {t(targetDetail.descriptionKey)}
                      </span>
                    </span>
                  </div>
                  {selected ? (
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className='text-primary mt-0.5 shrink-0'
                    />
                  ) : null}
                </div>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </section>

      <section className='flex flex-col gap-2'>
        <div className='text-sm font-semibold'>{t('Primary Model')}</div>
        <div className='bg-background ring-foreground/5 overflow-hidden rounded-2xl border shadow-sm ring-1'>
          <ModelSettingSection
            label={t('Primary Model')}
            value={activeModels.model || '-'}
            expanded={expandedModelField === 'model'}
            onToggle={() => openModelPicker('model')}
          >
            {renderModelPicker('model')}
          </ModelSettingSection>

          {selectedTarget === 'claude' ? (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <Separator />
              <CollapsibleTrigger className='hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors'>
                <span className='flex min-w-0 flex-col gap-0.5'>
                  <span className='text-sm font-semibold'>
                    {t('Advanced Settings')}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {t('Follow primary model')}
                  </span>
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={cn(
                    'text-muted-foreground shrink-0 transition-transform',
                    advancedOpen && 'rotate-180'
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className='CollapsibleContent'>
                <div className='flex flex-col gap-2 px-3 pb-3'>
                  {(
                    [
                      ['haiku_model', 'Haiku Model'],
                      ['sonnet_model', 'Sonnet Model'],
                      ['opus_model', 'Opus Model'],
                    ] as const
                  ).map(([field, label]) => (
                    <ModelSettingSection
                      key={field}
                      label={t(label)}
                      value={activeModels[field] || t('Follow primary model')}
                      expanded={expandedModelField === field}
                      onToggle={() => openModelPicker(field)}
                      nested
                    >
                      {renderModelPicker(field, true)}
                    </ModelSettingSection>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      </section>

      <Alert className='border-primary/15 bg-primary/5 shadow-none'>
        <HugeiconsIcon icon={InformationCircleIcon} />
        <AlertTitle>
          {t('Enable these options in CC Switch manually')}
        </AlertTitle>
        <AlertDescription className='col-span-full mt-3'>
          <ol className='flex flex-col gap-2'>
            {selectedTargetDetail.manualTaskKeys.map((taskKey, index) => (
              <li
                key={taskKey}
                className='bg-background/80 ring-foreground/5 text-foreground flex min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ring-1'
              >
                <Badge
                  variant='secondary'
                  className='size-6 shrink-0 justify-center rounded-full p-0 tabular-nums'
                >
                  {index + 1}
                </Badge>
                <span className='min-w-0 leading-5'>{t(taskKey)}</span>
              </li>
            ))}
          </ol>
        </AlertDescription>
      </Alert>

      {showLaunchHelp ? (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} />
          <AlertDescription>
            {t(
              'If CC Switch did not open, make sure it is installed and the protocol is registered.'
            )}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      contentClassName='border-border/70 shadow-2xl sm:max-w-[35rem]'
      bodyClassName='flex flex-col gap-3'
      footerClassName='border-border/60 border-t bg-background/95'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canImport}>
            {importMutation.isPending ? (
              <Spinner data-icon='inline-start' />
            ) : null}
            {importMutation.isPending
              ? t('Opening...')
              : t(selectedTargetDetail.importButtonKey)}
          </Button>
        </>
      }
    >
      {bodyContent}
    </Dialog>
  )
}

function ModelList(props: {
  groups: Array<{
    key: string
    vendorName: string
    items: CCSwitchModelOption[]
  }>
  selectedModel: string
  defaultModel?: string
  onSelect: (model: string) => void
}) {
  const { t } = useTranslation()
  if (props.groups.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm'>
        {t('No matching models found')}
      </div>
    )
  }
  return (
    <div className='bg-popover ring-foreground/10 max-h-64 overflow-y-auto rounded-xl border shadow-md ring-1'>
      {props.groups.map((group) => (
        <div key={group.key}>
          <div className='bg-muted/50 text-muted-foreground px-3 py-1.5 text-xs font-semibold'>
            {group.vendorName}
          </div>
          {group.items.map((item) => (
            <button
              key={item.name}
              type='button'
              className={cn(
                'hover:bg-muted/70 flex h-10 w-full items-center justify-between gap-3 border-t px-3 text-left text-sm transition-colors',
                item.name === props.selectedModel &&
                  'bg-primary/5 text-primary hover:bg-primary/10'
              )}
              onClick={() => props.onSelect(item.name)}
            >
              <span className='min-w-0 truncate font-medium'>{item.name}</span>
              {item.name === props.defaultModel ? (
                <Badge variant='secondary'>{t('Recommended')}</Badge>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function TokenField(props: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-background/70 ring-foreground/5 flex min-w-0 flex-col gap-0.5 rounded-lg px-2.5 py-2 ring-1',
        props.className
      )}
    >
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='text-sm font-medium break-all'>{props.value || '-'}</div>
    </div>
  )
}

function ModelSettingSection(props: {
  label: string
  value: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
  nested?: boolean
}) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        props.nested && 'bg-muted/20 rounded-xl border'
      )}
    >
      <button
        type='button'
        className='hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors'
        onClick={props.onToggle}
      >
        <span className='flex min-w-0 flex-col gap-0.5'>
          <span className='text-muted-foreground text-xs'>{props.label}</span>
          <span className='truncate text-sm font-semibold'>{props.value}</span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn(
            'text-muted-foreground shrink-0 transition-transform',
            props.expanded && 'rotate-180'
          )}
        />
      </button>
      {props.expanded ? (
        <div className='px-3 pb-3'>
          <Separator className='mb-3' />
          {props.children}
        </div>
      ) : null}
    </div>
  )
}
