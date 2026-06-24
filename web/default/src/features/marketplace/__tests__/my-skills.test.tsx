/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
// Coverage: DR-56 My Skills removal UI calls the remove endpoint and refreshes
// the library query without exposing disable wording.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { MySkills } from '../my-skills'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

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

vi.mock('@/lib/api', () => ({
  api: {
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => ({
      data: {
        data: [
          {
            skill_id: 'skill-1',
            slug: 'writing-helper',
            name: 'Writing Helper',
            category: 'writing',
            short_description: 'Draft and improve short writing.',
            required_plan: 'free',
            skill_status: 'published',
            enabled: true,
            availability: {
              executable: true,
              locked: false,
              cta: 'use',
            },
          },
        ],
        meta: { request_id: 'req-1' },
      },
    })),
  },
}))

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

describe('DR-56 My Skills removal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes a skill from My Skills without using disable copy', async () => {
    const user = userEvent.setup()
    renderMySkills()

    expect(await screen.findByText('Writing Helper')).toBeInTheDocument()
    expect(screen.queryByText('Disable Skill')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Remove from My Skills' })
    )

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/api/v1/marketplace/my-skills/skill-1',
        expect.objectContaining({ skipErrorHandler: true })
      )
    })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2)
    })
  })
})
