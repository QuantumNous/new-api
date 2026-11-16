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
import { Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveLocalizedText } from '@/lib/localized-text'
import { resolveModelProvider } from '@/lib/model-provider'
import { cn } from '@/lib/utils'

import {
  newRequestPluginConfigRow,
  requestPluginModelValueShape,
  toRequestPluginConfigDraft,
  type RequestPluginConfigRow,
  type RequestPluginFieldError,
} from '../lib/request-plugins'
import type { RequestPluginConfigField as ConfigField } from '../types'
import { RequestPluginConfigField } from './request-plugin-config-field'
import { RequestPluginFieldHint } from './request-plugin-field-hint'

type RequestPluginConfigModelValuesProps = {
  id: string
  name: string
  field: ConfigField
  rows: RequestPluginConfigRow[]
  /** The models offered in the model picker; other names can be typed. */
  models?: string[]
  disabled?: boolean
  className?: string
  errorFor: (path: string) => RequestPluginFieldError | undefined
  /** `path` names the row field that changed, when one did. */
  onChange: (rows: RequestPluginConfigRow[], path?: string) => void
}

/** A value per model, edited one line per model. */
export function RequestPluginConfigModelValues(
  props: RequestPluginConfigModelValuesProps
) {
  const { t, i18n } = useTranslation()
  const title =
    resolveLocalizedText(props.field.title, i18n.language) || props.name
  const description = resolveLocalizedText(
    props.field.description,
    i18n.language
  )
  const valueField = props.field.additionalProperties
  const valueTitle =
    resolveLocalizedText(valueField?.title, i18n.language) || t('Value')
  const modelOptions = useMemo(
    () =>
      [...new Set(props.models ?? [])].map((model) => {
        const provider = resolveModelProvider(model)
        return {
          value: model,
          label: model,
          icon: provider ? getLobeIcon(provider.icon, 16) : undefined,
        }
      }),
    [props.models]
  )

  const update = (row: RequestPluginConfigRow, name: string, value: unknown) =>
    props.onChange(
      props.rows.map((item) =>
        item.key === row.key
          ? { ...item, values: { ...item.values, [name]: value } }
          : item
      ),
      `${props.name}.${row.key}.${name}`
    )

  return (
    <FieldSet className={cn('gap-3', props.className)}>
      <div className='space-y-0.5'>
        <FieldLegend variant='label' className='mb-0'>
          {title}
        </FieldLegend>
        {description && <FieldDescription>{description}</FieldDescription>}
      </div>
      {props.rows.length === 0 && (
        <p className='text-muted-foreground text-sm'>{t('None added yet')}</p>
      )}
      {valueField && props.rows.length > 0 && (
        <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2'>
          <div aria-hidden='true' className='text-muted-foreground text-xs'>
            {t('Model')}
          </div>
          <div
            aria-hidden='true'
            className='text-muted-foreground flex items-center gap-1 text-xs'
          >
            <span>{valueTitle}</span>
            <RequestPluginFieldHint
              text={resolveLocalizedText(valueField.description, i18n.language)}
            />
          </div>
          <div />
          {props.rows.map((row, index) => {
            const rowName = `${title} ${index + 1}`
            const model =
              typeof row.values.model === 'string' ? row.values.model : ''
            const modelError = props.errorFor(`${props.name}.${row.key}.model`)
            // A model set on another line is not offered again.
            const taken = new Set(
              props.rows
                .filter((item) => item.key !== row.key)
                .map((item) => item.values.model)
            )
            return (
              <div
                key={row.key}
                role='group'
                aria-label={rowName}
                className='contents'
              >
                <Field
                  data-invalid={modelError ? true : undefined}
                  className='min-w-0 gap-1'
                >
                  <ComboboxInput
                    id={`${props.id}-${row.key}-model`}
                    options={modelOptions.filter(
                      (option) => !taken.has(option.value)
                    )}
                    value={model}
                    onValueChange={(next) => update(row, 'model', next)}
                    placeholder={t('Select or enter a model')}
                    emptyText={t('No matching models')}
                    allowCustomValue
                    disabled={props.disabled}
                    aria-label={t('Model')}
                    aria-invalid={modelError ? true : undefined}
                  />
                  {modelError && (
                    <FieldError className='text-xs'>
                      {t(modelError.message, modelError.values)}
                    </FieldError>
                  )}
                </Field>
                <RequestPluginConfigField
                  id={`${props.id}-${row.key}-value`}
                  name='value'
                  field={{ ...valueField, title: valueTitle }}
                  value={row.values.value}
                  required
                  error={props.errorFor(`${props.name}.${row.key}.value`)}
                  disabled={props.disabled}
                  layout='cell'
                  onChange={(next) => update(row, 'value', next)}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='mt-0.5'
                  disabled={props.disabled}
                  aria-label={t('Delete {{name}}', { name: rowName })}
                  onClick={() =>
                    props.onChange(
                      props.rows.filter((item) => item.key !== row.key)
                    )
                  }
                >
                  <X aria-hidden='true' />
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground -ml-2'
          disabled={props.disabled || !valueField}
          onClick={() =>
            props.onChange([
              ...props.rows,
              newRequestPluginConfigRow(
                toRequestPluginConfigDraft(
                  requestPluginModelValueShape(props.field),
                  { value: valueField?.default }
                )
              ),
            ])
          }
        >
          <Plus aria-hidden='true' />
          {t('Add model')}
        </Button>
      </div>
    </FieldSet>
  )
}
