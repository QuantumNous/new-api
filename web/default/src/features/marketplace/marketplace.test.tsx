import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { skillDownloadURL } from './api'
import { Marketplace } from './index'
import type { MarketplaceSkill } from './types'

const { navigateMock, mockGetMarketplaceSkills } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  mockGetMarketplaceSkills: vi.fn(),
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
  getMarketplaceSkills: mockGetMarketplaceSkills,
  emitMarketplaceEvent: vi.fn().mockResolvedValue(undefined),
  recordMarketplaceSkillEvent: vi.fn().mockResolvedValue(undefined),
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
      'Upgrade',
      {
        ...baseSkill,
        required_plan: 'enterprise',
        availability: { cta: 'upgrade', locked: true },
      },
    ],
    [
      'Renew',
      {
        ...baseSkill,
        availability: { cta: 'renew', locked: true },
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

  it('uses the resolved fallback Enable CTA when the API omits availability.cta', async () => {
    setMarketplaceSkills([baseSkill])

    renderMarketplace()

    expect(await screen.findByRole('button', { name: 'Enable' })).toBeEnabled()
  })

  it('navigates to the detail route when an actionable card CTA is clicked', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'Upgrade' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'upgrade-skill' },
    })
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
