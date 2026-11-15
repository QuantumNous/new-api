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
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { resolveLocalizedText } from '@/lib/localized-text'

import { REQUEST_PLUGIN_STAGE_LABELS } from '../lib/request-plugins'
import type {
  RequestPluginConfigField,
  RequestPluginConfigSchema,
} from '../types'

const FIELD_TYPE_LABELS: Record<RequestPluginConfigField['type'], string> = {
  string: 'Text',
  number: 'Number',
  integer: 'Whole number',
  boolean: 'On or off',
  array: 'List',
  object: 'JSON',
}

/** Where a request processing plugin runs, and the settings it takes. */
export function PluginTransformSection(props: {
  hooks: string[]
  schema?: RequestPluginConfigSchema
}) {
  const { t, i18n } = useTranslation()
  const fields = Object.entries(props.schema?.properties ?? {})
  return (
    <section
      className='space-y-4 rounded-lg border p-4'
      aria-label={t('Request processing')}
    >
      <h3 className='text-sm font-semibold'>{t('Request processing')}</h3>
      <div className='space-y-2'>
        <h4 className='text-muted-foreground text-xs'>{t('When it runs')}</h4>
        {props.hooks.length ? (
          <ol className='list-decimal space-y-1 pl-5 text-sm'>
            {props.hooks.map((hook) => (
              <li key={hook}>{t(REQUEST_PLUGIN_STAGE_LABELS[hook] ?? hook)}</li>
            ))}
          </ol>
        ) : (
          <p className='text-sm'>{t('Not declared')}</p>
        )}
      </div>
      <div className='space-y-2'>
        <h4 className='text-muted-foreground text-xs'>{t('Settings')}</h4>
        {fields.length ? (
          <Table aria-label={t('Settings')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Type')}</TableHead>
                <TableHead>{t('Default')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map(([name, field]) => {
                const description = resolveLocalizedText(
                  field.description,
                  i18n.language
                )
                return (
                  <TableRow key={name}>
                    <TableCell className='max-w-72 break-words whitespace-normal'>
                      <div className='font-medium'>
                        {resolveLocalizedText(field.title, i18n.language) ||
                          name}
                      </div>
                      {description && (
                        <div className='text-muted-foreground text-xs'>
                          {description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {t(FIELD_TYPE_LABELS[field.type] ?? field.type)}
                    </TableCell>
                    <TableCell className='max-w-48 font-mono text-xs break-all whitespace-normal'>
                      {field.default === undefined
                        ? '—'
                        : JSON.stringify(field.default)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className='text-sm'>{t('This plugin has no settings.')}</p>
        )}
      </div>
    </section>
  )
}
