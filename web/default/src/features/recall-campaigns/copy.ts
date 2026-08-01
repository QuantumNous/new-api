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

export const activitySMTPDeliveryFailureCopyKey =
  'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'

export const recallDeliveryErrorCopyByCode: Record<string, string> = {
  activity_smtp_not_configured:
    'Activity SMTP is not configured. Configure it before sending.',
  activity_smtp_send_failed: activitySMTPDeliveryFailureCopyKey,
  smtp_uncertain:
    'Delivery status is uncertain. Check the mailbox provider before retrying.',
}

export const recallTranslationTaskErrorCopyByCode: Record<string, string> = {
  translation_failed: 'Translation generation failed',
  translation_superseded:
    'Translation request was replaced by a newer request.',
}

export const recallTranslationTaskErrorCopyByKey: Record<string, string> = {
  'recall.translation.error.translation_failed':
    recallTranslationTaskErrorCopyByCode.translation_failed,
  'recall.translation.error.translation_superseded':
    recallTranslationTaskErrorCopyByCode.translation_superseded,
}

export function getRecallTranslationTaskErrorCopyKey(value: unknown): string {
  if (typeof value !== 'string')
    return recallTranslationTaskErrorCopyByCode.translation_failed
  const normalized = value.trim()
  return (
    recallTranslationTaskErrorCopyByCode[normalized] ??
    recallTranslationTaskErrorCopyByKey[normalized] ??
    recallTranslationTaskErrorCopyByCode.translation_failed
  )
}

const activitySMTPSaveFallbackCopyKey =
  'Failed to update Activity SMTP settings.'

const activitySMTPSaveValidationCopyByMessage: Record<string, string> = {
  'SMTP server is required': 'SMTP server is required.',
  'SMTP server is required.': 'SMTP server is required.',
  'SMTP port must be between 1 and 65535':
    'SMTP port must be between 1 and 65535.',
  'SMTP port must be between 1 and 65535.':
    'SMTP port must be between 1 and 65535.',
  'SMTP account is required': 'SMTP account is required.',
  'SMTP account is required.': 'SMTP account is required.',
  'SMTP token is required': 'SMTP token is required for first save.',
  'SMTP token is required.': 'SMTP token is required for first save.',
  'SMTP token is required for first save.':
    'SMTP token is required for first save.',
  'invalid SMTP sender': 'Sender must be a plain email address.',
  'Sender must be a plain email address.':
    'Sender must be a plain email address.',
}

function getObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as Record<string, unknown>
}

function getRecallApiErrorData(
  error: unknown
): Record<string, unknown> | undefined {
  return getObjectRecord(getObjectRecord(error)?.data)
}

export function getRecallDeliveryErrorCopyKey(
  code: unknown
): string | undefined {
  if (typeof code !== 'string') return undefined
  return recallDeliveryErrorCopyByCode[code]
}

export function getRecallApiErrorCodeCopyKey(
  error: unknown
): string | undefined {
  return getRecallDeliveryErrorCopyKey(getRecallApiErrorData(error)?.code)
}

export function getRecallActivitySMTPSafeSaveErrorCopyKey(
  error: unknown
): string {
  const codeCopy = getRecallApiErrorCodeCopyKey(error)
  if (codeCopy) return codeCopy

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : ''
  const validationCopy = activitySMTPSaveValidationCopyByMessage[message.trim()]
  return validationCopy ?? activitySMTPSaveFallbackCopyKey
}

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
  'recall.translation_status.ready',
  'recall.translation_status.stale',
  'recall.translation_status.manual',
  'recall.translation_status.missing',
  'recall.translation_status.invalid',
  'Activity email hourly limit',
  'All Activity Configuration campaigns share this hourly limit. Other system emails are unaffected.',
  'Attempts count when SMTP sending starts and are not refunded.',
  '{{used}} / {{limit}} sent this hour',
  'Hourly limit reached. Queued activity emails will resume at {{time}}.',
  'Quota resets at {{time}}.',
  'Hourly limit must be between 1 and 100000.',
  'Failed to load email quota.',
  'Save hourly limit',
] as const

export const recallActivitySMTPCopyKeys = [
  'Activity SMTP settings',
  'All Activity Configuration campaigns use this dedicated SMTP account.',
  'SMTP server',
  'SMTP port',
  'SMTP account',
  'Sender email',
  'SMTP token',
  'Leave blank to keep the existing SMTP token.',
  'Enter the SMTP token before saving.',
  'SSL enabled',
  'Force AUTH LOGIN',
  'Save SMTP settings',
  'Saving',
  'Activity SMTP settings saved.',
  'Failed to load Activity SMTP settings.',
  'Failed to update Activity SMTP settings.',
  'Loading SMTP settings',
  'Configured',
  'Not configured',
  'SMTP server is required.',
  'SMTP port is required.',
  'SMTP port must be an integer.',
  'SMTP port must be between 1 and 65535.',
  'SMTP account is required.',
  'Sender must be a plain email address.',
  'SMTP token is required for first save.',
  ...Object.values(recallDeliveryErrorCopyByCode),
] as const
