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
import { Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ParamOverrideEditorDialog } from '@/features/channels/components/dialogs/param-override-editor-dialog'

import {
  requestPluginFieldKind,
  requestPluginFieldVisible,
  type RequestPluginConfigDraft,
  type RequestPluginConfigRow,
  type RequestPluginFieldError,
} from '../lib/request-plugins'
import type { RequestPluginConfigSchema } from '../types'
import { RequestPluginConfigField } from './request-plugin-config-field'
import { RequestPluginConfigModelValues } from './request-plugin-config-model-values'
import { RequestPluginConfigRows } from './request-plugin-config-rows'

type RequestPluginConfigFormProps = {
  pluginKey: string
  schema?: RequestPluginConfigSchema
  draft: RequestPluginConfigDraft
  /** Every problem in the draft, keyed as fromRequestPluginConfigDraft does. */
  errors: Record<string, RequestPluginFieldError>
  /** Before a save is tried, only fields already edited show their problem. */
  showAllErrors?: boolean
  disabled?: boolean
  /** The models a value-per-model field offers. */
  models?: string[]
  onChange: (draft: RequestPluginConfigDraft) => void
}

/** The config form of an instance, generated from the plugin's configSchema. */
export function RequestPluginConfigForm(props: RequestPluginConfigFormProps) {
  const { t } = useTranslation()
  const [visualField, setVisualField] = useState<string | null>(null)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const properties = props.schema?.properties ?? {}
  const entries = Object.entries(properties)
  if (entries.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('This plugin has no settings.')}
      </p>
    )
  }
  const required = new Set(props.schema?.required ?? [])
  const errorFor = (path: string) =>
    props.showAllErrors || touched.has(path) ? props.errors[path] : undefined
  const update = (name: string, value: unknown, path = name) => {
    setTouched((current) => new Set(current).add(path))
    props.onChange({ ...props.draft, [name]: value })
  }

  return (
    <div className='divide-y rounded-xl border'>
      {entries.map(([name, field]) => {
        // A hidden field keeps its value for when it shows again.
        if (!requestPluginFieldVisible(field, properties, props.draft)) {
          return null
        }
        const id = `request-plugin-config-${name}`
        const kind = requestPluginFieldKind(field)
        if (kind === 'modelValues') {
          return (
            <RequestPluginConfigModelValues
              key={name}
              className='px-4 py-3.5'
              id={id}
              name={name}
              field={field}
              rows={(props.draft[name] as RequestPluginConfigRow[]) ?? []}
              models={props.models}
              disabled={props.disabled}
              errorFor={errorFor}
              onChange={(rows, path) => update(name, rows, path)}
            />
          )
        }
        if (kind === 'rows') {
          return (
            <RequestPluginConfigRows
              key={name}
              className='px-4 py-3.5'
              id={id}
              name={name}
              field={field}
              rows={(props.draft[name] as RequestPluginConfigRow[]) ?? []}
              disabled={props.disabled}
              errorFor={errorFor}
              onChange={(rows, path) => update(name, rows, path)}
            />
          )
        }
        return (
          <div key={name} className='px-4 py-3.5'>
            <RequestPluginConfigField
              id={id}
              name={name}
              field={field}
              value={props.draft[name]}
              required={required.has(name)}
              error={errorFor(name)}
              disabled={props.disabled}
              onChange={(value) => update(name, value)}
              action={
                props.pluginKey === 'param-override' &&
                name === 'override' && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={props.disabled}
                    onClick={() => setVisualField(name)}
                  >
                    <Wand2 aria-hidden='true' />
                    {t('Visual edit')}
                  </Button>
                )
              }
            />
          </div>
        )
      })}
      {visualField && (
        <ParamOverrideEditorDialog
          open
          value={
            typeof props.draft[visualField] === 'string'
              ? (props.draft[visualField] as string)
              : ''
          }
          onOpenChange={(open) => {
            if (!open) setVisualField(null)
          }}
          onSave={(next) => update(visualField, next)}
        />
      )}
    </div>
  )
}
