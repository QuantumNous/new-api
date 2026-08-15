import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import ChannelTestModal from '@/components/console/channels/ChannelTestModal.vue'
import type { ChannelModelTestResult } from '@/composables/useAdminChannels'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { AdminChannel } from '@/types/console'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

let mounted: VueWrapper[] = []

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted = []
  document.body.innerHTML = ''
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
  mounted.push(wrapper)
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

function visibleModels(): string[] {
  return Array.from(document.body.querySelectorAll('tbody tr'))
    .map((row) => row.querySelector('td:nth-child(2)')?.textContent?.trim())
    .filter((model): model is string => Boolean(model))
}

function batchTestButton(): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (item) => item.textContent?.includes('测试全部')
  )
  expect(button, 'batch test button').toBeTruthy()
  return button as HTMLButtonElement
}

async function goToNextPage(): Promise<void> {
  const button = document.body.querySelector(
    '[data-pagination-variant="modal-footer"] button[aria-label="下一页"]'
  ) as HTMLButtonElement
  button.click()
  await flushPromises()
}

describe('ChannelTestModal', () => {
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

  it('paginates the model list with a default size of five', async () => {
    const models = Array.from(
      { length: 12 },
      (_, index) => `model-${String(index + 1).padStart(2, '0')}`
    )
    render({ models: models.join(',') })

    expect(visibleModels()).toEqual(models.slice(0, 5))
    expect(bodyText()).not.toContain('共 12 项')

    const footer = document.body.querySelector(
      '[data-pagination-variant="modal-footer"]'
    ) as HTMLElement
    const pageSize = footer.querySelector(
      '[data-pagination-page-size]'
    ) as HTMLElement
    const controls = footer.querySelector(
      '[data-pagination-controls]'
    ) as HTMLElement
    const actions = footer.querySelector(
      '[data-pagination-actions]'
    ) as HTMLElement
    expect(
      pageSize.compareDocumentPosition(controls) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      controls.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    const nextPage = footer.querySelector(
      'button[aria-label="下一页"]'
    ) as HTMLButtonElement
    nextPage.click()
    await flushPromises()
    expect(visibleModels()).toEqual(models.slice(5, 10))

    const pageSizeSelect = footer.querySelector(
      '[data-pagination-page-size] [role="combobox"]'
    ) as HTMLButtonElement
    pageSizeSelect.click()
    await flushPromises()
    const option = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((item) => item.textContent?.trim() === '显示 10')
    expect(
      Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
        .map((item) => item.textContent?.trim())
        .filter(Boolean)
    ).toEqual(['显示 5', '显示 10', '显示 30', '显示 50'])
    expect(option).toBeTruthy()
    option?.click()
    await flushPromises()

    expect(visibleModels()).toEqual(models.slice(0, 10))
  })

  it('returns to a valid page after filtering or deleting models', async () => {
    const models = Array.from(
      { length: 12 },
      (_, index) => `model-${String(index + 1).padStart(2, '0')}`
    )
    render({
      models: models.join(','),
      testModel: async (_channel, model) =>
        Number(model.slice(-2)) > 5
          ? { ok: false, message: 'unavailable' }
          : { ok: true, timeMs: 100 },
    })

    await goToNextPage()
    await goToNextPage()
    expect(visibleModels()).toEqual(models.slice(10))

    const search = document.body.querySelector(
      'input[name="channel-test-model-filter"]'
    ) as HTMLInputElement
    search.value = 'model-01'
    search.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(visibleModels()).toEqual(['model-01'])

    search.value = ''
    search.dispatchEvent(new Event('input'))
    await flushPromises()
    batchTestButton().click()
    await flushPromises()
    await goToNextPage()
    await goToNextPage()
    expect(visibleModels()).toEqual(models.slice(10))

    const removeButton = Array.from(
      document.body.querySelectorAll('button')
    ).find((button) =>
      button.textContent?.includes('删除失败模型')
    ) as HTMLButtonElement
    removeButton.click()
    await flushPromises()
    removeButton.click()
    await flushPromises()

    expect(visibleModels()).toEqual(models.slice(0, 5))
  })

  it('keeps batch progress and spinners visible while requests are pending', async () => {
    let resolveTest: (result: ChannelModelTestResult) => void = () => {}
    const pendingTest = new Promise<ChannelModelTestResult>((resolve) => {
      resolveTest = resolve
    })
    render({ testModel: () => pendingTest })

    const button = batchTestButton()
    button.click()
    await flushPromises()

    expect(button.textContent).toContain('0/3')
    expect(
      document.body.querySelector('[data-channel-model-test-spinner]')
    ).toBeTruthy()
    expect(
      document.body.querySelectorAll('[data-channel-model-row-spinner]')
    ).toHaveLength(3)

    resolveTest({ ok: true, timeMs: 100 })
    await flushPromises()
  })

  it('tests all models and renders per-model outcomes', async () => {
    const { testModel } = render({
      testModel: async (_channel, model) =>
        model === 'glm-5.2'
          ? { ok: false, message: 'bad response status code 523' }
          : { ok: true, timeMs: 261 },
    })

    batchTestButton().click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(3)
    expect(rowFor('qwen3.7-max').textContent).toContain('261 毫秒')
    expect(rowFor('glm-5.2').textContent).toContain(
      'bad response status code 523'
    )
    expect(rowFor('glm-5.2').textContent).toContain('失败')
  })

  it('removes failed models through the two-step confirm', async () => {
    const { removeModels } = render({
      testModel: async (_channel, model) =>
        model.startsWith('glm')
          ? { ok: false, message: 'error code: 523' }
          : { ok: true, timeMs: 100 },
    })

    batchTestButton().click()
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
