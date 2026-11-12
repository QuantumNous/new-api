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
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field'
import { resolveLocalizedText } from '@/lib/localized-text'
import { cn } from '@/lib/utils'

import {
  newRequestPluginConfigRow,
  requestPluginConfigDefaults,
  requestPluginFieldKind,
  requestPluginFieldVisible,
  requestPluginRowsAsTable,
  toRequestPluginConfigDraft,
  type RequestPluginConfigRow,
  type RequestPluginFieldError,
} from '../lib/request-plugins'
import type { RequestPluginConfigField as ConfigField } from '../types'
import { RequestPluginConfigField } from './request-plugin-config-field'
import { RequestPluginFieldHint } from './request-plugin-field-hint'

type RequestPluginConfigRowsProps = {
  id: string
  name: string
  field: ConfigField
  rows: RequestPluginConfigRow[]
  disabled?: boolean
  className?: string
  errorFor: (path: string) => RequestPluginFieldError | undefined
  /** `path` names the row field that changed, when one did. */
  onChange: (rows: RequestPluginConfigRow[], path?: string) => void
}

/** How wide a table column is: patterns and long text take the room left. */
function columnWidth(field: ConfigField) {
  const kind = requestPluginFieldKind(field)
  if (kind === 'boolean') return 'auto'
  if (kind === 'enum') return '8.5rem'
  if (kind === 'number') return '6.5rem'
  if (
    field.format === 'regex' ||
    field.maxLength === undefined ||
    field.maxLength > 64
  ) {
    return 'minmax(8rem, 2fr)'
  }
  return 'minmax(6rem, 1fr)'
}

/**
 * A list of objects, such as rules. Items with a few short fields are edited
 * one line each under column titles; larger items get a small card each.
 */
export function RequestPluginConfigRows(props: RequestPluginConfigRowsProps) {
  const { t, i18n } = useTranslation()
  const title =
    resolveLocalizedText(props.field.title, i18n.language) || props.name
  const description = resolveLocalizedText(
    props.field.description,
    i18n.language
  )
  const items = props.field.items
  const itemTitle = resolveLocalizedText(items?.title, i18n.language) || title
  const fields = Object.entries(items?.properties ?? {})
  const properties = items?.properties ?? {}
  const required = new Set(items?.required ?? [])
  const table = requestPluginRowsAsTable(items)
  const full =
    props.field.maxItems !== undefined &&
    props.rows.length >= props.field.maxItems
  // Columns line up across the title row and every item row.
  const gridStyle: CSSProperties | undefined = table
    ? {
        gridTemplateColumns: `${fields.map(([, field]) => columnWidth(field)).join(' ')} auto`,
      }
    : undefined

  const move = (index: number, offset: number) => {
    const next = [...props.rows]
    const [row] = next.splice(index, 1)
    next.splice(index + offset, 0, row)
    props.onChange(next)
  }

  const renderField = (
    row: RequestPluginConfigRow,
    fieldName: string,
    field: ConfigField
  ) => {
    const path = `${props.name}.${row.key}.${fieldName}`
    // A cell keeps its column even while its field is hidden.
    if (!requestPluginFieldVisible(field, properties, row.values)) {
      return table ? <div key={fieldName} /> : null
    }
    return (
      <RequestPluginConfigField
        key={fieldName}
        id={`${props.id}-${row.key}-${fieldName}`}
        name={fieldName}
        field={field}
        value={row.values[fieldName]}
        required={required.has(fieldName)}
        error={props.errorFor(path)}
        disabled={props.disabled}
        layout={table ? 'cell' : 'compact'}
        onChange={(value) =>
          props.onChange(
            props.rows.map((item) =>
              item.key === row.key
                ? { ...item, values: { ...item.values, [fieldName]: value } }
                : item
            ),
            path
          )
        }
      />
    )
  }

  const rowActions = (row: RequestPluginConfigRow, index: number) => {
    const rowName = `${itemTitle} ${index + 1}`
    return (
      <div className='flex items-center'>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          disabled={props.disabled || index === 0}
          aria-label={t('Move {{name}} up', { name: rowName })}
          onClick={() => move(index, -1)}
        >
          <ArrowUp aria-hidden='true' />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          disabled={props.disabled || index === props.rows.length - 1}
          aria-label={t('Move {{name}} down', { name: rowName })}
          onClick={() => move(index, 1)}
        >
          <ArrowDown aria-hidden='true' />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          disabled={props.disabled}
          aria-label={t('Delete {{name}}', { name: rowName })}
          onClick={() =>
            props.onChange(props.rows.filter((item) => item.key !== row.key))
          }
        >
          <X aria-hidden='true' />
        </Button>
      </div>
    )
  }

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
      {table && props.rows.length > 0 && (
        <div className='overflow-x-auto'>
          <div
            className='grid min-w-max items-start gap-x-2 gap-y-2 sm:min-w-0'
            style={gridStyle}
          >
            {fields.map(([fieldName, field]) => (
              <div
                key={fieldName}
                aria-hidden='true'
                className='text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap'
              >
                <span>
                  {resolveLocalizedText(field.title, i18n.language) ||
                    fieldName}
                </span>
                {required.has(fieldName) && (
                  <span className='text-destructive'>*</span>
                )}
                <RequestPluginFieldHint
                  text={resolveLocalizedText(field.description, i18n.language)}
                />
              </div>
            ))}
            <div />
            {props.rows.map((row, index) => (
              <div
                key={row.key}
                role='group'
                aria-label={`${itemTitle} ${index + 1}`}
                className='contents'
              >
                {fields.map(([fieldName, field]) =>
                  renderField(row, fieldName, field)
                )}
                {rowActions(row, index)}
              </div>
            ))}
          </div>
        </div>
      )}
      {!table && props.rows.length > 0 && (
        <ol className='space-y-2'>
          {props.rows.map((row, index) => (
            <li
              key={row.key}
              aria-label={`${itemTitle} ${index + 1}`}
              className='bg-muted/30 space-y-3 rounded-lg border p-3'
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {`${itemTitle} ${index + 1}`}
                </span>
                {rowActions(row, index)}
              </div>
              <div className='grid gap-3 sm:grid-cols-3'>
                {fields.map(([fieldName, field]) => {
                  if (
                    !requestPluginFieldVisible(field, properties, row.values)
                  ) {
                    return null
                  }
                  const kind = requestPluginFieldKind(field)
                  const wide =
                    kind === 'textarea' ||
                    kind === 'lines' ||
                    kind === 'json' ||
                    kind === 'enumList' ||
                    (kind === 'text' &&
                      (field.format === 'regex' ||
                        field.format === 'url' ||
                        field.maxLength === undefined ||
                        field.maxLength > 64))
                  return (
                    <div
                      key={fieldName}
                      className={cn('min-w-0', wide && 'sm:col-span-3')}
                    >
                      {renderField(row, fieldName, field)}
                    </div>
                  )
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground -ml-2'
          disabled={props.disabled || full}
          onClick={() =>
            props.onChange([
              ...props.rows,
              newRequestPluginConfigRow(
                toRequestPluginConfigDraft(
                  items,
                  requestPluginConfigDefaults(items)
                )
              ),
            ])
          }
        >
          <Plus aria-hidden='true' />
          {t('Add {{name}}', { name: itemTitle })}
        </Button>
      </div>
    </FieldSet>
  )
}
