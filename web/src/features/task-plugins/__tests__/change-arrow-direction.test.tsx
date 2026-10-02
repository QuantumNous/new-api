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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarketplacePluginCard } from '../components/marketplace-plugin-card'
import { UsageSchemaTable } from '../components/usage-schema-table'

// Icon rendering is outside these checks (see plugin-card.test.tsx).
vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const FSI = '⁨'
const PDI = '⁩'

function renderUpgradeBadge() {
  render(
    <MarketplacePluginCard
      plugin={{
        key: 'kling',
        name: 'Kling',
        latest: '1.3.0',
        versions: [{ version: '1.3.0', path: 'plugin.js' }],
      }}
      installState={{
        status: 'upgradable',
        installedVersion: '1.2.3',
        latestVersion: '1.3.0',
      }}
      onInstall={() => undefined}
    />
  )
}

function renderEnumCell() {
  render(
    <UsageSchemaTable
      schema={{
        resolution: {
          enum: ['720p'],
          enumLabels: { '720p': { en: 'HD', fa: 'کیفیت بالا' } },
        },
      }}
    />
  )
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('task plugin change arrows', () => {
  it('in English, keeps the version upgrade as v1 → v2', async () => {
    await i18next.changeLanguage('en')
    renderUpgradeBadge()

    expect(screen.getByText('v1.2.3 → v1.3.0')).toBeInTheDocument()
  })

  it('in Persian, isolates both versions and points the arrow to the left', async () => {
    await i18next.changeLanguage('fa')
    renderUpgradeBadge()

    expect(
      screen.getByText(`${FSI}v1.2.3${PDI} ← ${FSI}v1.3.0${PDI}`)
    ).toBeInTheDocument()
  })

  it('in English, keeps the enum value and its label as value → label', async () => {
    await i18next.changeLanguage('en')
    renderEnumCell()

    expect(screen.getByRole('cell', { name: '720p → HD' })).toBeVisible()
  })

  it('in Persian, isolates the enum value and its label and points the arrow to the left', async () => {
    await i18next.changeLanguage('fa')
    renderEnumCell()

    expect(
      screen.getByText(`${FSI}720p${PDI} ← ${FSI}کیفیت بالا${PDI}`)
    ).toBeInTheDocument()
  })
})
