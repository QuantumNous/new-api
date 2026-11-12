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
  ArrowLeft,
  Boxes,
  Globe,
  ListChecks,
  Pencil,
  Plug,
  Users,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import type { TaskPluginOption } from '@/features/channels/api'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveLocalizedText } from '@/lib/localized-text'
import { resolveModelProvider } from '@/lib/model-provider'

import { localizedPluginName } from '../lib/plugin-name'
import {
  fromRequestPluginConfigDraft,
  requestPluginConfigDefaults,
  toRequestPluginConfigDraft,
} from '../lib/request-plugins'
import type { RequestPluginInstance } from '../types'
import { RequestPluginConfigForm } from './request-plugin-config-form'
import { RequestPluginPicker } from './request-plugin-picker'
import {
  RequestPluginIconTile,
  RequestPluginRunLine,
} from './request-plugin-summary'
import { RequestPluginTryPanel } from './request-plugin-try-panel'

type RequestPluginInstanceEditorProps = {
  open: boolean
  /** Null adds a new instance, starting with the choice of plugin. */
  instance: RequestPluginInstance | null
  plugins: TaskPluginOption[]
  /** How many instances each plugin already has, by plugin key. */
  instanceCounts: Record<string, number>
  groups: string[]
  /** Model names to pick from; other names can be typed in. */
  models: string[]
  saving: boolean
  /** The gateway's validation message for the last save. */
  error?: string
  onOpenChange: (open: boolean) => void
  onSave: (instance: RequestPluginInstance) => void
}

/** Which requests an instance processes besides the channels that add it. */
type InstanceScope = 'all' | 'groups' | 'channels'

const SCOPES = [
  {
    value: 'all',
    icon: Globe,
    title: 'All requests',
    hint: 'Whatever the group or channel',
  },
  {
    value: 'groups',
    icon: Users,
    title: 'Chosen groups',
    hint: 'Only requests from the groups you pick',
  },
  {
    value: 'channels',
    icon: Plug,
    title: 'Channels that add it',
    hint: 'Runs once a channel adds it in its settings',
  },
] as const

/** Whether an instance runs for every model or only for the ones picked. */
type ModelScope = 'all' | 'chosen'

const MODEL_SCOPES = [
  {
    value: 'all',
    icon: Boxes,
    title: 'All models',
    hint: 'Whatever model the request asks for',
  },
  {
    value: 'chosen',
    icon: ListChecks,
    title: 'Chosen models',
    hint: 'Only requests for the models you pick',
  },
] as const

/** The scope cards of the editor: an icon, a title and a hint each. */
function ScopeCards<Value extends string>(props: {
  id: string
  labelledBy?: string
  label?: string
  value: Value
  options: readonly {
    value: Value
    icon: typeof Globe
    title: string
    hint: string
  }[]
  disabled: boolean
  className: string
  onValueChange: (value: Value) => void
}) {
  const { t } = useTranslation()
  return (
    <RadioGroup
      aria-labelledby={props.labelledBy}
      aria-label={props.label}
      value={props.value}
      disabled={props.disabled}
      className={props.className}
      onValueChange={(value) => props.onValueChange(value as Value)}
    >
      {props.options.map((item) => (
        <FieldLabel key={item.value} htmlFor={`${props.id}-${item.value}`}>
          <Field orientation='horizontal' className='items-start'>
            <div className='min-w-0 flex-1 space-y-1'>
              <span className='flex items-center gap-1.5 text-sm font-medium'>
                <item.icon
                  aria-hidden='true'
                  className='text-muted-foreground size-4'
                />
                {t(item.title)}
              </span>
              <FieldDescription className='text-xs'>
                {t(item.hint)}
              </FieldDescription>
            </div>
            <RadioGroupItem
              id={`${props.id}-${item.value}`}
              value={item.value}
            />
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  )
}

export function RequestPluginInstanceEditor(
  props: RequestPluginInstanceEditorProps
) {
  // Each opening starts afresh, so edits left in a closed editor are gone.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setSession((current) => current + 1)
  }
  return <InstanceEditorDialog key={session} {...props} />
}

function InstanceEditorDialog(props: RequestPluginInstanceEditorProps) {
  const { t, i18n } = useTranslation()
  const formId = useId()
  const [pluginKey, setPluginKey] = useState(props.instance?.plugin ?? '')
  const [name, setName] = useState(props.instance?.name ?? '')
  const [renaming, setRenaming] = useState(false)
  const [enabled, setEnabled] = useState(props.instance?.enabled ?? true)
  const [scope, setScope] = useState<InstanceScope>(() => {
    if (!props.instance || props.instance.global) return 'all'
    return props.instance.groups.length > 0 ? 'groups' : 'channels'
  })
  const [groups, setGroups] = useState(props.instance?.groups ?? [])
  const [models, setModels] = useState(props.instance?.models ?? [])
  const [modelScope, setModelScope] = useState<ModelScope>(
    models.length > 0 ? 'chosen' : 'all'
  )
  const plugin = props.plugins.find((item) => item.key === pluginKey)
  const [draft, setDraft] = useState(() =>
    toRequestPluginConfigDraft(
      plugin?.configSchema,
      props.instance?.config ??
        requestPluginConfigDefaults(plugin?.configSchema)
    )
  )
  // Problems show as the admin edits; the rest show once a save is tried.
  const [showAllErrors, setShowAllErrors] = useState(false)
  // An instance whose plugin is gone keeps its saved settings untouched.
  const pluginMissing = Boolean(pluginKey) && !plugin
  const parsed = useMemo(
    () => fromRequestPluginConfigDraft(plugin?.configSchema, draft),
    [plugin?.configSchema, draft]
  )
  const pluginName = plugin
    ? localizedPluginName(plugin, i18n.language)
    : pluginKey
  const groupsMissing = scope === 'groups' && groups.length === 0
  const modelsMissing = modelScope === 'chosen' && models.length === 0

  const pick = (key: string) => {
    const next = props.plugins.find((item) => item.key === key)
    setPluginKey(key)
    setName(next ? localizedPluginName(next, i18n.language) : key)
    setDraft(
      toRequestPluginConfigDraft(
        next?.configSchema,
        requestPluginConfigDefaults(next?.configSchema)
      )
    )
    setShowAllErrors(false)
  }

  const finishRename = () => {
    setRenaming(false)
    if (!name.trim()) setName(pluginName)
  }

  const buildInstance = (
    config: Record<string, unknown>
  ): RequestPluginInstance => ({
    id: props.instance?.id ?? '',
    name: name.trim() || pluginName,
    plugin: pluginKey,
    enabled,
    global: scope === 'all',
    groups: scope === 'groups' ? groups : [],
    models: modelScope === 'chosen' ? models : [],
    config,
  })

  const submit = () => {
    let config = props.instance?.config ?? {}
    if (!pluginMissing) {
      if (Object.keys(parsed.errors).length > 0) {
        setShowAllErrors(true)
        return
      }
      config = parsed.config
    }
    if (groupsMissing || modelsMissing) {
      setShowAllErrors(true)
      return
    }
    props.onSave(buildInstance(config))
  }

  if (!pluginKey) {
    return (
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Add request processing')}
        description={t(
          'Pick a plugin to start. You can change its settings at any time.'
        )}
        contentClassName='sm:max-w-3xl'
      >
        <RequestPluginPicker
          plugins={props.plugins}
          instanceCounts={props.instanceCounts}
          onPick={pick}
        />
      </Dialog>
    )
  }

  const title = (
    <span className='flex items-center gap-3.5'>
      <RequestPluginIconTile
        plugin={plugin ?? { key: pluginKey, name: pluginKey }}
        size='lg'
      />
      <span className='flex min-w-0 flex-1 flex-col gap-1'>
        <span className='flex min-w-0 items-center gap-1.5'>
          {renaming ? (
            <Input
              autoFocus
              aria-label={t('Name')}
              value={name}
              maxLength={64}
              className='h-8 max-w-sm text-base font-semibold'
              onChange={(event) => setName(event.target.value)}
              onBlur={finishRename}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== 'Escape') return
                // Ends the rename without saving or closing the editor.
                event.preventDefault()
                event.stopPropagation()
                finishRename()
              }}
            />
          ) : (
            <>
              <span className='truncate text-lg font-semibold'>
                {name || pluginName}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                className='text-muted-foreground'
                aria-label={t('Rename')}
                disabled={props.saving}
                onClick={() => setRenaming(true)}
              >
                <Pencil aria-hidden='true' />
              </Button>
            </>
          )}
        </span>
        {plugin && <RequestPluginRunLine plugin={plugin} />}
      </span>
    </span>
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!props.saving) props.onOpenChange(open)
      }}
      title={title}
      description={
        plugin
          ? resolveLocalizedText(plugin.description, i18n.language)
          : undefined
      }
      contentClassName={plugin ? 'sm:max-w-5xl' : 'sm:max-w-2xl'}
      footer={
        <div className='flex w-full flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            {!props.instance && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={props.saving}
                onClick={() => setPluginKey('')}
              >
                <ArrowLeft aria-hidden='true' />
                {t('Other plugins')}
              </Button>
            )}
            <label className='flex items-center gap-2.5 text-sm'>
              <Switch
                checked={enabled}
                disabled={props.saving}
                onCheckedChange={setEnabled}
              />
              {t('Enabled')}
            </label>
          </div>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              disabled={props.saving}
              onClick={() => props.onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit' form={formId} disabled={props.saving}>
              {props.saving && <Spinner aria-hidden='true' />}
              {props.saving ? t('Saving...') : t('Save')}
            </Button>
          </div>
        </div>
      }
    >
      <div
        className={
          plugin ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]' : 'space-y-7'
        }
      >
        <form
          id={formId}
          className='min-w-0 space-y-7'
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <section className='space-y-2.5'>
            <h3 className='text-muted-foreground text-xs font-medium'>
              {t('Settings')}
            </h3>
            {plugin ? (
              <RequestPluginConfigForm
                pluginKey={pluginKey}
                schema={plugin.configSchema}
                draft={draft}
                errors={parsed.errors}
                showAllErrors={showAllErrors}
                disabled={props.saving}
                onChange={setDraft}
              />
            ) : (
              <p className='text-muted-foreground rounded-xl border p-4 text-sm'>
                {t(
                  'This plugin is disabled or not installed, so the instance does not run. It keeps its settings.'
                )}
              </p>
            )}
          </section>
          <section className='space-y-2.5'>
            <h3
              id={`${formId}-scope`}
              className='text-muted-foreground text-xs font-medium'
            >
              {t('Where it runs')}
            </h3>
            <ScopeCards<InstanceScope>
              id={`${formId}-scope`}
              labelledBy={`${formId}-scope`}
              value={scope}
              options={SCOPES}
              disabled={props.saving}
              className='grid gap-2 sm:grid-cols-3'
              onValueChange={setScope}
            />
            {scope === 'groups' && (
              <MultiSelect
                id={`${formId}-groups`}
                options={props.groups.map((group) => ({
                  value: group,
                  label: group,
                }))}
                selected={groups}
                onChange={setGroups}
                disabled={props.saving}
                placeholder={t('Select groups')}
              />
            )}
            {showAllErrors && groupsMissing && (
              <FieldError>{t('Pick at least one group')}</FieldError>
            )}
            <ScopeCards<ModelScope>
              id={`${formId}-models`}
              label={t('Models')}
              value={modelScope}
              options={MODEL_SCOPES}
              disabled={props.saving}
              className='grid gap-2 pt-1 sm:grid-cols-2'
              onValueChange={setModelScope}
            />
            {modelScope === 'chosen' && (
              <MultiSelect
                id={`${formId}-model-list`}
                options={[...new Set([...props.models, ...models])].map(
                  (model) => {
                    const provider = resolveModelProvider(model)
                    return {
                      value: model,
                      label: model,
                      icon: provider
                        ? getLobeIcon(provider.icon, 16)
                        : undefined,
                    }
                  }
                )}
                selected={models}
                onChange={setModels}
                disabled={props.saving}
                placeholder={t('Select models or add custom ones')}
                allowCreate
                createLabel='Add custom model "{{value}}"'
                maxVisibleChips={8}
              />
            )}
            {showAllErrors && modelsMissing && (
              <FieldError>{t('Pick at least one model')}</FieldError>
            )}
          </section>
          {props.error && (
            <FieldError className='whitespace-pre-wrap'>
              {props.error}
            </FieldError>
          )}
        </form>
        {plugin && (
          <RequestPluginTryPanel
            plugin={plugin}
            instance={
              Object.keys(parsed.errors).length === 0
                ? buildInstance(parsed.config)
                : null
            }
          />
        )}
      </div>
    </Dialog>
  )
}
