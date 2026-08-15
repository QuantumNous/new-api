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

  it('does not render an in-dialog channel list', async () => {
    render()

    await selectModel('gpt-5')

    expect(document.body.querySelectorAll('.channel-pick-row')).toHaveLength(0)
    expect(document.body.querySelector('[role="list"]')).toBeNull()
  })

  it('emits start/result per channel and tested once at the end', async () => {
    const { wrapper, testModel } = render({
      testModel: async (channel) =>
        channel.id === 2
          ? { ok: false, message: 'bad response status code 523' }
          : { ok: true, timeMs: 261 },
    })

    await selectModel('gpt-5')
    const button = startButton()
    button.click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(2)
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      'gpt-5',
      {},
      expect.anything()
    )
    expect(wrapper.emitted('start')).toEqual([[1], [2]])
    expect(wrapper.emitted('result')).toEqual([
      [1, { ok: true, timeMs: 261 }],
      [2, { ok: false, message: 'bad response status code 523' }],
    ])
    expect(wrapper.emitted('tested')).toHaveLength(1)
  })

  it('only tests channels publishing the picked model', async () => {
    const { wrapper, testModel } = render()

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
    expect(wrapper.emitted('result')).toEqual([[1, { ok: true, timeMs: 261 }]])
  })

  it('keeps the batch spinner visible while tests are pending', async () => {
    let resolveTest: (result: ChannelModelTestResult) => void = () => {}
    const pendingTest = new Promise<ChannelModelTestResult>((resolve) => {
      resolveTest = resolve
    })
    render({
      testModel: () => pendingTest,
    })

    await selectModel('gpt-5')
    const button = startButton()
    button.click()
    await flushPromises()

    expect(
      document.body.querySelector('[data-channel-test-spinner]')
    ).toBeTruthy()
    expect(button.textContent).toContain('0/2')
    expect(
      document.body
        .querySelector('[data-channel-test-picker]')
        ?.hasAttribute('inert')
    ).toBe(true)

    resolveTest({ ok: true, timeMs: 100 })
    await flushPromises()
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

    // The picker is inert during a batch, so change the model programmatically
    // to simulate a race (e.g. reopened state).
    ;(wrapper.vm as unknown as { selectedModel: string }).selectedModel =
      'gpt-5-mini'
    resolveTest({ ok: true, timeMs: 261 })
    await flushPromises()

    expect(wrapper.emitted('result')).toBeUndefined()
    expect(wrapper.emitted('tested')).toBeUndefined()
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
    expect(wrapper.emitted('result')).toBeUndefined()
    expect(wrapper.emitted('tested')).toBeUndefined()
  })
})
