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
import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { LoadingState } from '@/components/loading-state'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import type { PluginIconInput } from '@/features/task-plugins/lib/plugin-icon'
import { resolveLocalizedText } from '@/lib/localized-text'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { usePluginLogin } from '../../hooks/use-plugin-login'
import {
  DeviceStep,
  FieldsStep,
  PasteStep,
  PluginCredentialDetails,
  RedirectStep,
} from './plugin-login-steps'

const FORM_ID = 'plugin-login-form'

type PluginLoginDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId: number
  /** null logs in a new credential; an index logs in again on that line. */
  keyIndex: number | null
  /** Keeps a single-key channel's account and adds the new one next to it. */
  add?: boolean
  plugin: PluginIconInput
  onDone?: () => void
}

export function PluginLoginDialog(props: PluginLoginDialogProps) {
  const { t, i18n } = useTranslation()
  const login = usePluginLogin({
    channelId: props.channelId,
    keyIndex: props.keyIndex,
    add: props.add,
    onDone: props.onDone,
  })
  const ended = login.state.ended
  // A login the server ended keeps only its error and Start again on screen.
  const step = ended ? null : login.state.step
  const busy = login.state.status === 'busy'
  const failed = login.state.status === 'failed'
  const name = props.plugin.name || props.plugin.key

  let body: ReactNode = null
  if (step?.type === 'redirect') {
    body = <RedirectStep url={step.url} />
  } else if (step?.type === 'paste') {
    body = (
      <PasteStep
        url={step.url}
        hint={resolveLocalizedText(
          step.hint,
          i18n.resolvedLanguage || i18n.language
        )}
        formId={FORM_ID}
        disabled={busy}
        onSubmit={login.submit}
      />
    )
  } else if (step?.type === 'device') {
    body = (
      <DeviceStep
        userCode={step.user_code}
        verificationUri={step.verification_uri}
        verificationUriComplete={step.verification_uri_complete}
        secondsLeft={login.secondsLeft}
      />
    )
  } else if (step?.type === 'pending') {
    body = (
      <LoadingState
        inline
        size='sm'
        message={t('Waiting for you to confirm...')}
      />
    )
  } else if (step?.type === 'fields') {
    body = (
      <FieldsStep
        key={step.fields.map((field) => field.name).join('\n')}
        fields={step.fields}
        formId={FORM_ID}
        disabled={busy}
        onSubmit={login.submit}
      />
    )
  } else if (step?.type === 'done') {
    body = <PluginCredentialDetails credential={step.credential} />
  } else if (!failed) {
    body = <LoadingState inline size='sm' message={t('Loading...')} />
  }

  let problem: ReactNode = null
  if (login.expired && !ended) {
    problem = (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>{t('The code has expired')}</AlertTitle>
        <AlertAction>
          <Button size='sm' variant='outline' onClick={login.restart}>
            {t('Start again')}
          </Button>
        </AlertAction>
      </Alert>
    )
  } else if (failed) {
    problem = (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>{t('Login failed')}</AlertTitle>
        <AlertDescription>
          {getServerErrorMessage(login.state.error, t('Login failed'))}
        </AlertDescription>
        <AlertAction>
          <Button
            size='sm'
            variant='outline'
            onClick={ended ? login.restart : login.retry}
          >
            {ended ? t('Start again') : t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const takesInput = step?.type === 'paste' || step?.type === 'fields'
  let footer: ReactNode = (
    <Button variant='outline' onClick={() => props.onOpenChange(false)}>
      {t('Cancel')}
    </Button>
  )
  if (step?.type === 'done') {
    footer = (
      <Button onClick={() => props.onOpenChange(false)}>{t('Done')}</Button>
    )
  } else if (takesInput) {
    footer = (
      <>
        {footer}
        <Button type='submit' form={FORM_ID} disabled={busy}>
          {busy && <Spinner data-icon='inline-start' />}
          {t('Continue')}
        </Button>
      </>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <span className='flex min-w-0 items-center gap-2'>
          <PluginIcon plugin={props.plugin} size={20} />
          <span className='min-w-0 truncate'>
            {props.keyIndex === null
              ? t('Log in to {{name}}', { name })
              : t('Log in again to {{name}}', { name })}
          </span>
        </span>
      }
      contentClassName='sm:max-w-lg'
      bodyClassName='flex flex-col gap-4'
      footer={footer}
    >
      {body}
      {problem}
    </Dialog>
  )
}
