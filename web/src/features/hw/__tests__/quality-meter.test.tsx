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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { QualityMeter } from '../components/quality-meter'
import type {
  HwQualityLatest,
  HwQualityTraffic,
  HwQualityTrafficModel,
} from '../types'

vi.mock('@/components/layout', () => ({
  PublicLayout: (props: { children?: React.ReactNode }) => (
    <main data-testid='public-layout'>{props.children}</main>
  ),
}))
vi.mock('@/components/layout/components/footer', () => ({
  Footer: () => <footer data-testid='site-footer' />,
}))

const trI18n = createInstance()
await trI18n.init({
  lng: 'tr',
  resources: { tr: { translation: {} } },
  initAsync: false,
})

const clients: QueryClient[] = []

const sampleNote =
  'Bu ölçümler sabit ve sınırlı bir görev setiyle yapılan bir örneklemdir, garanti değildir.'

const measured: HwQualityLatest = {
  measured_at: 1792400000,
  file: 'run-1.json',
  taskset_version: 'v1',
  task_count: 12,
  judge_model: 'judge',
  models: [
    {
      model: 'claude-sonnet-5',
      reference: 'ref',
      avg_score: 7.25,
      avg_latency_ms: 1850,
      tasks: [],
    },
    {
      model: 'gpt-5.4-mini',
      reference: 'ref',
      avg_score: 6,
      avg_latency_ms: 900,
      tasks: [],
    },
  ],
  note: sampleNote,
  note_en:
    'These measurements are a sample over a small fixed task set, not a guarantee.',
}

const noTraffic: HwQualityTraffic = {
  computed_at: 1792400000,
  refresh_seconds: 600,
  min_requests: 20,
  windows: [
    { days: 7, models: [] },
    { days: 30, models: [] },
  ],
}

const empty: HwQualityLatest = {
  measured_at: 0,
  file: '',
  taskset_version: '',
  task_count: 0,
  judge_model: '',
  models: [],
  note: sampleNote,
  note_en:
    'These measurements are a sample over a small fixed task set, not a guarantee.',
  traffic: noTraffic,
}

const sonnetWeek: HwQualityTrafficModel = {
  model: 'claude-sonnet-5-5',
  requests: 1234,
  failed: 3,
  enough_data: true,
  success_percent: 99.76,
  median_seconds: 2,
  p95_seconds: 9,
  output_tokens_per_second: 32.6,
}

const observed: HwQualityLatest = {
  ...empty,
  traffic: {
    ...noTraffic,
    windows: [
      {
        days: 7,
        models: [
          sonnetWeek,
          {
            model: 'claude-haiku-4-5',
            requests: 5,
            failed: 0,
            enough_data: false,
            success_percent: null,
            median_seconds: null,
            p95_seconds: null,
            output_tokens_per_second: null,
          },
        ],
      },
      {
        days: 30,
        models: [
          {
            ...sonnetWeek,
            requests: 5678,
            median_seconds: 0,
            p95_seconds: 3,
          },
        ],
      },
    ],
  },
}

function mockQuality(data: HwQualityLatest) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, message: '', data },
  })
}

function renderPage(retryDelayMs = 60_000) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <I18nextProvider i18n={trI18n}>
      <QueryClientProvider client={client}>
        <QualityMeter retryDelayMs={retryDelayMs} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, message: '', data: measured },
  })
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

describe('quality meter page', () => {
  it('reads the latest measurement from the public endpoint', async () => {
    renderPage()

    expect(await screen.findByText('claude-sonnet-5')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/api/hw/quality/latest')
  })

  it('shows score, latency and measurement date per model', async () => {
    renderPage()

    expect(await screen.findByText('claude-sonnet-5')).toBeInTheDocument()
    expect(screen.getByText('7,25')).toBeInTheDocument()
    expect(screen.getByText('1.850 ms')).toBeInTheDocument()
    expect(screen.getByText('gpt-5.4-mini')).toBeInTheDocument()
    expect(screen.getAllByText('Ölçüm tarihi').length).toBeGreaterThan(0)
  })

  it('shows the API sample note that the results are a sample', async () => {
    renderPage()

    expect(await screen.findByText(sampleNote)).toBeInTheDocument()
  })

  it('shows an empty state without traffic or a run and invents no values', async () => {
    mockQuality(empty)
    renderPage()

    expect(
      await screen.findByText('Henüz ölçülecek istek yok')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Son 30 günde modellerimize gelen müşteri isteği yok. Rakam uydurmuyoruz: ilk istekler geldiğinde sonuçlar burada kendiliğinden görünür.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(sampleNote)).not.toBeInTheDocument()
  })

  it('keeps the empty state for an older server without traffic data', async () => {
    mockQuality({ ...empty, traffic: undefined })
    renderPage()

    expect(
      await screen.findByText('Henüz ölçülecek istek yok')
    ).toBeInTheDocument()
  })

  it('shows the observed figures of the last 7 days from the traffic', async () => {
    mockQuality(observed)
    renderPage()

    expect(await screen.findByText('claude-sonnet-5-5')).toBeInTheDocument()
    expect(
      screen.getByText('Gerçek müşteri isteklerinden ölçüm')
    ).toBeInTheDocument()
    expect(screen.getByText('1.234')).toBeInTheDocument()
    expect(screen.getByText('%99,76')).toBeInTheDocument()
    expect(screen.getByText('2 sn')).toBeInTheDocument()
    expect(screen.getByText('9 sn')).toBeInTheDocument()
    expect(screen.getByText('32,6 token/sn')).toBeInTheDocument()
    expect(screen.queryByText('İlk ölçüm yakında')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Henüz ölçülecek istek yok')
    ).not.toBeInTheDocument()
    // Without a judged run there is no judged table and no sample note.
    expect(screen.queryByText('Görev seti ölçümü')).not.toBeInTheDocument()
    expect(screen.queryByText(sampleNote)).not.toBeInTheDocument()
    expect(
      screen.getByText(/en geç 10 dakikada bir yenilenir/)
    ).toBeInTheDocument()
  })

  it('shows one card per model with all figures on a 390px phone', async () => {
    const width = window.innerWidth
    window.innerWidth = 390
    try {
      mockQuality(observed)
      renderPage()

      const cards = await screen.findAllByTestId('hw-quality-traffic-card')
      expect(cards).toHaveLength(2)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      const sonnet = within(cards[0])
      expect(sonnet.getByText('claude-sonnet-5-5')).toBeInTheDocument()
      for (const value of [
        '1.234',
        '%99,76',
        '2 sn',
        '9 sn',
        '32,6 token/sn',
      ]) {
        expect(sonnet.getByText(value)).toBeInTheDocument()
      }
      expect(sonnet.getByText('p95 yanıt süresi')).toBeInTheDocument()
      // A model below the minimum shows its count and the reason, no figures.
      const haiku = within(cards[1])
      expect(haiku.getByText('5')).toBeInTheDocument()
      expect(
        haiku.getByText('Yeterli veri yok (en az 20 istek)')
      ).toBeInTheDocument()
      expect(haiku.queryByText('p95 yanıt süresi')).not.toBeInTheDocument()
    } finally {
      window.innerWidth = width
    }
  })

  it('shows only the count for a model below the minimum', async () => {
    mockQuality(observed)
    renderPage()

    expect(await screen.findByText('claude-haiku-4-5')).toBeInTheDocument()
    expect(
      screen.getByText('Yeterli veri yok (en az 20 istek)')
    ).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('switches to the 30-day window and shows a sub-second median', async () => {
    mockQuality(observed)
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: 'Son 30 gün' }))

    expect(await screen.findByText('5.678')).toBeInTheDocument()
    expect(screen.getByText('<1 sn')).toBeInTheDocument()
    expect(screen.getByText('3 sn')).toBeInTheDocument()
  })

  it('says so when one window has no requests while the other has', async () => {
    const traffic = observed.traffic as HwQualityTraffic
    mockQuality({
      ...observed,
      traffic: {
        ...traffic,
        windows: [{ days: 7, models: [] }, traffic.windows[1]],
      },
    })
    renderPage()

    expect(
      await screen.findByText('Bu dönemde müşteri isteği yok.')
    ).toBeInTheDocument()
  })

  it('shows the observed figures next to a judged run', async () => {
    mockQuality({ ...measured, traffic: observed.traffic })
    renderPage()

    expect(await screen.findByText('claude-sonnet-5-5')).toBeInTheDocument()
    expect(screen.getByText('Görev seti ölçümü')).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-5')).toBeInTheDocument()
    expect(screen.getByText(sampleNote)).toBeInTheDocument()
  })

  it('reports a failed read in Turkish without a table', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(
      Object.assign(new Error('Server error'), { response: { status: 500 } })
    )
    renderPage()

    expect(
      await screen.findByText('Ölçüm verisi okunamadı. Lütfen tekrar deneyin.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('says in Turkish that too many requests were sent on a 429', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(
      Object.assign(new Error('Too many requests'), {
        response: { status: 429 },
      })
    )
    renderPage()

    expect(
      await screen.findByText(
        'Çok fazla istek gönderildi. Lütfen birkaç saniye sonra tekrar deneyin.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tekrar dene' })
    ).toBeInTheDocument()
  })

  it('retries once by itself after a failure and then shows the measurement', async () => {
    let calls = 0
    vi.spyOn(api, 'get').mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw Object.assign(new Error('Server error'), {
          response: { status: 500 },
        })
      }
      return { data: { success: true, message: '', data: measured } }
    })
    renderPage(20)

    expect(
      await screen.findByText('Ölçüm verisi okunamadı. Lütfen tekrar deneyin.')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('claude-sonnet-5', undefined, { timeout: 2000 })
    ).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('asks the API again when the visitor presses Tekrar dene', async () => {
    let calls = 0
    vi.spyOn(api, 'get').mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw Object.assign(new Error('Server error'), {
          response: { status: 500 },
        })
      }
      return { data: { success: true, message: '', data: measured } }
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))

    expect(await screen.findByText('claude-sonnet-5')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('never claims the models equal the original and names no supplier', async () => {
    mockQuality({ ...measured, traffic: observed.traffic })
    renderPage()
    await screen.findByText('claude-sonnet-5-5')

    const text = document.body.textContent?.toLowerCase() ?? ''
    expect(text).not.toContain('lumia')
    expect(text).not.toContain('openrouter')
    expect(text).not.toContain('orijinal')
    expect(text).not.toContain('gelijk aan')
  })
})
