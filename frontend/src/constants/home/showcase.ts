import activityDayAsset from '@/assets/activity/activity-banner-day-sketch.webp'
import activityNightAsset from '@/assets/activity/activity-banner.webp'
import bigameDayAsset from '@/assets/activity/bigame-banner-day-sketch.webp'
import bigameNightAsset from '@/assets/activity/bigame-banner.webp'
import farmDayAsset from '@/assets/activity/farm-banner-day-sketch.webp'
import farmNightAsset from '@/assets/activity/farm-banner.webp'
import type {
  HomeDiscountTier,
  HomeShowcaseSnapshot,
  HomeShowcaseSource,
} from '@/types/homeShowcase'

export const HOME_STARTED_AT = '2026-03-15T00:00:00+08:00'

export const HOME_DISCOUNT_TIERS: HomeDiscountTier[] = [
  { id: 'starter', thresholdTokens: 0, discountRate: 0.01 },
  { id: 'growth', thresholdTokens: 1_000_000, discountRate: 0.015 },
  { id: 'scale', thresholdTokens: 5_000_000, discountRate: 0.02 },
  { id: 'pro', thresholdTokens: 20_000_000, discountRate: 0.025 },
  { id: 'max', thresholdTokens: 50_000_000, discountRate: 0.03 },
]

export const HOME_SHOWCASE_MOCK: HomeShowcaseSnapshot = {
  market: {
    listings: [
      {
        id: 'relay-cascade',
        titleKey: 'showcase.market.listings.cascade.title',
        detailKey: 'showcase.market.listings.cascade.detail',
        vendor: 'OpenAI',
        model: 'gpt-5',
        unitPriceUsd: 0.82,
        availabilityPercent: 99.94,
        qualityScore: 97,
        status: 'draft',
        owned: true,
        journey: true,
      },
      {
        id: 'relay-claude',
        titleKey: 'showcase.market.listings.claude.title',
        detailKey: 'showcase.market.listings.claude.detail',
        vendor: 'Anthropic',
        model: 'claude-sonnet-4',
        unitPriceUsd: 0.91,
        availabilityPercent: 99.88,
        qualityScore: 96,
        status: 'listed',
        owned: false,
        journey: false,
      },
      {
        id: 'relay-gemini',
        titleKey: 'showcase.market.listings.gemini.title',
        detailKey: 'showcase.market.listings.gemini.detail',
        vendor: 'Google',
        model: 'gemini-2.5-pro',
        unitPriceUsd: 0.67,
        availabilityPercent: 99.73,
        qualityScore: 94,
        status: 'purchased',
        owned: true,
        journey: false,
      },
    ],
  },
  routing: {
    loadBalance: false,
    channels: [
      {
        id: 'route-atlas',
        listingId: null,
        nameKey: 'showcase.routing.channels.atlas',
        vendor: 'OpenAI',
        model: 'gpt-5',
        source: 'platform',
        enabled: true,
        weight: 55,
        priority: 1,
        health: 'healthy',
        latencyMs: 428,
        qualityScore: 98,
      },
      {
        id: 'route-gemini',
        listingId: 'relay-gemini',
        nameKey: 'showcase.routing.channels.gemini',
        vendor: 'Google',
        model: 'gemini-2.5-pro',
        source: 'market',
        enabled: true,
        weight: 30,
        priority: 2,
        health: 'healthy',
        latencyMs: 516,
        qualityScore: 94,
      },
      {
        id: 'route-harbor',
        listingId: null,
        nameKey: 'showcase.routing.channels.harbor',
        vendor: 'Anthropic',
        model: 'claude-sonnet-4',
        source: 'platform',
        enabled: true,
        weight: 15,
        priority: 3,
        health: 'healthy',
        latencyMs: 602,
        qualityScore: 95,
      },
    ],
  },
  discount: {
    tiers: HOME_DISCOUNT_TIERS,
    accountTokens: 6_800_000,
    exampleSpendUsd: 100,
  },
  activities: [
    {
      id: 'checkin',
      titleKey: 'showcase.activities.items.checkin.title',
      detailKey: 'showcase.activities.items.checkin.detail',
      rewardKey: 'showcase.activities.items.checkin.reward',
      current: 5,
      target: 7,
      unitKey: 'showcase.activities.units.days',
      routeName: 'activity',
      dayAsset: activityDayAsset,
      nightAsset: activityNightAsset,
    },
    {
      id: 'affiliate',
      titleKey: 'showcase.activities.items.affiliate.title',
      detailKey: 'showcase.activities.items.affiliate.detail',
      rewardKey: 'showcase.activities.items.affiliate.reward',
      current: 8,
      target: 12,
      unitKey: 'showcase.activities.units.invites',
      routeName: 'invite',
      dayAsset: activityDayAsset,
      nightAsset: activityNightAsset,
    },
    {
      id: 'farm',
      titleKey: 'showcase.activities.items.farm.title',
      detailKey: 'showcase.activities.items.farm.detail',
      rewardKey: 'showcase.activities.items.farm.reward',
      current: 6_800_000,
      target: 10_000_000,
      unitKey: 'showcase.activities.units.tokens',
      routeName: 'farm',
      dayAsset: farmDayAsset,
      nightAsset: farmNightAsset,
    },
    {
      id: 'bigame',
      titleKey: 'showcase.activities.items.bigame.title',
      detailKey: 'showcase.activities.items.bigame.detail',
      rewardKey: 'showcase.activities.items.bigame.reward',
      current: 72,
      target: 100,
      unitKey: 'showcase.activities.units.coins',
      routeName: 'bigame',
      dayAsset: bigameDayAsset,
      nightAsset: bigameNightAsset,
    },
  ],
  running: {
    startedAt: HOME_STARTED_AT,
    requestSeed: 32_132,
    requestsPerSecond: 4.5,
    requestsPerTick: 5,
    tickIntervalMs: 1_000,
  },
  qualityReports: [
    {
      id: 'modelloc-claude',
      channelId: 'route-harbor',
      agency: 'MODELLOC',
      reportNumber: 'ML-2026-0718-C4',
      model: 'Claude',
      verdict: 'verified',
      verdictKey: 'showcase.quality.verdicts.verified',
      score: 98,
      inspectedAt: '2026-07-18T14:30:00+08:00',
      reportUrl: 'https://modelloc.com/',
      evidenceAsset: null,
    },
    {
      id: 'modelloc-gpt',
      channelId: 'route-atlas',
      agency: 'MODELLOC',
      reportNumber: 'ML-2026-0722-G5',
      model: 'GPT',
      verdict: 'verified',
      verdictKey: 'showcase.quality.verdicts.verified',
      score: 97,
      inspectedAt: '2026-07-22T10:15:00+08:00',
      reportUrl: 'https://modelloc.com/',
      evidenceAsset: null,
    },
    {
      id: 'modelloc-gemini',
      channelId: 'route-gemini',
      agency: 'MODELLOC',
      reportNumber: 'ML-2026-0724-GP',
      model: 'Gemini',
      verdict: 'verified',
      verdictKey: 'showcase.quality.verdicts.verified',
      score: 95,
      inspectedAt: '2026-07-24T09:40:00+08:00',
      reportUrl: 'https://modelloc.com/',
      evidenceAsset: null,
    },
  ],
  supportLinks: [
    {
      id: 'ticket',
      labelKey: 'showcase.support.links.ticket',
      kind: 'route',
      routeName: 'tickets',
      href: null,
    },
    {
      id: 'telegram',
      labelKey: 'showcase.support.links.telegram',
      kind: 'external',
      routeName: null,
      href: null,
    },
    {
      id: 'qq',
      labelKey: 'showcase.support.links.qq',
      kind: 'external',
      routeName: null,
      href: null,
    },
  ],
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

export function createLocalHomeShowcaseSource(
  seed: HomeShowcaseSnapshot = HOME_SHOWCASE_MOCK
): HomeShowcaseSource {
  return {
    async load(signal?: AbortSignal) {
      if (signal?.aborted) throw abortError()
      await Promise.resolve()
      if (signal?.aborted) throw abortError()
      return structuredClone(seed)
    },
  }
}

export const LOCAL_HOME_SHOWCASE_SOURCE = createLocalHomeShowcaseSource()
