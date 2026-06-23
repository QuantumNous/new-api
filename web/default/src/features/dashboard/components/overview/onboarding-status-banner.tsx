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
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CreditCard, PackageOpen, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NEVER_CALLED_DISMISS_KEY = 'dr_dash_banner_never_called_dismissed'
const LOW_QUOTA_DISMISS_KEY = 'dr_dash_banner_low_quota_dismissed'
const MARKETPLACE_POINTER_DISMISS_KEY =
  'dr78_dash_marketplace_pointer_dismissed'

// Trigger the low-quota banner when the user's REMAINING quota dips
// below this many tokens. 50_000 tokens ≈ $0.10 ≈ ~10 chat turns of
// gpt-4o-mini — a fair "you're nearly out" line.
const LOW_QUOTA_THRESHOLD = 50_000

function readDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeDismissed(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* private mode — silent */
  }
}

type ClientSlug =
  | 'cherry-studio'
  | 'chatbox'
  | 'lobechat'
  | 'cursor'
  | 'claude-code'
  | 'code'

function asClientSlug(value: unknown): ClientSlug | null {
  if (typeof value !== 'string') return null
  switch (value) {
    case 'cherry-studio':
    case 'chatbox':
    case 'lobechat':
    case 'cursor':
    case 'claude-code':
    case 'code':
      return value
    default:
      return null
  }
}

function parseSettingRaw(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

/**
 * Two contextual banners that sit between the dashboard hero (setup
 * guide / summary cards) and the secondary content. They cover the
 * two "first 7 days" gaps the onboarding wizard alone can't fill:
 *
 *   1. **Never called the API**: user finished the wizard, has a key,
 *      but `request_count === 0`. We point them at their preferred
 *      client tutorial (or Playground as the universal fallback) so
 *      the trial credit doesn't sit unused.
 *
 *   2. **Trial credit nearly gone**: user has called at least once and
 *      remaining `quota` is below LOW_QUOTA_THRESHOLD. CTA to /wallet.
 *
 * Each banner is independently dismissable via localStorage — once
 * dismissed it stays hidden on that device. Server-side dismissal is
 * intentionally not wired (out of scope; setting-level persistence
 * would force every device to silently agree).
 */
export function OnboardingStatusBanner() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)

  const [neverCalledDismissed, setNeverCalledDismissed] = useState(() =>
    readDismissed(NEVER_CALLED_DISMISS_KEY)
  )
  const [lowQuotaDismissed, setLowQuotaDismissed] = useState(() =>
    readDismissed(LOW_QUOTA_DISMISS_KEY)
  )
  const [marketplacePointerDismissed, setMarketplacePointerDismissed] =
    useState(() => readDismissed(MARKETPLACE_POINTER_DISMISS_KEY))

  const setting = useMemo(() => parseSettingRaw(user?.setting), [user?.setting])
  const preferredClient = asClientSlug(setting?.preferred_client)

  const requestCount = Number(user?.request_count ?? 0)
  const remainingQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)

  // Only show banners for users who have completed the wizard at least
  // once. The /welcome redirect handles the "fresh, never picked"
  // case — banners are noise on top of it.
  const hasPersona =
    setting?.persona === 'casual' ||
    setting?.persona === 'dev' ||
    setting?.persona === 'team'

  const showNeverCalled =
    hasPersona && requestCount === 0 && !neverCalledDismissed

  // Low-quota only fires after at least one successful call (used_quota > 0).
  // Without that floor a brand-new account with trial < threshold would
  // see "balance low" before they even try the product.
  const showLowQuota =
    hasPersona &&
    requestCount > 0 &&
    usedQuota > 0 &&
    remainingQuota > 0 &&
    remainingQuota < LOW_QUOTA_THRESHOLD &&
    !lowQuotaDismissed

  const showMarketplacePointer = hasPersona && !marketplacePointerDismissed

  if (!showNeverCalled && !showLowQuota && !showMarketplacePointer) return null

  return (
    <div className='flex flex-col gap-3'>
      {showMarketplacePointer && (
        <Banner
          tone='accent'
          icon={<PackageOpen className='size-4' aria-hidden='true' />}
          title={t('Marketplace skills are ready.')}
          description={t(
            'Start with a ready-made skill when you want a guided workflow instead of a blank prompt.'
          )}
          actions={
            <Button size='sm' render={<Link to='/skills' />}>
              {t('Browse skills')}
            </Button>
          }
          onDismiss={() => {
            setMarketplacePointerDismissed(true)
            writeDismissed(MARKETPLACE_POINTER_DISMISS_KEY)
          }}
        />
      )}

      {showNeverCalled && (
        <Banner
          tone='accent'
          icon={<Sparkles className='size-4' aria-hidden='true' />}
          title={t("You haven't called the API yet.")}
          description={t(
            'Your trial credit is sitting unused. Follow the setup guide to paste your key into your AI tool.'
          )}
          actions={
            preferredClient ? (
              <Button
                size='sm'
                render={
                  <Link
                    to='/onboarding/$slug'
                    params={{ slug: preferredClient }}
                  />
                }
              >
                {t('Open setup guide')}
              </Button>
            ) : (
              <Button size='sm' render={<Link to='/keys' />}>
                {t('View your key & setup')}
              </Button>
            )
          }
          onDismiss={() => {
            setNeverCalledDismissed(true)
            writeDismissed(NEVER_CALLED_DISMISS_KEY)
          }}
        />
      )}

      {showLowQuota && (
        <Banner
          tone='warning'
          icon={<CreditCard className='size-4' aria-hidden='true' />}
          title={t('Trial credit running low.')}
          description={t(
            'Top up to keep using DeepRouter without interruption — recharge keeps the same API keys and clients working.'
          )}
          actions={
            <Button size='sm' render={<Link to='/wallet' />}>
              {t('Top up')}
            </Button>
          }
          onDismiss={() => {
            setLowQuotaDismissed(true)
            writeDismissed(LOW_QUOTA_DISMISS_KEY)
          }}
        />
      )}
    </div>
  )
}

function Banner({
  tone,
  icon,
  title,
  description,
  actions,
  onDismiss,
}: {
  tone: 'accent' | 'warning'
  icon: React.ReactNode
  title: string
  description: string
  actions: React.ReactNode
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5',
        tone === 'warning'
          ? 'border-amber-300/50 bg-amber-50/70 dark:border-amber-400/30 dark:bg-amber-950/30'
          : 'bg-card'
      )}
    >
      <div className='flex min-w-0 items-start gap-3'>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl border',
            tone === 'warning'
              ? 'border-amber-300/60 bg-amber-100/70 text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/40 dark:text-amber-200'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </span>
        <div className='min-w-0'>
          <p className='text-sm font-semibold'>{title}</p>
          <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
            {description}
          </p>
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        {actions}
        <button
          type='button'
          onClick={onDismiss}
          aria-label={t('Dismiss')}
          className='text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors'
        >
          <X className='size-4' aria-hidden='true' />
        </button>
      </div>
    </div>
  )
}
