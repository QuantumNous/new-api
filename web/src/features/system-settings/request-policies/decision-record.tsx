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

import type { PolicyEvent } from './api'
import { policyLabel } from './policy-label'

export function PolicyDecisionRecord(props: {
  events: PolicyEvent[] | null
  channelNames?: Record<number, string>
}) {
  const { t } = useTranslation()
  return (
    <ol aria-label={t('Request decision flow')} className='space-y-0 text-sm'>
      {(props.events ?? []).map((event, index) => (
        <li
          key={`${event.attempt}:${event.channel_id ?? 0}:${event.decision.action}:${event.decision.reason}:${event.rule ?? ''}`}
          className='border-border relative ml-3 min-w-0 border-l pb-5 pl-6 last:border-transparent last:pb-1'
        >
          <span
            aria-hidden='true'
            className='border-border bg-background absolute -left-3 flex size-6 items-center justify-center rounded-full border text-xs'
          >
            {index + 1}
          </span>
          <p
            className={
              event.decision.action === 'stop'
                ? 'font-medium text-amber-700 dark:text-amber-400'
                : 'font-medium'
            }
          >
            {policyLabel(t, event.decision.reason)}
            {event.channel_id
              ? ` · ${props.channelNames?.[event.channel_id] ?? `#${event.channel_id}`}`
              : ''}
            {event.status && event.decision.action === 'failure'
              ? ` · HTTP ${event.status}`
              : ''}
          </p>
          <p className='text-muted-foreground text-xs break-words'>
            {event.attempt > 0 ? `${t('Attempt')} ${event.attempt} · ` : ''}
            {event.elapsed_ms} ms
            {event.group ? ` · ${event.group}` : ''}
            {event.rule ? ` · ${event.rule}` : ''}
            {event.status ? ` · HTTP ${event.status}` : ''}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t('Source')}: {policyLabel(t, event.decision.source)}
            {event.health ? ` · ${policyLabel(t, event.health)}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}
