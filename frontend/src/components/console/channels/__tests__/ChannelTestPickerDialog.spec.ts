import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import ChannelTestPickerDialog from '@/components/console/channels/ChannelTestPickerDialog.vue'
import type {
  ChannelModelTestOptions,
  ChannelModelTestResult,
} from '@/composables/useAdminChannels'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { AdminChannel } from '@/types/console'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

type TestModelFn = (
  channel: AdminChannel,
  model: string,
  options: ChannelModelTestOptions,
  signal?: AbortSignal
) => Promise<ChannelModelTestResult>

function makeChannel(id: number, name: string, models: string): AdminChannel {
  return {
    id,
    name,
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

const defaultChannels = [
  makeChannel(1, 'RenRen2', 'gpt-5,gpt-5-mini'),
  makeChannel(2, 'RenRen3', 'gpt-5,o4-mini'),
]

let mounted: VueWrapper[] = []

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted = []
  document.body.innerHTML = ''
})

function render(
  options: { channels?: AdminChannel[]; testModel?: TestModelFn } = {}
): {
  wrapper: VueWrapper
  testModel: ReturnType<typeof vi.fn>
} {
  const testModel = vi.fn(
    options.testModel ?? (async () => ({ ok: true, timeMs: 261 }))
  )
  const wrapper = mount(ChannelTestPickerDialog, {
    attachTo: document.body,
    props: {
      open: true,
      supplier: 'Anthropic',
      channels: options.channels ?? defaultChannels,
      testModel,
    },
    global: { plugins: [i18n] },
  })
  mounted.push(wrapper)
  return { wrapper, testModel }
}

function bodyText(): string {
  return document.body.textContent ?? ''
}

function optionLabels(): string[] {
  return Array.from(document.body.querySelectorAll('[role="option"]')).map(
    (option) => option.textContent?.trim() ?? ''
  )
}

async function openDropdown(): Promise<void> {
  const trigger = document.body.querySelector(
    '[role="combobox"]'
  ) as HTMLButtonElement
  trigger.click()
  await flushPromises()
}

async function selectModel(model: string): Promise<void> {
  await openDropdown()
  const option = Array.from(
    document.body.querySelectorAll('[role="option"]')
  ).find((item) => item.textContent?.trim() === model) as HTMLElement
  expect(option, `option for ${model}`).toBeTruthy()
  option.click()
  await flushPromises()
}

function startButton(): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (item) => item.textContent?.includes('开始测试')
  )
  expect(button, 'start button').toBeTruthy()
  return button as HTMLButtonElement
}

function rowFor(name: string): HTMLElement {
  const rows = Array.from(document.body.querySelectorAll('.channel-pick-row'))
  const row = rows.find((item) => item.textContent?.includes(name))
  expect(row, `row for ${name}`).toBeTruthy()
  return row as HTMLElement
}

describe('ChannelTestPickerDialog', () => {
  it('offers the deduped union of the group models', async () => {
    render()
    await openDropdown()

    expect(optionLabels()).toEqual([
      '选择要测试的模型',
      'gpt-5',
      'gpt-5-mini',
      'o4-mini',
    ])
  })

  it('keeps the batch test disabled until a model is picked', async () => {
    render()

    expect(startButton().disabled).toBe(true)

    await selectModel('gpt-5')

    expect(startButton().disabled).toBe(false)
    expect(bodyText()).toContain('2 个渠道已配置该模型')
  })

  it('preselects the model when the group publishes only one', () => {
    render({ channels: [makeChannel(1, 'RenRen2', 'gpt-5')] })

    expect(startButton().disabled).toBe(false)
    expect(bodyText()).toContain('1 个渠道已配置该模型')
  })

  it('tests every channel publishing the model and renders each response', async () => {
    const { testModel } = render({
      testModel: async (channel) =>
        channel.id === 2
          ? { ok: false, message: 'bad response status code 523' }
          : { ok: true, timeMs: 261 },
    })

    await selectModel('gpt-5')
    startButton().click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(2)
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      'gpt-5',
      {},
      expect.anything()
    )
    expect(rowFor('RenRen2').textContent).toContain('261 毫秒')
    expect(rowFor('RenRen2').textContent).toContain('成功')
    expect(rowFor('RenRen3').textContent).toContain(
      'bad response status code 523'
    )
    expect(rowFor('RenRen3').textContent).toContain('失败')
  })

  it('skips channels that do not publish the picked model', async () => {
    const { testModel } = render()

    await selectModel('gpt-5-mini')
    startButton().click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(1)
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      'gpt-5-mini',
      {},
      expect.anything()
    )
    expect(rowFor('RenRen3').textContent).toContain('未配置')
  })

  it('emits tested once the batch finishes so the table can refresh', async () => {
    const { wrapper } = render()

    await selectModel('gpt-5')
    startButton().click()
    await flushPromises()

    expect(wrapper.emitted('tested')).toHaveLength(1)
  })

  it('discards in-flight results after the model changes mid-batch', async () => {
    let resolveTest: (result: ChannelModelTestResult) => void = () => {}
    const { wrapper } = render({
      testModel: () =>
        new Promise<ChannelModelTestResult>((resolve) => {
          resolveTest = resolve
        }),
    })

    await selectModel('gpt-5')
    startButton().click()
    await flushPromises()

    await selectModel('gpt-5-mini')
    resolveTest({ ok: true, timeMs: 261 })
    await flushPromises()

    expect(rowFor('RenRen2').textContent).not.toContain('261 毫秒')
    expect(rowFor('RenRen2').textContent).toContain('未测试')
    expect(wrapper.emitted('tested')).toBeUndefined()
  })

  it('drops results when the picked model changes', async () => {
    render()

    await selectModel('gpt-5')
    startButton().click()
    await flushPromises()
    expect(rowFor('RenRen2').textContent).toContain('261 毫秒')

    await selectModel('gpt-5-mini')

    expect(rowFor('RenRen2').textContent).not.toContain('261 毫秒')
    expect(rowFor('RenRen2').textContent).toContain('未测试')
  })

  it('aborts in-flight tests when the dialog closes', async () => {
    let capturedSignal: AbortSignal | undefined
    let resolveTest: (result: ChannelModelTestResult) => void = () => {}
    const { wrapper } = render({
      testModel: (_channel, _model, _options, signal) => {
        capturedSignal = signal
        return new Promise<ChannelModelTestResult>((resolve) => {
          resolveTest = resolve
        })
      },
    })

    await selectModel('gpt-5')
    startButton().click()
    await flushPromises()
    expect(capturedSignal?.aborted).toBe(false)

    await wrapper.setProps({ open: false })
    expect(capturedSignal?.aborted).toBe(true)

    resolveTest({ ok: true, timeMs: 100 })
    await flushPromises()
    expect(wrapper.emitted('tested')).toBeUndefined()
  })
})
