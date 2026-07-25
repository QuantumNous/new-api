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
import { describe, expect, test } from 'bun:test'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import fr from '../../i18n/locales/fr.json'
import ja from '../../i18n/locales/ja.json'
import pt from '../../i18n/locales/pt.json'
import ru from '../../i18n/locales/ru.json'
import vi from '../../i18n/locales/vi.json'
import zh from '../../i18n/locales/zh.json'
import { audienceTemplateDescriptionKeys } from './copy'
import * as recallCopy from './copy'

const localeTranslations: Record<string, Record<string, string>> = {
  en: en.translation,
  es: es.translation,
  fr: fr.translation,
  ja: ja.translation,
  pt: pt.translation,
  ru: ru.translation,
  vi: vi.translation,
  zh: zh.translation,
}

const translatedAudienceTemplateDescriptionKeys = [
  audienceTemplateDescriptionKeys.first_purchase,
  audienceTemplateDescriptionKeys.lapsed_payer,
  audienceTemplateDescriptionKeys.expired_subscription,
  audienceTemplateDescriptionKeys.registered_only,
  audienceTemplateDescriptionKeys.specified_users,
] as const

const activityConfigurationKeys = [
  'Activity Configuration',
  'Create activity configuration',
  'No activity configurations',
  'Back to Activity Configuration',
] as const

const exactAudienceControlKeys = [
  'Registered only',
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

const dynamicAudienceTemplateValueKeys = [
  'registered_only',
  'specified_users',
] as const

const specifiedUsersSelectorKeys = [
  'Specified users',
  'Manual emails',
  'Search users by name, username, or email',
  'No selected users.',
  'Loading matching users...',
  'Failed to load matching users.',
  'No matching users',
  'Invalid email entries',
  'Unavailable',
  'one@example.com, two@example.com',
] as const

const recallEmailPlaceholderHelpKeys = [
  'Available placeholders',
  'Click a placeholder to insert it into the body.',
  "Recipient's display name, or username when no display name is set.",
  'Masked promotion code, for example SAVE****25.',
  'Selected top-up amounts and subscription plan names and prices; internal product IDs are never shown.',
  'Promotion expiration time, displayed in UTC.',
  'Personal link that opens the top-up page and claims the offer.',
  'Personal link that stops future recall emails for this recipient.',
  'HTML link example:',
  'Preview uses sample recipient and offer data.',
] as const

const recallHelpKeys = [
  'Subject must be 200 characters or fewer',
  'Leave empty to use the campaign name.',
  'Body text must be 2000 characters or fewer',
  'Stripe does not convert fixed Coupon amounts automatically. Configure each checkout currency explicitly.',
  'Audience templates define the base audience. The rules shown below narrow it further, and built-in eligibility filters also apply. Preview the audience before activation.',
  "Email content is translated automatically when saved, sent in each user's language, and falls back to English when unavailable.",
  'Recall user groups',
  'Select user groups',
  'No matching user groups',
  'Loading configured user groups...',
  'Failed to load configured user groups.',
  'No configured user groups are available.',
  'Choose Allow or Block, then select the user groups to include or exclude. With no group filter, eligible users from every group are included.',
  ...activityConfigurationKeys,
  ...exactAudienceControlKeys,
  ...dynamicAudienceTemplateValueKeys,
  ...specifiedUsersSelectorKeys,
  ...recallEmailPlaceholderHelpKeys,
  ...translatedAudienceTemplateDescriptionKeys,
] as const

const legacyActivityConfigurationKeys = [
  'Recall Campaigns',
  'Create recall campaign',
  'No recall campaigns',
  'Back to Recall Campaigns',
] as const

describe('recall campaign copy', () => {
  test('maps each audience template to its explanation', () => {
    expect(audienceTemplateDescriptionKeys).toEqual({
      first_purchase:
        'Targets registered users who have never paid, for campaigns that encourage a first purchase.',
      lapsed_payer:
        'Targets previous payers who have not paid or used the API recently.',
      expired_subscription:
        'Targets previous subscribers whose subscription is no longer active and expired long enough ago.',
      registered_only:
        'Targets users who registered within a selected registration date range.',
      specified_users:
        'Targets explicitly selected users by user ID or email address.',
    })
  })

  test('exposes source copy for exact audience controls', () => {
    expect(
      (
        recallCopy as typeof recallCopy & {
          recallCampaignEditorCopyKeys?: readonly string[]
        }
      ).recallCampaignEditorCopyKeys
    ).toEqual(expect.arrayContaining([...exactAudienceControlKeys]))
    expect(recallCopy.recallCampaignEditorCopyKeys).not.toContain(
      'Registration end must be after start'
    )
  })

  for (const [locale, translations] of Object.entries(localeTranslations)) {
    test(`${locale} contains translated recall configuration help`, () => {
      for (const key of recallHelpKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} is missing ${key}`
        ).toBe(true)
        expect(
          translations[key],
          `${locale} has an empty value for ${key}`
        ).toBeTruthy()

        if (locale !== 'en') {
          expect(
            translations[key],
            `${locale} should translate ${key}`
          ).not.toBe(key)
          expect(
            translations[key],
            `${locale} should not use placeholder punctuation for ${key}`
          ).not.toContain('?')
        }
      }
    })

    test(`${locale} uses Activity Configuration instead of legacy Recall Campaign copy`, () => {
      for (const key of activityConfigurationKeys) {
        expect(translations[key], `${locale} is missing ${key}`).toBeTruthy()
      }

      for (const key of legacyActivityConfigurationKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} should not keep legacy visible key ${key}`
        ).toBe(false)
      }
    })
  }
})
