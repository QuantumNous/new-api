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
import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Gift,
  KeyRound,
  MessageSquare,
  Terminal,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { takeWelcomeHandoff } from '@/features/auth/lib/storage'
import type { RegisterResponseData } from '@/features/auth/types'
import { updateUserSettings } from '@/features/profile/api'
import { PERSONA_PRESETS } from '@/features/profile/lib/persona-presets'
import type { Persona, UserSettings } from '@/features/profile/types'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Optional persona picker (secondary — never blocks the golden path).
const PERSONAS: Array<{
  id: Persona
  icon: LucideIcon
  titleKey: string
  descKey: string
  badge?: string
}> = [
  {
    id: 'casual',
    icon: MessageSquare,
    titleKey: 'Everyday use',
    descKey:
      'Chatting, writing, translation, images. No code — paste your key into the AI app you already use.',
    badge: 'Most users',
  },
  {
    id: 'dev',
    icon: Terminal,
    titleKey: 'Building / coding',
    descKey: "Coding and API integration. You'll use the API directly.",
  },
  {
    id: 'team',
    icon: Users,
    titleKey: 'Team',
    descKey: 'Shared keys, audit trails, team integration.',
  },
]

const QUOTA_PER_USD = 500_000
const AVG_CHAT_COST_USD = 0.005

function estimateChats(quota: number): number {
  if (!quota || !Number.isFinite(quota) || quota <= 0) return 0
  return Math.max(0, Math.floor(quota / QUOTA_PER_USD / AVG_CHAT_COST_USD))
}

function formatChatsCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${Math.floor(n / 1000)}k`
}

export function Welcome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)

  // Read the one-shot register handoff exactly once on mount. After this the
  // default token is gone — refresh erases it (intentional, security).
  const [handoff] = useState<RegisterResponseData | null>(() =>
    takeWelcomeHandoff<RegisterResponseData>()
  )

  // Unauthenticated visitors get bounced to /sign-in. Logged-in users without
  // a handoff still see the screen (OAuth signup, refresh, privacy-mode, or
  // re-visiting /welcome) — the key card degrades to a "view on Keys" link.
  useEffect(() => {
    if (!user) {
      navigate({ to: '/sign-in', replace: true })
    }
  }, [user, navigate])

  const [persona, setPersona] = useState<Persona | null>('casual')
  const [submitting, setSubmitting] = useState(false)

  // Persist persona (+ its sidebar preset), then navigate to `target`.
  // EVERY CTA on this screen goes through here: PersonaPickerHost redirects
  // any user whose persona is still unset back to /welcome, so we MUST save
  // before leaving or the user bounces straight back. Save is best-effort —
  // we navigate regardless so a transient API hiccup never traps the user.
  const finishTo = async (target: string) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const finalPersona = persona ?? 'casual'
      const settingPatch: Partial<UserSettings> = { persona: finalPersona }
      const preset = PERSONA_PRESETS[finalPersona]
      if (preset?.sidebarModules) {
        ;(settingPatch as { sidebar_modules?: string }).sidebar_modules =
          preset.sidebarModules
      }
      const res = await updateUserSettings(settingPatch)
      if (!res?.success) {
        toast.error(res?.message || t('Could not save your selection.'))
      } else if (user) {
        const rawSetting = user.setting
        const currentSetting: UserSettings =
          typeof rawSetting === 'string'
            ? (JSON.parse(rawSetting) as UserSettings)
            : ((rawSetting as UserSettings | undefined) ?? {})
        setUser({
          ...user,
          setting: {
            ...currentSetting,
            ...settingPatch,
          } as unknown as Record<string, unknown>,
          sidebar_modules:
            (settingPatch as { sidebar_modules?: string }).sidebar_modules ??
            user.sidebar_modules,
        })
      }
      // Tell PersonaPickerHost to skip its very next redirect — setUser may
      // not have propagated to its subscriber by the time the destination
      // route mounts, which would otherwise bounce the user back to /welcome.
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem('dr_welcome_just_finished', '1')
        } catch {
          /* private mode — host may still redirect; setUser usually wins */
        }
      }
      navigate({ to: target as never, replace: true })
    } catch {
      toast.error(t('Could not save your selection.'))
      setSubmitting(false)
    }
  }

  if (!user) return null

  const name = handoff?.display_name || user?.username || ''
  const trialQuota = handoff?.trial_quota ?? 0

  return (
    <div className='mx-auto max-w-2xl px-4 py-8 sm:py-12'>
      {/* H1 — the RESULT, not a question */}
      <div className='mb-6 flex items-start gap-3'>
        <span className='mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'>
          <CheckCircle2 className='h-6 w-6' aria-hidden='true' />
        </span>
        <div>
          <h1 className='text-2xl font-bold sm:text-3xl'>
            {t('Your account is ready, {{name}}', { name })} 🎉
          </h1>
          <p className='text-muted-foreground mt-1.5 text-sm'>
            {t(
              "Everything's set up. Here's what you got — and how to start using it."
            )}
          </p>
        </div>
      </div>

      {/* What you just got */}
      <div className='mb-6 grid gap-3 sm:grid-cols-2'>
        <WelcomeCard
          icon={Gift}
          label={t('Free trial credit')}
          value={trialQuota ? `¥${(trialQuota / 500000).toFixed(2)}` : '—'}
          sub={
            trialQuota
              ? t('≈ {{count}} chats, on us', {
                  count: formatChatsCount(estimateChats(trialQuota)),
                })
              : ''
          }
        />
        {handoff?.default_token ? (
          <CopyCard
            icon={KeyRound}
            label={t('Your key (API Key)')}
            value={handoff.default_token}
          />
        ) : (
          <KeyFallbackCard />
        )}
      </div>

      {/* Start in 3 steps — concrete next actions */}
      <section className='bg-card mb-6 rounded-2xl border p-4 sm:p-5'>
        <h2 className='text-sm font-semibold sm:text-base'>
          {t('Start using it in 3 steps')}
        </h2>
        <ol className='mt-3 space-y-2.5'>
          <Step n={1} text={t('Copy your key above.')} />
          <Step
            n={2}
            text={t(
              'Paste it into the AI tool you already use — find the field labelled “API Key” in its settings and save.'
            )}
          />
          <Step
            n={3}
            text={t(
              'Come back and check it works — one tap confirms your key and credit are live.'
            )}
          />
        </ol>
      </section>

      {/* Primary + secondary action */}
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <Button
          type='button'
          size='lg'
          disabled={submitting}
          onClick={() => finishTo('/keys/test')}
          className='sm:flex-1'
        >
          {submitting ? t('Just a sec…') : t('Check it works')}
          <ArrowRight className='ml-1.5 h-4 w-4' aria-hidden='true' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='lg'
          disabled={submitting}
          onClick={() => finishTo('/wallet')}
        >
          <CreditCard className='mr-1.5 h-4 w-4' aria-hidden='true' />
          {t('Add credit')}
        </Button>
      </div>
      <p className='text-muted-foreground mt-2 text-xs'>
        {t('Your free credit is enough to start — top up later when it runs out.')}
      </p>

      {/* Optional persona — secondary, never blocks the golden path */}
      <section className='mt-8 border-t pt-6'>
        <p className='text-muted-foreground mb-3 text-xs'>
          {t(
            'Optional: what will you mostly use it for? Helps us tailor your dashboard — you can change this anytime.'
          )}
        </p>
        <div className='grid gap-3 sm:grid-cols-3'>
          {PERSONAS.map((p) => (
            <ChoiceCard
              key={p.id}
              icon={<p.icon className='h-5 w-5' />}
              title={t(p.titleKey)}
              description={t(p.descKey)}
              badge={p.badge ? t(p.badge) : undefined}
              selected={persona === p.id}
              onClick={() => setPersona(p.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className='flex gap-2.5'>
      <span className='bg-foreground text-background flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold'>
        {n}
      </span>
      <span className='text-muted-foreground text-sm leading-relaxed'>
        {text}
      </span>
    </li>
  )
}

function KeyFallbackCard() {
  const { t } = useTranslation()
  return (
    <Link
      to='/keys'
      className='bg-background hover:border-foreground/40 flex items-start gap-3 rounded-lg border p-3 transition-colors'
    >
      <span className='bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md border'>
        <KeyRound className='h-5 w-5' aria-hidden='true' />
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-[11px] font-medium'>
          {t('Your key (API Key)')}
        </p>
        <p className='text-sm font-semibold'>
          {t('Ready — view it on the Keys page →')}
        </p>
      </div>
    </Link>
  )
}

function ChoiceCard({
  icon,
  title,
  description,
  badge,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'group bg-background relative flex h-full flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all hover:shadow-sm',
        selected
          ? 'border-foreground ring-foreground/15 ring-2'
          : 'border-border hover:border-foreground/40'
      )}
      aria-pressed={selected}
    >
      {selected && (
        <span className='bg-foreground text-background absolute end-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full'>
          <Check className='h-3 w-3' />
        </span>
      )}
      <span className='bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md border'>
        {icon}
      </span>
      <span className='flex items-center gap-1.5'>
        <span className='text-sm font-medium'>{title}</span>
        {badge && (
          <span className='bg-foreground/10 text-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium'>
            {badge}
          </span>
        )}
      </span>
      <span className='text-muted-foreground text-xs leading-snug'>
        {description}
      </span>
    </button>
  )
}

function WelcomeCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub: string
}) {
  return (
    <div className='bg-background flex items-start gap-3 rounded-lg border p-3'>
      <span className='bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md border'>
        <Icon className='h-5 w-5' />
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-[11px] font-medium'>{label}</p>
        <p className='font-mono text-base font-semibold'>{value}</p>
        {sub && <p className='text-muted-foreground/80 text-[11px]'>{sub}</p>}
      </div>
    </div>
  )
}

function CopyCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('Copy failed'))
    }
  }
  return (
    <div className='bg-background flex items-start gap-3 rounded-lg border p-3'>
      <span className='bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md border'>
        <Icon className='h-5 w-5' />
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-[11px] font-medium'>{label}</p>
        <div className='mt-0.5 flex items-center gap-1'>
          <code className='flex-1 truncate font-mono text-xs' title={value}>
            {value}
          </code>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={handleCopy}
            className='h-6 px-1.5'
          >
            {copied ? (
              <Check className='h-3 w-3' />
            ) : (
              <Copy className='h-3 w-3' />
            )}
          </Button>
        </div>
        <p className='mt-0.5 text-[10px] text-amber-600 dark:text-amber-400'>
          {t("Copy now — won't be shown again after you leave this page.")}
        </p>
      </div>
    </div>
  )
}
