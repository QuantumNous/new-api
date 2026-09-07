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
import { useTranslation } from 'react-i18next'

import { BadgeCell, TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  // AutoGroupBadge,
  GroupRatioBadge,
  type GroupRatio,
} from './auto-group-visuals'

type ApiKeyGroupCellProps = {
  crossGroupRetry: boolean
  group: string
  ratio?: GroupRatio
  routingPriority?: string
  shouldReduceMotion: boolean
}

const SMART_ROUTING_LABELS: Record<string, string> = {
  auto: 'Auto',
  price: 'Price',
  speed: 'Speed',
  success_rate: 'Success rate',
}

export function ApiKeyGroupCell(props: ApiKeyGroupCellProps) {
  const { t } = useTranslation()
  const isSmart = !!props.routingPriority

  if (props.group !== 'auto') {
    const ratio = typeof props.ratio === 'number' ? props.ratio : undefined
    return (
      <TruncatedCell
        className='-ml-1.5'
        tooltipContent={props.group || '-'}
        tooltipClassName='break-all'
      >
        <GroupBadge group={props.group} ratio={ratio} />
      </TruncatedCell>
    )
  }

  const strategyLabel = isSmart
    ? t(SMART_ROUTING_LABELS[props.routingPriority!] ?? 'Auto')
    : null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <BadgeCell
            data-api-key-group-cell={isSmart ? 'smart' : 'auto'}
            className='gap-1.5 overflow-visible text-xs'
          />
        }
      >
        {isSmart ? (
          <StatusBadge
            label={t('Smart: {{strategy}}', { strategy: strategyLabel })}
            variant='success'
            copyable={false}
          />
        ) : (
          <StatusBadge
            label={t('Cross-group')}
            variant='info'
            copyable={false}
          />
        )}
        {/*<AutoGroupBadge shouldReduceMotion={props.shouldReduceMotion} />*/}
        <GroupRatioBadge
          ratio={props.ratio}
          isAuto
          shouldReduceMotion={props.shouldReduceMotion}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span className='text-xs'>
          {isSmart
            ? t(
                'Smart routing: the system picks the optimal channel across all usable groups by the selected strategy.'
              )
            : t(
                'Automatically selects the best available group with circuit breaker mechanism'
              )}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
