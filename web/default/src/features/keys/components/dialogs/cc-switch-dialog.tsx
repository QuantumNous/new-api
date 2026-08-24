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
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog } from '@/components/dialog'
import { getApiKeyCallableModels } from '../../lib/api-key-model-scope'
import { useApiKeys } from '../api-keys-provider'

const APP_CONFIGS = {
  claude: {
    label: 'Claude',
    defaultName: 'My Claude',
    modelFields: [
      { key: 'model', labelKey: 'Primary Model', required: true },
      { key: 'haikuModel', labelKey: 'Haiku Model', required: false },
      { key: 'sonnetModel', labelKey: 'Sonnet Model', required: false },
      { key: 'opusModel', labelKey: 'Opus Model', required: false },
    ],
  },
  codex: {
    label: 'Codex',
    defaultName: 'My Codex',
    modelFields: [{ key: 'model', labelKey: 'Primary Model', required: true }],
  },
  gemini: {
    label: 'Gemini',
    defaultName: 'My Gemini',
    modelFields: [{ key: 'model', labelKey: 'Primary Model', required: true }],
  },
} as const

type AppType = keyof typeof APP_CONFIGS

export type CCSwitchModelAccessState = 'loading' | 'error' | 'empty' | 'ready'

// eslint-disable-next-line react-refresh/only-export-components
export function getCCSwitchModelAccessState(input: {
  isPending: boolean
  isError: boolean
  hasData: boolean
  modelCount: number
}): CCSwitchModelAccessState {
  if (input.isPending) return 'loading'
  if (input.isError) return 'error'
  if (!input.hasData) return 'loading'
  return input.modelCount === 0 ? 'empty' : 'ready'
}

// eslint-disable-next-line react-refresh/only-export-components
export function getCCSwitchModelPlaceholderKey(
  state: CCSwitchModelAccessState
): string {
  if (state === 'loading') return 'Loading...'
  if (state === 'error') return 'Unable to load available models'
  return 'No callable models available for this API key'
}

export type CCSwitchModelValidation =
  | 'missing-required'
  | 'invalid-selection'
  | null

// eslint-disable-next-line react-refresh/only-export-components
export function validateCCSwitchModels(
  app: AppType,
  models: Record<string, string>,
  callableModelIds: ReadonlySet<string>
): CCSwitchModelValidation {
  for (const field of APP_CONFIGS[app].modelFields) {
    const model = models[field.key] ?? ''
    if (field.required && !model.trim()) return 'missing-required'
    if (model && !callableModelIds.has(model)) return 'invalid-selection'
  }
  return null
}

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) return status.server_address
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

function buildCCSwitchURL(
  app: string,
  name: string,
  models: Record<string, string>,
  apiKey: string
): string {
  const serverAddress = getServerAddress()
  const endpoint = app === 'codex' ? serverAddress + '/v1' : serverAddress
  const params = new URLSearchParams()
  params.set('resource', 'provider')
  params.set('app', app)
  params.set('name', name)
  params.set('endpoint', endpoint)
  params.set('apiKey', apiKey)
  for (const [k, v] of Object.entries(models)) {
    if (v) params.set(k, v)
  }
  params.set('homepage', serverAddress)
  params.set('enabled', 'true')
  return `ccswitch://v1/import?${params.toString()}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenKey: string
}

export function CCSwitchDialog(props: Props) {
  const { t } = useTranslation()
  const [app, setApp] = useState<AppType>('claude')
  const [name, setName] = useState<string>(APP_CONFIGS.claude.defaultName)
  const [models, setModels] = useState<Record<string, string>>({})
  const { currentRow, modelAccessQuery } = useApiKeys()

  const modelOptions = useMemo(() => {
    const items = getApiKeyCallableModels(modelAccessQuery.data, currentRow)
    return items.map((model) => ({ value: model.id, label: model.id }))
  }, [currentRow, modelAccessQuery.data])

  const modelAccessState = getCCSwitchModelAccessState({
    isPending: modelAccessQuery.isPending,
    isError: modelAccessQuery.isError,
    hasData: modelAccessQuery.data !== undefined,
    modelCount: modelOptions.length,
  })

  useEffect(() => {
    if (props.open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModels({})

      setApp('claude')

      setName(APP_CONFIGS.claude.defaultName)
    }
  }, [props.open])

  const currentConfig = APP_CONFIGS[app]

  const handleAppChange = (val: string) => {
    const appVal = val as AppType
    setApp(appVal)
    setName(APP_CONFIGS[appVal].defaultName)
    setModels({})
  }

  const handleSubmit = () => {
    if (modelAccessState !== 'ready') return

    const callableModels = new Set(modelOptions.map((option) => option.value))
    const validation = validateCCSwitchModels(app, models, callableModels)
    if (validation === 'missing-required') {
      toast.warning(t('Please select a primary model'))
      return
    }
    if (validation === 'invalid-selection') {
      toast.warning(t('Select a callable model'))
      return
    }
    const key = props.tokenKey.startsWith('sk-')
      ? props.tokenKey
      : `sk-${props.tokenKey}`
    const url = buildCCSwitchURL(app, name, models, key)
    window.open(url, '_blank')
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={modelAccessState !== 'ready'}
          >
            {t('Open CC Switch')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        {modelAccessState === 'loading' && (
          <Alert>
            <AlertTitle>{t('Loading...')}</AlertTitle>
          </Alert>
        )}
        {modelAccessState === 'error' && (
          <Alert variant='destructive'>
            <AlertTitle>{t('Unable to load available models')}</AlertTitle>
            <AlertAction>
              <Button
                type='button'
                size='sm'
                variant='outline'
                disabled={modelAccessQuery.isFetching}
                onClick={() => void modelAccessQuery.refetch()}
              >
                {t('Retry')}
              </Button>
            </AlertAction>
          </Alert>
        )}
        {modelAccessState === 'empty' && (
          <Alert>
            <AlertTitle>
              {t('No callable models available for this API key')}
            </AlertTitle>
          </Alert>
        )}
        <div className='space-y-2'>
          <Label>{t('Application')}</Label>
          <RadioGroup
            value={app}
            onValueChange={handleAppChange}
            className='flex gap-4'
          >
            {(
              Object.entries(APP_CONFIGS) as [
                AppType,
                (typeof APP_CONFIGS)[AppType],
              ][]
            ).map(([key, cfg]) => (
              <div key={key} className='flex items-center gap-2'>
                <RadioGroupItem value={key} id={`app-${key}`} />
                <Label htmlFor={`app-${key}`} className='cursor-pointer'>
                  {cfg.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className='space-y-2'>
          <Label>{t('Name')}</Label>
          <ComboboxInput
            options={[]}
            value={name}
            onValueChange={setName}
            placeholder={currentConfig.defaultName}
            emptyText=''
            allowCustomValue={true}
          />
        </div>

        {currentConfig.modelFields.map((field) => (
          <div key={field.key} className='space-y-2'>
            <Label>
              {t(field.labelKey)}
              {field.required && (
                <span className='text-destructive ml-0.5'>*</span>
              )}
            </Label>
            {modelAccessState !== 'ready' ? (
              <Input
                disabled
                readOnly
                value=''
                placeholder={t(
                  getCCSwitchModelPlaceholderKey(modelAccessState)
                )}
              />
            ) : (
              <ComboboxInput
                options={modelOptions}
                value={models[field.key] || ''}
                onValueChange={(v) =>
                  setModels((prev) => ({ ...prev, [field.key]: v }))
                }
                placeholder={t('Select a callable model')}
                emptyText={t('No models found')}
              />
            )}
          </div>
        ))}
      </div>
    </Dialog>
  )
}
