import { defineComponent, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ActivityShowcase from '@/components/home/showcase/ActivityShowcase.vue'
import HomeShowcase from '@/components/home/showcase/HomeShowcase.vue'
import MarketRouteShowcase from '@/components/home/showcase/MarketRouteShowcase.vue'
import TrustShowcase from '@/components/home/showcase/TrustShowcase.vue'
import { HOME_SHOWCASE_MOCK } from '@/constants/home/showcase'
import i18n from '@/i18n'
import type {
  HomeQualityReport,
  HomeShowcaseSource,
  HomeSupportLink,
} from '@/types/homeShowcase'

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: {
    to: { type: [Object, String], required: true },
  },
  setup(props, { slots }) {
    return () =>
      h('a', { 'data-route': JSON.stringify(props.to) }, slots.default?.())
  },
})

function mountOptions() {
  return {
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
})

describe('ActivityShowcase', () => {
  it('switches activities with pointer and keyboard controls', async () => {
    const wrapper = mount(ActivityShowcase, {
      props: { activities: HOME_SHOWCASE_MOCK.activities },
      ...mountOptions(),
    })

    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[1].trigger('click')
    expect(wrapper.find('[role="tabpanel"] h3').text()).toContain('入股计划')

    await tabs[1].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.find('[role="tabpanel"] h3').text()).toContain('Token 农场')
    wrapper.unmount()
  })

  it('renders explicit image-failure and empty states', async () => {
    const wrapper = mount(ActivityShowcase, {
      props: { activities: HOME_SHOWCASE_MOCK.activities },
      ...mountOptions(),
    })
    await wrapper.find('.activity-stage__media img').trigger('error')
    await nextTick()
    expect(wrapper.find('.activity-stage__media-fallback').exists()).toBe(true)
    wrapper.unmount()

    const empty = mount(ActivityShowcase, {
      props: { activities: [] },
      ...mountOptions(),
    })
    expect(empty.find('.activity-empty').exists()).toBe(true)
    empty.unmount()
  })
})

describe('MarketRouteShowcase', () => {
  it('emits publish and keyboard reorder commands without mutating real data', async () => {
    const snapshot = structuredClone(HOME_SHOWCASE_MOCK)
    const wrapper = mount(MarketRouteShowcase, {
      props: {
        side: 'sell',
        listings: snapshot.market.listings,
        journeyStage: 'draft',
        channels: snapshot.routing.channels,
        loadBalance: false,
        simulation: {
          eventId: 0,
          phase: 'idle',
          primaryChannelId: null,
          fallbackChannelId: null,
          activeChannelId: null,
          latencyMs: null,
        },
      },
      ...mountOptions(),
    })

    await wrapper.find('.market-listing__action').trigger('click')
    expect(wrapper.emitted('publish')?.[0]).toEqual(['relay-cascade'])

    await wrapper.find('.route-channel').trigger('keydown', {
      key: 'ArrowDown',
    })
    expect(wrapper.emitted('move')?.[0]).toEqual(['route-atlas', 1])

    await wrapper.find('.market-route-backdrop img').trigger('error')
    await nextTick()
    expect(wrapper.find('.market-route-backdrop img').exists()).toBe(false)
    wrapper.unmount()
  })
})

function trustProps(
  overrides: {
    reports?: HomeQualityReport[]
    supportLinks?: HomeSupportLink[]
    authenticated?: boolean
  } = {}
) {
  return {
    runtime: { days: 137, hours: 4, minutes: 5, seconds: 6, totalSeconds: 1 },
    todayRequests: 321_322,
    uptimeLabel: '99.99%',
    channels: structuredClone(HOME_SHOWCASE_MOCK.routing.channels),
    reports:
      overrides.reports ?? structuredClone(HOME_SHOWCASE_MOCK.qualityReports),
    supportLinks:
      overrides.supportLinks ??
      structuredClone(HOME_SHOWCASE_MOCK.supportLinks),
    authenticated: overrides.authenticated ?? false,
  }
}

describe('TrustShowcase', () => {
  it('shows only configured, safe support links and keeps report links safe', () => {
    const links: HomeSupportLink[] = [
      HOME_SHOWCASE_MOCK.supportLinks[0],
      {
        id: 'telegram',
        labelKey: 'showcase.support.links.telegram',
        kind: 'external',
        routeName: null,
        href: 'https://t.me/ren2hub',
      },
      {
        id: 'qq',
        labelKey: 'showcase.support.links.qq',
        kind: 'external',
        routeName: null,
        href: 'javascript:alert(1)',
      },
    ]
    const wrapper = mount(TrustShowcase, {
      props: trustProps({ supportLinks: links }),
      ...mountOptions(),
    })

    expect(wrapper.findAll('.support-action')).toHaveLength(2)
    expect(wrapper.find('.support-action--secondary').attributes('href')).toBe(
      'https://t.me/ren2hub'
    )
    expect(wrapper.find('.quality-report__result a').attributes('href')).toBe(
      'https://modelloc.com/'
    )
    wrapper.unmount()
  })

  it('renders empty reports, evidence fallback, and auth-aware primary CTA', async () => {
    const empty = mount(TrustShowcase, {
      props: trustProps({ reports: [] }),
      ...mountOptions(),
    })
    expect(empty.find('.quality-report-empty').exists()).toBe(true)
    expect(
      JSON.parse(
        empty.find('.final-action--primary').attributes('data-route') ?? '{}'
      )
    ).toEqual({ name: 'sign-up' })
    empty.unmount()

    const report = {
      ...HOME_SHOWCASE_MOCK.qualityReports[1],
      evidenceAsset: '/broken-evidence.webp',
    }
    const authenticated = mount(TrustShowcase, {
      props: trustProps({ reports: [report], authenticated: true }),
      ...mountOptions(),
    })
    await authenticated.find('.quality-report__evidence img').trigger('error')
    await nextTick()
    expect(authenticated.find('.quality-evidence-placeholder').exists()).toBe(
      true
    )
    await authenticated
      .find('.quality-workbench__backdrop img')
      .trigger('error')
    await nextTick()
    expect(
      authenticated.find('.quality-workbench__backdrop img').exists()
    ).toBe(false)
    expect(
      JSON.parse(
        authenticated.find('.final-action--primary').attributes('data-route') ??
          '{}'
      )
    ).toEqual({ name: 'dashboard' })
    authenticated.unmount()
  })
})

describe('HomeShowcase', () => {
  it('surfaces source failure and retries the same adapter', async () => {
    const load = vi
      .fn<HomeShowcaseSource['load']>()
      .mockRejectedValue(new Error('source unavailable'))
    const wrapper = mount(HomeShowcase, {
      props: { source: { load } },
      global: {
        plugins: [i18n, createPinia()],
        stubs: { RouterLink: RouterLinkStub },
      },
    })

    await flushPromises()
    expect(wrapper.find('.home-showcase-state--error').exists()).toBe(true)
    expect(load).toHaveBeenCalledTimes(1)

    await wrapper.find('.home-showcase-state button').trigger('click')
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
