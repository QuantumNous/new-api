import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getRecallActivitySMTPStatus,
  recallCampaignKeys,
  updateRecallActivitySMTP,
} from '../api'
import { getRecallActivitySMTPSafeSaveErrorCopyKey } from '../copy'
import type {
  RecallActivitySMTPInput,
  RecallActivitySMTPStatus,
} from '../types'

const SMTP_LOAD_ERROR = 'Failed to load Activity SMTP settings.'
const SMTP_SAVE_SUCCESS = 'Activity SMTP settings saved.'

export type RecallActivitySMTPFormValues = RecallActivitySMTPInput

type RecallActivitySMTPField = keyof RecallActivitySMTPFormValues
type RecallActivitySMTPFieldErrors = Partial<
  Record<RecallActivitySMTPField, string>
>

interface CampaignSMTPSettingsViewProps {
  disabled: boolean
  error: string
  expanded: boolean
  fieldErrors: RecallActivitySMTPFieldErrors
  loading?: boolean
  pending: boolean
  status: RecallActivitySMTPStatus
  success: string
  values: RecallActivitySMTPFormValues
  onFieldChange: (
    field: RecallActivitySMTPField,
    value: string | number | boolean
  ) => void
  onEdit: () => void
  onSave: () => void
}

const plainMailboxPattern =
  /^[^\s@<>()"'[\],;:\r\n]+@[^\s@<>()"'[\],;:\r\n]+\.[^\s@<>()"'[\],;:\r\n]+$/

function createEmptyStatus(): RecallActivitySMTPStatus {
  return {
    server: '',
    port: 587,
    account: '',
    email_from: '',
    ssl_enabled: false,
    force_auth_login: true,
    token_configured: false,
    configured: false,
    reply_to: '',
    unsubscribe_mailto: '',
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function createRecallActivitySMTPFormValues(
  status: RecallActivitySMTPStatus | undefined
): RecallActivitySMTPFormValues {
  const source = status ?? createEmptyStatus()
  return {
    server: source.server,
    port: source.port || 587,
    account: source.account,
    email_from: source.email_from,
    token: '',
    ssl_enabled: source.ssl_enabled,
    force_auth_login: source.force_auth_login,
    reply_to: source.reply_to ?? '',
    unsubscribe_mailto: source.unsubscribe_mailto ?? '',
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function normalizeRecallActivitySMTPInput(
  values: RecallActivitySMTPFormValues
): RecallActivitySMTPInput {
  return {
    server: values.server.trim(),
    port: values.port,
    account: values.account.trim(),
    email_from: values.email_from.trim(),
    token: values.token.trim() ? values.token : '',
    ssl_enabled: values.ssl_enabled,
    force_auth_login: values.force_auth_login,
    reply_to: values.reply_to.trim(),
    unsubscribe_mailto: values.unsubscribe_mailto.trim(),
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function recallActivitySMTPSchema(
  status: RecallActivitySMTPStatus | undefined
) {
  return z
    .object({
      server: z.string().refine((value) => value.trim().length > 0, {
        message: 'SMTP server is required.',
      }),
      port: z
        .number({ error: 'SMTP port is required.' })
        .int('SMTP port must be an integer.')
        .min(1, 'SMTP port must be between 1 and 65535.')
        .max(65535, 'SMTP port must be between 1 and 65535.'),
      account: z.string().refine((value) => value.trim().length > 0, {
        message: 'SMTP account is required.',
      }),
      email_from: z.string().refine(
        (value) => {
          const trimmed = value.trim()
          return trimmed.length > 0 && plainMailboxPattern.test(trimmed)
        },
        { message: 'Sender must be a plain email address.' }
      ),
      token: z.string(),
      ssl_enabled: z.boolean(),
      force_auth_login: z.boolean(),
      // Optional: empty simply omits the header.
      reply_to: z.string().refine(
        (value) => {
          const trimmed = value.trim()
          return trimmed.length === 0 || plainMailboxPattern.test(trimmed)
        },
        { message: 'Reply-to must be a plain email address.' }
      ),
      unsubscribe_mailto: z.string().refine(
        (value) => {
          const trimmed = value.trim()
          if (trimmed.length === 0) return true
          if (!trimmed.startsWith('mailto:')) return false
          return plainMailboxPattern.test(trimmed.slice('mailto:'.length))
        },
        { message: 'Unsubscribe mailbox must look like mailto:name@example.com.' }
      ),
    })
    .superRefine((values, context) => {
      if (status?.token_configured) return
      if (values.token.trim().length > 0) return
      context.addIssue({
        code: 'custom',
        path: ['token'],
        message: 'SMTP token is required for first save.',
      })
    })
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallActivitySMTPSaveSuccessState(
  status: RecallActivitySMTPStatus
): {
  status: RecallActivitySMTPStatus
  success: string
  values: RecallActivitySMTPFormValues
} {
  return {
    status,
    success: SMTP_SAVE_SUCCESS,
    values: createRecallActivitySMTPFormValues(status),
  }
}

function FieldError({
  id,
  message,
}: {
  id: string
  message?: string
}): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!message) return null
  return (
    <p id={id} role='alert' className='text-destructive text-xs'>
      {t(message)}
    </p>
  )
}

function getFieldErrorId(fieldId: string): string {
  return `${fieldId}-error`
}

function getFieldAriaInvalid(message?: string): true | undefined {
  if (message) return true
  return undefined
}

function getFieldDescription(
  fieldId: string,
  message?: string
): string | undefined {
  if (message) return getFieldErrorId(fieldId)
  return undefined
}

function getTokenDescription(message?: string): string {
  const helpId = 'recall-smtp-token-help'
  if (message) return `${helpId} ${getFieldErrorId('recall-smtp-token')}`
  return helpId
}

function getConfigurationStatusLabel(
  props: CampaignSMTPSettingsViewProps
): string {
  if (props.loading) return 'Loading SMTP settings'
  if (props.status.configured) return 'Configured'
  return 'Not configured'
}

const SMTP_FORM_ID = 'recall-smtp-settings-form'

export function CampaignSMTPSettingsView(
  props: CampaignSMTPSettingsViewProps
): React.JSX.Element {
  const { t } = useTranslation()
  const disabled = props.disabled || props.pending
  const showForm =
    !props.loading && (!props.status.configured || props.expanded)
  const showEdit = props.status.configured && !props.loading
  const serverEndpoint = `${props.status.server}:${props.status.port}`

  return (
    <div className='w-full min-w-0 space-y-3 rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <h2 className='text-sm font-medium'>{t('Activity SMTP settings')}</h2>
          {props.status.configured ? (
            <div className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs'>
              <span>{props.status.email_from}</span>
              <span>{serverEndpoint}</span>
            </div>
          ) : (
            <p className='text-muted-foreground text-xs'>
              {t(
                'All Activity Configuration campaigns use this dedicated SMTP account.'
              )}
            </p>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <span className='rounded-md border px-2 py-1 text-xs'>
            {t(getConfigurationStatusLabel(props))}
          </span>
          {showEdit ? (
            <Button
              type='button'
              aria-controls={SMTP_FORM_ID}
              aria-expanded={props.expanded}
              disabled={disabled}
              onClick={props.onEdit}
            >
              {t('Edit')}
            </Button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <form
          id={SMTP_FORM_ID}
          className='grid gap-3 md:grid-cols-2'
          onSubmit={(event) => {
            event.preventDefault()
            props.onSave()
          }}
        >
          <div className='space-y-1'>
            <Label htmlFor='recall-smtp-server'>{t('SMTP server')}</Label>
            <Input
              id='recall-smtp-server'
              aria-describedby={getFieldDescription(
                'recall-smtp-server',
                props.fieldErrors.server
              )}
              aria-invalid={getFieldAriaInvalid(props.fieldErrors.server)}
              disabled={disabled}
              value={props.values.server}
              onChange={(event) =>
                props.onFieldChange('server', event.target.value)
              }
            />
            <FieldError
              id={getFieldErrorId('recall-smtp-server')}
              message={props.fieldErrors.server}
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='recall-smtp-port'>{t('SMTP port')}</Label>
            <Input
              id='recall-smtp-port'
              aria-describedby={getFieldDescription(
                'recall-smtp-port',
                props.fieldErrors.port
              )}
              aria-invalid={getFieldAriaInvalid(props.fieldErrors.port)}
              type='number'
              min={1}
              max={65535}
              step={1}
              disabled={disabled}
              value={props.values.port}
              onChange={(event) =>
                props.onFieldChange('port', Number(event.target.value))
              }
            />
            <FieldError
              id={getFieldErrorId('recall-smtp-port')}
              message={props.fieldErrors.port}
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='recall-smtp-account'>{t('SMTP account')}</Label>
            <Input
              id='recall-smtp-account'
              aria-describedby={getFieldDescription(
                'recall-smtp-account',
                props.fieldErrors.account
              )}
              aria-invalid={getFieldAriaInvalid(props.fieldErrors.account)}
              disabled={disabled}
              value={props.values.account}
              onChange={(event) =>
                props.onFieldChange('account', event.target.value)
              }
            />
            <FieldError
              id={getFieldErrorId('recall-smtp-account')}
              message={props.fieldErrors.account}
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='recall-smtp-email-from'>{t('Sender email')}</Label>
            <Input
              id='recall-smtp-email-from'
              aria-describedby={getFieldDescription(
                'recall-smtp-email-from',
                props.fieldErrors.email_from
              )}
              aria-invalid={getFieldAriaInvalid(props.fieldErrors.email_from)}
              type='email'
              disabled={disabled}
              value={props.values.email_from}
              onChange={(event) =>
                props.onFieldChange('email_from', event.target.value)
              }
            />
            <FieldError
              id={getFieldErrorId('recall-smtp-email-from')}
              message={props.fieldErrors.email_from}
            />
          </div>

          <div className='space-y-1 md:col-span-2'>
            <Label htmlFor='recall-smtp-token'>{t('SMTP token')}</Label>
            <Input
              id='recall-smtp-token'
              aria-describedby={getTokenDescription(props.fieldErrors.token)}
              aria-invalid={getFieldAriaInvalid(props.fieldErrors.token)}
              type='password'
              autoComplete='new-password'
              disabled={disabled}
              value={props.values.token}
              onChange={(event) =>
                props.onFieldChange('token', event.target.value)
              }
            />
            <p
              id='recall-smtp-token-help'
              className='text-muted-foreground text-xs'
            >
              {props.status.token_configured
                ? t('Leave blank to keep the existing SMTP token.')
                : t('Enter the SMTP token before saving.')}
            </p>
            <FieldError
              id={getFieldErrorId('recall-smtp-token')}
              message={props.fieldErrors.token}
            />
          </div>

          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={props.values.ssl_enabled}
              disabled={disabled}
              onCheckedChange={(checked) =>
                props.onFieldChange('ssl_enabled', checked === true)
              }
            />
            {t('SSL enabled')}
          </label>

          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={props.values.force_auth_login}
              disabled={disabled}
              onCheckedChange={(checked) =>
                props.onFieldChange('force_auth_login', checked === true)
              }
            />
            {t('Force AUTH LOGIN')}
          </label>

          <div className='space-y-1'>
            <Label htmlFor='recall-smtp-reply-to'>{t('Reply-to address')}</Label>
            <Input
              id='recall-smtp-reply-to'
              aria-describedby={getFieldDescription(
                'recall-smtp-reply-to',
                props.fieldErrors.reply_to
              )}
              aria-invalid={getFieldAriaInvalid(props.fieldErrors.reply_to)}
              type='email'
              disabled={disabled}
              value={props.values.reply_to}
              onChange={(event) =>
                props.onFieldChange('reply_to', event.target.value)
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Optional. Marketing mail without a reachable reply address scores worse with mailbox providers.'
              )}
            </p>
            <FieldError
              id={getFieldErrorId('recall-smtp-reply-to')}
              message={props.fieldErrors.reply_to}
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='recall-smtp-unsubscribe-mailto'>
              {t('Unsubscribe mailbox')}
            </Label>
            <Input
              id='recall-smtp-unsubscribe-mailto'
              aria-describedby={getFieldDescription(
                'recall-smtp-unsubscribe-mailto',
                props.fieldErrors.unsubscribe_mailto
              )}
              aria-invalid={getFieldAriaInvalid(
                props.fieldErrors.unsubscribe_mailto
              )}
              disabled={disabled}
              placeholder='mailto:unsubscribe@example.com'
              value={props.values.unsubscribe_mailto}
              onChange={(event) =>
                props.onFieldChange('unsubscribe_mailto', event.target.value)
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Optional mailto: fallback for clients without one-click unsubscribe. One-click always uses the console endpoint.'
              )}
            </p>
            <FieldError
              id={getFieldErrorId('recall-smtp-unsubscribe-mailto')}
              message={props.fieldErrors.unsubscribe_mailto}
            />
          </div>

          <div className='flex items-center gap-3 md:col-span-2'>
            <Button type='submit' disabled={disabled}>
              {props.pending ? t('Saving') : t('Save SMTP settings')}
            </Button>
          </div>
        </form>
      ) : null}

      {props.success ? (
        <p className='text-muted-foreground text-xs'>{t(props.success)}</p>
      ) : null}

      {props.error ? (
        <p role='alert' className='text-destructive text-xs'>
          {t(props.error)}
        </p>
      ) : null}
    </div>
  )
}

export function CampaignSMTPSettings(): React.JSX.Element {
  const queryClient = useQueryClient()
  const smtpQuery = useQuery({
    queryKey: recallCampaignKeys.smtp,
    queryFn: getRecallActivitySMTPStatus,
  })
  const [status, setStatus] =
    useState<RecallActivitySMTPStatus>(createEmptyStatus())
  const [expanded, setExpanded] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const expansionInitializedRef = useRef(false)
  const statusRef = useRef(status)
  const updateSMTP = useMutation({ mutationFn: updateRecallActivitySMTP })
  const form = useForm<RecallActivitySMTPFormValues>({
    resolver: (...resolverArguments) =>
      zodResolver(recallActivitySMTPSchema(statusRef.current))(
        ...resolverArguments
      ),
    defaultValues: createRecallActivitySMTPFormValues(status),
  })
  const values = form.watch()
  const formIsDirtyRef = useRef(false)
  formIsDirtyRef.current = form.formState.isDirty

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (!smtpQuery.data?.data) return
    statusRef.current = smtpQuery.data.data
    setStatus(smtpQuery.data.data)
    if (!expansionInitializedRef.current) {
      setExpanded(!smtpQuery.data.data.configured)
      expansionInitializedRef.current = true
    }
    if (!formIsDirtyRef.current) {
      form.reset(createRecallActivitySMTPFormValues(smtpQuery.data.data))
    }
    setError('')
  }, [form, smtpQuery.data])

  const save = form.handleSubmit(async (formValues) => {
    setError('')
    setSuccess('')
    try {
      const response = await updateSMTP.mutateAsync(
        normalizeRecallActivitySMTPInput(formValues)
      )
      if (!response.data) {
        setError(getRecallActivitySMTPSafeSaveErrorCopyKey(response.message))
        return
      }
      const nextState = getRecallActivitySMTPSaveSuccessState(response.data)
      statusRef.current = nextState.status
      setStatus(nextState.status)
      setSuccess(nextState.success)
      form.reset(nextState.values)
      if (nextState.status.configured) {
        setExpanded(false)
      } else {
        setExpanded(true)
      }
      queryClient.setQueryData(recallCampaignKeys.smtp, {
        success: true,
        data: nextState.status,
      })
      await queryClient.invalidateQueries({ queryKey: recallCampaignKeys.smtp })
    } catch (saveError) {
      setError(getRecallActivitySMTPSafeSaveErrorCopyKey(saveError))
    }
  })

  const fieldErrors = Object.fromEntries(
    Object.entries(form.formState.errors).map(([field, fieldError]) => [
      field,
      fieldError?.message ? String(fieldError.message) : '',
    ])
  ) as RecallActivitySMTPFieldErrors
  const loadError = smtpQuery.isError && !smtpQuery.data?.data
  const effectiveStatus = smtpQuery.data?.data ?? status
  const effectiveExpanded = expansionInitializedRef.current
    ? expanded
    : !effectiveStatus.configured
  const setValueOptions = {
    shouldDirty: true,
    shouldValidate: form.formState.submitCount > 0,
  }
  const changeField: CampaignSMTPSettingsViewProps['onFieldChange'] = (
    field,
    value
  ) => {
    if (field === 'server') form.setValue(field, String(value), setValueOptions)
    if (field === 'port') form.setValue(field, Number(value), setValueOptions)
    if (field === 'account')
      form.setValue(field, String(value), setValueOptions)
    if (field === 'email_from') {
      form.setValue(field, String(value), setValueOptions)
    }
    if (field === 'token') form.setValue(field, String(value), setValueOptions)
    if (field === 'ssl_enabled') {
      form.setValue(field, value === true, setValueOptions)
    }
    if (field === 'force_auth_login') {
      form.setValue(field, value === true, setValueOptions)
    }
    if (field === 'reply_to') {
      form.setValue(field, String(value), setValueOptions)
    }
    if (field === 'unsubscribe_mailto') {
      form.setValue(field, String(value), setValueOptions)
    }
    setError('')
    setSuccess('')
  }

  return (
    <CampaignSMTPSettingsView
      disabled={smtpQuery.isPending || loadError}
      error={loadError ? SMTP_LOAD_ERROR : error}
      expanded={effectiveExpanded}
      fieldErrors={fieldErrors}
      loading={smtpQuery.isPending}
      pending={updateSMTP.isPending}
      status={effectiveStatus}
      success={success}
      values={values}
      onFieldChange={changeField}
      onEdit={() => setExpanded(true)}
      onSave={() => void save()}
    />
  )
}
