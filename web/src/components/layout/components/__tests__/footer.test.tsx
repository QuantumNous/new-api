/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Footer } from '../footer'

const status = vi.hoisted(() => ({
  user_agreement_enabled: false,
  privacy_policy_enabled: false,
}))
const systemConfig = vi.hoisted(() => ({
  footerHtml: '',
  logo: '/logo.png',
  systemName: 'New API',
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status }),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => systemConfig,
}))

describe('Footer', () => {
  beforeEach(() => {
    status.user_agreement_enabled = false
    status.privacy_policy_enabled = false
    systemConfig.footerHtml = ''
  })

  it('shows one concise upstream copyright attribution', () => {
    render(<Footer />)

    const projectLink = screen
      .getAllByRole('link', { name: 'New API' })
      .find(
        (link) =>
          link.getAttribute('href') === 'https://github.com/QuantumNous/new-api'
      )
    if (!projectLink) throw new Error('New API attribution link is missing')
    expect(projectLink).toHaveAttribute(
      'href',
      'https://github.com/QuantumNous/new-api'
    )
    expect(screen.getByText('野菜')).toBeVisible()
    expect(screen.getAllByText('New API')).toHaveLength(1)
    expect(projectLink.closest('footer')).toHaveTextContent(
      String(new Date().getFullYear())
    )
    expect(screen.queryByText('野菜API')).not.toBeInTheDocument()
  })

  it('renders configured footer content and enabled legal links', () => {
    systemConfig.footerHtml = '<strong>Operator footer</strong>'
    status.user_agreement_enabled = true
    status.privacy_policy_enabled = true

    render(<Footer />)

    expect(screen.getByText('Operator footer')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'User Agreement' })
    ).toHaveAttribute('href', '/user-agreement')
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' })
    ).toHaveAttribute('href', '/privacy-policy')
  })
})
