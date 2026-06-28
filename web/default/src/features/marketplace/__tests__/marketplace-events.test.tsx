/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Marketplace } from '../index'
import type { MarketplaceEventPayload, MarketplaceSkill } from '../types'

const mockGetMarketplaceSkills = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: MarketplaceSkill[] }>>()
)
const mockEmitMarketplaceEvent = vi.hoisted(() =>
  vi.fn<(payload: MarketplaceEventPayload) => Promise<void>>()
)
const mockRecordMarketplaceSkillEvent = vi.hoisted(() => vi.fn())
const mockNavigate = vi.hoisted(() => vi.fn())

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  callback: IntersectionObserverCallback
  elements = new Set<Element>()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe = (element: Element) => {
    this.elements.add(element)
  }

  unobserve = (element: Element) => {
    this.elements.delete(element)
  }

  disconnect = () => {
    this.elements.clear()
  }

  trigger() {
    this.callback(
      Array.from(this.elements).map((target) => ({
        target,
        isIntersecting: true,
        intersectionRatio: 1,
      })) as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver
    )
  }
}

vi.mock('../api', () => ({
  getMarketplaceSkills: mockGetMarketplaceSkills,
  emitMarketplaceEvent: mockEmitMarketplaceEvent,
  recordMarketplaceSkillEvent: mockRecordMarketplaceSkillEvent,
  saveSkill: vi.fn().mockResolvedValue(undefined),
  unsaveSkill: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn() },
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      auth: {
        user: { id: 1, username: 'pro-user', role: 1, group: 'pro' },
      },
    }),
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

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type='button' onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/input-group', () => ({
  InputGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InputGroupAddon: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  InputGroupButton: ({
    children,
    onClick,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  InputGroupInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: () => <input type='checkbox' />,
}))

vi.mock('../components', () => ({
  EmptyState: ({ kind }: { kind: string }) => <div>{kind}</div>,
  ErrorBanner: () => <div>error</div>,
  KidsBadge: () => <span>Kids Safe</span>,
  NewSkillBanner: () => <div>new skill banner</div>,
  PlanBadge: ({ plan }: { plan: string }) => <span>{plan}</span>,
  SkillCTA: ({ action }: { action: string }) => <button>{action}</button>,
  SkillCard: ({
    skill,
    onOpen,
    cardRef,
  }: {
    skill?: MarketplaceSkill
    onOpen?: (skill: MarketplaceSkill) => void
    cardRef?: (node: HTMLDivElement | null) => void
  }) =>
    skill == null ? (
      <div data-testid='card-loading' />
    ) : (
      <div ref={cardRef} data-testid={`card-${skill.id}`}>
        <button type='button' onClick={() => onOpen?.(skill)}>
          {skill.name}
        </button>
      </div>
    ),
}))

function renderMarketplace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <Marketplace />
    </QueryClientProvider>
  )
}

describe('Marketplace analytics events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    mockGetMarketplaceSkills.mockResolvedValue({
      data: [
        {
          id: 'skill-1',
          slug: 'skill-1',
          name: 'Draft Helper',
          category: 'writing',
          short_description: 'Draft faster',
          required_plan: 'free',
        },
      ],
    })
    mockEmitMarketplaceEvent.mockResolvedValue()
    mockRecordMarketplaceSkillEvent.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fires one impression when a card becomes visible', async () => {
    renderMarketplace()
    await screen.findByText('Draft Helper')
    await waitFor(() => {
      expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0)
    })

    MockIntersectionObserver.instances.at(-1)?.trigger()

    await waitFor(() => {
      expect(mockEmitMarketplaceEvent).toHaveBeenCalled()
    })
    expect(mockEmitMarketplaceEvent.mock.calls[0][0]).toEqual({
      event_type: 'skill_impression',
      skill_id: 'skill-1',
      entry_point: 'marketplace_card',
    })
  })

  it('fires detail view when a card opens', async () => {
    renderMarketplace()
    await userEvent.click(await screen.findByText('Draft Helper'))

    expect(mockEmitMarketplaceEvent.mock.calls[0][0]).toEqual({
      event_type: 'skill_detail_view',
      skill_id: 'skill-1',
      entry_point: 'marketplace_card',
    })
  })

  it('keeps server search results that match tokens but not a contiguous substring', async () => {
    mockGetMarketplaceSkills.mockResolvedValue({
      data: [
        {
          id: 'skill-token-match',
          slug: 'skill-token-match',
          name: 'Draft Legal Helper',
          category: 'writing',
          short_description: 'Searchable by separate tokens',
          required_plan: 'free',
        },
      ],
    })

    renderMarketplace()
    await userEvent.type(
      await screen.findByLabelText('Search Skills'),
      'draft helper'
    )

    await waitFor(() => {
      expect(mockGetMarketplaceSkills).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: 'draft helper',
        }),
        1
      )
    })
    expect(screen.getByText('Draft Legal Helper')).toBeInTheDocument()
  })

  it('debounces search before refetching server-filtered pages', async () => {
    renderMarketplace()
    await screen.findByText('Draft Helper')
    mockGetMarketplaceSkills.mockClear()

    fireEvent.change(await screen.findByLabelText('Search Skills'), {
      target: { value: 'draft helper' },
    })

    expect(mockGetMarketplaceSkills).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(mockGetMarketplaceSkills).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: 'draft helper',
        }),
        1
      )
    })
  })
})
