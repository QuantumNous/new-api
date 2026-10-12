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
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModelPerfBadge } from '../components/model-perf-badge'
import { PricingToolbar } from '../components/pricing-toolbar'

// Values such as "/1M" and "—t/s" start or end with neutral characters. On a
// right-to-left page they are isolated left to right, so the "/" and "—" stay
// on their side of the value.

describe('pricing toolbar token unit', () => {
  it.each(['/1M', '/1K'])(
    'isolates the %s toggle text left to right',
    (label) => {
      render(
        <PricingToolbar
          filteredCount={0}
          totalCount={0}
          sortBy='name'
          tokenUnit='M'
          showRechargePrice={false}
          viewMode='card'
          quotaTypeFilter='all'
          endpointTypeFilter='all'
          vendorFilter='all'
          groupFilter='all'
          tagFilter='all'
          onSortChange={vi.fn()}
          onTokenUnitChange={vi.fn()}
          onRechargePriceChange={vi.fn()}
          onViewModeChange={vi.fn()}
          onQuotaTypeChange={vi.fn()}
          onEndpointTypeChange={vi.fn()}
          onVendorChange={vi.fn()}
          onGroupChange={vi.fn()}
          onTagChange={vi.fn()}
          vendors={[]}
          groups={[]}
          groupRatios={{}}
          tags={[]}
          models={[]}
          hasActiveFilters={false}
          activeFilterCount={0}
          onClearFilters={vi.fn()}
        />
      )

      const toggle = screen.getByRole('button', { name: label })
      expect(within(toggle).getByText(label)).toHaveAttribute('dir', 'ltr')
    }
  )
})

describe('model performance badge', () => {
  it('isolates the empty latency and throughput values left to right', () => {
    render(
      <ModelPerfBadge
        perf={{ avg_latency_ms: 0, success_rate: 100, avg_tps: 0 }}
      />
    )

    expect(screen.getByText('—s')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText('—t/s')).toHaveAttribute('dir', 'ltr')
  })

  it('isolates measured latency and throughput values left to right', () => {
    render(
      <ModelPerfBadge
        perf={{ avg_latency_ms: 1250, success_rate: 99, avg_tps: 42.5 }}
      />
    )

    expect(screen.getByText('1.25s')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText('42.5t/s')).toHaveAttribute('dir', 'ltr')
  })
})
