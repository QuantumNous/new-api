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
import { useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { createFileRoute, redirect, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  approveCliDeviceAuthorization,
  denyCliDeviceAuthorization,
  getCliDeviceAuthorization,
} from '@/features/auth/api'
import type { CliDeviceAuthorization } from '@/features/auth/types'
import { useAuthStore } from '@/stores/auth-store'

const searchSchema = z.object({
  user_code: z.string().optional(),
})

export const Route = createFileRoute('/cli/authorize')({
  component: CliAuthorize,
  validateSearch: searchSchema,
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    const res = await getSelf().catch(() => null)
    if (res?.success && res.data) {
      auth.setUser(res.data)
      return
    }

    auth.reset()
    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
    })
  },
})

function CliAuthorize() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/cli/authorize' })
  const user = useAuthStore((state) => state.auth.user)
  const userCode = normalizeUserCode(search.user_code)
  const [authorization, setAuthorization] =
    useState<CliDeviceAuthorization | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadAuthorization() {
      if (!userCode) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const response = await getCliDeviceAuthorization(userCode)
        if (!cancelled) {
          setAuthorization(response.data ?? null)
        }
      } catch {
        if (!cancelled) {
          setAuthorization(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void loadAuthorization()
    return () => {
      cancelled = true
    }
  }, [userCode])

  async function approve() {
    if (!userCode) return
    setSubmitting('approve')
    try {
      const response = await approveCliDeviceAuthorization(userCode)
      if (response.success) {
        setAuthorization(response.data ?? null)
        toast.success(t('CLI authorization approved'))
      }
    } finally {
      setSubmitting(null)
    }
  }

  async function deny() {
    if (!userCode) return
    setSubmitting('deny')
    try {
      const response = await denyCliDeviceAuthorization(userCode)
      if (response.success) {
        setAuthorization(response.data ?? null)
        toast.success(t('CLI authorization denied'))
      }
    } finally {
      setSubmitting(null)
    }
  }

  const status = authorization?.status
  const isActionable = status === 'pending'
  const accountName = user?.display_name || user?.username || user?.email || '-'

  return (
    <main className='min-h-dvh bg-white text-black'>
      <div className='mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-6 py-8 sm:px-8 sm:py-10'>
        <div className='flex items-center justify-between'>
          <span className='text-2xl font-semibold tracking-normal'>
            flatkey
          </span>
          <span className='text-xs font-medium tracking-normal text-zinc-500 uppercase'>
            CLI
          </span>
        </div>

        <section className='flex flex-1 flex-col justify-center py-12'>
          <div className='space-y-8'>
            <div className='space-y-4'>
              <p className='text-sm font-medium text-zinc-500'>
                {t('Flatkey CLI wants to connect')}
              </p>
              <h1 className='text-4xl leading-tight font-semibold tracking-normal sm:text-5xl'>
                {t('Approve terminal login')}
              </h1>
              <p className='max-w-[34rem] text-base leading-7 text-zinc-600'>
                {t(
                  'This will create or reuse a Flatkey API key for this device. Future CLI requests spend credits from this account.'
                )}
              </p>
            </div>

            <div className='space-y-4 border-y border-zinc-200 py-6'>
              <InfoRow label={t('Signed in as')} value={accountName} />
              <InfoRow
                label={t('Request code')}
                value={userCode || t('Missing code')}
                mono
              />
              <InfoRow
                label={t('Client')}
                value={authorization?.client_name || 'flatkey-cli'}
              />
            </div>

            {loading ? (
              <div className='flex items-center gap-2 text-sm text-zinc-500'>
                <Loader2 className='h-4 w-4 animate-spin' />
                {t('Loading authorization request')}
              </div>
            ) : null}

            {!loading && !userCode ? (
              <StatusText tone='error'>{t('Missing authorization code.')}</StatusText>
            ) : null}

            {!loading && userCode && !authorization ? (
              <StatusText tone='error'>
                {t('Authorization request not found or expired.')}
              </StatusText>
            ) : null}

            {!loading && status && status !== 'pending' ? (
              <StatusText tone={status === 'approved' ? 'success' : 'error'}>
                {status === 'approved'
                  ? t('Approved. You can return to the terminal.')
                  : status === 'denied'
                    ? t('Denied. You can close this page.')
                    : t('Expired. Restart login from the terminal.')}
              </StatusText>
            ) : null}

            <div className='grid gap-3 sm:grid-cols-[1fr_auto]'>
              <Button
                type='button'
                disabled={!isActionable || submitting !== null}
                onClick={approve}
                className='h-12 justify-center rounded-none bg-black text-base font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-300'
              >
                {submitting === 'approve' ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : null}
                {t('Approve')}
              </Button>
              <Button
                type='button'
                variant='ghost'
                disabled={!isActionable || submitting !== null}
                onClick={deny}
                className='h-12 justify-center rounded-none px-8 text-zinc-600 hover:bg-zinc-100 hover:text-black'
              >
                {t('Deny')}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function InfoRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className='grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-6'>
      <dt className='text-sm text-zinc-500'>{props.label}</dt>
      <dd
        className={cn(
          'break-words text-sm font-medium text-zinc-950',
          props.mono ? 'font-mono tracking-normal' : ''
        )}
      >
        {props.value}
      </dd>
    </div>
  )
}

function StatusText(props: {
  children: ReactNode
  tone: 'success' | 'error'
}) {
  return (
    <p
      className={cn(
        'text-sm font-medium',
        props.tone === 'success' ? 'text-emerald-700' : 'text-red-600'
      )}
    >
      {props.children}
    </p>
  )
}

function normalizeUserCode(value: string | undefined): string {
  if (!value) return ''
  const code = value.trim().toUpperCase().replaceAll('-', '')
  if (code.length !== 8) return value.trim().toUpperCase()
  return `${code.slice(0, 4)}-${code.slice(4)}`
}
