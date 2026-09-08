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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MultiSelect } from '@/components/multi-select'
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
} from '@/components/ui/form'

import {
  mergeVertexStorageModels,
  splitVertexStorageModels,
} from '../../../lib'

type VertexStorageBucketsFieldProps = {
  channelType: number
  models: string[]
  onModelsChange: (models: string[]) => void
}

export function VertexStorageBucketsField(
  props: VertexStorageBucketsFieldProps
) {
  const { t } = useTranslation()
  const parts = useMemo(
    () => splitVertexStorageModels(props.models),
    [props.models]
  )
  const options = useMemo(
    () => parts.buckets.map((bucket) => ({ label: bucket, value: bucket })),
    [parts.buckets]
  )

  if (props.channelType !== 41) return null

  return (
    <FormItem className='space-y-3'>
      <div className='space-y-1'>
        <FormLabel>{t('Storage buckets')}</FormLabel>
        <FormDescription>
          {t(
            'Configure Google Cloud Storage buckets for this Vertex AI channel.'
          )}
        </FormDescription>
      </div>
      <FormControl>
        <MultiSelect
          options={options}
          selected={parts.buckets}
          onChange={(buckets) =>
            props.onModelsChange(
              mergeVertexStorageModels(parts.models, buckets)
            )
          }
          placeholder={t('Enter storage bucket names')}
          allowCreate
          createLabel='Add storage bucket "{{value}}"'
          maxVisibleChips={8}
        />
      </FormControl>
    </FormItem>
  )
}
