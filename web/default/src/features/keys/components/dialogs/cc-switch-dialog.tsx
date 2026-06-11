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
import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, Code2, KeyRound, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/dialog'
import {
  createCCSwitchImportLink,
  getCCSwitchImportOptions,
} from '../../api'
import type { CCSwitchModelOption } from '../../types'

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

export function CCSwitchDialog(props: CCSwitchDialogProps) {
  const { t } = useTranslation()
  const [selectedTarget, setSelectedTarget] = useState<TargetKey>('codex')
  const [modelsByTarget, setModelsByTarget] = useState<
    Record<TargetKey, ModelSelection>
  >({ codex: emptyModelSelection(), claude: emptyModelSelection() })
  const [expandedModelField, setExpandedModelField] =
    useState<ModelField | null>(null)
  const [modelKeyword, setModelKeyword] = useState('')
  const [showLaunchHelp, setShowLaunchHelp] = useState(false)

  const optionsQuery = useQuery({
    queryKey: ['ccswitch-import-options', props.tokenId],
    queryFn: async () => {
      if (!props.tokenId) throw new Error('Missing token id')
      return getCCSwitchImportOptions(props.tokenId)
    },
    enabled: props.open && Boolean(props.tokenId),
  })

  const options = optionsQuery.data?.data
  const activeModels = modelsByTarget[selectedTarget]

  useEffect(() => {
    if (!props.open || !options) return
    const defaultTarget: TargetKey =
      options.default_target === 'claude' ? 'claude' : 'codex'
    const mainModel = options.default_model || ''
    setSelectedTarget(defaultTarget)
    setModelsByTarget({
      codex: { ...emptyModelSelection(), model: mainModel },
      claude: {
        model: mainModel,
        haiku_model: '',
        sonnet_model: '',
        opus_model: '',
      },
    })
    setExpandedModelField(null)
    setModelKeyword('')
    setShowLaunchHelp(false)
  }, [options, props.open, props.tokenId])

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
    const words = modelKeyword
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
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
    <div className='space-y-3 pt-3'>
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
        <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
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

  let bodyContent: ReactNode
  if (optionsQuery.isLoading) {
    bodyContent = (
      <div className='text-muted-foreground py-6 text-center text-sm'>
        {t('Loading...')}
      </div>
    )
  } else if (optionsQuery.data && !optionsQuery.data.success) {
    bodyContent = (
      <div className='text-destructive py-6 text-center text-sm'>
        {optionsQuery.data.message || t('Failed to load import options')}
      </div>
    )
  } else if (options) {
    bodyContent = (
      <div className='space-y-4'>
        <section className='bg-muted/40 rounded-lg p-4'>
          <div className='mb-3 flex items-center gap-2'>
            <div className='bg-background text-muted-foreground flex size-7 items-center justify-center rounded-md'>
              <KeyRound className='size-4' />
            </div>
            <h3 className='text-sm font-semibold'>{t('Current token')}</h3>
          </div>
          <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]'>
            <TokenField label={t('Token Name')} value={options.token.name} />
            <TokenField label={t('API Key')} value={options.token.masked_key} />
          </div>
        </section>

        <section className='space-y-2'>
          <div className='text-muted-foreground text-xs font-medium'>
            {t('Import target')}
          </div>
          <div className='bg-muted/50 grid grid-cols-2 gap-1 rounded-lg p-1'>
            {options.targets.map((target) => {
              const TargetIcon = target.key === 'claude' ? Bot : Code2
              const selected = target.key === selectedTarget
              return (
                <button
                  key={target.key}
                  type='button'
                  disabled={!target.enabled}
                  className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                    selected
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    !target.enabled && 'cursor-not-allowed opacity-50'
                  )}
                  onClick={() => {
                    if (!target.enabled) return
                    setSelectedTarget(
                      target.key === 'claude' ? 'claude' : 'codex'
                    )
                    setExpandedModelField(null)
                    setShowLaunchHelp(false)
                  }}
                >
                  <TargetIcon className='size-4' />
                  <span className='truncate'>{target.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <SettingSection
          label={t('Primary Model')}
          value={activeModels.model || '-'}
          expanded={expandedModelField === 'model'}
          onToggle={() => openModelPicker('model')}
        >
          {renderModelPicker('model')}
        </SettingSection>

        {selectedTarget === 'claude'
          ? (
              [
                ['haiku_model', 'Haiku Model'],
                ['sonnet_model', 'Sonnet Model'],
                ['opus_model', 'Opus Model'],
              ] as const
            ).map(([field, label]) => (
              <SettingSection
                key={field}
                label={t(label)}
                value={activeModels[field] || t('Follow primary model')}
                expanded={expandedModelField === field}
                onToggle={() => openModelPicker(field)}
              >
                {renderModelPicker(field, true)}
              </SettingSection>
            ))
          : null}

        {showLaunchHelp ? (
          <div className='bg-muted/50 text-muted-foreground rounded-lg border p-3 text-sm'>
            {t(
              'If CC Switch did not open, make sure it is installed and the protocol is registered.'
            )}
          </div>
        ) : null}
      </div>
    )
  } else {
    bodyContent = (
      <div className='text-muted-foreground py-6 text-center text-sm'>
        {t('No import options available')}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      description={t(
        'Import the current token to your local CC Switch for Codex or Claude Code.'
      )}
      contentClassName='sm:max-w-xl'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canImport || optionsQuery.isLoading}
          >
            {importMutation.isPending ? t('Opening...') : t('Import now')}
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
    <div className='bg-background max-h-72 overflow-y-auto rounded-lg border'>
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
                <span className='bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs'>
                  {t('Recommended')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function TokenField(props: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1.5'>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='break-all text-sm font-medium'>{props.value || '-'}</div>
    </div>
  )
}

function SettingSection(props: {
  label: string
  value: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className='bg-muted/40 rounded-lg ring-1 ring-border/50'>
      <div className='flex items-center justify-between gap-3 p-4'>
        <div className='min-w-0 space-y-1'>
          <div className='text-muted-foreground text-xs'>{props.label}</div>
          <div className='truncate text-sm font-semibold'>{props.value}</div>
        </div>
        <Button variant='secondary' size='sm' onClick={props.onToggle}>
          {props.expanded ? t('Collapse') : t('Change')}
        </Button>
      </div>
      {props.expanded ? (
        <div className='border-border/60 border-t px-4 pb-4'>
          {props.children}
        </div>
      ) : null}
    </section>
  )
}
