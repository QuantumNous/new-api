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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  CreditCard,
  FileText,
  KeyRound,
  ListChecks,
  Play,
  RadioTower,
  ShieldCheck,
  TerminalSquare,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { getUserModels } from '@/lib/api'
import { MOTION_TRANSITION } from '@/lib/motion'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { useApiInfo } from '../../hooks/use-status-data'
import { AnnouncementsPanel } from './announcements-panel'
import { ApiInfoPanel } from './api-info-panel'
import { FAQPanel } from './faq-panel'
import { CockpitChartsGrid } from './cockpit-charts-grid'
import { CockpitHeader } from './cockpit-header'
import { SummaryCards } from './summary-cards'
import { COCKPIT_CARD_CLASS } from './cockpit-display'

const SETUP_GUIDE_VISIBILITY_STORAGE_KEY =
  'dashboard_overview_setup_guide_expanded'

const SETUP_GUIDE_CODE_PATTERN = [
  'const request = await client.responses.create({',
  "  model: 'gpt-4.1-mini',",
  "  input: 'Start routing traffic',",
  '})',
  '',
  'if (request.output_text) {',
  '  console.log(request.output_text)',
  '}',
].join('\n')

type DashboardActionPath =
  | '/keys'
  | '/wallet'
  | '/playground'
  | '/channels'
  | '/usage-logs'
  | '/pricing'

interface StartStep {
  title: string
  description: string
  to: DashboardActionPath
  icon: LucideIcon
  completed: boolean
}

interface QuickAction {
  title: string
  description: string
  to: DashboardActionPath
  icon: LucideIcon
  adminOnly?: boolean
}

interface RequestExample {
  endpoint: string
  model: string
  keyName: string
  displayKey: string
  curl: string
  ready: boolean
}

interface HeroSignal {
  label: string
  value: string
  icon: LucideIcon
}

function getSavedSetupGuideExpanded(): boolean | null {
  if (typeof window === 'undefined') return null
  const saved = window.localStorage.getItem(SETUP_GUIDE_VISIBILITY_STORAGE_KEY)
  if (saved === 'expanded') return true
  if (saved === 'collapsed') return false
  return null
}

function saveSetupGuideExpanded(expanded: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    SETUP_GUIDE_VISIBILITY_STORAGE_KEY,
    expanded ? 'expanded' : 'collapsed'
  )
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function normalizeEndpoint(sourceUrl?: string): string {
  const fallback = `${getCurrentOrigin()}/v1/chat/completions`
  const trimmed = sourceUrl?.trim()
  if (!trimmed) return fallback

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (withoutTrailingSlash.endsWith('/v1/chat/completions')) {
    return withoutTrailingSlash
  }
  if (withoutTrailingSlash.endsWith('/v1')) {
    return `${withoutTrailingSlash}/chat/completions`
  }
  return `${withoutTrailingSlash}/v1/chat/completions`
}

function getPreferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((item) => item.status === 1) ?? keys[0] ?? null
}

function formatDisplayKey(key?: string): string {
  if (!key) return 'sk-...'
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}...${key.slice(-4)}`
}

function buildCurlCommand(args: {
  endpoint: string
  apiKey: string
  model: string
}): string {
  return [
    `curl ${args.endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${args.apiKey}" \\`,
    `  -d '{"model":"${args.model}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join('\n')
}

function SetupGuideBackdrop(props: { compact?: boolean }) {
  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-90',
          props.compact
            ? '[mask-image:linear-gradient(90deg,black_0%,black_48%,transparent_74%)]'
            : ''
        )}
        style={{
          background: [
            'radial-gradient(ellipse 80% 70% at 0% 0%, oklch(0.42 0.16 265 / 45%) 0%, transparent 60%)',
            'radial-gradient(ellipse 60% 55% at 100% 30%, oklch(0.4 0.14 290 / 40%) 0%, transparent 65%)',
          ].join(', '),
        }}
        aria-hidden='true'
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 hidden overflow-hidden font-mono text-violet-200/20 sm:block',
          props.compact ? 'w-1/2 opacity-45' : 'w-[58%] opacity-75'
        )}
        aria-hidden='true'
      >
        <pre
          className={cn(
            'absolute right-3 [mask-image:linear-gradient(90deg,transparent_0%,black_30%,black_82%,transparent_100%)] text-right tracking-[0.38em] whitespace-pre',
            props.compact
              ? '-top-6 text-[9px] leading-4'
              : 'top-1 text-[11px] leading-5'
          )}
        >
          {SETUP_GUIDE_CODE_PATTERN}
        </pre>
      </div>
      <div
        className='pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/20 via-transparent to-slate-950/60'
        aria-hidden='true'
      />
    </>
  )
}

function StartStepItem(props: {
  step: StartStep
  index: number
  isLast: boolean
}) {
  const Icon = props.step.icon
  const StatusIcon = props.step.completed ? Check : Circle

  return (
    <li className='relative flex gap-3 pb-2.5 last:pb-0'>
      {!props.isLast && (
        <span
          className='bg-border absolute top-9 bottom-0 left-4 w-px'
          aria-hidden='true'
        />
      )}
      <span
        className={cn(
          'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-950/60 shadow-xs',
          props.step.completed && 'border-emerald-500/40 bg-emerald-500/15'
        )}
      >
        <StatusIcon
          className={props.step.completed ? 'text-success size-4' : 'size-4'}
          aria-hidden='true'
        />
      </span>

      <Link
        to={props.step.to}
        className='flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-left text-slate-100 shadow-xs transition-colors outline-none hover:bg-slate-900/80 focus-visible:ring-2 focus-visible:ring-violet-500/40'
      >
        <span className='flex min-w-0 items-start gap-2.5'>
          <span className='mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-950/50'>
            <Icon className='size-3.5' aria-hidden='true' />
          </span>
          <span className='flex min-w-0 flex-col gap-0.5'>
            <span className='flex items-center gap-2 text-sm font-medium'>
              <span className='text-muted-foreground font-mono text-xs tabular-nums'>
                {props.index + 1}.
              </span>
              <span className='truncate'>{props.step.title}</span>
            </span>
            <span className='line-clamp-1 text-xs text-slate-400'>
              {props.step.description}
            </span>
          </span>
        </span>
        <ArrowRight
          className='text-muted-foreground size-4 shrink-0'
          aria-hidden='true'
        />
      </Link>
    </li>
  )
}

function RequestPreview(props: {
  example: RequestExample
  signals: HeroSignal[]
}) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const previewLines = props.example.curl.split('\n').map((line) => {
    if (line.includes('Authorization: Bearer')) {
      return `  -H "Authorization: Bearer ${props.example.displayKey}" \\`
    }
    return line
  })

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={MOTION_TRANSITION.slow}
      className='relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-3 shadow-sm backdrop-blur'
    >
      {!shouldReduceMotion && (
        <motion.div
          className='via-foreground/30 pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent'
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden='true'
        />
      )}

      <div className='flex items-center justify-between gap-3 border-b pb-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg'>
            <TerminalSquare className='size-4' aria-hidden='true' />
          </span>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>
              {t('First API request')}
            </div>
            <div className='text-muted-foreground truncate text-xs'>
              {props.example.ready
                ? props.example.keyName
                : t('Create an API key to unlock the real request')}
            </div>
          </div>
        </div>
        {props.example.ready ? (
          <CopyButton
            value={props.example.curl}
            variant='outline'
            size='sm'
            className='h-7 gap-1.5 px-2 text-xs'
            tooltip={t('Copy ready-to-run curl')}
            successTooltip={t('Copied!')}
            aria-label={t('Copy ready-to-run curl')}
          >
            {t('Copy')}
          </CopyButton>
        ) : (
          <Button size='sm' variant='outline' render={<Link to='/keys' />}>
            {t('Create API Key')}
          </Button>
        )}
      </div>

      <div className='bg-foreground/[0.035] my-3 rounded-xl p-3 font-mono text-xs'>
        <div className='mb-2 flex items-center gap-1.5'>
          <span className='bg-destructive size-2 rounded-full' />
          <span className='bg-warning size-2 rounded-full' />
          <span className='bg-success size-2 rounded-full' />
        </div>
        <div className='flex flex-col gap-1 overflow-hidden'>
          {previewLines.map((line, index) => (
            <code
              key={`${line}-${index}`}
              className='text-muted-foreground truncate'
              title={line}
            >
              {line}
            </code>
          ))}
        </div>
      </div>

      <div className='grid gap-2'>
        {props.signals.map((signal) => {
          const Icon = signal.icon

          return (
            <div
              key={signal.label}
              className='bg-muted/40 flex items-center justify-between gap-3 rounded-xl px-3 py-2'
            >
              <span className='flex min-w-0 items-center gap-2'>
                <Icon
                  className='text-muted-foreground size-3.5 shrink-0'
                  aria-hidden='true'
                />
                <span className='truncate text-xs font-medium'>
                  {signal.label}
                </span>
              </span>
              <span className='text-muted-foreground shrink-0 text-xs'>
                {signal.value}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function QuickActionItem(props: { action: QuickAction }) {
  const Icon = props.action.icon

  return (
    <Button
      variant='outline'
      className='h-auto justify-start rounded-xl border-white/10 bg-slate-950/40 px-3 py-3 text-left text-slate-100 hover:bg-slate-900/80'
      render={<Link to={props.action.to} />}
    >
      <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-950/50'>
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='truncate text-sm font-medium'>
          {props.action.title}
        </span>
        <span className='line-clamp-2 text-xs leading-relaxed text-slate-400'>
          {props.action.description}
        </span>
      </span>
    </Button>
  )
}

function CompactQuickAction(props: { action: QuickAction }) {
  const Icon = props.action.icon

  return (
    <Button
      variant='outline'
      size='sm'
      className='h-8 min-w-24 gap-1.5 border-white/10 bg-slate-950/50 px-2.5 text-slate-100'
      render={<Link to={props.action.to} />}
    >
      <Icon data-icon='inline-start' />
      <span>{props.action.title}</span>
    </Button>
  )
}

export function OverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { items: apiInfoItems } = useApiInfo()
  const [manualSetupGuideExpanded, setManualSetupGuideExpanded] = useState<
    boolean | null
  >(() => getSavedSetupGuideExpanded())

  const requestCount = Number(user?.request_count ?? 0)
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 10 })
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = await getUserModels()
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const preferredKey = useMemo(
    () => getPreferredKey(apiKeysQuery.data ?? []),
    [apiKeysQuery.data]
  )

  const realKeyQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'token-key', preferredKey?.id],
    queryFn: async () => {
      if (!preferredKey?.id) return ''
      const result = await fetchTokenKey(preferredKey.id)
      return result.success && result.data?.key ? `sk-${result.data.key}` : ''
    },
    enabled: Boolean(preferredKey?.id),
    staleTime: 5 * 60 * 1000,
  })

  const startSteps = useMemo<StartStep[]>(
    () => [
      {
        title: t('Dashboard setup step api key title'),
        description: t('Dashboard setup step api key description'),
        to: '/keys',
        icon: KeyRound,
        completed: Boolean(preferredKey),
      },
      {
        title: t('Dashboard setup step recharge title'),
        description: t('Dashboard setup step recharge description'),
        to: '/wallet',
        icon: CreditCard,
        completed: remainQuota > 0 || usedQuota > 0,
      },
      {
        title: t('Dashboard setup step request title'),
        description: t('Dashboard setup step request description'),
        to: '/playground',
        icon: TerminalSquare,
        completed: requestCount > 0,
      },
    ],
    [preferredKey, remainQuota, requestCount, t, usedQuota]
  )

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        title: t('Playground'),
        description: t('Dashboard quick action playground description'),
        to: '/playground',
        icon: Play,
      },
      {
        title: t('Channels'),
        description: t('Dashboard quick action channels description'),
        to: '/channels',
        icon: RadioTower,
        adminOnly: true,
      },
      {
        title: t('Usage Logs'),
        description: t('Dashboard quick action logs description'),
        to: '/usage-logs',
        icon: FileText,
      },
      {
        title: t('Pricing'),
        description: t('Dashboard quick action pricing description'),
        to: '/pricing',
        icon: BookOpen,
      },
    ],
    [t]
  )

  const visibleQuickActions = useMemo(
    () => quickActions.filter((action) => !action.adminOnly || isAdmin),
    [isAdmin, quickActions]
  )

  const heroSignals = useMemo<HeroSignal[]>(
    () => [
      {
        label: t('Route active'),
        value: apiInfoItems.length > 0 ? t('Online') : t('Current domain'),
        icon: RadioTower,
      },
      {
        label: t('Auth configured'),
        value: preferredKey ? t('Secured') : t('Needs API key'),
        icon: ShieldCheck,
      },
      {
        label: t('Model selected'),
        value: modelsQuery.data?.[0] ?? t('Loading'),
        icon: Timer,
      },
    ],
    [apiInfoItems.length, modelsQuery.data, preferredKey, t]
  )

  const requestExample = useMemo<RequestExample>(() => {
    const endpoint = normalizeEndpoint(apiInfoItems[0]?.url)
    const model = modelsQuery.data?.[0] ?? 'gpt-4o-mini'
    const apiKey = realKeyQuery.data ?? ''
    const keyName = preferredKey?.name ?? t('No API key yet')
    const ready = Boolean(apiKey && model)

    return {
      endpoint,
      model,
      keyName,
      displayKey: formatDisplayKey(apiKey),
      ready,
      curl: buildCurlCommand({
        endpoint,
        apiKey: apiKey || 'sk-...',
        model,
      }),
    }
  }, [apiInfoItems, modelsQuery.data, preferredKey, realKeyQuery.data, t])

  const completedStepCount = startSteps.filter((step) => step.completed).length
  const setupComplete = completedStepCount === startSteps.length
  const setupGuideExpanded = manualSetupGuideExpanded ?? !setupComplete

  const handleSetupGuideToggle = () => {
    const nextExpanded = !setupGuideExpanded
    setManualSetupGuideExpanded(nextExpanded)
    saveSetupGuideExpanded(nextExpanded)
  }

  return (
    <div className='flex flex-col gap-4 sm:gap-5'>
      <CockpitHeader />
      <SummaryCards />
      <CockpitChartsGrid isAdmin={isAdmin} />

      {setupGuideExpanded ? (
        <CardStaggerContainer className='grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]'>
          <CardStaggerItem className={cn(COCKPIT_CARD_CLASS, 'h-full')}>
            <div className='relative h-full overflow-hidden p-4 sm:p-5 text-slate-100'>
              <SetupGuideBackdrop />
              <div className='relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]'>
                <div className='flex min-w-0 flex-col gap-5'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='flex max-w-2xl flex-col gap-1'>
                      <div className='flex items-center gap-2 text-xs font-medium tracking-wider text-violet-300/90 uppercase'>
                        <ListChecks className='size-3.5' aria-hidden='true' />
                        {t('Get started')}
                      </div>
                      <h3 className='text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl'>
                        {t('Dashboard onboarding title')}
                      </h3>
                      <p className='max-w-xl text-sm leading-relaxed text-slate-400'>
                        {t('Dashboard onboarding description')}
                      </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={handleSetupGuideToggle}
                      >
                        <ChevronUp data-icon='inline-start' />
                        {t('Hide setup guide')}
                      </Button>
                      <Button size='sm' render={<Link to='/keys' />}>
                        <KeyRound data-icon='inline-start' />
                        {t('Create API Key')}
                      </Button>
                    </div>
                  </div>

                  <ol className='rounded-2xl border border-white/10 bg-slate-950/40 p-2 backdrop-blur'>
                    {startSteps.map((step, index) => (
                      <StartStepItem
                        key={step.title}
                        step={step}
                        index={index}
                        isLast={index === startSteps.length - 1}
                      />
                    ))}
                  </ol>
                </div>

                <RequestPreview
                  example={requestExample}
                  signals={heroSignals}
                />
              </div>
            </div>
          </CardStaggerItem>

          <CardStaggerItem className={cn(COCKPIT_CARD_CLASS, 'h-full p-4 sm:p-5')}>
            <div className='flex h-full flex-col gap-4 text-slate-100'>
              <div className='flex flex-col gap-1'>
                <div className='text-xs font-medium tracking-wider text-violet-300/90 uppercase'>
                  {t('Recommended actions')}
                </div>
                <h3 className='text-lg font-semibold tracking-tight text-slate-50'>
                  {t('Dashboard recommended actions title')}
                </h3>
              </div>
              <div className='grid gap-2'>
                {visibleQuickActions.map((action) => (
                  <QuickActionItem key={action.title} action={action} />
                ))}
              </div>
            </div>
          </CardStaggerItem>
        </CardStaggerContainer>
      ) : (
        <CardStaggerContainer>
          <CardStaggerItem className={cn(COCKPIT_CARD_CLASS, 'overflow-hidden')}>
            <div className='relative overflow-hidden px-4 py-3 text-slate-100 sm:px-5'>
              <SetupGuideBackdrop compact />
              <div className='relative flex flex-wrap items-center justify-between gap-3'>
                <div className='flex min-w-0 items-center gap-3'>
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 shadow-xs'>
                    <Check className='text-success size-4' aria-hidden='true' />
                  </span>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <h3 className='truncate text-sm font-semibold'>
                        {setupComplete
                          ? t('Setup guide complete')
                          : t('Setup guide')}
                      </h3>
                      <span className='rounded-md border border-white/10 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-400'>
                        {t('Setup progress: {{completed}}/{{total}}', {
                          completed: completedStepCount,
                          total: startSteps.length,
                        })}
                      </span>
                    </div>
                    <p className='text-muted-foreground line-clamp-1 text-xs'>
                      {setupComplete
                        ? t(
                            'Your setup guide is collapsed so usage stays in focus.'
                          )
                        : t('Setup guide is collapsed. Expand it anytime.')}
                    </p>
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  {visibleQuickActions.map((action) => (
                    <CompactQuickAction key={action.title} action={action} />
                  ))}
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-8 min-w-28 border-white/10 bg-slate-950/50 text-slate-100'
                    onClick={handleSetupGuideToggle}
                  >
                    <ChevronDown data-icon='inline-start' />
                    {t('Show setup guide')}
                  </Button>
                </div>
              </div>
            </div>
          </CardStaggerItem>
        </CardStaggerContainer>
      )}

      <CardStaggerContainer className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <CardStaggerItem>
          <ApiInfoPanel />
        </CardStaggerItem>
        <CardStaggerItem>
          <AnnouncementsPanel />
        </CardStaggerItem>
        <CardStaggerItem>
          <FAQPanel />
        </CardStaggerItem>
      </CardStaggerContainer>
    </div>
  )
}
