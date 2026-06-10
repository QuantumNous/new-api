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
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getUserModels } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/dialog'
import {
  createCCSwitchImportLink,
  getCCSwitchImportOptions,
} from '../../api'
import type { CCSwitchImportTarget } from '../../types'

interface CCSwitchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenId?: number
}

export function CCSwitchDialog(props: CCSwitchDialogProps) {
  const { t } = useTranslation()
  const [selectedTarget, setSelectedTarget] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [targetExpanded, setTargetExpanded] = useState(false)
  const [modelExpanded, setModelExpanded] = useState(false)
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

  const modelsQuery = useQuery({
    queryKey: ['user-models-ccswitch'],
    queryFn: getUserModels,
    enabled: props.open,
    staleTime: 5 * 60 * 1000,
  })

  const options = optionsQuery.data?.data
  const activeTarget = selectedTarget || options?.default_target || ''
  const activeModel = selectedModel || options?.default_model || ''

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!props.tokenId) throw new Error('Missing token id')
      return createCCSwitchImportLink(props.tokenId, {
        target: activeTarget,
        model: activeModel,
      })
    },
  })

  const modelOptions = useMemo(() => {
    const data = modelsQuery.data?.data ?? []
    const seen = new Set<string>()
    const merged = [options?.default_model, ...data].filter(
      (item): item is string => Boolean(item)
    )
    return merged.filter((model) => {
      if (seen.has(model)) return false
      seen.add(model)
      return true
    })
  }, [modelsQuery.data?.data, options?.default_model])

  const filteredModels = useMemo(() => {
    const words = modelKeyword
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    if (words.length === 0) return modelOptions.slice(0, 30)
    return modelOptions
      .filter((model) => {
        const lowerModel = model.toLowerCase()
        return words.every((word) => lowerModel.includes(word))
      })
      .slice(0, 30)
  }, [modelKeyword, modelOptions])

  useEffect(() => {
    if (!props.open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetExpanded(false)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModelExpanded(false)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModelKeyword('')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowLaunchHelp(false)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTarget('')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedModel('')
  }, [props.open, props.tokenId])

  const selectedTargetConfig = useMemo(() => {
    return options?.targets.find((target) => target.key === activeTarget)
  }, [options?.targets, activeTarget])

  const canImport =
    Boolean(selectedTargetConfig?.enabled) &&
    Boolean(activeModel.trim()) &&
    !importMutation.isPending

  const handleSubmit = async () => {
    if (!selectedTargetConfig?.enabled) {
      toast.warning(t('Please select an available import target'))
      return
    }
    if (!activeModel.trim()) {
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

  let modelListContent: ReactNode
  if (filteredModels.length > 0) {
    modelListContent = (
      <div className='max-h-64 space-y-2 overflow-y-auto pr-1'>
        {filteredModels.map((model) => (
          <button
            key={model}
            type='button'
            className={cn(
              'hover:bg-muted flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              model === activeModel && 'border-primary bg-primary/5'
            )}
            onClick={() => {
              setSelectedModel(model)
              setModelKeyword('')
              setModelExpanded(false)
              setShowLaunchHelp(false)
            }}
          >
            <span className='min-w-0 truncate font-medium'>{model}</span>
            {model === options?.default_model ? (
              <span className='bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs'>
                {t('Recommended')}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    )
  } else {
    modelListContent = (
      <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm'>
        {t('No matching models found')}
      </div>
    )
  }

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
        <section className='bg-muted/40 rounded-lg border p-4'>
          <h3 className='mb-3 text-sm font-semibold'>
            {t('Current token')}
          </h3>
          <div className='grid gap-3 sm:grid-cols-2'>
            <TokenField label={t('Name')} value={options.token.name} />
            <TokenField label={t('API Key')} value={options.token.masked_key} />
            <TokenField
              label={t('BaseURL')}
              value={options.token.base_url}
              className='sm:col-span-2'
            />
          </div>
        </section>

        <SettingSection
          label={t('Import target')}
          value={selectedTargetConfig?.label || activeTarget || '-'}
          expanded={targetExpanded}
          onToggle={() => {
            setTargetExpanded((value) => !value)
            setModelExpanded(false)
          }}
        >
          <div className='space-y-2 pt-3'>
            {options.targets.map((target) => (
              <TargetOption
                key={target.key}
                target={target}
                selected={target.key === activeTarget}
                onSelect={() => {
                  if (!target.enabled) return
                  setSelectedTarget(target.key)
                  setTargetExpanded(false)
                  setShowLaunchHelp(false)
                }}
              />
            ))}
          </div>
        </SettingSection>

        <SettingSection
          label={t('Default model')}
          value={activeModel || '-'}
          expanded={modelExpanded}
          onToggle={() => {
            setModelExpanded((value) => !value)
            setTargetExpanded(false)
          }}
        >
          <div className='space-y-3 pt-3'>
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
                {t('{{count}} matches', { count: filteredModels.length })}
              </span>
            </div>
            {modelListContent}
          </div>
        </SettingSection>

        {showLaunchHelp && (
          <div className='bg-muted/50 text-muted-foreground rounded-lg border p-3 text-sm'>
            {t(
              'If CC Switch did not open, make sure it is installed and the protocol is registered.'
            )}
          </div>
        )}
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
        'Import the current token to your local CC Switch for Codex.'
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

function TokenField(props: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1', props.className)}>
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
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between gap-3 p-4'>
        <div className='min-w-0 space-y-1'>
          <div className='text-muted-foreground text-xs'>{props.label}</div>
          <div className='truncate text-sm font-semibold'>{props.value}</div>
        </div>
        <Button variant='link' onClick={props.onToggle}>
          {props.expanded ? t('Collapse') : t('Change')}
        </Button>
      </div>
      {props.expanded ? (
        <div className='border-t px-4 pb-4'>{props.children}</div>
      ) : null}
    </section>
  )
}

function TargetOption(props: {
  target: CCSwitchImportTarget
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  let statusText = t(props.target.disabled_reason || 'Coming soon')
  if (props.target.enabled) {
    statusText = props.selected ? t('Selected') : t('Supported')
  }
  return (
    <button
      type='button'
      disabled={!props.target.enabled}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
        props.target.enabled
          ? 'hover:bg-muted'
          : 'bg-muted/40 text-muted-foreground cursor-not-allowed',
        props.selected && 'border-primary bg-primary/5'
      )}
      onClick={props.onSelect}
    >
      <span className='font-medium'>{props.target.label}</span>
      <span className='text-muted-foreground text-xs'>{statusText}</span>
    </button>
  )
}
