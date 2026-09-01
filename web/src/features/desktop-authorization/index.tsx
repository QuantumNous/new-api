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
import {
  Check,
  CircleAlert,
  KeyRound,
  Leaf,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'

import {
  decideDesktopAuthorization,
  type DesktopAuthorizationDecision,
} from './api'

type AuthorizationState =
  | 'ready'
  | 'submitting'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'error'

interface DesktopAuthorizationProps {
  userCode?: string
}

const normalizeUserCode = (value?: string) =>
  value
    ?.trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9-]/g, '') ?? ''

export function DesktopAuthorization({ userCode }: DesktopAuthorizationProps) {
  const { t } = useTranslation()
  const code = normalizeUserCode(userCode)
  const [state, setState] = useState<AuthorizationState>(
    code ? 'ready' : 'error'
  )

  const decide = async (decision: DesktopAuthorizationDecision) => {
    if (!code || state === 'submitting') return
    setState('submitting')
    try {
      const result = await decideDesktopAuthorization(code, decision)
      if (result.success) {
        setState(decision === 'approve' ? 'approved' : 'denied')
      } else if (
        result.code === 'expired_token' ||
        result.code === 'invalid_request'
      ) {
        setState('expired')
      } else {
        setState('error')
      }
    } catch (error: unknown) {
      const responseCode = (
        error as { response?: { data?: { code?: string } } }
      ).response?.data?.code
      setState(
        responseCode === 'expired_token' || responseCode === 'invalid_request'
          ? 'expired'
          : 'error'
      )
    }
  }

  const settled = state === 'approved' || state === 'denied'

  return (
    <Main className='overflow-auto'>
      <div className='relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10 sm:px-8'>
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_42%)]'
        />

        <section className='relative w-full max-w-[620px]' aria-live='polite'>
          <div className='border-border/70 bg-card/95 shadow-foreground/5 overflow-hidden rounded-[28px] border shadow-2xl backdrop-blur-xl'>
            <header className='border-border/70 flex items-center gap-4 border-b px-6 py-5 sm:px-8'>
              <div className='bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl'>
                <Leaf className='size-5' aria-hidden='true' />
              </div>
              <div className='min-w-0'>
                <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
                  {t('Official desktop connection')}
                </p>
                <h1 className='mt-1 text-xl font-semibold tracking-tight sm:text-2xl'>
                  {t('Connect 野菜API Desktop')}
                </h1>
              </div>
            </header>

            <div className='space-y-7 px-6 py-7 sm:px-8 sm:py-8'>
              {settled ? (
                <ResultState state={state} />
              ) : (
                <>
                  <div>
                    <p className='text-foreground text-[15px] leading-7'>
                      {t(
                        'The desktop app is asking to use your 野菜API account on this computer.'
                      )}
                    </p>
                    <p className='text-muted-foreground mt-1 text-sm leading-6'>
                      {t(
                        'Only continue if you started this connection in the official desktop app.'
                      )}
                    </p>
                  </div>

                  <div className='bg-muted/45 ring-border/70 rounded-2xl px-5 py-4 ring-1'>
                    <p className='text-muted-foreground text-xs font-medium'>
                      {t('Code shown in the app')}
                    </p>
                    <p className='mt-2 font-mono text-2xl font-semibold tracking-[0.18em] tabular-nums sm:text-3xl'>
                      {code || '—'}
                    </p>
                    <p className='text-muted-foreground mt-2 text-xs leading-5'>
                      {t('Make sure this code matches before you connect.')}
                    </p>
                  </div>

                  <div className='grid gap-3 sm:grid-cols-3'>
                    <PermissionItem
                      icon={WalletCards}
                      label={t('View balance and usage')}
                    />
                    <PermissionItem
                      icon={KeyRound}
                      label={t('Configure your AI apps')}
                    />
                    <PermissionItem
                      icon={ShieldCheck}
                      label={t('Create a revocable session')}
                    />
                  </div>

                  {state === 'expired' && (
                    <StatusMessage
                      icon={CircleAlert}
                      title={t('This connection request has expired')}
                      description={t(
                        'Return to the desktop app and start the connection again.'
                      )}
                    />
                  )}
                  {state === 'error' && (
                    <StatusMessage
                      icon={CircleAlert}
                      title={
                        code
                          ? t('Could not confirm this connection')
                          : t('The connection code is missing')
                      }
                      description={
                        code
                          ? t(
                              'Check your connection and try again. No access was granted.'
                            )
                          : t(
                              'Open this page again from the desktop app to continue.'
                            )
                      }
                    />
                  )}

                  <div className='flex flex-col-reverse gap-3 pt-1 sm:flex-row'>
                    <Button
                      type='button'
                      variant='outline'
                      size='lg'
                      className='h-11 flex-1 rounded-xl'
                      disabled={!code || state === 'submitting'}
                      onClick={() => void decide('deny')}
                    >
                      {t('Do not connect')}
                    </Button>
                    <Button
                      type='button'
                      size='lg'
                      className='h-11 flex-1 rounded-xl shadow-sm'
                      disabled={!code || state === 'submitting'}
                      onClick={() => void decide('approve')}
                    >
                      {state === 'submitting' ? (
                        <LoaderCircle
                          className='size-4 animate-spin'
                          aria-hidden='true'
                        />
                      ) : (
                        <Check className='size-4' aria-hidden='true' />
                      )}
                      {state === 'submitting'
                        ? t('Connecting...')
                        : t('Connect this computer')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <p className='text-muted-foreground mt-4 text-center text-xs leading-5'>
            {t(
              'This approval does not reveal your password or API keys to the desktop app.'
            )}
          </p>
        </section>
      </div>
    </Main>
  )
}

function PermissionItem({
  icon: Icon,
  label,
}: {
  icon: typeof WalletCards
  label: string
}) {
  return (
    <div className='border-border/70 bg-background/55 flex min-h-24 flex-col gap-3 rounded-2xl border p-4'>
      <Icon className='text-primary size-5' aria-hidden='true' />
      <p className='text-foreground/90 text-sm leading-5 font-medium'>
        {label}
      </p>
    </div>
  )
}

function StatusMessage({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CircleAlert
  title: string
  description: string
}) {
  return (
    <div className='border-destructive/25 bg-destructive/5 flex gap-3 rounded-xl border p-4'>
      <Icon className='text-destructive mt-0.5 size-4 shrink-0' aria-hidden />
      <div>
        <p className='text-sm font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-xs leading-5'>
          {description}
        </p>
      </div>
    </div>
  )
}

function ResultState({ state }: { state: 'approved' | 'denied' }) {
  const { t } = useTranslation()
  const approved = state === 'approved'
  const Icon = approved ? Check : X
  return (
    <div className='flex flex-col items-center py-7 text-center'>
      <div
        className={
          approved
            ? 'bg-primary/10 text-primary flex size-16 items-center justify-center rounded-3xl'
            : 'bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-3xl'
        }
      >
        <Icon className='size-7' aria-hidden='true' />
      </div>
      <h2 className='mt-5 text-2xl font-semibold tracking-tight'>
        {approved ? t('Connection approved') : t('Connection declined')}
      </h2>
      <p className='text-muted-foreground mt-2 max-w-sm text-sm leading-6'>
        {approved
          ? t('You can close this page and return to the desktop app.')
          : t('No access was granted. You can close this page.')}
      </p>
    </div>
  )
}
