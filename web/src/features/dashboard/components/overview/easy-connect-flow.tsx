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
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  Layers3,
  Link2,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Combobox } from '@/components/ui/combobox'
import { YecaiAction, YecaiPanel } from '@/components/yecai'
import { useGuideAddress } from '@/features/guide/use-guide-address'
import { createApiKey, fetchTokenKey } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getUserGroupModels, getUserGroups, getUserModels } from '@/lib/api'
import { cn } from '@/lib/utils'

import { canReuseEasyConnectKey, explainGroupRatio } from './easy-connect'

export type EasyConnectGroup = {
  value: string
  label: string
  description: string
  ratio?: number | string
}

type ConnectionBundle = {
  apiKey: string
  baseUrl: string
  group: string
  model: string
}

type EasyConnectFlowProps = {
  existingKey?: ApiKey | null
}

function normalizeApiKey(secret: string): string {
  return secret.startsWith('sk-') ? secret : `sk-${secret}`
}

function getGroupLabel(groupKey: string, description: string): string {
  if (groupKey === 'auto') return 'Automatic route'
  if (description && description !== groupKey) return description
  if (groupKey === 'default') return 'Standard route'
  return groupKey
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) return apiKey
  return `${apiKey.slice(0, 5)}••••••••${apiKey.slice(-6)}`
}

function ConnectionValue(props: {
  icon: typeof Link2
  label: string
  value: string
}) {
  const Icon = props.icon

  return (
    <div className='dopa-easy-pass__value'>
      <span aria-hidden='true'>
        <Icon />
      </span>
      <span>
        <small>{props.label}</small>
        <strong title={props.value}>{props.value}</strong>
      </span>
    </div>
  )
}

function GroupPriceCopy(props: { group: EasyConnectGroup }) {
  const { t } = useTranslation()
  const explanation = explainGroupRatio(
    props.group.ratio,
    props.group.value === 'auto'
  )

  if (explanation.kind === 'auto') {
    return (
      <>
        <strong>{t('Automatically chooses an available route')}</strong>
        <span>{t('The final price follows the route actually used')}</span>
      </>
    )
  }
  if (explanation.kind === 'discount') {
    return (
      <>
        <strong>
          {t('About {{fold}} off · saves {{percent}}%', {
            fold: explanation.fold,
            percent: explanation.percent,
          })}
        </strong>
        <span>{t('Compared with the base billing price')}</span>
      </>
    )
  }
  if (explanation.kind === 'premium') {
    return (
      <>
        <strong>
          {t('{{multiplier}}× price · {{percent}}% above base', {
            multiplier: explanation.multiplier,
            percent: explanation.percent,
          })}
        </strong>
        <span>{t('Choose only when you need this route')}</span>
      </>
    )
  }
  if (explanation.kind === 'standard') {
    return (
      <>
        <strong>{t('Base price · no markup')}</strong>
        <span>{t('A straightforward default for everyday use')}</span>
      </>
    )
  }
  return (
    <>
      <strong>{t('Price is confirmed when used')}</strong>
      <span>{t('The exact charge will appear in your usage details')}</span>
    </>
  )
}

export function EasyConnectFlow(props: EasyConnectFlowProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const address = useGuideAddress()
  const { copyToClipboard } = useCopyToClipboard()
  const [modelChoice, setModelChoice] = useState('')
  const [groupChoice, setGroupChoice] = useState('')
  const [connection, setConnection] = useState<ConnectionBundle | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const modelInputId = useId()
  const selectionVersion = useRef(0)

  const modelsQuery = useQuery({
    queryKey: ['user-models'],
    queryFn: getUserModels,
    staleTime: 60 * 1000,
  })
  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 60 * 1000,
  })

  const models =
    modelsQuery.data?.success && !modelsQuery.isError
      ? (modelsQuery.data.data ?? [])
      : []
  const userGroups = useMemo<EasyConnectGroup[]>(
    () =>
      Object.entries(
        groupsQuery.data?.success ? (groupsQuery.data.data ?? {}) : {}
      ).map(([key, value]) => ({
        value: key,
        label: getGroupLabel(key, value.desc),
        description: value.desc || key,
        ratio: value.ratio,
      })),
    [groupsQuery.data]
  )

  // Ask the enabled-model endpoint, not pricing ratios or group names.
  // It also resolves the account's real automatic routing group membership.
  const groupModelsQueries = useQueries({
    queries: userGroups.map((group) => ({
      queryKey: ['user-group-models', group.value],
      queryFn: () => getUserGroupModels(group.value),
      staleTime: 60 * 1000,
    })),
  })

  const existingLimitedModels = (props.existingKey?.model_limits ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const defaultModel =
    existingLimitedModels?.find((model) => models.includes(model)) ??
    models[0] ??
    ''
  const selectedModel = models.includes(modelChoice)
    ? modelChoice
    : defaultModel
  const routesLoading =
    groupsQuery.isLoading || groupModelsQueries.some((query) => query.isPending)
  const routesError =
    groupsQuery.isError ||
    groupsQuery.data?.success === false ||
    groupModelsQueries.some(
      (query) => query.isError || query.data?.success === false
    )
  const groups = userGroups.filter((_, index) => {
    const query = groupModelsQueries[index]
    return (
      !groupsQuery.isError &&
      !query.isError &&
      query.data?.success &&
      query.data.data?.includes(selectedModel)
    )
  })
  const existingGroup = props.existingKey?.group || 'default'
  const defaultGroup =
    groups.find((group) => group.value === existingGroup)?.value ??
    groups.find((group) => group.value === 'default')?.value ??
    groups[0]?.value ??
    ''
  const selectedGroup = groups.some((group) => group.value === groupChoice)
    ? groupChoice
    : defaultGroup
  const selectedGroupInfo = groups.find(
    (group) => group.value === selectedGroup
  )
  const visibleConnection =
    connection?.model === selectedModel && connection.group === selectedGroup
      ? connection
      : null
  const canReuseKey =
    Boolean(selectedModel && selectedGroup) &&
    canReuseEasyConnectKey(props.existingKey, selectedModel, selectedGroup)
  const optionsLoading = modelsQuery.isLoading || routesLoading
  const modelsError = modelsQuery.isError || modelsQuery.data?.success === false
  const selectionReady =
    !optionsLoading && Boolean(selectedModel && selectedGroup)
  let passDescription = t(
    'We will create a dedicated key for this model and billing route.'
  )
  if (visibleConnection) {
    passDescription = t(
      'Copy these values into any app that supports a custom API.'
    )
  } else if (canReuseKey) {
    passDescription = t('Your existing key already matches these choices.')
  }
  let prepareActionLabel = t('Generate connection details')
  if (isPreparing) {
    prepareActionLabel = t('Preparing...')
  } else if (canReuseKey) {
    prepareActionLabel = t('Show connection details')
  }

  const handleModelChange = (nextModel: string | null) => {
    selectionVersion.current += 1
    setConnection(null)
    setModelChoice(nextModel ?? '')
  }

  const handleGroupChange = (nextGroup: string) => {
    selectionVersion.current += 1
    setConnection(null)
    setGroupChoice(nextGroup)
  }

  const handlePrepareConnection = async () => {
    if (!selectionReady || isPreparing) return

    const preparingVersion = selectionVersion.current
    setIsPreparing(true)
    try {
      // Recheck immediately before creating/revealing a key so a stale cached
      // list cannot produce a connection for a route that was just disabled.
      const supported = await queryClient.fetchQuery({
        queryKey: ['user-group-models', selectedGroup],
        queryFn: () => getUserGroupModels(selectedGroup),
        staleTime: 0,
      })
      if (preparingVersion !== selectionVersion.current) return
      if (!supported.success || !supported.data?.includes(selectedModel)) {
        setConnection(null)
        toast.error(
          t(
            'This route no longer supports the selected model. Choose another route.'
          )
        )
        return
      }

      let secret = ''
      if (canReuseKey && props.existingKey) {
        const result = await fetchTokenKey(props.existingKey.id)
        if (result.success && result.data?.key) {
          secret = normalizeApiKey(result.data.key)
        } else {
          toast.error(result.message || t('Could not read this API key'))
          return
        }
      } else {
        const result = await createApiKey({
          name: `${t('Easy setup')} · ${selectedModel}`,
          remain_quota: 0,
          expired_time: -1,
          unlimited_quota: true,
          model_limits_enabled: true,
          model_limits: selectedModel,
          allow_ips: '',
          group: selectedGroup,
          auto_groups: [],
          cross_group_retry: selectedGroup === 'auto',
        })
        if (result.success && result.data?.key) {
          secret = normalizeApiKey(result.data.key)
          await queryClient.invalidateQueries({
            queryKey: ['dashboard', 'easy-overview', 'api-keys'],
          })
        } else {
          toast.error(result.message || t('Could not create the API key'))
          return
        }
      }

      if (preparingVersion !== selectionVersion.current) return
      setConnection({
        apiKey: secret,
        baseUrl: address.baseUrl,
        group: selectedGroup,
        model: selectedModel,
      })
    } catch {
      toast.error(t('Could not prepare the connection details'))
    } finally {
      setIsPreparing(false)
    }
  }

  const handleCopyConnection = async () => {
    if (!visibleConnection) return

    await copyToClipboard(
      [
        `${t('API address')}: ${visibleConnection.baseUrl}`,
        `${t('API key')}: ${visibleConnection.apiKey}`,
        `${t('Model')}: ${visibleConnection.model}`,
      ].join('\n')
    )
  }

  return (
    <YecaiPanel
      as='section'
      className='dopa-easy-connect'
      data-testid='easy-connect-flow'
      layer='raised'
      tone='model'
    >
      <header className='dopa-easy-connect__header'>
        <div>
          <span className='dopa-section-kicker'>
            <Sparkles className='size-4' aria-hidden='true' />
            {t('Three-step quick connect')}
          </span>
          <h2>{t('Choose it. Copy it. Start using AI.')}</h2>
          <p>
            {t(
              'No tutorial detours. Pick a model and a billing route, then copy the three values into your app.'
            )}
          </p>
        </div>
        <span className='dopa-easy-connect__ready'>
          <Check aria-hidden='true' />
          {t('Manual setup stays available')}
        </span>
      </header>

      <div className='dopa-easy-connect__choices'>
        <section className='dopa-easy-connect__step' data-tone='model'>
          <div className='dopa-easy-connect__step-heading'>
            <span>1</span>
            <div>
              <h3>
                <label htmlFor={modelInputId}>{t('Choose a model')}</label>
              </h3>
              <p>{t('Which AI do you want to use?')}</p>
            </div>
          </div>
          <div className='dopa-easy-connect__model-picker'>
            <Search aria-hidden='true' />
            <Combobox
              id={modelInputId}
              options={models.map((model) => ({
                label: model,
                value: model,
              }))}
              value={selectedModel}
              onValueChange={handleModelChange}
              placeholder={
                optionsLoading ? t('Loading models') : t('Search models...')
              }
              emptyText={t('No model found.')}
              className='h-14 rounded-2xl border-0 bg-transparent pl-10 font-mono shadow-none'
            />
          </div>
          {modelsError ? (
            <div role='alert' className='dopa-easy-connect__empty'>
              <p>{t('Could not load models. Please retry.')}</p>
              <YecaiAction
                appearance='outline'
                size='sm'
                onClick={() => void modelsQuery.refetch()}
              >
                {t('Retry')}
              </YecaiAction>
            </div>
          ) : null}
          {!modelsError && !modelsQuery.isLoading && models.length === 0 ? (
            <p className='dopa-easy-connect__empty'>
              {t('No available models yet. Ask support to enable one first.')}
            </p>
          ) : null}
        </section>

        <section className='dopa-easy-connect__step' data-tone='money'>
          <div className='dopa-easy-connect__step-heading'>
            <span>2</span>
            <div>
              <h3>{t('Choose a billing route')}</h3>
              <p>{t('The same model can have different prices')}</p>
            </div>
          </div>
          <div
            aria-busy={routesLoading}
            aria-label={t('Billing route')}
            className='dopa-easy-connect__groups'
            role='radiogroup'
          >
            {groups.map((group) => {
              const selected = group.value === selectedGroup
              return (
                <button
                  key={group.value}
                  aria-checked={selected}
                  className={cn(
                    'dopa-easy-connect__group',
                    selected && 'is-selected'
                  )}
                  onClick={() => handleGroupChange(group.value)}
                  role='radio'
                  type='button'
                >
                  <span className='dopa-easy-connect__group-check'>
                    {selected ? <Check aria-hidden='true' /> : null}
                  </span>
                  <span>
                    <b>{t(group.label)}</b>
                    <small>
                      <GroupPriceCopy group={group} />
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
          {routesLoading ? (
            <p role='status' className='dopa-easy-connect__empty'>
              {t('Checking available routes...')}
            </p>
          ) : null}
          {routesError ? (
            <div role='alert' className='dopa-easy-connect__empty'>
              <p>
                {t(
                  'Some billing routes could not be checked. Retry to see all available routes.'
                )}
              </p>
              <YecaiAction
                appearance='outline'
                size='sm'
                onClick={() => {
                  void groupsQuery.refetch()
                  void queryClient.invalidateQueries({
                    queryKey: ['user-group-models'],
                  })
                }}
              >
                {t('Retry')}
              </YecaiAction>
            </div>
          ) : null}
          {!routesLoading && !routesError && groups.length === 0 ? (
            <p className='dopa-easy-connect__empty'>
              {userGroups.length === 0
                ? t('No billing route is available for this account.')
                : t(
                    'No billing route supports this model. Choose another model or contact support.'
                  )}
            </p>
          ) : null}
        </section>
      </div>

      <section
        className='dopa-easy-pass'
        data-ready={visibleConnection ? 'true' : 'false'}
      >
        <div className='dopa-easy-pass__intro'>
          <span>3</span>
          <div>
            <h3>
              {visibleConnection
                ? t('Your connection pass is ready')
                : t('Generate connection details')}
            </h3>
            <p>{passDescription}</p>
          </div>
        </div>

        {visibleConnection ? (
          <div className='dopa-easy-pass__details'>
            <ConnectionValue
              icon={Link2}
              label={t('API address')}
              value={visibleConnection.baseUrl}
            />
            <ConnectionValue
              icon={KeyRound}
              label={t('API key')}
              value={maskApiKey(visibleConnection.apiKey)}
            />
            <ConnectionValue
              icon={Layers3}
              label={t('Model')}
              value={visibleConnection.model}
            />
          </div>
        ) : (
          <div className='dopa-easy-pass__summary'>
            <span>
              <small>{t('Model')}</small>
              <strong>{selectedModel || t('Not selected')}</strong>
            </span>
            <ArrowRight aria-hidden='true' />
            <span>
              <small>{t('Billing route')}</small>
              <strong>
                {selectedGroupInfo
                  ? t(selectedGroupInfo.label)
                  : t('Not selected')}
              </strong>
            </span>
          </div>
        )}

        <div className='dopa-easy-pass__actions'>
          {visibleConnection ? (
            <YecaiAction
              className='dopa-easy-pass__primary'
              onClick={handleCopyConnection}
              size='lg'
              tone='leaf'
            >
              <Copy data-icon='inline-start' />
              {t('Copy everything')}
            </YecaiAction>
          ) : (
            <YecaiAction
              className='dopa-easy-pass__primary'
              disabled={!selectionReady || isPreparing}
              onClick={handlePrepareConnection}
              size='lg'
              tone='leaf'
            >
              {isPreparing ? (
                <LoaderCircle
                  className='animate-spin'
                  data-icon='inline-start'
                />
              ) : (
                <KeyRound data-icon='inline-start' />
              )}
              {prepareActionLabel}
            </YecaiAction>
          )}
          <Link to='/guide' className='dopa-easy-pass__help'>
            {t('Need help with a specific app?')}
            <ArrowRight aria-hidden='true' />
          </Link>
        </div>
      </section>
    </YecaiPanel>
  )
}
