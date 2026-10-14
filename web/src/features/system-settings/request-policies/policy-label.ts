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
import type { TFunction } from 'i18next'

// Labels for the decision events recorded by the backend request policy state
// (reasons, sources and health), the session behaviors, and the auto-disable
// sources reported by the channel operations summary.
export function policyLabel(t: TFunction, value: string): string {
  switch (value) {
    case 'upstream_failure':
      return t('Upstream request failed')
    case 'request_failed':
      return t('Request failed')
    case 'task_failed':
      return t('Task failed')
    case 'strict_session':
      return t('Session behavior prevents switching channels')
    case 'attempt_budget_exhausted':
      return t('Total attempt budget exhausted')
    case 'channel_error':
      return t('Channel error')
    case 'unrecognized_status':
      return t('Unrecognized status code')
    case 'task_accepted':
      return t('The task was accepted; submission cannot be replayed')
    case 'pinned_channel':
      return t('Fixed channel constraint')
    case 'local_rejection':
      return t('Request rejected locally')
    case 'non_retryable_error':
    case 'system_retry_exclusion':
      return t('System retry exclusion')
    case 'status_not_retryable':
      return t('Status is outside the retry rules')
    case 'retry_status_matched':
      return t('Status matches the retry rules')
    case 'session_rule_matched':
      return t('Session rule matched')
    case 'channel_selected':
      return t('Channel selected')
    case 'request_completed':
      return t('Request completed')
    case 'stream_not_successful':
      return t('Stream did not complete successfully')
    case 'channel':
      return t('Channel')
    case 'global':
      return t('Global default')
    case 'global_and_channel':
      return t('Global and channel settings')
    case 'session_rule':
      return t('Session rule')
    case 'system':
      return t('System constraint')
    case 'routing':
      return t('Channel selection')
    case 'upstream':
      return t('Upstream response')
    case 'transport':
      return t('Upstream connection')
    case 'local':
      return t('Local check')
    case 'channel_constraint':
      return t('Fixed channel constraint')
    case 'unchanged':
      return t('Unchanged')
    case 'channel_disable_requested':
      return t('Channel disable requested')
    case 'key_disable_requested':
      return t('Current key disable requested')
    case 'off':
    case '':
      return t('Do not keep sessions')
    case 'prefer':
      return t('Prefer the original channel, allow switching')
    case 'strict':
      return t('Require the original channel')
    default:
      return value
  }
}
