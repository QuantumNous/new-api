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
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import type { ProfileSubscriptionSummary } from '../lib'
import type { UserProfile } from '../types'
import { ProfileHeader } from './profile-header'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

const profile: UserProfile = {
  id: 42,
  username: 'ada',
  display_name: 'Ada Lovelace',
  role: 1,
  email: 'ada@example.com',
  group: 'default',
  quota: 1500000,
  used_quota: 250000,
  request_count: 1234,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  created_time: 1710000000,
}

const activeSubscription: ProfileSubscriptionSummary = {
  planTitle: 'Pro',
  totalQuota: 5000000,
  usedQuota: 1900000,
  remainingQuota: 3100000,
  unlimited: false,
  notIncluded: false,
  remainingDays: 19,
  resetAt: 0,
  usagePercent: 38,
  window5h: {
    totalQuota: 20000,
    usedQuota: 5000,
    remainingQuota: 15000,
    unlimited: false,
    notIncluded: false,
    resetAt: 0,
    usagePercent: 25,
  },
  window7d: {
    totalQuota: 80000,
    usedQuota: 32000,
    remainingQuota: 48000,
    unlimited: false,
    notIncluded: false,
    resetAt: 0,
    usagePercent: 40,
  },
  mediaCredits: {
    totalQuota: 120,
    usedQuota: 35,
    remainingQuota: 85,
    unlimited: false,
    notIncluded: false,
    resetAt: 1720000000,
    usagePercent: 29.166666666666668,
  },
}

function renderHeader(subscription: ProfileSubscriptionSummary | null): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <ProfileHeader
        profile={profile}
        loading={false}
        subscription={subscription}
      />
    </I18nextProvider>
  )
}

async function renderHeaderWithTranslations(
  subscription: ProfileSubscriptionSummary | null,
  language: string,
  translations: Record<string, string>
): Promise<string> {
  const i18n = createInstance()

  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: language,
    resources: { [language]: { translation: translations } },
    interpolation: { escapeValue: false },
  })

  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ProfileHeader
        profile={profile}
        loading={false}
        subscription={subscription}
      />
    </I18nextProvider>
  )
}

function renderLoadingHeader(): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <ProfileHeader profile={null} loading subscription={null} />
    </I18nextProvider>
  )
}

function extractBalanceGuidance(html: string): string {
  const match = html.match(
    /<div[^>]*data-slot="profile-balance-guidance"[^>]*>[\s\S]*?<\/div>/
  )
  return match?.[0] ?? ''
}

function classForDataSlot(html: string, slot: string): string {
  const match = html.match(
    new RegExp(`<[^>]+data-slot="${slot}"[^>]*class="([^"]*)"`)
  )
  return match?.[1] ?? ''
}

function classForLoadingContentWrapper(html: string): string {
  const match = html.match(
    /<div class="([^"]*)"><div data-slot="profile-header-top-row"/
  )
  return match?.[1] ?? ''
}

function tokensForDataSlot(html: string, slot: string): string[] {
  return classForDataSlot(html, slot).split(/\s+/).filter(Boolean)
}

function sliceBetweenDataSlots(
  html: string,
  startSlot: string,
  endSlot: string
): string {
  const start = html.indexOf(`data-slot="${startSlot}"`)
  const end = html.indexOf(`data-slot="${endSlot}"`, start + 1)

  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)

  return html.slice(start, end)
}

describe('ProfileHeader', () => {
  test('renders an active subscription and compact balance guidance', () => {
    const html = renderHeader(activeSubscription)

    expect(html).toContain('aria-label="Current Plan"')
    expect(html).toContain('data-slot="profile-plan-summary"')
    expect(html).toContain('Pro')
    expect(html).toContain('Active')
    expect(html).not.toContain('Click to copy: Active')
    expect(html).toContain('Remaining days')
    expect(html).toContain('19')
    expect(html).toContain('Monthly model quota')
    expect(html).toContain(formatQuota(activeSubscription.totalQuota))
    expect(html).toContain('Remaining')
    expect(html).toContain(formatQuota(activeSubscription.remainingQuota))
    expect(html).toContain('aria-label="Progress"')
    expect(html).toContain('aria-valuenow="38"')
    expect(html).toContain('Available balance')
    expect(html).toContain(formatQuota(profile.quota))
    expect(html).toContain('Balance can be used to purchase plans directly.')
    expect(html).toContain(
      'After plan quota is exhausted, balance is used automatically for API usage billing.'
    )
    expect(html).toContain('Total Usage')
    expect(html).toContain('API Requests')
  })

  test('renders the full API request count without compact locale units', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ProfileHeader
          profile={{ ...profile, request_count: 130_000_000 }}
          loading={false}
          subscription={activeSubscription}
        />
      </I18nextProvider>
    )

    expect(html).toContain('130,000,000')
    expect(html).not.toContain('1.3亿')
  })

  test('renders identity and balance in the top row before the full-width plan band', () => {
    const html = renderHeader(activeSubscription)

    const topRowStart = html.indexOf('data-slot="profile-header-top-row"')
    const identityStart = html.indexOf(
      'data-slot="profile-identity"',
      topRowStart
    )
    const balanceStart = html.indexOf(
      'data-slot="profile-balance-column"',
      topRowStart
    )
    const planStart = html.indexOf(
      'data-slot="profile-plan-summary"',
      topRowStart
    )
    const statsStart = html.indexOf('data-slot="profile-stats"', topRowStart)

    expect(topRowStart).toBeGreaterThan(-1)
    expect(html).not.toContain('max-w-[860px]')
    expect(identityStart).toBeGreaterThan(topRowStart)
    expect(balanceStart).toBeGreaterThan(identityStart)
    expect(planStart).toBeGreaterThan(balanceStart)
    expect(statsStart).toBeGreaterThan(planStart)
  })

  test('links redemption from the balance area and hides the internal group', () => {
    const internalGroup = 'internal-admin-routing-group'
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <ProfileHeader
          profile={{ ...profile, group: internalGroup }}
          loading={false}
          subscription={activeSubscription}
        />
      </I18nextProvider>
    )
    const balanceColumn = sliceBetweenDataSlots(
      html,
      'profile-balance-column',
      'profile-plan-summary'
    )

    expect(balanceColumn).toContain('href="/redeem"')
    expect(balanceColumn).toContain('Redeem Code')
    expect(html).not.toContain(internalGroup)
  })

  test('keeps balance and redeem actions visually aligned with clear spacing', () => {
    const html = renderHeader(activeSubscription)
    const actionsClass = classForDataSlot(html, 'profile-balance-actions')
    const balanceClass = classForDataSlot(html, 'profile-balance')
    const actions = sliceBetweenDataSlots(
      html,
      'profile-balance-actions',
      'profile-balance-guidance'
    )

    expect(actionsClass).toContain('flex')
    expect(actionsClass).toContain('flex-wrap')
    expect(actionsClass).toContain('gap-3')
    expect(actionsClass).toContain('lg:justify-end')
    expect(balanceClass).toContain('h-9')
    expect(balanceClass).toContain('rounded-lg')
    expect(balanceClass).toContain('bg-background')
    expect(balanceClass).toContain('shadow-xs')
    expect(actions).toContain('h-9 rounded-lg px-3 shadow-xs')
  })

  test('keeps the loading header aligned to the desktop balance column', () => {
    const html = renderLoadingHeader()

    expect(html).not.toContain('max-w-[860px]')
    expect(classForLoadingContentWrapper(html)).toBe('p-3 sm:p-5')
    expect(classForDataSlot(html, 'profile-header-top-row')).toContain(
      'lg:grid-cols-[minmax(0,1fr)_390px]'
    )
    expect(classForDataSlot(html, 'profile-balance-column')).toContain(
      'lg:w-[390px]'
    )
  })

  test('renders plan summary as an unpadded divider section', () => {
    const html = renderHeader(activeSubscription)
    const planClass = classForDataSlot(html, 'profile-plan-summary')

    expect(planClass).toContain('mt-5')
    expect(planClass).toContain('border-t')
    expect(planClass).toContain('pt-4')
    expect(planClass).toContain('sm:pt-5')
    expect(planClass).not.toContain('bg-primary/5')
    expect(planClass).not.toContain('rounded-lg')
    expect(planClass).not.toContain('border-primary/20')
    expect(html).toContain('Current Plan')
    expect(html).toContain('Pro')
    expect(html).toContain('Active')
    expect(html).toContain('Remaining days')
    expect(html).toContain('19')
    expect(html).not.toContain('Start date')
    expect(html).not.toContain('End date')
  })

  test('renders plan quota and remaining amount below the usage meters', () => {
    const html = renderHeader(activeSubscription)
    const quotaRowClass = classForDataSlot(html, 'profile-plan-quota-row')
    const quotaRowStart = html.indexOf('data-slot="profile-plan-quota-row"')
    const totalStart = html.indexOf('Monthly model quota', quotaRowStart)
    const remainingStart = html.indexOf('Remaining', quotaRowStart)
    const progressStart = html.indexOf('aria-label="Progress"', quotaRowStart)

    expect(quotaRowClass).toContain('mt-4')
    expect(quotaRowClass).toContain('grid-cols-2')
    expect(quotaRowClass).toContain('border-t')
    expect(quotaRowClass).toContain('pt-4')
    expect(quotaRowClass).not.toContain('lg:grid-cols-1')
    expect(totalStart).toBeGreaterThan(quotaRowStart)
    expect(remainingStart).toBeGreaterThan(totalStart)
    expect(progressStart).toBeGreaterThan(remainingStart)
    expect(
      sliceBetweenDataSlots(html, 'profile-plan-quota-row', 'profile-stats')
    ).toMatch(/class="mt-3"[\s\S]*h-1\.5/)
  })

  test('renders the 5-hour, 7-day, and media windows before monthly quota', () => {
    const html = renderHeader(activeSubscription)
    const shortRowStart = html.indexOf(
      'data-slot="profile-plan-short-window-row"'
    )
    const window5hStart = html.indexOf(
      'data-slot="profile-plan-window-5h"',
      shortRowStart
    )
    const window7dStart = html.indexOf(
      'data-slot="profile-plan-window-7d"',
      shortRowStart
    )
    const mediaStart = html.indexOf(
      'data-slot="profile-plan-window-media"',
      shortRowStart
    )
    const quotaRowStart = html.indexOf(
      'data-slot="profile-plan-quota-row"',
      shortRowStart
    )

    expect(shortRowStart).toBeGreaterThan(-1)
    expect(window5hStart).toBeGreaterThan(shortRowStart)
    expect(window7dStart).toBeGreaterThan(window5hStart)
    expect(mediaStart).toBeGreaterThan(window7dStart)
    expect(quotaRowStart).toBeGreaterThan(mediaStart)
  })

  test('renders finite 5-hour, 7-day, and media quota meters', () => {
    const html = renderHeader(activeSubscription)
    const shortRowClass = classForDataSlot(
      html,
      'profile-plan-short-window-row'
    )
    const shortRowTokens = tokensForDataSlot(
      html,
      'profile-plan-short-window-row'
    )

    expect(shortRowClass).toContain('grid')
    expect(shortRowClass).toContain('mt-4')
    expect(shortRowClass).toContain('gap-4')
    expect(shortRowClass).toContain('lg:grid-cols-3')
    expect(shortRowClass).not.toContain('sm:grid-cols-2')
    expect(shortRowTokens).not.toContain('grid-cols-2')
    expect(shortRowClass).not.toContain('overflow')
    expect(shortRowClass).not.toContain('flex-row')
    expect(shortRowClass).not.toContain('whitespace-nowrap')
    expect(shortRowClass).not.toContain('truncate')
    expect(shortRowClass).not.toContain('line-clamp')
    const window5hHtml = sliceBetweenDataSlots(
      html,
      'profile-plan-window-5h',
      'profile-plan-window-7d'
    )
    const window7dHtml = sliceBetweenDataSlots(
      html,
      'profile-plan-window-7d',
      'profile-plan-window-media'
    )
    const mediaHtml = sliceBetweenDataSlots(
      html,
      'profile-plan-window-media',
      'profile-plan-quota-row'
    )
    const window5hClass = classForDataSlot(html, 'profile-plan-window-5h')
    const window7dClass = classForDataSlot(html, 'profile-plan-window-7d')
    const mediaClass = classForDataSlot(html, 'profile-plan-window-media')

    for (const meterClass of [window5hClass, window7dClass, mediaClass]) {
      expect(meterClass).toContain('min-w-0')
      expect(meterClass).toContain('space-y-1.5')
      expect(meterClass).not.toContain('border')
      expect(meterClass).not.toContain('bg-')
      expect(meterClass).not.toContain('rounded')
    }
    expect(window5hHtml).toContain('5-hour limit')
    expect(window5hHtml).toContain(
      `${formatQuota(activeSubscription.window5h.usedQuota)} / ${formatQuota(activeSubscription.window5h.totalQuota)} used`
    )
    expect(window5hHtml).toContain(
      `${formatQuota(activeSubscription.window5h.remainingQuota)} remaining`
    )
    expect(window5hHtml).toContain('aria-label="5-hour limit"')
    expect(window5hHtml).toContain('aria-valuenow="25"')
    expect(window5hHtml).toContain('h-1.5')
    expect(window7dHtml).toContain('7-day limit')
    expect(window7dHtml).toContain(
      `${formatQuota(activeSubscription.window7d.usedQuota)} / ${formatQuota(activeSubscription.window7d.totalQuota)} used`
    )
    expect(window7dHtml).toContain(
      `${formatQuota(activeSubscription.window7d.remainingQuota)} remaining`
    )
    expect(window7dHtml).toContain('aria-label="7-day limit"')
    expect(window7dHtml).toContain('aria-valuenow="40"')
    expect(window7dHtml).toContain('h-1.5')
    expect(mediaHtml).toContain('Media generation credits')
    expect(mediaHtml).toContain('35 / 120 used')
    expect(mediaHtml).toContain(
      `85 remaining, resets ${formatTimestampToDate(
        activeSubscription.mediaCredits.resetAt
      )}`
    )
    expect(mediaHtml).toContain('aria-label="Media generation credits"')
    expect(mediaHtml).toContain(
      `aria-valuenow="${activeSubscription.mediaCredits.usagePercent}"`
    )
    expect(mediaHtml).toContain('h-1.5')
    expect(mediaHtml).not.toContain('$')
  })

  test('keeps loading usage skeleton slots in the divider plan section', () => {
    const html = renderLoadingHeader()
    const planClass = classForDataSlot(html, 'profile-plan-summary')
    const shortRowStart = html.indexOf(
      'data-slot="profile-plan-short-window-row"'
    )
    const window5hStart = html.indexOf(
      'data-slot="profile-plan-window-5h"',
      shortRowStart
    )
    const window7dStart = html.indexOf(
      'data-slot="profile-plan-window-7d"',
      shortRowStart
    )
    const mediaStart = html.indexOf(
      'data-slot="profile-plan-window-media"',
      shortRowStart
    )
    const quotaRowStart = html.indexOf(
      'data-slot="profile-plan-quota-row"',
      shortRowStart
    )

    expect(planClass).toContain('mt-5')
    expect(planClass).toContain('border-t')
    expect(planClass).toContain('pt-4')
    expect(planClass).toContain('sm:pt-5')
    expect(planClass).not.toContain('bg-primary/5')
    expect(planClass).not.toContain('rounded-lg')
    expect(shortRowStart).toBeGreaterThan(-1)
    expect(window5hStart).toBeGreaterThan(shortRowStart)
    expect(window7dStart).toBeGreaterThan(window5hStart)
    expect(mediaStart).toBeGreaterThan(window7dStart)
    expect(quotaRowStart).toBeGreaterThan(mediaStart)
    expect(classForDataSlot(html, 'profile-plan-short-window-row')).toContain(
      'lg:grid-cols-3'
    )
    expect(
      classForDataSlot(html, 'profile-plan-short-window-row')
    ).not.toContain('sm:grid-cols-2')
  })

  test('does not render a subscription placeholder when no summary exists', () => {
    const html = renderHeader(null)

    expect(html).not.toContain('profile-plan-summary')
    expect(html).not.toContain('profile-plan-quota-row')
    expect(html).not.toContain('profile-plan-short-window-row')
    expect(html).not.toContain('profile-plan-window-5h')
    expect(html).not.toContain('profile-plan-window-7d')
    expect(html).not.toContain('profile-plan-window-media')
    expect(html).not.toContain('Pro')
    expect(html).not.toContain('No plan')
    expect(html).toContain('Ada Lovelace')
    expect(html).toContain('Available balance')
    expect(html).toContain(formatQuota(profile.quota))
    expect(html).toContain('Total Usage')
    expect(html).toContain('API Requests')
    expect(html).toContain('data-slot="profile-stats"')
  })

  test('renders two complete balance guidance paragraphs without clipping utilities', () => {
    const html = renderHeader(null)
    const guidance = extractBalanceGuidance(html)
    const topRowClass = classForDataSlot(html, 'profile-header-top-row')
    const balanceColumnClass = classForDataSlot(html, 'profile-balance-column')
    const guidanceClass = classForDataSlot(html, 'profile-balance-guidance')

    expect(guidance).not.toBe('')
    expect((guidance.match(/<p/g) ?? []).length).toBe(2)
    expect(guidance).toMatch(
      /<p[^>]*>Balance can be used to purchase plans directly\.<\/p>[\s\S]*<p[^>]*>After plan quota is exhausted, balance is used automatically for API usage billing\.<\/p>/
    )
    expect(topRowClass).toContain('lg:grid-cols-[minmax(0,1fr)_390px]')
    expect(balanceColumnClass).toContain('lg:w-[390px]')
    expect(guidanceClass).toContain('text-xs')
    expect(guidanceClass).not.toContain('sm:text-sm')
    expect(guidance).not.toContain('whitespace-nowrap')
    expect(guidance).not.toContain('truncate')
    expect(guidance).not.toContain('line-clamp')
  })

  test('renders unlimited subscription quota without a finite usage percentage', () => {
    const subscription: ProfileSubscriptionSummary = {
      planTitle: 'Scale',
      totalQuota: 0,
      usedQuota: 0,
      remainingQuota: 0,
      unlimited: true,
      notIncluded: false,
      remainingDays: null,
      resetAt: 0,
      usagePercent: 0,
      window5h: {
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        unlimited: true,
        notIncluded: false,
        resetAt: 0,
        usagePercent: 0,
      },
      window7d: {
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        unlimited: true,
        notIncluded: false,
        resetAt: 0,
        usagePercent: 0,
      },
      mediaCredits: {
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        unlimited: true,
        notIncluded: false,
        resetAt: 0,
        usagePercent: 0,
      },
    }

    const html = renderHeader(subscription)

    expect(html).toContain('Unlimited')
    expect(html).toContain('No usage limit')
    expect(html).toContain('aria-label="5-hour limit"')
    expect(html).toContain('aria-label="7-day limit"')
    expect(html).toContain('aria-label="Media generation credits"')
    expect(html).toContain('aria-valuenow="0"')
    expect(html).toContain('aria-valuetext="Unlimited"')
    expect(html).not.toContain('aria-valuetext="0%"')
    expect(html).not.toContain('0 / 0 used')
  })

  test('renders media credits as not included instead of unlimited', () => {
    const subscription: ProfileSubscriptionSummary = {
      ...activeSubscription,
      mediaCredits: {
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        unlimited: false,
        notIncluded: true,
        resetAt: 0,
        usagePercent: 0,
      },
    }

    const html = renderHeader(subscription)
    const mediaHtml = sliceBetweenDataSlots(
      html,
      'profile-plan-window-media',
      'profile-plan-quota-row'
    )

    expect(mediaHtml).toContain('Media generation credits')
    expect(mediaHtml).toContain('Not included')
    expect(mediaHtml).toContain('0 remaining')
    expect(mediaHtml).toContain('aria-valuenow="0"')
    expect(mediaHtml).toContain('aria-valuetext="Not included"')
    expect(mediaHtml).not.toContain('Unlimited')
    expect(mediaHtml).not.toContain('No usage limit')
  })

  test('renders media not-included remaining text through the existing localized remaining key', async () => {
    const subscription: ProfileSubscriptionSummary = {
      ...activeSubscription,
      mediaCredits: {
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        unlimited: false,
        notIncluded: true,
        resetAt: 0,
        usagePercent: 0,
      },
    }

    const html = await renderHeaderWithTranslations(subscription, 'zh', {
      'Media generation credits': '媒体生成额度',
      'Not included': '不包含',
      '{{remaining}} remaining': '剩余 {{remaining}}',
    })
    const mediaHtml = sliceBetweenDataSlots(
      html,
      'profile-plan-window-media',
      'profile-plan-quota-row'
    )

    expect(mediaHtml).toContain('不包含')
    expect(mediaHtml).toContain('剩余 0')
    expect(mediaHtml).toContain('aria-valuetext="不包含"')
    expect(mediaHtml).not.toContain('0 remaining')
  })
})
