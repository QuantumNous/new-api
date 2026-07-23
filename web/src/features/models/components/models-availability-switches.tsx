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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  getSystemOptions,
  updateSystemOption,
} from '@/features/system-settings/api'
import { getOptionValue } from '@/features/system-settings/hooks/use-system-options'
import { modelsQueryKeys } from '../lib'

type AutoModelOptions = {
  AutomaticDisableModelEnabled: boolean
  AutomaticEnableModelEnabled: boolean
}

const DEFAULT_AUTO_MODEL_OPTIONS: AutoModelOptions = {
  AutomaticDisableModelEnabled: false,
  AutomaticEnableModelEnabled: false,
}

export function ModelsAvailabilitySwitches() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['system-options'],
    queryFn: getSystemOptions,
    staleTime: 30 * 1000,
  })

  const serverValues = useMemo(
    () =>
      getOptionValue(data?.data, DEFAULT_AUTO_MODEL_OPTIONS) as AutoModelOptions,
    [data?.data]
  )

  const [disableEnabled, setDisableEnabled] = useState(false)
  const [enableEnabled, setEnableEnabled] = useState(false)

  useEffect(() => {
    setDisableEnabled(serverValues.AutomaticDisableModelEnabled)
    setEnableEnabled(serverValues.AutomaticEnableModelEnabled)
  }, [
    serverValues.AutomaticDisableModelEnabled,
    serverValues.AutomaticEnableModelEnabled,
  ])

  const mutation = useMutation({
    mutationFn: updateSystemOption,
    onSuccess: (resp, variables) => {
      if (!resp.success) {
        toast.error(resp.message || t('Failed to update setting'))
        // rollback from server values on next effect; force local rollback now
        setDisableEnabled(serverValues.AutomaticDisableModelEnabled)
        setEnableEnabled(serverValues.AutomaticEnableModelEnabled)
        return
      }
      toast.success(t('Setting updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
      // keep local state in sync with just-saved key
      if (variables.key === 'AutomaticDisableModelEnabled') {
        setDisableEnabled(variables.value === true || variables.value === 'true')
      }
      if (variables.key === 'AutomaticEnableModelEnabled') {
        setEnableEnabled(variables.value === true || variables.value === 'true')
      }
    },
    onError: (error: Error, variables) => {
      toast.error(error.message || t('Failed to update setting'))
      if (variables.key === 'AutomaticDisableModelEnabled') {
        setDisableEnabled(serverValues.AutomaticDisableModelEnabled)
      }
      if (variables.key === 'AutomaticEnableModelEnabled') {
        setEnableEnabled(serverValues.AutomaticEnableModelEnabled)
      }
    },
  })

  const saving = mutation.isPending || isLoading

  const handleDisableChange = useCallback(
    (checked: boolean) => {
      const previous = disableEnabled
      setDisableEnabled(checked)
      if (!checked) {
        // hide dependent switch immediately; keep its server value for restore
        setEnableEnabled(serverValues.AutomaticEnableModelEnabled)
      }
      mutation.mutate(
        {
          key: 'AutomaticDisableModelEnabled',
          value: checked,
        },
        {
          onError: () => setDisableEnabled(previous),
          onSuccess: (resp) => {
            if (!resp.success) setDisableEnabled(previous)
          },
        }
      )
    },
    [disableEnabled, mutation, serverValues.AutomaticEnableModelEnabled]
  )

  const handleEnableChange = useCallback(
    (checked: boolean) => {
      const previous = enableEnabled
      setEnableEnabled(checked)
      mutation.mutate(
        {
          key: 'AutomaticEnableModelEnabled',
          value: checked,
        },
        {
          onError: () => setEnableEnabled(previous),
          onSuccess: (resp) => {
            if (!resp.success) setEnableEnabled(previous)
          },
        }
      )
    },
    [enableEnabled, mutation]
  )

  return (
    <div
      className='grid min-w-0 gap-3 sm:grid-cols-2'
    >
      <div className='flex min-w-0 items-center gap-2'>
        <Label
          htmlFor='auto-disable-models'
          className='text-sm leading-snug font-medium'
        >
          {t('Auto-disable models with no available channels')}
        </Label>
        <Switch
          id='auto-disable-models'
          checked={disableEnabled}
          disabled={saving}
          onCheckedChange={handleDisableChange}
          size='sm'
        />
      </div>

      {disableEnabled ? (
        <div className='flex min-w-0 items-center gap-2'>
          <Label
            htmlFor='auto-enable-models'
            className='text-sm leading-snug font-medium'
          >
            {t(
              'Auto-enable models disabled by this setting when a channel recovers'
            )}
          </Label>
          <Switch
            id='auto-enable-models'
            checked={enableEnabled}
            disabled={saving}
            onCheckedChange={handleEnableChange}
            size='sm'
          />
        </div>
      ) : (
        <div className='hidden sm:block' aria-hidden='true' />
      )}
    </div>
  )
}
