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
import { FilterHorizontalIcon, RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { InputGroupButton } from '@/components/ui/input-group'

import type { useChannelModelDiscovery } from '../hooks/use-channel-model-discovery'
import { normalizeModelName } from '../lib/model-mapping-validation'
import { UpstreamModelSelection } from './upstream-model-selection'

type UpstreamModelPickerProps = {
  value: string
  onSelect: (model: string) => void
  disabled?: boolean
  discovery: Pick<
    ReturnType<typeof useChannelModelDiscovery>,
    'status' | 'models'
  >
  onFetch: () => Promise<void> | undefined
  feedback: ReactNode
}

export function UpstreamModelPicker(props: UpstreamModelPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const models = useMemo(
    () => [
      ...new Set(
        props.discovery.models.map(normalizeModelName).filter(Boolean)
      ),
    ],
    [props.discovery.models]
  )
  const ready = props.discovery.status === 'success'
  const loading = props.discovery.status === 'loading'
  const canApply = ready && !props.disabled && models.includes(selected)

  return (
    <Dialog
      open={open && !props.disabled}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          if (props.disabled) return
          if (!ready && !loading) {
            const request = props.onFetch()
            if (!request) return
            void request
          }
          setSelected(props.value.trim())
        }
        setOpen(nextOpen)
      }}
      trigger={
        <InputGroupButton
          size='icon-xs'
          aria-label={t('Select Model')}
          title={t('Fetch available models from upstream')}
          disabled={props.disabled}
        >
          <HugeiconsIcon
            icon={FilterHorizontalIcon}
            strokeWidth={2}
            aria-hidden='true'
          />
        </InputGroupButton>
      }
      title={t('Select Model')}
      description={t('Fetch available models from upstream')}
      contentClassName='sm:max-w-3xl'
      bodyClassName='space-y-3'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              void props.onFetch()
            }}
            disabled={loading || props.disabled}
            className='sm:mr-auto'
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              data-icon='inline-start'
              aria-hidden='true'
            />
            {t('Refresh')}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => setOpen(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={!canApply}
            onClick={() => {
              if (!canApply) return
              props.onSelect(selected)
              setOpen(false)
            }}
          >
            {t('Apply')}
          </Button>
        </>
      }
    >
      <div aria-live='polite'>{props.feedback}</div>
      {open && ready && models.length > 0 && (
        <UpstreamModelSelection
          models={models}
          existingModels={[]}
          selected={models.includes(selected) ? [selected] : []}
          selectionMode='single'
          onChange={(values) => setSelected(values[0] ?? '')}
        />
      )}
    </Dialog>
  )
}
