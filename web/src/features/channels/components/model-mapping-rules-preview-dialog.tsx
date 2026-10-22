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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'

import type { ModelMappingRulesPreview } from '../types'

type ModelMappingRulesPreviewDialogProps = {
  preview: ModelMappingRulesPreview | null
  onOpenChange: (open: boolean) => void
  onConfirm: (preview: ModelMappingRulesPreview) => void
}

export function ModelMappingRulesPreviewDialog(
  props: ModelMappingRulesPreviewDialogProps
) {
  const { t } = useTranslation()
  const preview = props.preview
  const changed = preview?.changed ?? []
  const conflicts = preview?.conflicts ?? []

  return (
    <Dialog
      open={preview !== null}
      onOpenChange={props.onOpenChange}
      title={t('Apply rules to existing models')}
      description={t(
        'Renamed models keep forwarding to the same upstream model. Changes are written to the form; save the channel to keep them.'
      )}
      contentClassName='sm:max-w-2xl'
      bodyClassName='flex flex-col gap-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={changed.length === 0}
            onClick={() => preview && props.onConfirm(preview)}
          >
            {t('Apply changes')}
          </Button>
        </>
      }
    >
      {changed.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No models would change.')}
        </p>
      ) : (
        <section className='flex flex-col gap-2'>
          <h3 className='text-sm font-semibold'>
            {t('{{count}} model(s) will be renamed', { count: changed.length })}
          </h3>
          <ul
            aria-label={t('Renamed models')}
            className='flex max-h-64 flex-col gap-2 overflow-y-auto font-mono text-xs'
          >
            {changed.map((item) => (
              <li
                key={item.from}
                className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2'
              >
                <span className='min-w-0 wrap-anywhere'>{item.from}</span>
                <ArrowRight className='size-3.5 shrink-0' aria-hidden='true' />
                <span className='min-w-0 wrap-anywhere'>
                  {item.to}
                  {item.to !== item.upstream && (
                    <span className='text-muted-foreground'>
                      {' '}
                      ({t('Upstream receives')}: {item.upstream})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {conflicts.length > 0 && (
        <section className='flex flex-col gap-2'>
          <h3 className='text-warning text-sm font-semibold'>
            {t('{{count}} model(s) kept because the new name is taken', {
              count: conflicts.length,
            })}
          </h3>
          <ul
            aria-label={t('Conflicting models')}
            className='flex max-h-40 flex-col gap-2 overflow-y-auto font-mono text-xs'
          >
            {conflicts.map((item) => (
              <li key={`${item.model}-${item.target}`}>
                {item.model} → {item.target}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  )
}
