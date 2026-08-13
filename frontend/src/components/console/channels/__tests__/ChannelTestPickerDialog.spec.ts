import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

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

const channels = [
  makeChannel(1, 'Alpha', 'gpt-4o,gpt-oss-20b'),
  makeChannel(2, 'Beta', 'claude-4,gpt-4o'),
]

type TestModel = (
  channel: AdminChannel,
  model: string,
  options: ChannelModelTestOptions,
  signal?: AbortSignal
) => Promise<ChannelModelTestResult>

function render(testModel?: TestModel): {
  wrapper: VueWrapper
  testModel: ReturnType<typeof vi.fn>
} {
  const testModelMock = vi.fn(
    testModel ?? (async () => ({ ok: true, timeMs: 120 }))
  )
  const wrapper = mount(ChannelTestPickerDialog, {
    attachTo: document.body,
    props: {
      open: true,
      supplier: 'OpenAI',
      channels,
      testModel: testModelMock,
    },
    global: { plugins: [i18n] },
  })
  return { wrapper, testModel: testModelMock }
}

function optionLabels(): string[] {
  return Array.from(
    document.body.querySelectorAll('li[role="option"]'),
    (option) => option.textContent?.trim() ?? ''
  )
}

async function openModelSelect() {
  const trigger = document.body.querySelector(
    'button[role="combobox"]'
  ) as HTMLButtonElement
  trigger.click()
  await flushPromises()
}

async function pickModel(model: string) {
  await openModelSelect()
  const option = Array.from(
    document.body.querySelectorAll<HTMLElement>('li[role="option"]')
  ).find((item) => item.textContent?.trim() === model)
  expect(option, `option for ${model}`).toBeTruthy()
  option!.click()
  await flushPromises()
}

function rowNames(): string[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="listitem"]'),
    (row) => row.querySelector('span span')?.textContent?.trim() ?? ''
  )
}

function rowFor(name: string): HTMLElement {
  const row = Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="listitem"]')
  ).find((item) => item.textContent?.includes(name))
  expect(row, `row for ${name}`).toBeTruthy()
  return row as HTMLElement
}

function startButton(): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (item) => item.textContent?.includes('开始测试')
  )
  expect(button, 'start button').toBeTruthy()
  return button as HTMLButtonElement
}

describe('ChannelTestPickerDialog', () => {
  it('offers the sorted model union and lists the whole group before a pick', async () => {
    render()

    expect(rowNames()).toEqual(['Alpha', 'Beta'])
    await openModelSelect()
    expect(optionLabels()).toEqual([
      '选择模型',
      'claude-4',
      'gpt-4o',
      'gpt-oss-20b',
    ])
  })

  it('narrows the channel rows to the channels serving the picked model', async () => {
    render()

    await pickModel('claude-4')

    expect(rowNames()).toEqual(['Beta'])
  })

  it('tests the picked model on every serving channel and shows inline results', async () => {
    const { testModel } = render(async (channel) =>
      channel.id === 2
        ? { ok: false, message: 'bad response status code 523' }
        : { ok: true, timeMs: 120 }
    )

    await pickModel('gpt-4o')
    startButton().click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(2)
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      'gpt-4o',
      expect.anything(),
      expect.anything()
    )
    expect(rowFor('Alpha').textContent).toContain('120 毫秒')
    expect(rowFor('Alpha').textContent).toContain('成功')
    expect(rowFor('Beta').textContent).toContain('bad response status code 523')
    expect(rowFor('Beta').textContent).toContain('失败')
  })

  it('aborts the in-flight run when the dialog closes', async () => {
    let capturedSignal: AbortSignal | undefined
    const pending: Array<() => void> = []
    const { wrapper } = render(
      (_channel, _model, _options, signal) =>
        new Promise<ChannelModelTestResult>((resolve) => {
          capturedSignal = signal
          pending.push(() => resolve({ ok: true, timeMs: 10 }))
        })
    )

    await pickModel('gpt-4o')
    startButton().click()
    await flushPromises()
    expect(capturedSignal?.aborted).toBe(false)

    await wrapper.setProps({ open: false })

    expect(capturedSignal?.aborted).toBe(true)
    pending.forEach((resolve) => resolve())
    await flushPromises()
  })
})
