import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import ChannelTestModal from '@/components/console/channels/ChannelTestModal.vue'
import type { ChannelModelTestResult } from '@/composables/useAdminChannels'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { AdminChannel } from '@/types/console'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

function makeChannel(models: string): AdminChannel {
  return {
    id: 7,
    name: 'PICOAI-国模-A',
    type: 1,
    supplier: 'OpenAI',
    status: 1,
    priority: 0,
    weight: 0,
    capacity_used: 0,
    capacity_total: 20,
    channel_ratio: 1,
    upstream_ratio: 1,
    used_quota: 0,
    balance: 0,
    response_time: 0,
    test_time: 0,
    base_url: '',
    models,
    model_mapping: '',
  }
}

interface MountOptions {
  models?: string
  canWrite?: boolean
  testModel?: (
    channel: AdminChannel,
    model: string
  ) => Promise<ChannelModelTestResult>
  removeModels?: (channel: AdminChannel, models: string[]) => Promise<boolean>
}

function render(options: MountOptions = {}): {
  wrapper: VueWrapper
  testModel: ReturnType<typeof vi.fn>
  removeModels: ReturnType<typeof vi.fn>
} {
  const testModel = vi.fn(
    options.testModel ?? (async () => ({ ok: true, timeMs: 261 }))
  )
  const removeModels = vi.fn(options.removeModels ?? (async () => true))
  const wrapper = mount(ChannelTestModal, {
    attachTo: document.body,
    props: {
      open: true,
      channel: makeChannel(options.models ?? 'glm-5-turbo,qwen3.7-max,glm-5.2'),
      canWrite: options.canWrite ?? true,
      testModel,
      removeModels,
    },
    global: { plugins: [i18n] },
  })
  return { wrapper, testModel, removeModels }
}

function bodyText(): string {
  return document.body.textContent ?? ''
}

function rowFor(model: string): HTMLTableRowElement {
  const rows = Array.from(document.body.querySelectorAll('tbody tr'))
  const row = rows.find((item) => item.textContent?.includes(model))
  expect(row, `row for ${model}`).toBeTruthy()
  return row as HTMLTableRowElement
}

describe('ChannelTestModal', () => {
  it('keeps the modal shell fixed while preserving mobile and model scrolling', () => {
    render()

    const modalBody = document.body.querySelector(
      '[data-modal-body]'
    ) as HTMLElement
    const responsiveLayout = document.body.querySelector(
      '[data-channel-test-layout]'
    ) as HTMLElement
    const modelSection = document.body.querySelectorAll(
      '.channel-test-section'
    )[1] as HTMLElement
    const modelScroll = document.body.querySelector(
      '[data-channel-model-scroll]'
    ) as HTMLElement
    const pagination = document.body.querySelector(
      '[data-channel-model-pagination]'
    ) as HTMLElement

    expect(modalBody.classList).toContain('overflow-hidden')
    expect(modalBody.classList).not.toContain('overflow-y-auto')
    expect(responsiveLayout.classList).toContain('overflow-y-auto')
    expect(responsiveLayout.classList).toContain('sm:overflow-hidden')
    expect(modelSection.classList).toContain('shrink-0')
    expect(modelSection.classList).toContain('sm:flex-1')
    expect(modelScroll.classList).toContain('overflow-x-auto')
    expect(modelScroll.classList).toContain('sm:overflow-auto')
    expect(modelScroll.classList).toContain('sm:flex-1')
    expect(modelScroll.classList).toContain('subtle-scroll')
    expect(modelScroll.contains(pagination)).toBe(false)
  })

  it('lists every channel model with idle status', () => {
    render()

    expect(bodyText()).toContain('glm-5-turbo')
    expect(bodyText()).toContain('qwen3.7-max')
    expect(bodyText()).toContain('glm-5.2')
    expect(bodyText()).toContain('测试全部 3 个模型')
    expect(bodyText()).toContain('未测试')
  })

  it('filters models locally', async () => {
    render()

    const search = document.body.querySelector(
      'input[name="channel-test-model-filter"]'
    ) as HTMLInputElement
    search.value = 'qwen'
    search.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(bodyText()).toContain('qwen3.7-max')
    expect(bodyText()).not.toContain('glm-5-turbo')
    expect(bodyText()).toContain('测试全部 1 个模型')
  })

  it('tests all models and renders per-model outcomes', async () => {
    const { testModel } = render({
      testModel: async (_channel, model) =>
        model === 'glm-5.2'
          ? { ok: false, message: 'bad response status code 523' }
          : { ok: true, timeMs: 261 },
    })

    const testAll = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('测试全部')
    ) as HTMLButtonElement
    testAll.click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(3)
    expect(rowFor('qwen3.7-max').textContent).toContain('261 毫秒')
    expect(rowFor('glm-5.2').textContent).toContain(
      'bad response status code 523'
    )
    expect(rowFor('glm-5.2').textContent).toContain('失败')
  })

  it('shows spinning testing states in status, result, and action cells', async () => {
    let resolveTest: ((result: ChannelModelTestResult) => void) | undefined
    const pending = new Promise<ChannelModelTestResult>((resolve) => {
      resolveTest = resolve
    })
    render({ models: 'gpt-oss-20b', testModel: () => pending })

    const row = rowFor('gpt-oss-20b')
    const rowTest = row.querySelector(
      'td:last-child button'
    ) as HTMLButtonElement
    rowTest.click()
    await flushPromises()

    const cells = row.querySelectorAll('td')
    const runningLabel = i18n.global.t('channels.testStatusRunning')
    expect(cells[2]?.textContent).toContain(runningLabel)
    expect(cells[3]?.textContent).toContain(runningLabel)
    expect(row.querySelectorAll('.animate-spin')).toHaveLength(3)

    resolveTest?.({ ok: true, timeMs: 261 })
    await flushPromises()
  })

  it('requests a persisted-state reconciliation after a completed batch', async () => {
    const { wrapper } = render({ models: 'gpt-oss-20b' })
    const testAll = Array.from(document.body.querySelectorAll('button')).find(
      (button) =>
        button.textContent?.includes(
          i18n.global.t('channels.testAllModels', { count: 1 })
        )
    ) as HTMLButtonElement

    testAll.click()
    await flushPromises()

    expect(wrapper.emitted('tested')).toHaveLength(1)
  })

  it('removes failed models through the two-step confirm', async () => {
    const { removeModels } = render({
      testModel: async (_channel, model) =>
        model.startsWith('glm')
          ? { ok: false, message: 'error code: 523' }
          : { ok: true, timeMs: 100 },
    })

    const testAll = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('测试全部')
    ) as HTMLButtonElement
    testAll.click()
    await flushPromises()

    const removeButton = Array.from(
      document.body.querySelectorAll('button')
    ).find((button) =>
      button.textContent?.includes('删除失败模型')
    ) as HTMLButtonElement
    removeButton.click()
    await flushPromises()
    expect(removeModels).not.toHaveBeenCalled()
    expect(removeButton.textContent).toContain('确认删除 2 个失败模型')

    removeButton.click()
    await flushPromises()
    expect(removeModels).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      ['glm-5-turbo', 'glm-5.2']
    )
    expect(bodyText()).not.toContain('glm-5-turbo')
    expect(bodyText()).toContain('qwen3.7-max')
  })

  it('passes endpoint and stream overrides to the test request', async () => {
    const { testModel } = render({ models: 'gpt-oss-20b' })

    const streamSwitch = document.body.querySelector(
      'button[role="switch"]'
    ) as HTMLButtonElement
    streamSwitch.click()
    await flushPromises()

    const rowTest = rowFor('gpt-oss-20b').querySelector(
      'td:last-child button'
    ) as HTMLButtonElement
    rowTest.click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      'gpt-oss-20b',
      expect.objectContaining({ stream: true }),
      expect.anything()
    )
  })
})
