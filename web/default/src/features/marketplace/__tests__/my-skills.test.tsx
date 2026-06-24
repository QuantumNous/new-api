/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
// Coverage: DR-59 My Skills management UI — header count, filters
// (All/Available/Locked/Deprecated), row states + actions, Use → Skill Detail
// (navigation only, no skill_used), Remove-from-My-Skills confirm flow (DR-56),
// and empty/error states. Asserts no "Disable" / Playground wording.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { MySkills } from '../my-skills'
import type { MySkill } from '../types'

const { navigateMock, mobileRef } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  mobileRef: { current: false },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, k: string) => String(opts?.[k] ?? '')),
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// jsdom has no matchMedia; drive the responsive switch via mobileRef.
vi.mock('@/hooks', () => ({ useMediaQuery: () => mobileRef.current }))

vi.mock('@/components/layout', () => {
  const SectionPageLayout = ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  )
  SectionPageLayout.Title = ({ children }: { children: ReactNode }) => (
    <h1>{children}</h1>
  )
  SectionPageLayout.Description = ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  )
  SectionPageLayout.Content = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  )
  return { SectionPageLayout }
})

let currentRows: MySkill[] = []
let getShouldReject = false

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => {
      if (getShouldReject) {
        // axios-style error carrying the standard error envelope + request id.
        throw {
          message: 'request failed',
          response: {
            data: { error: { message: 'boom', request_id: 'req-err-9' } },
          },
        }
      }
      return { data: { data: currentRows, meta: { request_id: 'req-1' } } }
    }),
    delete: vi.fn(async () => undefined),
    post: vi.fn(async () => undefined),
  },
}))

function mySkill(overrides: Partial<MySkill>): MySkill {
  return {
    id: overrides.skill_id ?? 'id',
    slug: 'slug',
    name: 'Skill',
    category: 'writing',
    required_plan: 'free',
    skill_status: 'published',
    enabled: true,
    enabled_at: '2026-06-15T00:00:00Z',
    last_used_at: null,
    availability: { executable: true, locked: false, cta: 'use' },
    ...overrides,
  }
}

const DATASET: MySkill[] = [
  mySkill({ skill_id: 's-exec', slug: 'exec', name: 'Exec Skill' }),
  mySkill({
    skill_id: 's-plan',
    slug: 'plan',
    name: 'Plan Skill',
    required_plan: 'pro',
    availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED', cta: 'upgrade' },
  }),
  mySkill({
    skill_id: 's-dep',
    slug: 'dep',
    name: 'Deprecated Exec',
    skill_status: 'deprecated',
    availability: { executable: true, locked: false, cta: 'use' },
  }),
  mySkill({
    skill_id: 's-deplock',
    slug: 'deplock',
    name: 'Deprecated Locked',
    required_plan: 'pro',
    skill_status: 'deprecated',
    availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED', cta: 'upgrade' },
  }),
  mySkill({
    skill_id: 's-arch',
    slug: 'arch',
    name: 'Archived Skill',
    skill_status: 'archived',
    availability: { locked: true, lock_code: 'SKILL_NOT_PUBLISHED', cta: 'unavailable' },
  }),
  mySkill({
    skill_id: 's-kids',
    slug: 'kids',
    name: 'Kids Blocked',
    availability: { locked: true, lock_code: 'SKILL_KIDS_MODE_BLOCKED', cta: 'unavailable' },
  }),
  mySkill({
    skill_id: 's-quota',
    slug: 'quota',
    name: 'Quota Skill',
    availability: { locked: true, lock_code: 'SKILL_QUOTA_EXCEEDED', cta: 'upgrade' },
  }),
]

function renderMySkills() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <MySkills />
    </QueryClientProvider>
  )
}

function rowOf(name: string): HTMLElement {
  const cell = screen.getByText(name)
  const row = cell.closest('tr')
  if (row == null) throw new Error(`row not found for ${name}`)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  currentRows = DATASET
  getShouldReject = false
  mobileRef.current = false
})

describe('DR-59 My Skills UI', () => {
  it('renders the header count from API rows', async () => {
    renderMySkills()
    expect(await screen.findByText('7 Skills in My Skills')).toBeInTheDocument()
  })

  it('renders a live DR-54 payload that omits id and category', async () => {
    const user = userEvent.setup()
    // The real ListMySkills response has skill_id/slug/name/skill_status/...
    // but NO `id` and NO `category` — exercise that exact shape.
    // No `id` and no `category` — the standalone MySkill type accepts this
    // exact live shape without any cast.
    currentRows = [
      {
        skill_id: 'live-1',
        slug: 'live-skill',
        name: 'Live Skill',
        skill_status: 'published',
        required_plan: 'free',
        enabled: true,
        enabled_at: '2026-06-15T00:00:00Z',
        last_used_at: null,
        availability: { executable: true, locked: false, cta: 'use' },
      },
    ]
    renderMySkills()
    await screen.findByText('Live Skill')
    const row = rowOf('Live Skill')
    // Use navigates by slug (no id present).
    await user.click(within(row).getByRole('button', { name: 'Use' }))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'live-skill' },
    })
    // Remove targets skill_id even though `id` is absent.
    await user.click(
      within(row).getByRole('button', { name: 'Remove from My Skills' })
    )
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        '/api/v1/marketplace/my-skills/live-1',
        expect.objectContaining({ skipErrorHandler: true })
      )
    )
  })

  it('renders all rows with status / plan / last-used columns', async () => {
    renderMySkills()
    expect(await screen.findByText('Exec Skill')).toBeInTheDocument()
    for (const name of [
      'Plan Skill',
      'Deprecated Exec',
      'Deprecated Locked',
      'Archived Skill',
      'Kids Blocked',
      'Quota Skill',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(within(rowOf('Exec Skill')).getByText('Available')).toBeInTheDocument()
    expect(within(rowOf('Exec Skill')).getByText('Never')).toBeInTheDocument()
    expect(within(rowOf('Plan Skill')).getByText('Plan required')).toBeInTheDocument()
  })

  it('Available filter shows only executable non-deprecated rows', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(screen.getByRole('tab', { name: /Available/ }))
    expect(screen.getByText('Exec Skill')).toBeInTheDocument()
    expect(screen.queryByText('Plan Skill')).not.toBeInTheDocument()
    expect(screen.queryByText('Deprecated Exec')).not.toBeInTheDocument()
    expect(screen.queryByText('Archived Skill')).not.toBeInTheDocument()
  })

  it('Locked filter includes plan / kids / archived-unavailable rows', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(screen.getByRole('tab', { name: /Locked/ }))
    expect(screen.getByText('Plan Skill')).toBeInTheDocument()
    expect(screen.getByText('Archived Skill')).toBeInTheDocument()
    expect(screen.getByText('Kids Blocked')).toBeInTheDocument()
    expect(screen.getByText('Quota Skill')).toBeInTheDocument()
    expect(screen.queryByText('Exec Skill')).not.toBeInTheDocument()
    // deprecated+locked belongs to Deprecated, not Locked.
    expect(screen.queryByText('Deprecated Locked')).not.toBeInTheDocument()
  })

  it('quota-exceeded row shows the quota status, no Use, and a Remove action', async () => {
    renderMySkills()
    await screen.findByText('Quota Skill')
    const row = rowOf('Quota Skill')
    expect(within(row).getByText('Quota exceeded')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Use' })).not.toBeInTheDocument()
    expect(
      within(row).getByRole('button', { name: 'Remove from My Skills' })
    ).toBeInTheDocument()
  })

  it('Deprecated filter includes deprecated rows, including deprecated+locked', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(screen.getByRole('tab', { name: /Deprecated/ }))
    expect(screen.getByText('Deprecated Exec')).toBeInTheDocument()
    expect(screen.getByText('Deprecated Locked')).toBeInTheDocument()
    expect(screen.queryByText('Exec Skill')).not.toBeInTheDocument()
    expect(screen.queryByText('Plan Skill')).not.toBeInTheDocument()
  })

  it('shows a filtered-empty message when a filter has no rows', async () => {
    const user = userEvent.setup()
    currentRows = [mySkill({ skill_id: 's-exec', slug: 'exec', name: 'Exec Skill' })]
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(screen.getByRole('tab', { name: /Deprecated/ }))
    expect(screen.getByText('No Skills match this filter.')).toBeInTheDocument()
  })

  it('shows the global empty state with an Explore Skills CTA', async () => {
    currentRows = []
    renderMySkills()
    expect(await screen.findByText('No skills in My Skills')).toBeInTheDocument()
    const explore = screen.getByRole('button', { name: /Explore Skills/ })
    await userEvent.setup().click(explore)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/skills' })
  })

  it('shows an ErrorBanner with the error message and request id on load failure', async () => {
    getShouldReject = true
    renderMySkills()
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByText(/req-err-9/)).toBeInTheDocument()
  })

  it('Use on an executable row navigates to Skill Detail and emits no usage event', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(within(rowOf('Exec Skill')).getByRole('button', { name: 'Use' }))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'exec' },
    })
    // Navigation only — never executes, never emits skill_used.
    expect(api.post).not.toHaveBeenCalled()
  })

  it('does not render Use on locked rows; shows lock reason instead', async () => {
    renderMySkills()
    await screen.findByText('Plan Skill')
    expect(
      within(rowOf('Plan Skill')).queryByRole('button', { name: 'Use' })
    ).not.toBeInTheDocument()
    expect(within(rowOf('Plan Skill')).getByText('Plan required')).toBeInTheDocument()
  })

  it('locked rows render NO Upgrade / Renew / Contact Sales CTA (deliberate FR-U6 deferral)', async () => {
    renderMySkills()
    await screen.findByText('Plan Skill')
    // Guards the conscious FR-U6 deviation: locked rows are reason + Remove only,
    // with no clickable upgrade-class CTA (no wired plan/renew/contact route).
    for (const name of ['Plan Skill', 'Quota Skill', 'Deprecated Locked']) {
      const row = rowOf(name)
      expect(
        within(row).queryByRole('button', { name: /upgrade|renew|contact/i })
      ).not.toBeInTheDocument()
      expect(
        within(row).queryByRole('link', { name: /upgrade|renew|contact/i })
      ).not.toBeInTheDocument()
    }
  })

  it('deprecated+executable shows the warning but NO Use and a non-link name (Detail is published-only)', async () => {
    renderMySkills()
    await screen.findByText('Deprecated Exec')
    const row = rowOf('Deprecated Exec')
    expect(within(row).getByText(/keep using it for now/i)).toBeInTheDocument()
    // No Use (would dead-end at published-only Detail).
    expect(within(row).queryByRole('button', { name: 'Use' })).not.toBeInTheDocument()
    // Name is plain text, not a navigable button.
    expect(
      within(row).queryByRole('button', { name: 'Deprecated Exec' })
    ).not.toBeInTheDocument()
  })

  it('published row name navigates to Skill Detail; deprecated/archived names do not', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    // Published executable: name is a link → navigates by slug.
    await user.click(within(rowOf('Exec Skill')).getByRole('button', { name: 'Exec Skill' }))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'exec' },
    })
    // Deprecated + archived: names are NOT buttons (no Detail navigation).
    expect(
      within(rowOf('Deprecated Exec')).queryByRole('button', { name: 'Deprecated Exec' })
    ).not.toBeInTheDocument()
    expect(
      within(rowOf('Archived Skill')).queryByRole('button', { name: 'Archived Skill' })
    ).not.toBeInTheDocument()
  })

  it('deprecated+locked shows the warning and lock copy but NO Use', async () => {
    renderMySkills()
    await screen.findByText('Deprecated Locked')
    const row = rowOf('Deprecated Locked')
    expect(within(row).queryByRole('button', { name: 'Use' })).not.toBeInTheDocument()
    expect(within(row).getByText('Plan required')).toBeInTheDocument()
    expect(within(row).getByText(/keep using it for now/i)).toBeInTheDocument()
  })

  it('archived and kids-blocked rows offer no Use', async () => {
    renderMySkills()
    await screen.findByText('Archived Skill')
    expect(
      within(rowOf('Archived Skill')).queryByRole('button', { name: 'Use' })
    ).not.toBeInTheDocument()
    expect(
      within(rowOf('Kids Blocked')).queryByRole('button', { name: 'Use' })
    ).not.toBeInTheDocument()
    expect(within(rowOf('Kids Blocked')).getByText('Blocked in Kids Mode')).toBeInTheDocument()
  })

  it('Remove opens a confirm dialog, then DELETEs the skill and refetches', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    expect(api.get).toHaveBeenCalledTimes(1)

    await user.click(
      within(rowOf('Exec Skill')).getByRole('button', {
        name: 'Remove from My Skills',
      })
    )
    expect(await screen.findByText('Remove from My Skills?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/api/v1/marketplace/my-skills/s-exec',
        expect.objectContaining({ skipErrorHandler: true })
      )
    })
    expect(api.delete).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })

  it('closes the confirm dialog after confirming Remove', async () => {
    const user = userEvent.setup()
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(
      within(rowOf('Exec Skill')).getByRole('button', {
        name: 'Remove from My Skills',
      })
    )
    expect(await screen.findByText('Remove from My Skills?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(screen.queryByText('Remove from My Skills?')).not.toBeInTheDocument()
    )
  })

  it('Remove failure surfaces an error toast', async () => {
    const user = userEvent.setup()
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('nope'))
    renderMySkills()
    await screen.findByText('Exec Skill')
    await user.click(
      within(rowOf('Exec Skill')).getByRole('button', {
        name: 'Remove from My Skills',
      })
    )
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('renders the mobile stacked list (no table) on small screens, with working actions', async () => {
    const user = userEvent.setup()
    mobileRef.current = true
    currentRows = [mySkill({ skill_id: 's-exec', slug: 'exec', name: 'Exec Skill' })]
    renderMySkills()
    await screen.findByText('Exec Skill')
    // Mobile path renders cards, not a <table>.
    expect(document.querySelector('table')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Use' }))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/skills/$slug',
      params: { slug: 'exec' },
    })
  })

  it('never shows Disable wording or a Playground action', async () => {
    renderMySkills()
    await screen.findByText('Exec Skill')
    expect(screen.queryByText(/Disable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Playground/i)).not.toBeInTheDocument()
  })
})
