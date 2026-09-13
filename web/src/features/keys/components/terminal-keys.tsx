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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { Copy, KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { TerminalPage } from '@/components/layout/components/terminal-page'
import { buildModelCatalog } from '@/features/home/lib/catalog'
import { formatPerMillionTokens } from '@/features/home/lib/pricing-savings'
import { usePricingData } from '@/features/pricing/hooks'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getUserGroups } from '@/lib/api'
import { cn } from '@/lib/utils'

import {
  revokeAllApiKeys,
  createApiKey,
  deleteApiKey,
  getFullApiKey,
  getApiKeys,
} from '../api'
import { getApiKeyFormDefaultValues, transformFormDataToPayload } from '../lib'
import {
  describeGroupDiscount,
  parseGroupRatio,
  quoteGroupUsage,
  type GroupDiscount,
} from '../lib/group-quote'

function discountLabel(t: TFunction, discount: GroupDiscount) {
  if (discount.kind === 'original') return t('List price')
  if (discount.kind === 'markup') {
    return t('{{times}}× list price', { times: discount.times })
  }
  return t('{{zhe}} off', { zhe: discount.zhe })
}

type UserGroup = {
  value: string
  label: string
  desc: string
  ratio: number
}

export function TerminalKeys() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const clipboard = useCopyToClipboard({ notify: true })
  const [name, setName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [modelName, setModelName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<number | 'all' | null>(null)
  const { models, priceRate } = usePricingData()
  const catalog = useMemo(
    () => buildModelCatalog(models || [], priceRate),
    [models, priceRate]
  )
  const selectedModel =
    catalog.find((model) => model.modelName === modelName) ?? catalog[0] ?? null

  const selectedPricingModel = models.find(
    (model) => model.model_name === selectedModel?.modelName
  )

  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
  })
  const groups = useMemo<UserGroup[]>(() => {
    const entries = Object.entries(groupsQuery.data?.data || {})
    return entries
      .map(([value, info]) => ({
        value,
        label: value,
        desc: String(info.desc || value),
        ratio: parseGroupRatio(info.ratio),
      }))
      .filter(
        (group) =>
          group.value !== 'auto' &&
          (!selectedPricingModel ||
            selectedPricingModel.enable_groups?.includes(group.value))
      )
      .sort((a, b) => a.ratio - b.ratio)
  }, [groupsQuery.data, selectedPricingModel])
  const selectedGroup =
    groups.find((group) => group.value === groupName) ?? groups[0] ?? null

  const keysQuery = useQuery({
    queryKey: ['terminal', 'keys', page],
    queryFn: async () => {
      const result = await getApiKeys({ p: page, size: 100 })
      if (!result.success || !result.data) {
        throw new Error(result.message || t('Failed to load API keys'))
      }
      return result.data
    },
  })

  const refreshKeys = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['terminal'] }),
      queryClient.invalidateQueries({ queryKey: ['keys'] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      const payload = transformFormDataToPayload({
        ...getApiKeyFormDefaultValues(false),
        name: name.trim() || t('Daily key'),
        group: selectedGroup?.value || '',
        auto_groups_mode: 'inherit',
        auto_groups: [],
        cross_group_retry: false,
      })
      const created = await createApiKey(payload)
      if (!created.success) {
        throw new Error(created.message || t('Failed to create API key'))
      }
      return created.data
    },
    onSuccess: async (created) => {
      setCreatedKey(null)
      setPage(1)
      await refreshKeys()
      toast.success(t('API key created'))
      // Older servers may omit data. Creation still succeeded; the refreshed
      // list supplies an explicit copy action instead of creating again.
      if (created?.id) {
        try {
          setCreatedKey(await getFullApiKey(created.id))
        } catch (error) {
          setActionError(
            error instanceof Error
              ? t(error.message)
              : t('Failed to load API keys')
          )
        }
      }
    },
    onError: (error: Error) => setActionError(t(error.message)),
  })

  const copyMutation = useMutation({
    mutationFn: async (id: number) => {
      setActionError(null)
      const value = await getFullApiKey(id)
      await clipboard.copyToClipboard(value)
    },
    onError: (error: Error) => setActionError(t(error.message)),
  })

  const revokeOne = useMutation({
    mutationFn: async (id: number) => {
      setActionError(null)
      const result = await deleteApiKey(id)
      if (!result.success) {
        throw new Error(result.message || t('Failed to delete API key'))
      }
    },
    onSuccess: () => setRevokeTarget(null),
    onError: (error: Error) => {
      setActionError(t(error.message))
      setRevokeTarget(null)
    },
    onSettled: async () => {
      setPage(1)
      setCreatedKey(null)
      await refreshKeys()
    },
  })

  const revokeAll = useMutation({
    mutationFn: async () => {
      setActionError(null)
      await revokeAllApiKeys()
    },
    onSuccess: () => {
      setRevokeTarget(null)
      setCreatedKey(null)
      setPage(1)
      toast.success(t('All keys revoked'))
    },
    onError: (error: Error) => {
      setActionError(t(error.message))
      setRevokeTarget(null)
    },
    onSettled: async () => {
      setPage(1)
      setCreatedKey(null)
      await refreshKeys()
    },
  })

  const keys = keysQuery.data?.items ?? []
  const pageCount = Math.max(1, Math.ceil((keysQuery.data?.total ?? 0) / 100))
  let revokeCount = 0
  if (revokeTarget === 'all') {
    revokeCount = keysQuery.data?.total ?? 0
  } else if (revokeTarget !== null) {
    revokeCount = 1
  }
  const revoking = revokeOne.isPending || revokeAll.isPending

  return (
    <TerminalPage
      title={t('API keys')}
      description={t(
        'Pick a model to see the price, then pick a group. The key bills at that group rate.'
      )}
      actions={
        (keysQuery.data?.total ?? 0) > 0 ? (
          <button
            type='button'
            className='ci-button ci-button--danger-quiet ci-button--size-xs'
            onClick={() => setRevokeTarget('all')}
            disabled={revoking}
          >
            {t('Revoke all active keys')}
          </button>
        ) : null
      }
    >
      {actionError || keysQuery.error ? (
        <p role='alert' className='text-destructive'>
          {actionError || keysQuery.error?.message}
        </p>
      ) : null}
      <section className='ci-panel'>
        <header className='ci-panelHeader'>
          <h2>{t('1. Pick a model')}</h2>
          <p>
            {t(
              'This is only for quoting. The key can still call other models in the same group.'
            )}
          </p>
        </header>
        <div className='ci-panelBody'>
          <label className='ci-field'>
            <span>{t('Model')}</span>
            <select
              className='ci-input ci-input--sm'
              value={selectedModel?.modelName ?? ''}
              onChange={(event) => setModelName(event.target.value)}
            >
              {catalog.length === 0 ? (
                <option value=''>{t('No models yet')}</option>
              ) : (
                catalog.map((model) => (
                  <option key={model.modelName} value={model.modelName}>
                    {model.modelName} · {model.vendorName}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </section>

      <section className='ci-panel'>
        <header className='ci-panelHeader'>
          <h2>{t('2. Pick a billing group')}</h2>
          <p>
            {t(
              'Groups are price lanes. The discount applies to this key’s requests.'
            )}
          </p>
        </header>
        <div className='ci-panelBody'>
          {selectedModel && !selectedModel.quote ? (
            <Link
              to='/pricing/$modelId'
              params={{ modelId: selectedModel.modelName }}
            >
              {t('View pricing details')}
            </Link>
          ) : null}
          {groups.length === 0 ? (
            <p className='ci-formNote'>
              {t('No billing groups are available for this model.')}
            </p>
          ) : (
            <div className='ci-quoteGrid'>
              {groups.map((group) => {
                const groupQuote = selectedModel?.quote
                  ? quoteGroupUsage(selectedModel.quote, group.ratio)
                  : null
                const discount = describeGroupDiscount(group.ratio)
                const selected = selectedGroup?.value === group.value
                return (
                  <button
                    key={group.value}
                    type='button'
                    className={cn('ci-quoteCard', selected && 'is-selected')}
                    onClick={() => setGroupName(group.value)}
                    aria-pressed={selected}
                  >
                    <strong>{group.desc || group.label}</strong>
                    <span className='ci-quoteLane'>
                      {group.label}
                      {' · '}
                      {discountLabel(t, discount)}
                    </span>
                    {groupQuote ? (
                      <dl>
                        <div>
                          <dt>{t('Input / million tokens')}</dt>
                          <dd>{formatPerMillionTokens(groupQuote.input)}</dd>
                        </div>
                        <div>
                          <dt>{t('Output / million tokens')}</dt>
                          <dd>{formatPerMillionTokens(groupQuote.output)}</dd>
                        </div>
                        <div>
                          <dt>{t('95% cache hit on input')}</dt>
                          <dd>
                            {groupQuote.cacheHitInput == null
                              ? t('No cache price for this model')
                              : formatPerMillionTokens(
                                  groupQuote.cacheHitInput
                                )}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('Versus list price')}</dt>
                          <dd>
                            {groupQuote.savingsPercent > 0
                              ? t('Save about {{percent}}%', {
                                  percent: groupQuote.savingsPercent,
                                })
                              : t('No extra discount')}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className='ci-panel'>
        <header className='ci-panelHeader'>
          <h2>{t('3. Create the key')}</h2>
          <p>{t('Give it a name you will recognize later.')}</p>
        </header>
        <div className='ci-panelBody'>
          <label className='ci-field'>
            <span>{t('Key name')}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className='ci-input ci-input--sm'
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('Daily key')}
              />
              <button
                type='button'
                className='ci-button ci-button--size-xs'
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  groupsQuery.isLoading ||
                  !selectedGroup
                }
              >
                <KeyRound size={14} />
                {t('Create key')}
              </button>
            </div>
          </label>
        </div>
      </section>

      {createdKey ? (
        <div className='ci-createdKey'>
          <code>{createdKey}</code>
          <button
            type='button'
            className='ci-button ci-button--ghost ci-button--size-icon-xs'
            onClick={() => {
              void clipboard.copyToClipboard(createdKey)
            }}
          >
            <Copy size={14} />
          </button>
        </div>
      ) : null}

      <section className='ci-panel'>
        {keys.length === 0 ? (
          <div className='ci-empty'>
            <span className='ci-emptyIcon'>
              <KeyRound size={18} />
            </span>
            <h3>{t('No API keys yet')}</h3>
            <p>
              {t(
                'Create a key above, then fill the base URL and this key into your tool.'
              )}
            </p>
          </div>
        ) : (
          <table className='ci-catalogTable'>
            <thead>
              <tr>
                <th>{t('Name')}</th>
                <th>{t('Key')}</th>
                <th>{t('Group')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    <code>{key.key}</code>
                  </td>
                  <td>{key.group || t('Default')}</td>
                  <td>
                    <button
                      type='button'
                      className='ci-button ci-button--ghost ci-button--size-xs'
                      disabled={copyMutation.isPending}
                      onClick={() => copyMutation.mutate(key.id)}
                    >
                      <Copy size={14} /> {t('Copy')}
                    </button>
                    <button
                      type='button'
                      className='ci-button ci-button--ghost ci-button--size-xs'
                      disabled={revoking}
                      onClick={() => setRevokeTarget(key.id)}
                    >
                      {t('Revoke')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {pageCount > 1 ? (
        <div className='ci-tablePager'>
          <button
            className='ci-button ci-button--ghost ci-button--size-xs'
            type='button'
            disabled={page <= 1 || keysQuery.isFetching}
            onClick={() => setPage(page - 1)}
          >
            {t('Previous')}
          </button>
          <span>
            {page} / {pageCount}
          </span>
          <button
            className='ci-button ci-button--ghost ci-button--size-xs'
            type='button'
            disabled={page >= pageCount || keysQuery.isFetching}
            onClick={() => setPage(page + 1)}
          >
            {t('Next')}
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        destructive
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeTarget(null)
        }}
        title={t('Delete {{count}} API key(s)?', { count: revokeCount })}
        desc={
          <>
            {t('You are about to delete {{count}} API key(s).', {
              count: revokeCount,
            })}{' '}
            <br />
            {t('This action cannot be undone.')}
          </>
        }
        confirmText={t('Delete')}
        isLoading={revoking}
        handleConfirm={() => {
          if (revokeTarget === 'all') {
            revokeAll.mutate()
          } else if (revokeTarget !== null) {
            revokeOne.mutate(revokeTarget)
          }
        }}
      />
    </TerminalPage>
  )
}
