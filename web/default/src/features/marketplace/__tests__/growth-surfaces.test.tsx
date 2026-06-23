/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
// Coverage: DR-78 growth surfaces — new Skill banner and download URL attribution.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NewSkillBanner } from '../components/new-skill-banner'
import { skillDownloadURL } from '../lib/growth-surfaces'
import type { MarketplaceSkill } from '../types'

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

describe('DR-78 Marketplace growth surfaces', () => {
  it('renders the new Skill banner and handles CTA/dismiss', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onDismiss = vi.fn()

    render(
      <NewSkillBanner skill={SKILL} onAction={onAction} onDismiss={onDismiss} />
    )

    expect(screen.getByText('New skill available')).toBeInTheDocument()
    expect(
      screen.getByText('Writing Helper can help with writing tasks.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try skill' }))
    expect(onAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('adds recommended and new entry points to download URLs', () => {
    expect(skillDownloadURL('writing-helper', 'recommended')).toBe(
      '/api/v1/marketplace/skills/writing-helper/download?entry_point=recommended'
    )
    expect(skillDownloadURL('writing-helper', 'new')).toBe(
      '/api/v1/marketplace/skills/writing-helper/download?entry_point=new'
    )
    expect(skillDownloadURL('writing-helper', 'marketplace_card')).toBe(
      '/api/v1/marketplace/skills/writing-helper/download'
    )
  })
})
