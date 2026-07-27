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
import type { RecallAudienceTemplate } from './types'

export const audienceTemplateDescriptionKeys: Record<
  RecallAudienceTemplate,
  string
> = {
  first_purchase:
    'Targets registered users who have never paid, for campaigns that encourage a first purchase.',
  lapsed_payer:
    'Targets previous payers who have not paid or used the API recently.',
  expired_subscription:
    'Targets previous subscribers whose subscription is no longer active and expired long enough ago.',
  registered_only:
    'Targets users who registered within a selected registration date range.',
  registration_time_range:
    'Targets users registered within the selected time range, regardless of API usage, payment, or subscription status.',
  specified_users:
    'Targets explicitly selected users by user ID or email address.',
}

export const recallCampaignEditorCopyKeys = [
  'Registered only',
  'Registration time range',
  'Specified users',
  'Registration start',
  'Registration end',
  'Registration start is required',
  'Registration end is required',
  'Registration end must be on or after start',
  'At least one user or email is required',
  'User IDs are invalid',
  'Emails are invalid',
  'Up to 500 users or emails are supported',
] as const

export const recallActivityEmailCopyKeys = [
  'stale',
  'manual',
  'missing',
  'invalid',
  'Activity email hourly limit',
  'All Activity Configuration campaigns share this hourly limit. Other system emails are unaffected.',
  'Attempts count when SMTP sending starts and are not refunded.',
  '{{used}} / {{limit}} sent this hour',
  'Hourly limit reached. Queued activity emails will resume at {{time}}.',
  'Quota resets at {{time}}.',
  'Hourly limit must be between 1 and 100000.',
  'Save hourly limit',
] as const
