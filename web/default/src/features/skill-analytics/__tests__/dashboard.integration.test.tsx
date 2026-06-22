/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/

/**
 * Integration tests for SkillAnalyticsDashboard.
 *
 * Coverage: SkillAnalyticsDashboard — 9 P0 cards, loading, error,
 * tracking-failure banner, Revenue Attribution conditional, date range switch.
 *
 * Mock strategy:
 *  - vi.hoisted so mockGetOverview is initialised before vi.mock factory runs.
 *  - Real QueryClientProvider per test (no cache leakage).
 *  - retryDelay:0 so the error-state test doesn't wait for exponential backoff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SkillAnalyticsDashboard } from '../index'
import type { SkillAnalyticsOverview } from '../types'

// ── vi.hoisted: initialise mock BEFORE vi.mock factory ────────────────────────
const mockGetOverview = vi.hoisted(() =>
  vi.fn<(range: { start: string; end: string }) => Promise<SkillAnalyticsOverview>>()
)

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../api', () => ({
  getSkillAnalyticsOverview: mockGetOverview,
}))

const translations: Record<string, string> = {
  'skillAnalytics.blockReason.planRequired': '计划要求',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => translations[key] ?? key }),
}))

vi.mock('@/components/layout', () => {
  const Title = ({ children }: { children?: ReactNode }) => <h1>{children}</h1>
  const Description = ({ children }: { children?: ReactNode }) => <p>{children}</p>
  const Content = ({ children }: { children?: ReactNode }) => <>{children}</>
  const Actions = ({ children }: { children?: ReactNode }) => <>{children}</>
  const Layout = ({ children }: { children: ReactNode }) => <div>{children}</div>
  Layout.Title = Title
  Layout.Description = Description
  Layout.Content = Content
  Layout.Actions = Actions
  return { SectionPageLayout: Layout }
})

vi.mock('@/components/page-transition', () => ({
  StaggerContainer: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid='skeleton' className={className} />
  ),
}))

vi.mock('@/lib/format', () => ({
  // Deterministic output regardless of locale ICU data in test environment
  formatNumber: (v: number | null | undefined) =>
    v == null ? '-' : String(v),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const FULL_DATA: SkillAnalyticsOverview = {
  wasu: 4200,
  total_skill_runs: 98765,
  detail_ctr: 0.342,
  enable_rate: 0.619,
  first_use_rate: 0.28,
  repeat_use_rate: 0.55,
  block_rate: 0.03,
  top_block_reason: 'plan_required',
  revenue_attribution_usd: 1234.56,
  charging_enabled: true,
  data_freshness: 'ok',
  period_start: '2026-06-14T00:00:00.000Z',
  period_end: '2026-06-21T00:00:00.000Z',
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,   // override component-level retry:1 for test speed
        retryDelay: 0,
      },
    },
  })
}

function renderDashboard() {
  const client = makeClient()
  return render(
    <QueryClientProvider client={client}>
      <SkillAnalyticsDashboard />
    </QueryClientProvider>
  )
}

/** Wait until no skeletons are present — confirms data (or error) has settled. */
async function waitForDataReady() {
  await waitFor(
    () => {
      const skeletons = document.querySelectorAll('[data-testid="skeleton"]')
      expect(skeletons.length).toBe(0)
    },
    { timeout: 3000 }
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SkillAnalyticsDashboard — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Page header ────────────────────────────────────────────────────────────

  it('renders page title and description', () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Skill Analytics' })).toBeInTheDocument()
    expect(screen.getByText('Skill analytics overview for the operator')).toBeInTheDocument()
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows skeleton cards while loading', () => {
    mockGetOverview.mockReturnValue(new Promise(() => {})) // never resolves
    renderDashboard()
    const skeletons = screen.getAllByTestId('skeleton')
    // At least 2 skeletons per card (value + description placeholders)
    expect(skeletons.length).toBeGreaterThanOrEqual(8)
  })

  // ── Success state: all 9 cards present ────────────────────────────────────

  it('renders all 9 P0 card titles when charging_enabled=true', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()

    for (const title of [
      'Weekly Active Skill Users',
      'Total Skill Runs',
      'Skill Detail CTR',
      'Enable Rate',
      'First Use Rate',
      'Repeat Use Rate',
      'Block Rate',
      'Top Block Reason',
      'Revenue Attribution',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('renders WASU count value', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    // formatNumber mock returns String(v); 4200 → "4200"
    expect(screen.getByText('4200')).toBeInTheDocument()
  })

  it('renders Enable Rate as percentage', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    expect(screen.getByText('61.9%')).toBeInTheDocument()
  })

  it('renders block_rate as percentage', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    expect(screen.getByText('3.0%')).toBeInTheDocument()
  })

  it('renders translated top_block_reason label', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    expect(screen.getByText('计划要求')).toBeInTheDocument()
  })

  it('renders revenue_attribution_usd as formatted USD', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    expect(screen.getByText('$1,234.56')).toBeInTheDocument()
  })

  // ── Null metric values → no-data state ────────────────────────────────────

  it('shows "—" and "No data in this period" when all metrics are null', async () => {
    const nullData: SkillAnalyticsOverview = {
      ...FULL_DATA,
      wasu: null,
      total_skill_runs: null,
      detail_ctr: null,
      enable_rate: null,
      first_use_rate: null,
      repeat_use_rate: null,
      block_rate: null,
      top_block_reason: null,
      revenue_attribution_usd: null,
    }
    mockGetOverview.mockResolvedValue(nullData)
    renderDashboard()
    await waitForDataReady()

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(8)
    const noData = screen.getAllByText('No data in this period')
    expect(noData.length).toBeGreaterThanOrEqual(8)
  })

  // ── Revenue Attribution conditional ───────────────────────────────────────

  it('hides Revenue Attribution card when charging_enabled=false', async () => {
    mockGetOverview.mockResolvedValue({ ...FULL_DATA, charging_enabled: false })
    renderDashboard()
    await waitForDataReady()
    expect(screen.queryByText('Revenue Attribution')).not.toBeInTheDocument()
  })

  it('shows Revenue Attribution card when charging_enabled=true', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    expect(screen.getByText('Revenue Attribution')).toBeInTheDocument()
  })

  // ── Tracking failure banner ────────────────────────────────────────────────

  it('shows orange tracking-failed banner when data_freshness=failed', async () => {
    mockGetOverview.mockResolvedValue({ ...FULL_DATA, data_freshness: 'failed' })
    renderDashboard()
    await waitForDataReady()
    expect(
      screen.getByText(
        'Data tracking is unavailable. Metrics shown below are stale or missing.'
      )
    ).toBeInTheDocument()
  })

  it('shows yellow delayed banner when data_freshness=delayed', async () => {
    mockGetOverview.mockResolvedValue({ ...FULL_DATA, data_freshness: 'delayed' })
    renderDashboard()
    await waitForDataReady()
    expect(
      screen.getByText(
        'Data tracking is delayed. Metrics may not reflect the latest activity.'
      )
    ).toBeInTheDocument()
  })

  it('all metric cards show "—" when tracking is failed', async () => {
    mockGetOverview.mockResolvedValue({ ...FULL_DATA, data_freshness: 'failed' })
    renderDashboard()
    await waitForDataReady()
    // 9 cards (charging enabled) each show "—" due to trackingFailed prop
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(9)
  })

  it('shows "Tracking unavailable" on all cards when tracking failed', async () => {
    mockGetOverview.mockResolvedValue({ ...FULL_DATA, data_freshness: 'failed' })
    renderDashboard()
    await waitForDataReady()
    const msgs = screen.getAllByText('Tracking unavailable')
    expect(msgs.length).toBeGreaterThanOrEqual(9)
  })

  it('no tracking banner when data_freshness=ok', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()
    expect(screen.queryByText(/Data tracking is unavailable/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Data tracking is delayed/)).not.toBeInTheDocument()
  })

  // ── API error state ────────────────────────────────────────────────────────

  it('shows error banner when API call rejects', async () => {
    mockGetOverview.mockRejectedValue(new Error('404 Not Found'))
    renderDashboard()
    await waitFor(
      () =>
        expect(
          screen.getByText(
            'Skill analytics data is unavailable. The analytics API (DR-75) may not be deployed yet.'
          )
        ).toBeInTheDocument(),
      { timeout: 3000 }
    )
  })

  // ── Date range control ────────────────────────────────────────────────────

  it('renders the date range preset buttons', () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('switching to 24h triggers a new API call with a ~24h window', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()

    const callsBefore = mockGetOverview.mock.calls.length
    await userEvent.click(screen.getByText('Last 24 hours'))

    await waitFor(() =>
      expect(mockGetOverview.mock.calls.length).toBeGreaterThan(callsBefore)
    )
    const lastCall = mockGetOverview.mock.lastCall!
    const range = lastCall[0]
    const diffMs =
      new Date(range.end).getTime() - new Date(range.start).getTime()
    // 24h ± 60 seconds tolerance
    expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000)
  })

  it('API is called with the correct date range on first render (7d default)', async () => {
    mockGetOverview.mockResolvedValue(FULL_DATA)
    renderDashboard()
    await waitForDataReady()

    const firstCall = mockGetOverview.mock.calls[0]!
    const range = firstCall[0]
    const diffMs =
      new Date(range.end).getTime() - new Date(range.start).getTime()
    // 7d ± 60 seconds tolerance
    expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    expect(diffMs).toBeLessThan(8 * 24 * 60 * 60 * 1000)
  })
  it('refreshes rolling date range after the dashboard stays mounted', async () => {
    const firstNow = new Date('2026-06-21T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(firstNow)
    mockGetOverview.mockResolvedValue(FULL_DATA)

    renderDashboard()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetOverview).toHaveBeenCalledTimes(1)
    const firstRange = mockGetOverview.mock.calls[0]![0]

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000)
    })

    expect(mockGetOverview.mock.calls.length).toBeGreaterThan(1)
    const latestRange = mockGetOverview.mock.lastCall![0]
    expect(new Date(latestRange.end).getTime()).toBe(
      firstNow.getTime() + 60 * 1000
    )
    expect(latestRange.end).not.toBe(firstRange.end)
  })
})
