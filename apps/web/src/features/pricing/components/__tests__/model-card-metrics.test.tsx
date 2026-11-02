import { afterAll, describe, expect, test } from 'bun:test'

import type { ModelPerfBadgeData } from '../model-perf-badge'
import type { Root } from 'react-dom/client'

// The card chart is plain SVG, so it renders under happy-dom without the
// rspack CSS/app entry pipeline the dev server needs. Dynamic imports follow
// the repo's existing render-test convention: bun evaluates all test files in
// one process, so React/i18next singletons must load after the happy-dom
// environment preload (see bunfig.toml).
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { initReactI18next, I18nextProvider } = await import('react-i18next')
const { ModelCardMetrics } = await import('../model-card-metrics')

// An empty resource bundle makes i18next echo the key, so assertions read the
// English source string the component passes to `t()`.
const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'en' })

const mounted: { root: Root | null } = { root: null }

afterAll(() => {
  act(() => mounted.root?.unmount())
})

function renderCard(perf: ModelPerfBadgeData) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ModelCardMetrics perf={perf} />
      </I18nextProvider>
    )
  })
  mounted.root = root
  return host
}

// A seconds-suffixed axis tick ("2.50s") versus a milliseconds one ("500ms"):
// "ms" also ends in "s", so the check needs the regex, not endsWith.
const SECONDS_LABEL = /(?<!m)s$/

// A series of hourly latency points; latency_ms is the bucket mean the backend
// reports in milliseconds.
function series(latencyMs: number) {
  return Array.from({ length: 24 }, (_, index) => ({
    ts: 1_700_000_000 + index * 3_600,
    latency_ms: latencyMs,
    success_rate: 99,
  }))
}

function badge(recent: ReturnType<typeof series>, avgLatencyMs: number) {
  return {
    avg_latency_ms: avgLatencyMs,
    success_rate: 99,
    avg_tps: 42,
    recent_series: recent,
  } satisfies ModelPerfBadgeData
}

function latencyTexts(host: HTMLElement) {
  return Array.from(host.querySelectorAll('text'))
    .map((node) => node.textContent ?? '')
    .filter((text) => text.length > 0)
}

describe('model-square card latency unit', () => {
  // The whole scale (axis ticks, headline, bars) must share one unit: a chart
  // that mixes "2.50" with "1200ms" is unreadable and the ticks no longer
  // measure the bars.
  test('a peak above one second renders the whole chart in seconds', () => {
    const host = renderCard(badge(series(2_500), 2_500))
    const labels = latencyTexts(host)

    expect(labels).toContain('2.50s')
    expect(labels.some((label) => label.endsWith('ms'))).toBe(false)
  })

  // Real hourly data rarely has every bucket equal to the peak: a single slow
  // hour must flip the whole chart's unit without the average moving. This is
  // the case the uniform-series tests above cannot cover.
  test('a single slow hour sets the unit for the whole chart', () => {
    const slowHour = { ts: 1_700_000_000, latency_ms: 2_500, success_rate: 99 }
    const host = renderCard(
      badge([...series(200), slowHour], 200)
    )
    const labels = latencyTexts(host)

    expect(labels).toContain('2.50s')
    expect(labels.some((label) => label.endsWith('ms'))).toBe(false)
  })

  // A faster model keeps milliseconds so their numbers stay whole rather than
  // collapsing to "0.00"-style fractions of a second. The top tick carries the
  // unit and shows the rounded scale (niceCeil(820) is 1000), never the raw
  // measured value.
  test('a peak below one second keeps milliseconds', () => {
    const host = renderCard(badge(series(820), 820))
    const labels = latencyTexts(host)

    expect(labels).toContain('1,000ms')
    expect(labels.some((label) => SECONDS_LABEL.test(label))).toBe(false)
  })

  // The boundary itself: a measured peak of exactly one second is the smallest
  // value that flips the scale, so 999ms must stay in milliseconds.
  test('a peak just under one second stays in milliseconds', () => {
    const host = renderCard(badge(series(999), 999))
    const labels = latencyTexts(host)

    expect(labels).toContain('1,000ms')
    expect(labels.some((label) => SECONDS_LABEL.test(label))).toBe(false)
  })

  // The headline value and the axis must agree, so a reader can check the
  // average against the scale. The headline reserves the axis max's width and
  // animates the live number, so it settles on the axis shape rather than a
  // standalone one.
  test('the headline number matches the axis unit', async () => {
    const host = renderCard(badge(series(1_200), 1_200))
    // The count-up runs on a real timer; let it reach the final value.
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 2_000)
    await promise
    await act(async () => {})

    const headline = Array.from(host.querySelectorAll('span'))
      .map((node) => node.textContent ?? '')
      .filter((text) => /^2\.00$/.test(text))

    expect(headline).toContain('2.00')
    expect(latencyTexts(host)).toContain('2.00s')
  })
})
