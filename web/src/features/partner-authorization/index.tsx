/*
Copyright (C) 2023-2026 QuantumNous
*/
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'

import {
  decidePartnerAuthorization,
  getPartnerAuthorization,
  type PartnerAuthorizationView,
} from './api'

type ConsentState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'error'
  | 'framed'
  | 'settled'

function navigateWithoutReferrer(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.referrerPolicy = 'no-referrer'
  link.rel = 'noreferrer'
  link.click()
}

function scopeLabel(scope: string, t: (key: string) => string) {
  if (scope === 'account:read')
    return t('Read your account profile and balance')
  if (scope === 'credential:read') return t('Receive a dedicated API key')
  if (scope === 'payment:write') {
    return t('Create top-up orders that you confirm on the payment page')
  }
  if (scope === 'offline_access') return t('Stay connected for 30 days')
  return scope
}

export function PartnerAuthorization(props: { request?: string }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [state, setState] = useState<ConsentState>('loading')
  const [view, setView] = useState<PartnerAuthorizationView | null>(null)

  useEffect(() => {
    const existing = document.querySelector('meta[name="referrer"]')
    const meta = existing ?? document.createElement('meta')
    meta.setAttribute('name', 'referrer')
    meta.setAttribute('content', 'no-referrer')
    if (!existing) document.head.appendChild(meta)
  }, [])

  useEffect(() => {
    if (window.self !== window.top) {
      setState('framed')
      return
    }
    if (!props.request) {
      setState('error')
      return
    }
    let cancelled = false
    void getPartnerAuthorization(props.request)
      .then((data) => {
        if (cancelled) return
        setView(data)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [props.request])

  const decide = async (decision: 'approve' | 'deny') => {
    if (!props.request || state === 'submitting') return
    setState('submitting')
    try {
      const result = await decidePartnerAuthorization(props.request, decision)
      setState('settled')
      navigateWithoutReferrer(result.redirect_to)
    } catch {
      setState('error')
    }
  }

  const expiry = view?.grant_expires_at
    ? new Date(view.grant_expires_at).toLocaleString(locale)
    : ''

  return (
    <Main className='overflow-auto'>
      <div className='flex min-h-full items-center justify-center px-4 py-10'>
        <section className='w-full max-w-[620px]' aria-live='polite'>
          <div className='border-border/70 bg-card overflow-hidden rounded-[28px] border shadow-sm'>
            <header className='border-border/70 border-b px-6 py-5'>
              <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
                {t('Partner authorization')}
              </p>
              <h1 className='mt-1 text-xl font-semibold tracking-tight'>
                {t('Authorize a third-party assistant')}
              </h1>
            </header>
            <div className='space-y-6 px-6 py-7'>
              {state === 'framed' && (
                <Status
                  title={t('This page cannot be opened in a frame')}
                  description={t(
                    'Open this authorization page directly in your browser.'
                  )}
                />
              )}
              {state === 'loading' && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <LoaderCircle className='size-4 animate-spin' aria-hidden />
                  {t('Loading...')}
                </div>
              )}
              {state === 'error' && (
                <Status
                  title={t('Please restart authorization from the app')}
                  description={t(
                    'This request is invalid, expired, or was opened in another browser.'
                  )}
                />
              )}
              {(state === 'ready' || state === 'submitting') && view && (
                <>
                  <p className='text-sm leading-6'>
                    {t(
                      '{{name}} wants to connect to your account and call models with your balance.',
                      { name: view.client_name }
                    )}
                  </p>
                  <dl className='space-y-3 text-sm'>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Application')}
                      </dt>
                      <dd className='font-medium'>{view.client_name}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Callback host')}
                      </dt>
                      <dd className='font-medium'>{view.redirect_host}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>{t('Access')}</dt>
                      <dd>
                        <ul className='list-disc space-y-1 pl-5'>
                          {view.scopes.map((scope) => (
                            <li key={scope}>{scopeLabel(scope, t)}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        {t('Valid until')}
                      </dt>
                      <dd className='font-medium'>{expiry}</dd>
                    </div>
                  </dl>
                  <p className='border-destructive/25 bg-destructive/5 rounded-xl border p-3 text-sm'>
                    {t(
                      'Approving issues an unlimited-quota API key that can spend your balance. You can disable it later in your token list.'
                    )}
                  </p>
                  {view.active_binding_limit_reached && (
                    <Status
                      title={t('Binding limit reached')}
                      description={t(
                        'Revoke an existing authorization for this app before approving another.'
                      )}
                    />
                  )}
                  <div className='flex flex-col-reverse gap-3 sm:flex-row'>
                    <Button
                      type='button'
                      variant='outline'
                      className='flex-1'
                      disabled={state === 'submitting'}
                      onClick={() => void decide('deny')}
                    >
                      {t('Deny')}
                    </Button>
                    <Button
                      type='button'
                      className='flex-1'
                      disabled={
                        state === 'submitting' ||
                        view.active_binding_limit_reached
                      }
                      onClick={() => void decide('approve')}
                    >
                      {state === 'submitting'
                        ? t('Authorizing...')
                        : t('Approve')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </Main>
  )
}

function Status(props: { title: string; description: string }) {
  return (
    <div className='border-destructive/25 bg-destructive/5 flex gap-3 rounded-xl border p-4'>
      <CircleAlert
        className='text-destructive mt-0.5 size-4 shrink-0'
        aria-hidden
      />
      <div>
        <p className='text-sm font-medium'>{props.title}</p>
        <p className='text-muted-foreground mt-1 text-xs leading-5'>
          {props.description}
        </p>
      </div>
    </div>
  )
}
