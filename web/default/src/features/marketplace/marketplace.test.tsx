import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { skillDownloadURL } from './api'
import { Marketplace } from './index'

// useNavigate is captured so we can assert the card click navigates to detail.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

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

// A skill whose BACKEND availability.cta is "upgrade" — before the P1 fix the
// card rendered an "Upgrade" button that merely opened the detail page.
vi.mock('./api', () => ({
  getAllMarketplaceSkills: vi.fn().mockResolvedValue({
    data: [
      {
        id: '1',
        slug: 'my-skill',
        name: 'My Skill',
        category: 'writing',
        short_description: 'desc',
        required_plan: 'pro',
        status: 'published',
        availability: { cta: 'upgrade', locked: true },
      },
    ],
  }),
  emitMarketplaceEvent: vi.fn().mockResolvedValue(undefined),
  // DR-78 growth surfaces are part of the merged component; mock them so the
  // detail-view event (card CTA) and any download URL building are no-ops here.
  recordMarketplaceSkillEvent: vi.fn().mockResolvedValue(undefined),
  skillDownloadURL: vi.fn(
    (idOrSlug: string) => `/api/v1/marketplace/skills/${idOrSlug}/download`
  ),
}))

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

describe('Marketplace list card CTA (P1)', () => {
  it('shows "View" regardless of backend availability.cta, and never the raw action label', async () => {
    renderMarketplace()
    const cta = await screen.findByRole('button', { name: /View/ })
    expect(cta).not.toBeNull()
    // The misleading backend label must not be shown on the card.
    expect(screen.queryByText('Upgrade')).toBeNull()
  })

  it('navigates to the detail route when the card CTA is clicked', async () => {
    renderMarketplace()
    const cta = await screen.findByRole('button', { name: /View/ })
    fireEvent.click(cta)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'my-skill' },
    })
  })
})

describe('Marketplace new-skill banner CTA (P1)', () => {
  it('navigates to the detail page and never triggers a direct download', async () => {
    // Banner shows when not dismissed; ensure a clean slate.
    window.localStorage.clear()
    navigateMock.mockClear()
    vi.mocked(skillDownloadURL).mockClear()

    renderMarketplace()
    const tryBtn = await screen.findByRole('button', { name: /Try skill/ })
    fireEvent.click(tryBtn)

    // Banner CTA must go to the detail page (same flow as the card).
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'my-skill' },
    })
    // It must NOT build a download URL from the list/banner surface: a direct
    // download navigation omits New-Api-User (SkillUserAuth 401) and bypasses the
    // detail page's downloadSkillPackage() axios flow. skillDownloadURL is the
    // sole download-URL builder, so asserting it is never called proves no direct
    // download path is taken. (window.location.assign is non-configurable in jsdom,
    // so it cannot be spied; the component no longer references it at all.)
    expect(skillDownloadURL).not.toHaveBeenCalled()
  })
})
