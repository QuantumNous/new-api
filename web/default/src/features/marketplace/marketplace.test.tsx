import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordMarketplaceSkillEvent, skillDownloadURL } from './api'
import { Marketplace } from './index'
import type { DownloadLeaderboardSkill, MarketplaceSkill } from './types'

const {
  navigateMock,
  mockGetDownloadLeaderboardSkills,
  mockGetMarketplaceRailSkills,
  mockGetMarketplaceSkills,
  mockRecordMarketplaceSkillEvent,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  mockGetDownloadLeaderboardSkills: vi.fn(),
  mockGetMarketplaceRailSkills: vi.fn(),
  mockGetMarketplaceSkills: vi.fn(),
  mockRecordMarketplaceSkillEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      auth: {
        user: { id: 1, username: 'pro-user', role: 1, group: 'pro' },
      },
    }),
}))

vi.mock('./api', () => ({
  getDownloadLeaderboardSkills: mockGetDownloadLeaderboardSkills,
  getMarketplaceSkills: mockGetMarketplaceSkills,
  getMarketplaceRailSkills: mockGetMarketplaceRailSkills,
  emitMarketplaceEvent: vi.fn().mockResolvedValue(undefined),
  purchaseSkill: vi.fn().mockResolvedValue({
    order_id: 'order-1',
    skill_id: 'skill-1',
    status: 'succeeded',
    entitled: true,
    amount_usd: 2,
    currency: 'USD',
    quota_charged: 1000,
    monetization_type: 'one_time',
  }),
  recordMarketplaceSkillEvent: mockRecordMarketplaceSkillEvent,
  saveSkill: vi.fn().mockResolvedValue(undefined),
  unsaveSkill: vi.fn().mockResolvedValue(undefined),
  skillDownloadURL: vi.fn(
    (idOrSlug: string) => `/api/v1/marketplace/skills/${idOrSlug}/download`
  ),
}))

const baseSkill: MarketplaceSkill = {
  id: 'base-skill',
  slug: 'base-skill',
  name: 'Base Skill',
  category: 'writing',
  short_description: 'desc',
  required_plan: 'free',
  status: 'published',
}

function setMarketplaceSkills(skills: MarketplaceSkill[]) {
  mockGetMarketplaceSkills.mockResolvedValue({
    data: skills,
    pagination: { page: 1, limit: 100, total: skills.length, has_next: false },
  })
  mockGetMarketplaceRailSkills.mockResolvedValue({
    data: [],
    pagination: { page: 1, limit: 6, total: 0, has_next: false },
  })
}

function setDownloadLeaderboards(skills: DownloadLeaderboardSkill[] = []) {
  mockGetDownloadLeaderboardSkills.mockResolvedValue({
    data: skills,
    pagination: { page: 1, limit: 6, total: skills.length, has_next: false },
  })
}

function renderMarketplace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Marketplace />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setDownloadLeaderboards()
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  })
})

describe('Marketplace list card CTA matrix', () => {
  const ctaCases: Array<[string, MarketplaceSkill]> = [
    ['Enable', { ...baseSkill, availability: { cta: 'enable' } }],
    [
      'Use',
      {
        ...baseSkill,
        availability: { cta: 'use', enabled: true, executable: true },
      },
    ],
    [
      'Contact Sales',
      {
        ...baseSkill,
        availability: { cta: 'contact_sales', locked: true },
      },
    ],
    [
      'Log in',
      {
        ...baseSkill,
        availability: { cta: 'login', locked: true },
      },
    ],
  ]

  it.each(ctaCases)(
    'shows %s for the resolved skill state',
    async (label, skill) => {
      setMarketplaceSkills([{ ...skill, id: label, slug: label }])

      renderMarketplace()

      expect(await screen.findByRole('button', { name: label })).toBeEnabled()
      expect(
        screen.queryByRole('button', { name: /View/ })
      ).not.toBeInTheDocument()
    }
  )

  it('shows disabled Unavailable for unavailable skills', async () => {
    setMarketplaceSkills([
      {
        ...baseSkill,
        availability: { cta: 'unavailable', locked: true },
      },
    ])

    renderMarketplace()

    expect(
      await screen.findByRole('button', { name: 'Unavailable' })
    ).toBeDisabled()
  })

  it.each([
    ['upgrade', 'Upgrade Skill'],
    ['renew', 'Renew Skill'],
  ] as const)('shows the dual paywall CTA for %s locks', async (cta, name) => {
    setMarketplaceSkills([
      {
        ...baseSkill,
        id: cta,
        slug: cta,
        name,
        availability: { cta, locked: true },
      },
    ])

    renderMarketplace()

    expect(
      await screen.findByRole('button', { name: 'Unlock $2' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Get PLUS' })).toBeEnabled()
  })

  it('uses the resolved fallback Enable CTA when the API omits availability.cta', async () => {
    setMarketplaceSkills([baseSkill])

    renderMarketplace()

    expect(await screen.findByRole('button', { name: 'Enable' })).toBeEnabled()
  })

  it('opens the paywall when a buyable locked card CTA is clicked', async () => {
    setMarketplaceSkills([
      {
        ...baseSkill,
        id: 'upgrade-skill',
        slug: 'upgrade-skill',
        name: 'Upgrade Skill',
        required_plan: 'enterprise',
        availability: { cta: 'upgrade', locked: true },
      },
    ])

    renderMarketplace()
    fireEvent.click(await screen.findByRole('button', { name: 'Unlock $2' }))

    expect(await screen.findByText('Paywall')).toBeInTheDocument()
  })
})

describe('Marketplace new-skill banner CTA', () => {
  it('navigates to the detail page and never triggers a direct download', async () => {
    setMarketplaceSkills([
      {
        ...baseSkill,
        slug: 'my-skill',
        name: 'My Skill',
        availability: { cta: 'download' },
      },
    ])
    window.localStorage.clear()
    navigateMock.mockClear()
    vi.mocked(skillDownloadURL).mockClear()

    renderMarketplace()
    fireEvent.click(await screen.findByRole('button', { name: /Try skill/ }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'my-skill' },
    })
    expect(skillDownloadURL).not.toHaveBeenCalled()
  })
})

describe('Marketplace DR-90 discovery rails', () => {
  it('renders rails and attributes detail clicks to the rail entry point', async () => {
    setMarketplaceSkills([baseSkill])
    mockGetMarketplaceRailSkills.mockImplementation((rail: string) => {
      if (rail === 'new_week') {
        return Promise.resolve({
          data: [
            {
              ...baseSkill,
              id: 'new-week',
              slug: 'new-week',
              name: 'New Week Skill',
            },
          ],
          pagination: { page: 1, limit: 6, total: 1, has_next: false },
        })
      }
      return Promise.resolve({
        data: [
          {
            ...baseSkill,
            id: 'trending',
            slug: 'trending',
            name: 'Trending Skill',
          },
        ],
        pagination: { page: 1, limit: 6, total: 1, has_next: false },
      })
    })

    renderMarketplace()

    expect(await screen.findByText('New this week')).toBeInTheDocument()
    expect(await screen.findByText('Trending')).toBeInTheDocument()
    fireEvent.click(await screen.findByText('Trending Skill'))

    expect(mockRecordMarketplaceSkillEvent).toHaveBeenCalledWith('trending', {
      event_type: 'skill_detail_view',
      entry_point: 'trending',
    })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'trending' },
    })
  })
})

describe('Marketplace download leaderboards', () => {
  it('renders weekly and monthly rails and opens detail with leaderboard attribution', async () => {
    setMarketplaceSkills([baseSkill])
    mockGetDownloadLeaderboardSkills.mockImplementation(
      (params: { window: '7d' | '30d' }) =>
        Promise.resolve({
          data: [
            {
              ...baseSkill,
              id: `${params.window}-skill`,
              slug: `${params.window}-skill`,
              name: params.window === '7d' ? 'Weekly Skill' : 'Monthly Skill',
              download_count: params.window === '7d' ? 9 : 30,
              rank: 1,
              window: params.window,
            },
          ],
          pagination: { page: 1, limit: 6, total: 1, has_next: false },
        })
    )

    renderMarketplace()

    expect(await screen.findByText('This Week')).toBeInTheDocument()
    expect(await screen.findByText('This Month')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Weekly Skill/ }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: '7d-skill' },
    })
    expect(recordMarketplaceSkillEvent).toHaveBeenCalledWith('7d-skill', {
      event_type: 'skill_detail_view',
      entry_point: 'leaderboard_weekly',
    })
  })
})
