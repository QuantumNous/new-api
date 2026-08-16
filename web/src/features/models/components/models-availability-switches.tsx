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
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  getSystemOptions,
  updateSystemOption,
} from '@/features/system-settings/api'
import { getOptionValue } from '@/features/system-settings/hooks/use-system-options'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

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
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )

  const optionsQuery = useQuery({
    queryKey: ['system-options'],
    queryFn: getSystemOptions,
    enabled: isRoot,
    retry: false,
    staleTime: 30 * 1000,
  })

  const serverValues = useMemo(
    () =>
      getOptionValue(
        optionsQuery.data?.data,
        DEFAULT_AUTO_MODEL_OPTIONS
      ) as AutoModelOptions,
    [optionsQuery.data?.data]
  )

  const [disableEnabled, setDisableEnabled] = useState(false)
  const [enableEnabled, setEnableEnabled] = useState(false)
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false)

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
        return
      }
      toast.success(t('Setting updated successfully'))
      void queryClient.invalidateQueries({ queryKey: ['system-options'] })
      void queryClient.invalidateQueries({ queryKey: modelsQueryKeys.all })

      const enabled = variables.value === true || variables.value === 'true'
      if (variables.key === 'AutomaticDisableModelEnabled') {
        setDisableEnabled(enabled)
        if (!enabled) setEnableEnabled(false)
      }
      if (variables.key === 'AutomaticEnableModelEnabled') {
        setEnableEnabled(enabled)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to update setting'))
    },
  })

  const saving = mutation.isPending || optionsQuery.isFetching
  const optionsLoadFailed =
    optionsQuery.isError || optionsQuery.data?.success === false

  const handleDisableChange = (checked: boolean) => {
    if (checked) {
      setDisableConfirmOpen(true)
      return
    }
    mutation.mutate({
      key: 'AutomaticDisableModelEnabled',
      value: false,
    })
  }

  const handleEnableChange = (checked: boolean) => {
    if (checked && !disableEnabled) return
    mutation.mutate({
      key: 'AutomaticEnableModelEnabled',
      value: checked,
    })
  }

  const handleConfirmDisable = () => {
    mutation.mutate(
      {
        key: 'AutomaticDisableModelEnabled',
        value: true,
      },
      {
        onSuccess: (resp) => {
          if (resp.success) setDisableConfirmOpen(false)
        },
      }
    )
  }

  if (!isRoot) return null

  if (optionsLoadFailed) {
    return (
      <div
        role='alert'
        className='border-destructive/40 bg-destructive/5 text-destructive flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm'
      >
        <AlertCircle className='size-4 shrink-0' aria-hidden='true' />
        <span className='min-w-0 flex-1'>{t('Failed to load')}</span>
        <Button
          variant='outline'
          size='sm'
          disabled={optionsQuery.isFetching}
          onClick={() => void optionsQuery.refetch()}
        >
          <RefreshCw className='size-4' aria-hidden='true' />
          {t('Retry')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className='grid min-w-0 gap-3 sm:grid-cols-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <Label
            htmlFor='auto-disable-models'
            className='min-w-0 flex-1 text-sm leading-snug font-medium'
          >
            {t('Auto-disable models with no available channels')}
          </Label>
          <Switch
            id='auto-disable-models'
            checked={disableEnabled}
            disabled={saving}
            onCheckedChange={handleDisableChange}
            size='sm'
            className='shrink-0'
          />
        </div>

        {disableEnabled ? (
          <div className='flex min-w-0 items-center gap-2'>
            <Label
              htmlFor='auto-enable-models'
              className='min-w-0 flex-1 text-sm leading-snug font-medium'
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
              className='shrink-0'
            />
          </div>
        ) : (
          <div className='hidden sm:block' aria-hidden='true' />
        )}
      </div>

      <Dialog
        open={disableConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDisableConfirmOpen(false)
        }}
        title={t('Disable Models with No Channels?')}
        description={t(
          'Enabling this setting immediately disables all currently enabled models with no available channels. Turning it off later will not automatically re-enable those models. Continue?'
        )}
        contentHeight='auto'
        footer={
          <>
            <Button
              variant='outline'
              disabled={mutation.isPending}
              onClick={() => setDisableConfirmOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant='destructive'
              disabled={mutation.isPending}
              onClick={handleConfirmDisable}
            >
              {t('Enable')}
            </Button>
          </>
        }
      >
        {' '}
      </Dialog>
    </>
  )
}
