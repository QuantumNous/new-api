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
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StaticDataTable } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { hasAnyPermission, PERMISSION } from '@/lib/rbac'
import { useAuthStore } from '@/stores/auth-store'

import {
  createModelKey,
  deleteMarketplaceModel,
  deleteModelKey,
  getMarketplaceModel,
  getMarketplaceModels,
  getPermissions,
  getProviders,
  getProviderSettlement,
  getProviderWallet,
  getRoles,
  getUserRoles,
  saveMarketplaceModel,
  saveModelApiConfig,
  saveModelPricing,
  saveProvider,
  saveProviderSettlement,
  saveProviderWallet,
  updateModelKey,
  updateUserRoles,
} from './api'
import type {
  MarketplaceModel,
  MarketplaceModelDetail,
  ModelApiConfig,
  ModelPricing,
  ProviderProfile,
  ProviderSettlementConfig,
  ProviderWallet,
  Role,
} from './types'

type SecondaryDevelopmentProps = {
  section: 'marketplace' | 'provider' | 'rbac' | 'finance'
}

const modelDefaults: Partial<MarketplaceModel> = {
  name: '',
  description: '',
  model_type: 'text',
  tags: '',
  context_length: 0,
  billing_type: 'token',
  status: 'draft',
  recommended: false,
  sort_order: 0,
}

export function SecondaryDevelopment(props: SecondaryDevelopmentProps) {
  if (props.section === 'rbac') return <RBACConsole />
  if (props.section === 'finance') return <FinanceConsole />
  if (props.section === 'provider') return <ProviderConsole />
  return <MarketplaceConsole />
}

function MarketplaceConsole() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const canManage = hasAnyPermission(user, [
    PERMISSION.MARKETPLACE_MANAGE,
    PERMISSION.MARKETPLACE_SELF_MANAGE,
  ])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<MarketplaceModel>>(modelDefaults)
  const queryClient = useQueryClient()
  const modelsQuery = useQuery({
    queryKey: ['secondary-marketplace-models'],
    queryFn: () => getMarketplaceModels({ page_size: 50 }),
  })
  const detailQuery = useQuery({
    queryKey: ['secondary-marketplace-model', selectedId],
    queryFn: () => getMarketplaceModel(selectedId || 0),
    enabled: Boolean(selectedId),
  })
  const saveMutation = useMutation({
    mutationFn: saveMarketplaceModel,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        setDraft(modelDefaults)
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-models'],
        })
      }
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteMarketplaceModel,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Deleted successfully'))
        setSelectedId(null)
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-models'],
        })
      }
    },
  })
  const items = modelsQuery.data?.data?.items ?? []

  const handleEdit = (item: MarketplaceModel) => {
    setSelectedId(item.id)
    setDraft(item)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate({
      ...draft,
      context_length: Number(draft.context_length || 0),
      sort_order: Number(draft.sort_order || 0),
    })
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Model Marketplace')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          onClick={() => modelsQuery.refetch()}
          disabled={modelsQuery.isFetching}
        >
          <RefreshCw data-icon='inline-start' />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]'>
          <Card className='min-h-0'>
            <CardHeader>
              <CardTitle>{t('Marketplace Models')}</CardTitle>
              <CardDescription>
                {t('Approved models can later be listed for users.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaticDataTable
                data={items}
                emptyContent={t('No marketplace models found')}
                columns={[
                  { id: 'name', header: t('Model'), cell: (row) => row.name },
                  {
                    id: 'provider',
                    header: t('Provider'),
                    cell: (row) => row.provider?.name || `#${row.provider_id}`,
                  },
                  {
                    id: 'status',
                    header: t('Status'),
                    cell: (row) => (
                      <Badge variant='secondary'>{row.status}</Badge>
                    ),
                  },
                  {
                    id: 'actions',
                    header: t('Actions'),
                    cell: (row) => (
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => handleEdit(row)}
                        >
                          {t('Edit')}
                        </Button>
                        {canManage && (
                          <Button
                            size='sm'
                            variant='destructive'
                            onClick={() => deleteMutation.mutate(row.id)}
                          >
                            <Trash2 data-icon='inline-start' />
                            {t('Delete')}
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          <div className='flex min-h-0 flex-col gap-4'>
            {canManage && (
              <MarketplaceModelForm
                draft={draft}
                onChange={setDraft}
                onSubmit={handleSubmit}
                isSubmitting={saveMutation.isPending}
              />
            )}
            {detailQuery.data?.success && detailQuery.data.data && (
              <ModelFoundationPanel
                detail={detailQuery.data.data}
                canManage={canManage}
              />
            )}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function MarketplaceModelForm(props: {
  draft: Partial<MarketplaceModel>
  onChange: (draft: Partial<MarketplaceModel>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
}) {
  const { t } = useTranslation()
  const update = (patch: Partial<MarketplaceModel>) =>
    props.onChange({ ...props.draft, ...patch })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {props.draft.id ? t('Update Model') : t('Create Model')}
        </CardTitle>
        <CardDescription>
          {t('Maintain the phase one model foundation data.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={props.onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Model Name')}</FieldLabel>
              <Input
                value={props.draft.name || ''}
                onChange={(event) => update({ name: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{t('Description')}</FieldLabel>
              <Textarea
                value={props.draft.description || ''}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
              />
            </Field>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <Field>
                <FieldLabel>{t('Model Type')}</FieldLabel>
                <Input
                  value={props.draft.model_type || ''}
                  onChange={(event) =>
                    update({ model_type: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{t('Status')}</FieldLabel>
                <Input
                  value={props.draft.status || ''}
                  onChange={(event) => update({ status: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>{t('Context Length')}</FieldLabel>
                <Input
                  type='number'
                  value={props.draft.context_length || 0}
                  onChange={(event) =>
                    update({ context_length: Number(event.target.value) })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{t('Billing Type')}</FieldLabel>
                <Input
                  value={props.draft.billing_type || ''}
                  onChange={(event) =>
                    update({ billing_type: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>{t('Capability Tags')}</FieldLabel>
              <Input
                value={props.draft.tags || ''}
                onChange={(event) => update({ tags: event.target.value })}
              />
            </Field>
            <Button type='submit' disabled={props.isSubmitting}>
              <Save data-icon='inline-start' />
              {t('Save')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function InfoLine(props: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='text-foreground font-medium'>
        {props.value || props.value === 0 ? props.value : '-'}
      </div>
    </div>
  )
}

function ModelFoundationPanel(props: {
  detail: MarketplaceModelDetail
  canManage: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [apiConfig, setApiConfig] = useState<Partial<ModelApiConfig>>({})
  const [keyDraft, setKeyDraft] = useState({
    name: '',
    key: '',
    status: 'active',
  })
  const [pricing, setPricing] = useState<Partial<ModelPricing>>({})
  const saveApiMutation = useMutation({
    mutationFn: () => saveModelApiConfig(props.detail.id, apiConfig),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-model', props.detail.id],
        })
      }
    },
  })
  const createKeyMutation = useMutation({
    mutationFn: () => createModelKey(props.detail.id, keyDraft),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        setKeyDraft({ name: '', key: '', status: 'active' })
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-model', props.detail.id],
        })
      }
    },
  })
  const updateKeyMutation = useMutation({
    mutationFn: (payload: { id: number; status: string }) =>
      updateModelKey(props.detail.id, payload.id, { status: payload.status }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-model', props.detail.id],
        })
      }
    },
  })
  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: number) => deleteModelKey(props.detail.id, keyId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Deleted successfully'))
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-model', props.detail.id],
        })
      }
    },
  })
  const savePricingMutation = useMutation({
    mutationFn: () => saveModelPricing(props.detail.id, pricing),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({
          queryKey: ['secondary-marketplace-model', props.detail.id],
        })
      }
    },
  })
  const firstConfig = props.detail.api_configs[0]
  const firstPricing = props.detail.pricing[0]

  useEffect(() => {
    setApiConfig(
      firstConfig || {
        protocol: 'openai',
        auth_type: 'bearer',
        status: 'active',
      }
    )
    setPricing(
      firstPricing || {
        currency: 'USD',
        pricing_type: 'token',
        status: 'draft',
      }
    )
  }, [firstConfig, firstPricing])

  if (!props.canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('Model Detail')}</CardTitle>
          <CardDescription>
            {t('Public pricing and capability information for this model.')}
          </CardDescription>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-3 text-sm md:grid-cols-2'>
          <InfoLine label={t('Model Type')} value={props.detail.model_type} />
          <InfoLine
            label={t('Context Length')}
            value={props.detail.context_length}
          />
          <InfoLine
            label={t('Billing Type')}
            value={props.detail.billing_type}
          />
          <InfoLine label={t('Capability Tags')} value={props.detail.tags} />
          {props.detail.pricing.map((item) => (
            <div
              key={item.id}
              className='border-border/70 rounded-md border p-3 md:col-span-2'
            >
              <div className='text-muted-foreground mb-2 text-xs'>
                {t('Pricing')}
              </div>
              <div className='grid grid-cols-3 gap-3'>
                <InfoLine label={t('Input Price')} value={item.input_price} />
                <InfoLine label={t('Output Price')} value={item.output_price} />
                <InfoLine label={t('Call Price')} value={item.call_price} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('API Configuration')}</CardTitle>
          <CardDescription>
            {t('Configure upstream access without exposing secrets.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('API URL')}</FieldLabel>
              <Input
                value={apiConfig.base_url || ''}
                onChange={(event) =>
                  setApiConfig({ ...apiConfig, base_url: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel>{t('Model Mapping')}</FieldLabel>
              <Textarea
                value={apiConfig.model_mapping || ''}
                onChange={(event) =>
                  setApiConfig({
                    ...apiConfig,
                    model_mapping: event.target.value,
                  })
                }
              />
            </Field>
            <Button
              onClick={() => saveApiMutation.mutate()}
              disabled={saveApiMutation.isPending}
            >
              <Save data-icon='inline-start' />
              {t('Save')}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('Model Keys')}</CardTitle>
          <CardDescription>
            {t('Only masked keys are shown after saving.')}
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <StaticDataTable
            data={props.detail.keys}
            emptyContent={t('No keys configured')}
            columns={[
              { id: 'name', header: t('Name'), cell: (row) => row.name },
              { id: 'mask', header: t('Key'), cell: (row) => row.key_mask },
              { id: 'status', header: t('Status'), cell: (row) => row.status },
              {
                id: 'actions',
                header: t('Actions'),
                cell: (row) => (
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        updateKeyMutation.mutate({
                          id: row.id,
                          status:
                            row.status === 'active' ? 'disabled' : 'active',
                        })
                      }
                    >
                      {row.status === 'active' ? t('Disable') : t('Enable')}
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => deleteKeyMutation.mutate(row.id)}
                    >
                      <Trash2 data-icon='inline-start' />
                      {t('Delete')}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          <div className='grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.5fr_auto]'>
            <Input
              placeholder={t('Name')}
              value={keyDraft.name}
              onChange={(event) =>
                setKeyDraft({ ...keyDraft, name: event.target.value })
              }
            />
            <Input
              placeholder={t('API Key')}
              value={keyDraft.key}
              onChange={(event) =>
                setKeyDraft({ ...keyDraft, key: event.target.value })
              }
            />
            <Button
              onClick={() => createKeyMutation.mutate()}
              disabled={createKeyMutation.isPending}
            >
              <Plus data-icon='inline-start' />
              {t('Add')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('Pricing')}</CardTitle>
          <CardDescription>
            {t('Prices stay in draft until a later review flow approves them.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <Field>
                <FieldLabel>{t('Input Price')}</FieldLabel>
                <Input
                  type='number'
                  value={pricing.input_price || 0}
                  onChange={(event) =>
                    setPricing({
                      ...pricing,
                      input_price: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{t('Output Price')}</FieldLabel>
                <Input
                  type='number'
                  value={pricing.output_price || 0}
                  onChange={(event) =>
                    setPricing({
                      ...pricing,
                      output_price: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{t('Call Price')}</FieldLabel>
                <Input
                  type='number'
                  value={pricing.call_price || 0}
                  onChange={(event) =>
                    setPricing({
                      ...pricing,
                      call_price: Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Button
              onClick={() => savePricingMutation.mutate()}
              disabled={savePricingMutation.isPending}
            >
              <Save data-icon='inline-start' />
              {t('Save')}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  )
}

function ProviderConsole() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const providersQuery = useQuery({
    queryKey: ['secondary-providers'],
    queryFn: () => getProviders({ page_size: 50 }),
  })
  const [draft, setDraft] = useState<Partial<ProviderProfile>>({})
  const saveMutation = useMutation({
    mutationFn: saveProvider,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({ queryKey: ['secondary-providers'] })
      }
    },
  })
  const providers = providersQuery.data?.data?.items ?? []

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Provider Console')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Provider Profiles')}</CardTitle>
              <CardDescription>
                {t(
                  'Providers can only see their own profile unless granted platform permissions.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaticDataTable
                data={providers}
                emptyContent={t('No providers found')}
                columns={[
                  { id: 'name', header: t('Name'), cell: (row) => row.name },
                  {
                    id: 'user',
                    header: t('User ID'),
                    cell: (row) => row.user_id,
                  },
                  {
                    id: 'status',
                    header: t('Status'),
                    cell: (row) => row.status,
                  },
                  {
                    id: 'action',
                    header: t('Actions'),
                    cell: (row) => (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setDraft(row)}
                      >
                        {t('Edit')}
                      </Button>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          <ProviderProfileForm
            draft={draft}
            onChange={setDraft}
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate(draft)
            }}
            isSubmitting={saveMutation.isPending}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function ProviderProfileForm(props: {
  draft: Partial<ProviderProfile>
  onChange: (draft: Partial<ProviderProfile>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
}) {
  const { t } = useTranslation()
  const update = (patch: Partial<ProviderProfile>) =>
    props.onChange({ ...props.draft, ...patch })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Provider Profile')}</CardTitle>
        <CardDescription>
          {t('Create or update provider identity for marketplace ownership.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={props.onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Name')}</FieldLabel>
              <Input
                value={props.draft.name || ''}
                onChange={(event) => update({ name: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{t('User ID')}</FieldLabel>
              <Input
                type='number'
                value={props.draft.user_id || 0}
                onChange={(event) =>
                  update({ user_id: Number(event.target.value) })
                }
              />
            </Field>
            <Field>
              <FieldLabel>{t('Contact')}</FieldLabel>
              <Input
                value={props.draft.contact || ''}
                onChange={(event) => update({ contact: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{t('Description')}</FieldLabel>
              <Textarea
                value={props.draft.description || ''}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
              />
            </Field>
            <Button type='submit' disabled={props.isSubmitting}>
              <Save data-icon='inline-start' />
              {t('Save')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function FinanceConsole() {
  const { t } = useTranslation()
  const providersQuery = useQuery({
    queryKey: ['secondary-finance-providers'],
    queryFn: () => getProviders({ page_size: 50 }),
  })
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null
  )
  const providers = providersQuery.data?.data?.items ?? []
  const activeProviderId = selectedProviderId || providers[0]?.id

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Finance Foundation')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,1fr)]'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Providers')}</CardTitle>
              <CardDescription>
                {t(
                  'Select a provider to manage wallet and settlement settings.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaticDataTable
                data={providers}
                emptyContent={t('No providers found')}
                columns={[
                  { id: 'name', header: t('Name'), cell: (row) => row.name },
                  {
                    id: 'action',
                    header: t('Actions'),
                    cell: (row) => (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setSelectedProviderId(row.id)}
                      >
                        {t('Select')}
                      </Button>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          {activeProviderId ? (
            <FinanceForms providerId={activeProviderId} />
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function FinanceForms(props: { providerId: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const walletQuery = useQuery({
    queryKey: ['secondary-wallet', props.providerId],
    queryFn: () => getProviderWallet(props.providerId),
  })
  const settlementQuery = useQuery({
    queryKey: ['secondary-settlement', props.providerId],
    queryFn: () => getProviderSettlement(props.providerId),
  })
  const [wallet, setWallet] = useState<Partial<ProviderWallet>>({})
  const [settlement, setSettlement] = useState<
    Partial<ProviderSettlementConfig>
  >({})
  useEffect(() => {
    setWallet(walletQuery.data?.data || {})
  }, [walletQuery.data])
  useEffect(() => {
    setSettlement(settlementQuery.data?.data || {})
  }, [settlementQuery.data])
  const walletMutation = useMutation({
    mutationFn: () => saveProviderWallet(props.providerId, wallet),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({
          queryKey: ['secondary-wallet', props.providerId],
        })
      }
    },
  })
  const settlementMutation = useMutation({
    mutationFn: () => saveProviderSettlement(props.providerId, settlement),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({
          queryKey: ['secondary-settlement', props.providerId],
        })
      }
    },
  })

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <CardHeader>
          <CardTitle>{t('Provider Wallet')}</CardTitle>
          <CardDescription>
            {t('System-only wallet data for phase one settlement tracking.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Wallet Address')}</FieldLabel>
              <Input
                value={wallet.wallet_address || ''}
                onChange={(event) =>
                  setWallet({ ...wallet, wallet_address: event.target.value })
                }
              />
            </Field>
            <Button
              onClick={() => walletMutation.mutate()}
              disabled={walletMutation.isPending}
            >
              <Save data-icon='inline-start' />
              {t('Save')}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('Settlement Configuration')}</CardTitle>
          <CardDescription>
            {t(
              'USDT conversion and commission settings are manually configured.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <NumberField
                label={t('USDT Rate')}
                value={settlement.usdt_rate}
                onChange={(value) =>
                  setSettlement({ ...settlement, usdt_rate: value })
                }
              />
              <NumberField
                label={t('Commission Ratio')}
                value={settlement.commission_ratio}
                onChange={(value) =>
                  setSettlement({ ...settlement, commission_ratio: value })
                }
              />
              <NumberField
                label={t('Minimum Withdrawal')}
                value={settlement.min_withdrawal}
                onChange={(value) =>
                  setSettlement({ ...settlement, min_withdrawal: value })
                }
              />
              <NumberField
                label={t('Withdrawal Fee')}
                value={settlement.withdrawal_fee}
                onChange={(value) =>
                  setSettlement({ ...settlement, withdrawal_fee: value })
                }
              />
            </div>
            <Button
              onClick={() => settlementMutation.mutate()}
              disabled={settlementMutation.isPending}
            >
              <Save data-icon='inline-start' />
              {t('Save')}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}

function RBACConsole() {
  const { t } = useTranslation()
  const [userId, setUserId] = useState(0)
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([])
  const rolesQuery = useQuery({
    queryKey: ['secondary-rbac-roles'],
    queryFn: getRoles,
  })
  const permissionsQuery = useQuery({
    queryKey: ['secondary-rbac-permissions'],
    queryFn: getPermissions,
  })
  const userRolesQuery = useQuery({
    queryKey: ['secondary-rbac-user-roles', userId],
    queryFn: () => getUserRoles(userId),
    enabled: userId > 0,
  })
  useEffect(() => {
    const roleCodes =
      userRolesQuery.data?.data?.map((item) => item.role_code) ?? []
    setSelectedRoleCodes(roleCodes)
  }, [userRolesQuery.data])
  const mutation = useMutation({
    mutationFn: () => updateUserRoles(userId, selectedRoleCodes),
    onSuccess: (result) => {
      if (result.success) toast.success(t('Saved successfully'))
    },
  })
  const roles = rolesQuery.data?.data ?? []
  const permissions = permissionsQuery.data?.data ?? []
  const permissionMap = new Map(
    permissions.map((item) => [item.code, item.name])
  )

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Roles & Permissions')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Role Matrix')}</CardTitle>
              <CardDescription>
                {t('Built-in roles define the phase one access boundaries.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaticDataTable
                data={roles}
                emptyContent={t('No roles found')}
                columns={[
                  { id: 'role', header: t('Role'), cell: (row) => row.name },
                  { id: 'code', header: t('Code'), cell: (row) => row.code },
                  {
                    id: 'permissions',
                    header: t('Permissions'),
                    cell: (row: Role) => (
                      <div className='flex flex-wrap gap-1'>
                        {(row.permissions || []).map((permission) => (
                          <Badge key={permission} variant='secondary'>
                            {permissionMap.get(permission) || permission}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('User Role Binding')}</CardTitle>
              <CardDescription>
                {t(
                  'Bind extra platform roles while preserving legacy role levels.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('User ID')}</FieldLabel>
                  <Input
                    type='number'
                    value={userId}
                    onChange={(event) => setUserId(Number(event.target.value))}
                  />
                </Field>
                <div className='flex flex-col gap-2'>
                  {roles.map((role) => (
                    <label
                      key={role.code}
                      className='flex items-center gap-2 text-sm'
                    >
                      <input
                        type='checkbox'
                        checked={selectedRoleCodes.includes(role.code)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selectedRoleCodes, role.code]
                            : selectedRoleCodes.filter(
                                (item) => item !== role.code
                              )
                          setSelectedRoleCodes(next)
                        }}
                      />
                      <span>{role.name}</span>
                    </label>
                  ))}
                </div>
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || userId <= 0}
                >
                  <Save data-icon='inline-start' />
                  {t('Save')}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function NumberField(props: {
  label: string
  value: number | undefined
  onChange: (value: number) => void
}) {
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Input
        type='number'
        value={props.value || 0}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </Field>
  )
}
