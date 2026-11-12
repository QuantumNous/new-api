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
import { useMutation } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TaskPluginOption } from '@/features/channels/api'
import { RequestPluginRecord } from '@/features/usage-logs/components/request-plugin-record'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { dryRunRequestPlugins } from '../api'
import { localizedPluginName } from '../lib/plugin-name'
import {
  REQUEST_PLUGIN_DRY_RUN_FORMATS,
  REQUEST_PLUGIN_STAGE_LABELS,
  requestPluginDryRunExample,
  requestPluginDryRunPath,
} from '../lib/request-plugins'
import type { RequestPluginDryRunResult, RequestPluginInstance } from '../types'
import { SourceDiff } from './source-diff'

type RequestPluginDryRunDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  instances: RequestPluginInstance[]
  plugins: TaskPluginOption[]
  groups: string[]
}

const DEFAULT_FORMAT = REQUEST_PLUGIN_DRY_RUN_FORMATS[0]

/** Runs the saved instances on a sample request; nothing is sent or charged. */
export function RequestPluginDryRunDialog(
  props: RequestPluginDryRunDialogProps
) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Dry run')}
      description={t('Runs the saved instances on a sample request.')}
      contentClassName='sm:max-w-4xl'
    >
      {props.open && <DryRunForm {...props} />}
    </Dialog>
  )
}

function DryRunForm(props: RequestPluginDryRunDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [format, setFormat] = useState<string>(DEFAULT_FORMAT.value)
  const [model, setModel] = useState<string>(DEFAULT_FORMAT.model)
  const [group, setGroup] = useState('')
  const [channelId, setChannelId] = useState('')
  const [body, setBody] = useState(() =>
    JSON.stringify(
      requestPluginDryRunExample(DEFAULT_FORMAT.value, DEFAULT_FORMAT.model),
      null,
      2
    )
  )
  const [inputError, setInputError] = useState('')
  const [sentBody, setSentBody] = useState('')
  const mutation = useMutation({
    mutationFn: dryRunRequestPlugins,
    meta: { errorToast: false },
  })
  const result = mutation.data

  const run = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = null
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setInputError('Request body must be a JSON object.')
      return
    }
    const channel = channelId.trim() ? Number(channelId) : undefined
    if (channel !== undefined && !(Number.isInteger(channel) && channel > 0)) {
      setInputError('Enter a valid channel ID.')
      return
    }
    setInputError('')
    setSentBody(JSON.stringify(parsed, null, 2))
    mutation.mutate({
      format,
      path: requestPluginDryRunPath(format, model.trim()),
      model: model.trim(),
      group: group.trim() || undefined,
      channel_id: channel,
      body: parsed,
    })
  }

  const instanceName = (id: string) =>
    props.instances.find((instance) => instance.id === id)?.name ||
    result?.steps?.find((step) => step.instance === id)?.name ||
    id
  const pluginName = (key: string) => {
    const plugin = props.plugins.find((item) => item.key === key)
    return plugin ? localizedPluginName(plugin, i18n.language) : key
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field>
          <FieldLabel htmlFor='request-plugin-dry-run-format'>
            {t('Format')}
          </FieldLabel>
          <Select
            value={format}
            items={REQUEST_PLUGIN_DRY_RUN_FORMATS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            onValueChange={(value) => {
              const next = REQUEST_PLUGIN_DRY_RUN_FORMATS.find(
                (item) => item.value === value
              )
              if (!next) return
              setFormat(next.value)
              setModel(next.model)
              setBody(
                JSON.stringify(
                  requestPluginDryRunExample(next.value, next.model),
                  null,
                  2
                )
              )
            }}
          >
            <SelectTrigger
              id='request-plugin-dry-run-format'
              className='w-full'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_PLUGIN_DRY_RUN_FORMATS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor='request-plugin-dry-run-model'>
            {t('Model')}
          </FieldLabel>
          <Input
            id='request-plugin-dry-run-model'
            value={model}
            placeholder={DEFAULT_FORMAT.model}
            onChange={(event) => setModel(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='request-plugin-dry-run-group'>
            {t('Group')}
          </FieldLabel>
          <Combobox
            id='request-plugin-dry-run-group'
            aria-label={t('Group')}
            options={props.groups.map((item) => ({ value: item, label: item }))}
            value={group}
            onValueChange={(value) => setGroup(value ?? '')}
            placeholder={t('Optional, for example: default')}
            allowCustomValue
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='request-plugin-dry-run-channel'>
            {t('Channel ID')}
          </FieldLabel>
          <Input
            id='request-plugin-dry-run-channel'
            inputMode='numeric'
            value={channelId}
            placeholder={t('Optional, for example: 12')}
            onChange={(event) => setChannelId(event.target.value)}
          />
          <FieldDescription>
            {t('Also runs the instances this channel adds.')}
          </FieldDescription>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor='request-plugin-dry-run-body'>
          {t('Request body')}
        </FieldLabel>
        <JsonCodeEditor
          id='request-plugin-dry-run-body'
          ariaLabel={t('Request body')}
          value={body}
          onChange={setBody}
          heightClassName='h-56 min-h-56 max-h-56'
        />
        {inputError && <FieldError>{t(inputError)}</FieldError>}
      </Field>
      <div className='flex justify-end'>
        <Button disabled={mutation.isPending || !model.trim()} onClick={run}>
          {mutation.isPending ? (
            <Spinner aria-hidden='true' />
          ) : (
            <Play aria-hidden='true' />
          )}
          {t('Run')}
        </Button>
      </div>
      {mutation.isError && (
        <FieldError className='whitespace-pre-wrap'>
          {getServerErrorMessage(mutation.error)}
        </FieldError>
      )}
      {result && (
        <DryRunResult
          result={result}
          sentBody={sentBody}
          instanceName={instanceName}
          pluginName={pluginName}
          locale={locale}
        />
      )}
    </div>
  )
}

function DryRunResult(props: {
  result: RequestPluginDryRunResult
  sentBody: string
  instanceName: (id: string) => string
  pluginName: (key: string) => string
  locale?: string
}) {
  const { t } = useTranslation()
  const steps = props.result.steps ?? []
  const headerSet = Object.entries(props.result.headers?.set ?? {})
  const headerRemove = props.result.headers?.remove ?? []
  let outcome = (
    <p role='status' className='text-sm'>
      {t('The request passed every instance.')}
    </p>
  )
  if (props.result.rejected) {
    outcome = (
      <p role='status' className='text-destructive text-sm break-words'>
        {t('Refused by {{name}}: {{message}} (code: {{code}})', {
          name: props.instanceName(props.result.rejected.instance),
          message: props.result.rejected.message,
          code: props.result.rejected.code,
        })}
      </p>
    )
  } else if (props.result.failed) {
    outcome = (
      <p role='status' className='text-destructive text-sm break-words'>
        {t('{{name}} failed: {{error}}', {
          name: props.instanceName(props.result.failed.instance),
          error: props.result.failed.error,
        })}
      </p>
    )
  }

  return (
    <section className='space-y-4 border-t pt-4' aria-label={t('Result')}>
      <h3 className='text-sm font-semibold'>{t('Result')}</h3>
      {outcome}
      {steps.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No instance ran for this request.')}
        </p>
      ) : (
        <Table aria-label={t('Steps')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Instance')}</TableHead>
              <TableHead>{t('Stage')}</TableHead>
              <TableHead>{t('Action')}</TableHead>
              <TableHead>{t('Changes')}</TableHead>
              <TableHead>{t('Findings')}</TableHead>
              <TableHead>{t('Duration')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((step) => {
              let action = step.action
              if (step.action === 'continue') action = t('Passed')
              if (step.action === 'reject') action = t('Refused')
              if (step.action === 'unchecked') action = t('Not checked')
              return (
                <TableRow key={`${step.instance}-${step.stage}`}>
                  <TableCell className='max-w-48 break-words whitespace-normal'>
                    {step.name || props.instanceName(step.instance)}
                    <span className='text-muted-foreground block text-xs'>
                      {props.pluginName(step.plugin)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {t(REQUEST_PLUGIN_STAGE_LABELS[step.stage] ?? step.stage)}
                  </TableCell>
                  <TableCell className='max-w-56 break-words whitespace-normal'>
                    {action}
                    {step.error && (
                      <span className='text-destructive block text-xs'>
                        {step.error}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatNumber(step.effects, props.locale)}
                  </TableCell>
                  <TableCell className='max-w-56 break-words whitespace-normal'>
                    {step.findings?.length
                      ? step.findings
                          .map(
                            (finding) =>
                              `${finding.rule}${finding.category ? ` (${finding.category})` : ''} × ${formatNumber(finding.count, props.locale)}`
                          )
                          .join(', ')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {t('{{value}} ms', {
                      value: formatNumber(step.duration_ms, props.locale),
                    })}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      <div className='space-y-2'>
        <h4 className='text-sm font-medium'>{t('Request body')}</h4>
        <SourceDiff
          before={props.sentBody}
          after={JSON.stringify(props.result.body ?? null, null, 2)}
          label={t('Request body changes')}
          emptyText={t('The request body is unchanged.')}
        />
      </div>
      <div className='space-y-2'>
        <h4 className='text-sm font-medium'>{t('Header changes')}</h4>
        {headerSet.length === 0 && headerRemove.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No header changes.')}
          </p>
        ) : (
          <ul className='space-y-1 font-mono text-xs break-all'>
            {headerSet.map(([name, value]) => (
              <li key={`set-${name}`}>
                {t('Set')} {name}: {value}
              </li>
            ))}
            {headerRemove.map((name) => (
              <li key={`remove-${name}`}>
                {t('Remove')} {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {props.result.reasoning_effort && (
        <p className='text-sm'>
          {t('Reasoning effort: {{effort}}', {
            effort: props.result.reasoning_effort,
          })}
        </p>
      )}
      <div className='space-y-2'>
        <h4 className='text-sm font-medium'>
          {t('What users see in their logs')}
        </h4>
        {props.result.record?.length ? (
          <RequestPluginRecord items={props.result.record} loadIcons />
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('Nothing about this request is shown in user logs.')}
          </p>
        )}
      </div>
    </section>
  )
}
