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
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, ExternalLink } from 'lucide-react'
import type { ReactElement } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { LoadingState } from '@/components/loading-state'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isHttpUrl } from '@/lib/content-format'
import { formatTimestampToDate } from '@/lib/format'
import { resolveLocalizedText } from '@/lib/localized-text'

import {
  pluginLoginFieldsSchema,
  pluginLoginPasteSchema,
  readPluginLoginRedirect,
  type PluginCredentialSummary,
  type PluginLoginField,
  type PluginLoginInput,
} from '../../lib/plugin-login'

/** Vendor pages open in a new tab that keeps no reference to this one. */
function VendorLink(props: { url: string; label: string }) {
  if (!isHttpUrl(props.url)) return null
  return (
    <Button
      role='link'
      variant='outline'
      className='w-fit'
      nativeButton={false}
      render={<a href={props.url} target='_blank' rel='noopener noreferrer' />}
    >
      <ExternalLink data-icon='inline-start' aria-hidden='true' />
      {props.label}
    </Button>
  )
}

/** The account and expiry of a credential that finished logging in. */
export function PluginCredentialDetails(props: {
  credential?: PluginCredentialSummary
}) {
  const { t } = useTranslation()
  const credential = props.credential
  const name = credential?.label || credential?.account_id
  const account =
    credential?.account_id && credential.account_id !== name
      ? credential.account_id
      : undefined
  return (
    <div className='flex items-start gap-3'>
      <CircleCheck className='text-success mt-0.5 size-5' aria-hidden='true' />
      <div className='flex min-w-0 flex-col gap-1'>
        <p className='font-medium'>{t('Logged in')}</p>
        {name && <p className='text-sm break-all'>{name}</p>}
        {account && (
          <p className='text-muted-foreground text-xs break-all'>
            {t('Account ID')}: {account}
          </p>
        )}
        {Boolean(credential?.expires_at) && (
          <p className='text-muted-foreground text-xs'>
            {t('Expires {{time}}', {
              time: formatTimestampToDate(credential?.expires_at),
            })}
          </p>
        )}
      </div>
    </div>
  )
}

export function RedirectStep(props: { url: string }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-4'>
      <p className='text-sm'>
        {t(
          'Sign in on the provider page in a new tab. This dialog updates when you finish.'
        )}
      </p>
      <VendorLink url={props.url} label={t('Open sign-in page')} />
      <LoadingState inline size='sm' message={t('Waiting for sign-in...')} />
    </div>
  )
}

export function PasteStep(props: {
  url: string
  hint?: string
  formId: string
  disabled: boolean
  onSubmit: (input: PluginLoginInput) => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(pluginLoginPasteSchema),
    defaultValues: { callback_url: '' },
  })
  const redirect = readPluginLoginRedirect(props.url)
  // The vendor appends its parameters to the redirect address it was given.
  let example: string | undefined
  if (redirect) {
    example = `${redirect}${redirect.includes('?') ? '&' : '?'}code=...&state=...`
  }
  return (
    <div className='flex flex-col gap-4'>
      <ol className='list-decimal space-y-3 ps-5 text-sm'>
        <li>
          {t('Open the sign-in page and sign in.')}
          <div className='mt-2'>
            <VendorLink url={props.url} label={t('Open sign-in page')} />
          </div>
        </li>
        <li>
          {t(
            'After sign-in, the browser goes to a page that may not load. That is expected.'
          )}
          {redirect && (
            <div className='mt-2 flex flex-col items-start gap-1'>
              {t("That page's address starts with:")}
              <code className='bg-muted rounded px-1.5 py-0.5 break-all'>
                {redirect}
              </code>
            </div>
          )}
        </li>
        <li>
          {t(
            "Copy the full address from that page's address bar and paste it below."
          )}
        </li>
      </ol>
      {props.hint && (
        <p className='text-muted-foreground text-sm'>{props.hint}</p>
      )}
      <Form {...form}>
        <form
          id={props.formId}
          onSubmit={form.handleSubmit((values) =>
            props.onSubmit({ callback_url: values.callback_url.trim() })
          )}
        >
          <FormField
            control={form.control}
            name='callback_url'
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('Address after sign-in')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder={example}
                    inputMode='url'
                    autoComplete='off'
                    spellCheck={false}
                    disabled={props.disabled}
                    className='min-h-20 font-mono break-all'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}

export function DeviceStep(props: {
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  secondsLeft: number | null
}) {
  const { t } = useTranslation()
  // The dialog shows the expiry and a way to start again.
  const expired = props.secondsLeft === 0
  let countdown = ''
  if (props.secondsLeft !== null && !expired) {
    const minutes = Math.floor(props.secondsLeft / 60)
    const seconds = String(props.secondsLeft % 60).padStart(2, '0')
    countdown = `${minutes}:${seconds}`
  }
  return (
    <div className='flex flex-col gap-4'>
      <p className='text-sm'>
        {t('Open the verification page and enter this code.')}
      </p>
      <div className='bg-muted/40 flex items-center justify-between gap-3 rounded-lg border px-4 py-3'>
        <span className='font-mono text-2xl font-semibold tracking-widest break-all'>
          {props.userCode}
        </span>
        <CopyButton value={props.userCode} />
      </div>
      <div className='flex flex-col gap-1'>
        <VendorLink
          url={props.verificationUriComplete || props.verificationUri}
          label={t('Open verification page')}
        />
        {isHttpUrl(props.verificationUri) && (
          <span className='text-muted-foreground text-xs break-all'>
            {props.verificationUri}
          </span>
        )}
      </div>
      {countdown && (
        <p className='text-muted-foreground text-sm tabular-nums'>
          {t('Code expires in {{time}}', { time: countdown })}
        </p>
      )}
      {!expired && (
        <LoadingState
          inline
          size='sm'
          message={t('Waiting for you to confirm...')}
        />
      )}
    </div>
  )
}

export function FieldsStep(props: {
  fields: PluginLoginField[]
  formId: string
  disabled: boolean
  onSubmit: (input: PluginLoginInput) => void
}) {
  const { i18n } = useTranslation()
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(pluginLoginFieldsSchema(props.fields)),
    defaultValues: Object.fromEntries(
      props.fields.map((field) => [field.name, ''])
    ),
  })
  const language = i18n.resolvedLanguage || i18n.language
  return (
    <Form {...form}>
      <form
        id={props.formId}
        className='flex flex-col gap-4'
        onSubmit={form.handleSubmit((values) =>
          props.onSubmit({ fields: values })
        )}
      >
        {props.fields.map((field) => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: input }) => {
              const placeholder =
                resolveLocalizedText(field.placeholder, language) || undefined
              // Values are credentials: no autofill, no spellcheck service.
              let control: ReactElement
              if (field.type === 'password') {
                control = (
                  <PasswordInput
                    {...input}
                    placeholder={placeholder}
                    disabled={props.disabled}
                    autoComplete='new-password'
                    spellCheck={false}
                  />
                )
              } else if (field.type === 'textarea') {
                control = (
                  <Textarea
                    {...input}
                    rows={5}
                    placeholder={placeholder}
                    disabled={props.disabled}
                    autoComplete='off'
                    spellCheck={false}
                    className='font-mono text-xs'
                  />
                )
              } else {
                control = (
                  <Input
                    {...input}
                    placeholder={placeholder}
                    disabled={props.disabled}
                    autoComplete='off'
                    spellCheck={false}
                  />
                )
              }
              return (
                <FormItem>
                  <FormLabel required={field.required}>
                    {resolveLocalizedText(field.label, language) || field.name}
                  </FormLabel>
                  <FormControl>{control}</FormControl>
                  {field.description && (
                    <FormDescription>
                      {resolveLocalizedText(field.description, language)}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        ))}
      </form>
    </Form>
  )
}
