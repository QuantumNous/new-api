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

const localeTranslations = {
  en: en.translation,
  es: es.translation,
  fr: fr.translation,
  ja: ja.translation,
  pt: pt.translation,
  ru: ru.translation,
  vi: vi.translation,
  zh: zh.translation,
} as const

const invitationKeys = [
  'Invite',
  'Invite & Earn',
  'Invite friends to sign up and complete their first top-up, and you both receive {{reward}} in API credits.',
  'Invite friends to sign up and complete their first top-up. You receive {{inviterReward}} and your friend receives {{inviteeReward}} in API credits.',
  'Unlimited rewards, credits never expire, and any email address is accepted.',
  'Earn rewards for up to {{count}} successful referral. Credits never expire, and any email address is accepted.',
  'Earn rewards for up to {{count}} successful referrals. Credits never expire, and any email address is accepted.',
  'Earn More Credits!',
  'Total earned',
  'Lifetime',
  'Pending credits',
  "Released after your friend's first top-up",
  'Registered friends',
  '{{reward}} each after first top-up',
  'Active',
  'Tracking',
  'Share your link to start earning',
  'Your Referral Link',
  'Share your referral link with friends. Referral rewards are processed after their first successful top-up.',
  'Copy referral link',
  'Share by email',
  'Share on X',
  'Share on LinkedIn',
  'Join Flatkey with my referral link. Referral rewards are processed after your first successful top-up.',
  'How it works',
  'Share your referral link',
  'Send your unique referral link to a friend.',
  'Your friend signs up and tops up',
  'They create their account using your referral link and complete their first successful top-up.',
  'Both receive {{reward}}',
  'You receive {{inviterReward}}, your friend receives {{inviteeReward}}',
  'Rewards are added automatically to both API balances and used for API requests.',
  'Recent referrals',
  'User',
  'Registered',
  'Status',
  'Reward',
  'Reward granted',
  'Awaiting top-up',
  'Reward unavailable',
  'You reached the referral reward limit',
  'No referrals yet',
  'Share your referral link to get started.',
  "We couldn't load your referrals.",
  'Retry',
  'FAQ',
  'When are referral rewards granted?',
  'Referral rewards are granted only after your friend completes their first successful top-up. Registration, creating an API key, and making an API call do not grant a reward.',
  'What are the current referral rewards?',
  "The current configured rewards are {{inviterReward}} for you and {{inviteeReward}} for your friend. Rewards are processed after your friend's first successful top-up.",
  'Is there a referral reward limit?',
  'There is currently no limit on the number of referral rewards you can earn.',
  'The maximum number of successful referrals you can earn rewards for is {{count}}. Friends invited after that can still receive their reward.',
  'How do I use my referral rewards?',
  'Referral rewards are added automatically to your API balance and used for API requests.',
  'Which referrals appear here?',
  'This list shows active accounts registered through your referral link. Deleted accounts may not appear, so the rewards shown here may not add up to your lifetime earnings.',
  'What behavior is prohibited?',
  'Self-referrals, duplicate accounts, and other abuse are prohibited. Rewards may be withheld or revoked.',
  // Subscription-mode (invite reward v2) keys
  'Invite friends to subscribe: they get {{discount}} off their first month, and you receive {{reward}} in balance — unlocked {{days}} days after payment.',
  "Unlocks {{days}} days after your friend's payment",
  'Locked credits',
  '{{reward}} each after their first subscription',
  'You receive {{reward}} in balance',
  'Your friend subscribes with {{discount}} off',
  'They sign up with your link and get {{discount}} off the first month of any plan.',
  '{{reward}} is added to your balance, unlocked {{days}} days after payment if there is no refund.',
  'Referral rewards are created when your friend completes their first subscription payment, and unlock {{days}} days later if the payment is not refunded. Registration, top-ups, and API calls alone do not grant a reward.',
  'Your friend gets {{discount}} off the first month of any plan, and you receive {{reward}} as balance.',
  'Unlocks {{date}}',
  'Awaiting subscription',
  'Reward revoked',
  "Your friend's subscription was refunded",
  "Your friend's payment was disputed",
] as const

const localeInvariantKeys = new Set<(typeof invitationKeys)[number]>(['FAQ'])

const obsoleteReferralRewardKey =
  'Rewards are issued after your referral creates their first API key and successfully calls the API.'

describe('invitation i18n', () => {
  for (const [locale, translations] of Object.entries(localeTranslations)) {
    test(`${locale} contains translated invitation copy`, () => {
      for (const key of invitationKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} is missing ${key}`
        ).toBe(true)
        expect(
          translations[key],
          `${locale} has an empty value for ${key}`
        ).toBeTruthy()

        if (locale !== 'en' && !localeInvariantKeys.has(key)) {
          expect(
            translations[key],
            `${locale} should translate ${key}`
          ).not.toBe(key)
        }
      }
    })
  }

  test('preserves interpolation placeholders in every locale', () => {
    const placeholderKeys = {
      'Invite friends to sign up and complete their first top-up, and you both receive {{reward}} in API credits.':
        ['{{reward}}'],
      'Invite friends to sign up and complete their first top-up. You receive {{inviterReward}} and your friend receives {{inviteeReward}} in API credits.':
        ['{{inviterReward}}', '{{inviteeReward}}'],
      'Earn rewards for up to {{count}} successful referrals. Credits never expire, and any email address is accepted.':
        ['{{count}}'],
      'Earn rewards for up to {{count}} successful referral. Credits never expire, and any email address is accepted.':
        ['{{count}}'],
      '{{reward}} each after first top-up': ['{{reward}}'],
      'Both receive {{reward}}': ['{{reward}}'],
      'You receive {{inviterReward}}, your friend receives {{inviteeReward}}': [
        '{{inviterReward}}',
        '{{inviteeReward}}',
      ],
      "The current configured rewards are {{inviterReward}} for you and {{inviteeReward}} for your friend. Rewards are processed after your friend's first successful top-up.":
        ['{{inviterReward}}', '{{inviteeReward}}'],
      'The maximum number of successful referrals you can earn rewards for is {{count}}. Friends invited after that can still receive their reward.':
        ['{{count}}'],
      'Invite friends to subscribe: they get {{discount}} off their first month, and you receive {{reward}} in balance — unlocked {{days}} days after payment.':
        ['{{discount}}', '{{reward}}', '{{days}}'],
      "Unlocks {{days}} days after your friend's payment": ['{{days}}'],
      'Your friend subscribes with {{discount}} off': ['{{discount}}'],
      'They sign up with your link and get {{discount}} off the first month of any plan.':
        ['{{discount}}'],
      '{{reward}} is added to your balance, unlocked {{days}} days after payment if there is no refund.':
        ['{{reward}}', '{{days}}'],
      'Referral rewards are created when your friend completes their first subscription payment, and unlock {{days}} days later if the payment is not refunded. Registration, top-ups, and API calls alone do not grant a reward.':
        ['{{days}}'],
      'Your friend gets {{discount}} off the first month of any plan, and you receive {{reward}} as balance.':
        ['{{discount}}', '{{reward}}'],
      'Unlocks {{date}}': ['{{date}}'],
    } as const

    for (const [locale, translations] of Object.entries(localeTranslations)) {
      for (const [key, placeholders] of Object.entries(placeholderKeys)) {
        for (const placeholder of placeholders) {
          expect(
            translations[key as keyof typeof translations],
            `${locale} should preserve ${placeholder} in ${key}`
          ).toContain(placeholder)
        }
      }
    }
  })

  test('preserves product and platform names in every locale', () => {
    const literalKeys = {
      'Share on X': ['X'],
      'Share on LinkedIn': ['LinkedIn'],
      'Join Flatkey with my referral link. Referral rewards are processed after your first successful top-up.':
        ['Flatkey'],
      'Referral rewards are granted only after your friend completes their first successful top-up. Registration, creating an API key, and making an API call do not grant a reward.':
        ['API'],
      'Referral rewards are added automatically to your API balance and used for API requests.':
        ['API'],
    } as const

    for (const [locale, translations] of Object.entries(localeTranslations)) {
      for (const [key, literals] of Object.entries(literalKeys)) {
        for (const literal of literals) {
          expect(
            translations[key as keyof typeof translations],
            `${locale} should preserve ${literal} in ${key}`
          ).toContain(literal)
        }
      }
    }
  })

  test('keeps the sidebar promotion concise in every locale', () => {
    for (const translations of Object.values(localeTranslations)) {
      expect(translations['Earn More Credits!'].length).toBeLessThanOrEqual(22)
    }
  })

  test('does not retain obsolete API-key referral reward guidance', () => {
    for (const [locale, translations] of Object.entries(localeTranslations)) {
      expect(
        Object.prototype.hasOwnProperty.call(
          translations,
          obsoleteReferralRewardKey
        ),
        `${locale} should not contain obsolete referral reward guidance`
      ).toBe(false)
    }
  })

  test('does not retain obsolete manual-transfer guidance', () => {
    const obsoleteKeys = [
      'Move available referral rewards to your main balance.',
      'Transfer available referral rewards to your main balance, then use them for API requests.',
    ]

    for (const [locale, translations] of Object.entries(localeTranslations)) {
      for (const key of obsoleteKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} should not contain obsolete transfer guidance`
        ).toBe(false)
      }
    }
  })

  test('Japanese anti-abuse copy identifies self-referrals explicitly', () => {
    const antiAbuseCopy =
      ja.translation[
        'Self-referrals, duplicate accounts, and other abuse are prohibited. Rewards may be withheld or revoked.'
      ]

    expect(antiAbuseCopy).toContain('自己招待')
    expect(antiAbuseCopy).not.toContain('自己紹介')
  })
})
