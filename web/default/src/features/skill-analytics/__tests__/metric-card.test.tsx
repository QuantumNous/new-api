/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/

// Coverage: MetricCard component — loading / no-data / tracking-failed / normal states

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { MetricCard } from '../components/metric-card'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('MetricCard', () => {
  const base = {
    title: 'Weekly Active Skill Users',
    value: '1,234' as string | null,
    description: 'Users who ran at least one skill call during the period',
    icon: Users,
  }

  it('renders title', () => {
    render(<MetricCard {...base} />)
    expect(screen.getByText('Weekly Active Skill Users')).toBeInTheDocument()
  })

  it('renders value and description in normal state', () => {
    render(<MetricCard {...base} />)
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(
      screen.getByText('Users who ran at least one skill call during the period')
    ).toBeInTheDocument()
  })

  it('shows skeleton elements when loading=true (no value rendered)', () => {
    const { container } = render(<MetricCard {...base} loading />)
    // Skeletons are divs with "animate-pulse" style — value text absent
    expect(screen.queryByText('1,234')).not.toBeInTheDocument()
    // at least one skeleton element present
    expect(container.querySelectorAll('[class*="skeleton"], [class*="animate"]').length).toBeGreaterThan(0)
  })

  it('shows "—" and "No data in this period" when value is null', () => {
    render(<MetricCard {...base} value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('No data in this period')).toBeInTheDocument()
  })

  it('shows "—" when trackingFailed=true regardless of value', () => {
    render(<MetricCard {...base} value='999' trackingFailed />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('999')).not.toBeInTheDocument()
  })

  it('shows "Tracking unavailable" description when trackingFailed=true', () => {
    render(<MetricCard {...base} trackingFailed />)
    expect(screen.getByText('Tracking unavailable')).toBeInTheDocument()
  })

  it('trackingFailed overrides value=null — shows tracking desc not no-data desc', () => {
    render(<MetricCard {...base} value={null} trackingFailed />)
    expect(screen.getByText('Tracking unavailable')).toBeInTheDocument()
    expect(screen.queryByText('No data in this period')).not.toBeInTheDocument()
  })

  it('renders sparkline placeholder bars (12 bars)', () => {
    const { container } = render(<MetricCard {...base} />)
    // The aria-hidden sparkline container has 12 child spans
    const sparklines = container.querySelectorAll('[aria-hidden="true"] > span')
    expect(sparklines).toHaveLength(12)
  })
})
