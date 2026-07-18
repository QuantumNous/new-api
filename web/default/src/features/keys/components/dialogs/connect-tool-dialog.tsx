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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { ProviderBadge } from '@/components/provider-badge'
import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getPricing } from '@/features/pricing/api'
import { getUserGroups } from '@/lib/api'
import { cn } from '@/lib/utils'

import { createApiKey } from '../../api'
import { ERROR_MESSAGES } from '../../constants'
import {
  ENDPOINT_TYPES,
  buildCCSwitchImportURL,
  buildCherryStudioImportURL,
  buildConnectTokenName,
  filterModelsForGroup,
  getEndpointTypeConfig,
  getGroupsForEndpoint,
  recommendModelName,
  type ConnectToolId,
  type EndpointTypeId,
} from '../../lib/connect-tool'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from '../api-key-group-combobox'
import { useApiKeys } from '../api-keys-provider'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectToolDialog(props: Props) {
  const { t } = useTranslation()
  const { triggerRefresh } = useApiKeys()

  const [endpointId, setEndpointId] = useState<EndpointTypeId | ''>('')
  const [group, setGroup] = useState('')
  const [model, setModel] = useState('')
  const [toolId, setToolId] = useState<ConnectToolId>('cc-switch')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdKey, setCreatedKey] = useState('')
  const [manualHint, setManualHint] = useState(false)

  const pricingQuery = useQuery({
    queryKey: ['pricing', 'connect-tool'],
    queryFn: getPricing,
    enabled: props.open,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  })

  const groupsQuery = useQuery({
    queryKey: ['user-groups', 'connect-tool'],
    queryFn: getUserGroups,
    enabled: props.open,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  })

  const pricingModels = useMemo(() => {
    const models = pricingQuery.data?.data || []
    const vendors = pricingQuery.data?.vendors || []
    const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]))
    return models.map((model) => {
      const vendor = model.vendor_id
        ? vendorMap.get(model.vendor_id)
        : undefined
      return {
        ...model,
        vendor_name: vendor?.name || model.vendor_name,
        vendor_icon: vendor?.icon || model.vendor_icon,
      }
    })
  }, [pricingQuery.data])

  // Merge pricing.usable_group with /user/self/groups so channel-group changes
  // are not dropped when one of the two responses is incomplete.
  // If both are empty, getGroupsForEndpoint still falls back to model groups.
  const usableGroups = useMemo(() => {
    const merged = new Set<string>([
      ...Object.keys(pricingQuery.data?.usable_group || {}),
      ...Object.keys(groupsQuery.data?.data || {}),
    ])
    return [...merged]
  }, [pricingQuery.data?.usable_group, groupsQuery.data?.data])

  const availableEndpointIds = useMemo(() => {
    return ENDPOINT_TYPES.filter(
      (endpoint) =>
        getGroupsForEndpoint(pricingModels, endpoint.id, usableGroups).length >
        0
    ).map((endpoint) => endpoint.id)
  }, [pricingModels, usableGroups])

  const isLoadingOptions =
    props.open && (pricingQuery.isLoading || groupsQuery.isLoading)
  const loadFailed =
    props.open &&
    !isLoadingOptions &&
    (pricingQuery.isError ||
      (pricingQuery.isFetched && pricingModels.length === 0))

  const groupOptions = useMemo((): ApiKeyGroupOption[] => {
    if (!endpointId) return []
    return getGroupsForEndpoint(pricingModels, endpointId, usableGroups).map(
      (value) => {
        const meta = groupsQuery.data?.data?.[value]
        return {
          value,
          label: value,
          desc: meta?.desc ? String(meta.desc) : value,
          ratio: meta?.ratio,
        }
      }
    )
  }, [endpointId, pricingModels, usableGroups, groupsQuery.data?.data])

  const modelOptions = useMemo(() => {
    if (!endpointId || !group) return []
    return filterModelsForGroup(pricingModels, endpointId, group).map(
      (item) => ({
        value: item.model_name,
        label: item.model_name,
      })
    )
  }, [endpointId, group, pricingModels])

  useEffect(() => {
    if (!props.open) return
    setEndpointId('')
    setGroup('')
    setModel('')
    setToolId('cc-switch')
    setCreatedKey('')
    setManualHint(false)
    setIsSubmitting(false)
  }, [props.open])

  useEffect(() => {
    if (!endpointId) {
      setGroup('')
      setModel('')
      return
    }
    // Always re-resolve against the current endpoint's groups so switching
    // provider type does not keep a group that only belonged to the previous type.
    setGroup((current) => {
      if (
        current &&
        groupOptions.some((item) => item.value === current)
      ) {
        return current
      }
      return groupOptions[0]?.value || ''
    })
  }, [endpointId, groupOptions])

  useEffect(() => {
    if (!endpointId || !group) {
      setModel('')
      return
    }
    const models = filterModelsForGroup(pricingModels, endpointId, group)
    const recommended = recommendModelName(models, endpointId)
    setModel((current) => {
      if (current && models.some((item) => item.model_name === current)) {
        return current
      }
      return recommended
    })
  }, [endpointId, group, pricingModels])

  const endpointConfig = endpointId
    ? getEndpointTypeConfig(endpointId)
    : undefined

  const canSubmit = Boolean(
    endpointConfig && group && model && toolId && !isSubmitting
  )

  const handleSubmit = async () => {
    if (!endpointConfig || !group || !model) return
    setIsSubmitting(true)
    setManualHint(false)
    try {
      const tokenName = buildConnectTokenName(endpointConfig.label, group)
      const result = await createApiKey({
        name: tokenName,
        remain_quota: 0,
        expired_time: -1,
        unlimited_quota: true,
        model_limits_enabled: false,
        model_limits: '',
        allow_ips: '',
        group,
        cross_group_retry: false,
      })

      if (!result.success || !result.data?.key) {
        toast.error(result.message || t(ERROR_MESSAGES.CREATE_FAILED))
        return
      }

      const apiKey = result.data.key.startsWith('sk-')
        ? result.data.key
        : `sk-${result.data.key}`
      setCreatedKey(apiKey)
      triggerRefresh()

      const launchUrl =
        toolId === 'cc-switch'
          ? buildCCSwitchImportURL({
              app: endpointConfig.ccSwitchApp,
              name: tokenName,
              model,
              apiKey,
            })
          : buildCherryStudioImportURL(apiKey)

      window.open(launchUrl, '_blank')
      toast.success(t('API key created. Opening the selected tool...'))
      setManualHint(true)
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Connect tool')}
      description={t(
        'Pick a provider type, group, model, and client. We create an API key and open the tool for you.'
      )}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-5'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? t('Configuring...') : t('Create and configure')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('Provider type')}</Label>
        <div className='grid grid-cols-2 gap-2'>
          {ENDPOINT_TYPES.map((endpoint) => {
            const enabled =
              !isLoadingOptions && availableEndpointIds.includes(endpoint.id)
            const selected = endpointId === endpoint.id
            return (
              <button
                key={endpoint.id}
                type='button'
                disabled={!enabled}
                onClick={() => setEndpointId(endpoint.id)}
                className={cn(
                  'border-border flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  selected && 'border-primary bg-primary/5',
                  (!enabled || isLoadingOptions) &&
                    'cursor-not-allowed opacity-40',
                  enabled && !selected && 'hover:bg-muted/50'
                )}
              >
                <ProviderBadge
                  label={endpoint.label}
                  iconKey={endpoint.iconKey}
                  colorText={false}
                  copyable={false}
                />
              </button>
            )
          })}
        </div>
        {isLoadingOptions && (
          <p className='text-muted-foreground text-xs'>
            {t('Loading available providers...')}
          </p>
        )}
        {loadFailed && (
          <p className='text-muted-foreground text-xs'>
            {t(
              'Could not load pricing data. Open the pricing page or refresh and try again.'
            )}
          </p>
        )}
        {!isLoadingOptions &&
          !loadFailed &&
          availableEndpointIds.length === 0 && (
            <p className='text-muted-foreground text-xs'>
              {t(
                'No provider types are available. Types unlock when pricing models match Anthropic / OpenAI for your groups — having channels alone is not enough.'
              )}
            </p>
          )}
      </div>

      <div className='space-y-2'>
        <Label>{t('Group')}</Label>
        <ApiKeyGroupCombobox
          options={groupOptions}
          value={group}
          onValueChange={setGroup}
          placeholder={t('Select a group')}
          disabled={!endpointId}
        />
      </div>

      <div className='space-y-2'>
        <Label>{t('Primary Model')}</Label>
        <div
          className={cn(
            (!endpointId || !group) && 'pointer-events-none opacity-50'
          )}
        >
          <ComboboxInput
            options={modelOptions}
            value={model}
            onValueChange={setModel}
            placeholder={t('Select a model')}
            emptyText={t('No models available')}
            allowCustomValue={false}
          />
        </div>
        <p className='text-muted-foreground text-xs'>
          {t(
            'A recommended model is selected automatically. You can change it.'
          )}
        </p>
      </div>

      <div className='space-y-2'>
        <Label>{t('Configuration tool')}</Label>
        <RadioGroup
          value={toolId}
          onValueChange={(value) => setToolId(value as ConnectToolId)}
          className='flex flex-col gap-2'
        >
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='cc-switch' id='connect-tool-cc-switch' />
            <Label htmlFor='connect-tool-cc-switch' className='cursor-pointer'>
              CC Switch
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <RadioGroupItem
              value='cherry-studio'
              id='connect-tool-cherry-studio'
            />
            <Label
              htmlFor='connect-tool-cherry-studio'
              className='cursor-pointer'
            >
              Cherry Studio
            </Label>
          </div>
        </RadioGroup>
      </div>

      {manualHint && createdKey && (
        <div className='bg-muted/40 space-y-2 rounded-lg border p-3 text-xs'>
          <p className='text-muted-foreground'>
            {t(
              'If the app did not open, install the tool and use this API key manually:'
            )}
          </p>
          <code className='bg-background block break-all rounded border px-2 py-1.5'>
            {createdKey}
          </code>
        </div>
      )}
    </Dialog>
  )
}
