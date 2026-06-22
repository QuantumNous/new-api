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
import { Cockpit24hOverview } from './cockpit-24h-overview'
import { CockpitChannelHealthTable } from './cockpit-channel-health-table'
import { CockpitOperationsTrend } from './cockpit-operations-trend'
import { CockpitTenantRanking } from './cockpit-tenant-ranking'
import {
  OVERVIEW_BOTTOM_ROW_CLASS,
  OVERVIEW_MIDDLE_ROW_CLASS,
} from './overview-reference-styles'

export function CockpitChartsGrid() {
  return (
    <section className='flex flex-col gap-2'>
      <div className={OVERVIEW_MIDDLE_ROW_CLASS}>
        <CockpitOperationsTrend />
        <CockpitChannelHealthTable />
      </div>

      <div className={OVERVIEW_BOTTOM_ROW_CLASS}>
        <Cockpit24hOverview />
        <CockpitTenantRanking />
      </div>
    </section>
  )
}
