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
import { useFormContext, useWatch } from 'react-hook-form'

import { RequestPluginConfigForm } from '@/features/task-plugins/components/request-plugin-config-form'
import {
  fromRequestPluginConfigDraft,
  toRequestPluginConfigDraft,
  type RequestPluginConfigDraft,
} from '@/features/task-plugins/lib/request-plugins'
import type { RequestPluginConfigSchema } from '@/features/task-plugins/types'

import type { ChannelFormValues } from '../../lib/channel-form'

type ChannelPluginConfigFieldsProps = {
  pluginKey: string
  schema: RequestPluginConfigSchema
  /** The channel's models, offered by value-per-model fields. */
  models: string[]
  disabled?: boolean
}

/**
 * The settings a plugin declares for its channels. The saved values stay as
 * they are until a field is edited; a field left empty uses the plugin's
 * default.
 */
export function ChannelPluginConfigFields(
  props: ChannelPluginConfigFieldsProps
) {
  const form = useFormContext<ChannelFormValues>()
  const [config, typed] = useWatch({
    control: form.control,
    name: ['plugin_config', 'plugin_config_draft'],
  })
  const submitted = form.formState.submitCount > 0
  const draft = useMemo<RequestPluginConfigDraft>(() => {
    if (typed) return typed
    // A switch cannot show "not set", so an unset one shows its default.
    const values: Record<string, unknown> = {}
    for (const [name, field] of Object.entries(props.schema.properties)) {
      if (field.type === 'boolean' && field.default !== undefined) {
        values[name] = field.default
      }
    }
    return toRequestPluginConfigDraft(props.schema, { ...values, ...config })
  }, [typed, config, props.schema])
  const errors = useMemo(
    () => fromRequestPluginConfigDraft(props.schema, draft).errors,
    [props.schema, draft]
  )

  return (
    <RequestPluginConfigForm
      pluginKey={props.pluginKey}
      schema={props.schema}
      draft={draft}
      errors={errors}
      showAllErrors={submitted}
      models={props.models}
      disabled={props.disabled}
      onChange={(next) =>
        form.setValue('plugin_config_draft', next, { shouldDirty: true })
      }
    />
  )
}
