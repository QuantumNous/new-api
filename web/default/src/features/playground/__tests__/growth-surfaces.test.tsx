/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
// Coverage: DR-78 Playground empty-state recommendation surface.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { MarketplaceSkill } from '@/features/marketplace/types'
import { PlaygroundEmptyState } from '../components/playground-empty-state'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values
        ? key
            .replace('{{name}}', values.name)
            .replace('{{category}}', values.category)
        : key,
  }),
}))

const SKILL: MarketplaceSkill = {
  id: 'skill-1',
  slug: 'writing-helper',
  name: 'Writing Helper',
  category: 'writing',
  short_description: 'Draft and improve short writing.',
  required_plan: 'free',
  availability: { enabled: false, locked: false, cta: 'download' },
  badges: ['featured'],
  featured: true,
}

describe('DR-78 Playground recommendation surface', () => {
  it('renders a recommended Skill and sends download CTA clicks', async () => {
    const user = userEvent.setup()
    const onDownloadRecommendation = vi.fn()

    render(
      <PlaygroundEmptyState
        recommendedSkill={SKILL}
        onDownloadRecommendation={onDownloadRecommendation}
        onSubmitPrompt={vi.fn()}
      />
    )

    expect(screen.getByText('Recommended skill')).toBeInTheDocument()
    expect(
      screen.getByText('Try Writing Helper for guided writing work.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try skill' }))
    expect(onDownloadRecommendation).toHaveBeenCalledWith(SKILL)
  })
})
