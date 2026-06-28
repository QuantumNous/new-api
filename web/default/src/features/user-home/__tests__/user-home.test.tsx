/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserHome } from '../index'
import type { UserHomeData } from '../types'

const mockGetUserHome = vi.hoisted(() => vi.fn<() => Promise<UserHomeData>>())
const mockRecordMarketplaceSkillEvent = vi.hoisted(() => vi.fn())
const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({
  getUserHome: mockGetUserHome,
}))

vi.mock('@/features/marketplace/api', () => ({
  recordMarketplaceSkillEvent: mockRecordMarketplaceSkillEvent,
  saveSkill: vi.fn().mockResolvedValue(undefined),
  unsaveSkill: vi.fn().mockResolvedValue(undefined),
  downloadSkillPackage: vi.fn().mockResolvedValue(undefined),
  skillDownloadURL: (id: string, entryPoint: string) =>
    `/api/v1/marketplace/skills/${id}/download?entry_point=${entryPoint}`,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts) return key
      return Object.entries(opts).reduce(
        (acc, [name, value]) => acc.replace(`{{${name}}}`, String(value)),
        key
      )
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

vi.mock('@/components/layout', () => {
  const Layout = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  )
  Layout.Title = ({ children }: { children: ReactNode }) => <h1>{children}</h1>
  Layout.Description = ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  )
  Layout.Content = ({ children }: { children: ReactNode }) => <>{children}</>
  return { SectionPageLayout: Layout }
})

function renderUserHome() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <UserHome />
    </QueryClientProvider>
  )
}

const HOME_DATA: UserHomeData = {
  account: {
    balance_quota: 6000000,
    balance_usd: 12,
    display_balance: 12,
    display_unit: 'USD',
    used_quota: 1000,
    recent_topups_count: 2,
    recent_topups_total: 20,
  },
  subscriptions: {
    billing_preference: 'subscription_first',
    active: [
      {
        subscription: {
          id: 1,
          user_id: 42,
          plan_id: 1,
          amount_total: 100,
          amount_used: 10,
          start_time: 1782680000,
          end_time: 1782766400,
          status: 'active',
        },
        plan: {
          id: 1,
          title: 'PLUS',
          price_amount: 19.9,
          currency: 'USD',
          duration_unit: 'month',
          duration_value: 1,
        },
      },
    ],
    all: [],
  },
  purchases: {
    entitled_skill_ids: ['owned-skill'],
    succeeded_count: 1,
    recent_orders: [
      {
        order_id: 'order-1',
        skill_id: 'owned-skill',
        skill_slug: 'owned-skill',
        skill_name: 'Owned Helper',
        status: 'succeeded',
        amount_usd: 2,
        currency: 'USD',
        quota_charged: 1000000,
        monetization_type: 'one_time',
        created_at: '2026-06-29T00:00:00Z',
        entitled: true,
      },
    ],
  },
  saved_skills: [
    {
      skill_id: 'saved-skill',
      slug: 'saved-skill',
      name: 'Saved Helper',
      category: 'writing',
      short_description: 'Saved for later',
      skill_status: 'published',
      required_plan: 'free',
      saved_at: '2026-06-29T00:00:00Z',
      enabled: false,
    },
  ],
  recommended_for_you: [
    {
      id: 'locked-skill',
      slug: 'locked-skill',
      name: 'Locked Writer',
      category: 'writing',
      short_description: 'Needs PLUS',
      required_plan: 'pro',
      availability: {
        enabled: false,
        locked: true,
        lock_code: 'SKILL_PLAN_REQUIRED',
        cta: 'upgrade',
      },
      saved: false,
    },
  ],
  new_this_week_for_you: [
    {
      id: 'fresh-skill',
      slug: 'fresh-skill',
      name: 'Fresh Writer',
      category: 'writing',
      short_description: 'New this week',
      required_plan: 'free',
      availability: {
        enabled: false,
        locked: true,
        lock_code: 'SKILL_NOT_ENABLED',
        cta: 'enable',
      },
      saved: false,
    },
  ],
  recommended_categories: ['writing'],
  entry_point: 'user_home',
}

describe('DR-88 User Home dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserHome.mockResolvedValue(HOME_DATA)
    mockRecordMarketplaceSkillEvent.mockResolvedValue(undefined)
  })

  it('renders own status, paywall-aware recommendations, new-week matches, saved Skills, and user_home attribution', async () => {
    renderUserHome()

    expect(
      await screen.findByRole('heading', { name: 'Home' })
    ).toBeInTheDocument()
    expect(await screen.findByText('PLUS')).toBeInTheDocument()
    expect(screen.getByText('1 owned Skills')).toBeInTheDocument()
    expect(screen.getByText('Locked Writer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock $2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get PLUS' })).toBeInTheDocument()
    expect(screen.getByText('Fresh Writer')).toBeInTheDocument()
    expect(screen.getByText('Saved Helper')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockRecordMarketplaceSkillEvent).toHaveBeenCalledWith(
        'locked-skill',
        {
          event_type: 'skill_impression',
          entry_point: 'user_home',
        }
      )
      expect(mockRecordMarketplaceSkillEvent).toHaveBeenCalledWith(
        'fresh-skill',
        {
          event_type: 'skill_impression',
          entry_point: 'user_home',
        }
      )
    })
  })
})
