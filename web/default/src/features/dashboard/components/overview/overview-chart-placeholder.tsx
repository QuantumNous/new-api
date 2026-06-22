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
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { OVERVIEW_MIDDLE_BODY_CLASS } from './overview-reference-styles'

const PLACEHOLDER_POINTS = Array.from({ length: 13 }, (_, index) => ({
  label: `${String(index * 2).padStart(2, '0')}:00`,
  current: 0,
  prior: 0,
}))

interface OverviewChartPlaceholderProps {
  message?: string
  description?: string
}

export function OverviewChartPlaceholder(props: OverviewChartPlaceholderProps) {
  const { t } = useTranslation()

  return (
    <div className={OVERVIEW_MIDDLE_BODY_CLASS}>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={PLACEHOLDER_POINTS} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke='#EEF0F3' strokeDasharray='3 3' vertical={false} />
          <XAxis
            dataKey='label'
            tick={{ fill: '#C4CBD4', fontSize: 10 }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#C4CBD4', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
            ticks={[0, 2, 4]}
          />
          <Line type='monotone' dataKey='current' stroke='transparent' dot={false} />
          <Line type='monotone' dataKey='prior' stroke='transparent' dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 px-4'>
        <span className='flex size-9 items-center justify-center rounded-full bg-[#F3F4F6]'>
          <Activity className='size-4 text-[#9CA3AF]' aria-hidden='true' />
        </span>
        <div className='max-w-xs text-center'>
          <p className='text-[13px] font-medium text-[#374151]'>
            {props.message ?? t('Dashboard trend empty hint')}
          </p>
          {props.description ? (
            <p className='mt-1 text-[12px] leading-relaxed text-[#9CA3AF]'>
              {props.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
