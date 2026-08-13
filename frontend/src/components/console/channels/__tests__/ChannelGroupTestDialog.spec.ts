import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import ChannelGroupTestDialog from '@/components/console/channels/ChannelGroupTestDialog.vue'
import type { ChannelModelTestResult } from '@/composables/useAdminChannels'
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
  makeChannel(2, 'Beta', 'gpt-4o,claude-4'),
]

function render(
  testModel?: (
    channel: AdminChannel,
    model: string
  ) => Promise<ChannelModelTestResult>
) {
  const testModelMock = vi.fn(
    testModel ?? (async () => ({ ok: true, timeMs: 120 }))
  )
  mount(ChannelGroupTestDialog, {
    attachTo: document.body,
    props: {
      open: true,
      supplier: 'OpenAI',
      channels,
      testModel: testModelMock,
    },
    global: { plugins: [i18n] },
  })
  return { testModel: testModelMock }
}

function bodyText(): string {
  return document.body.textContent ?? ''
}

function pickModel(model: string) {
  const radio = Array.from(
    document.body.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  ).find((input) => input.value === model)
  expect(radio, `radio for ${model}`).toBeTruthy()
  radio!.click()
}

function startButton(): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (item) => item.textContent?.includes('开始测试')
  )
  expect(button, 'start button').toBeTruthy()
  return button as HTMLButtonElement
}

describe('ChannelGroupTestDialog', () => {
  it('lists the model union with per-model channel counts', () => {
    render()

    expect(bodyText()).toContain('gpt-4o')
    expect(bodyText()).toContain('gpt-oss-20b')
    expect(bodyText()).toContain('claude-4')
    expect(bodyText()).toContain('2 个渠道支持')
    expect(bodyText()).toContain('1 个渠道支持')
  })

  it('filters the model list locally', async () => {
    render()

    const search = document.body.querySelector(
      'input[name="channel-group-test-filter"]'
    ) as HTMLInputElement
    search.value = 'claude'
    search.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(bodyText()).toContain('claude-4')
    expect(bodyText()).not.toContain('gpt-oss-20b')
  })

  it('tests the picked model on every channel serving it', async () => {
    const { testModel } = render(async (channel) =>
      channel.id === 2
        ? { ok: false, message: 'bad response status code 523' }
        : { ok: true, timeMs: 120 }
    )

    pickModel('gpt-4o')
    await flushPromises()
    startButton().click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(2)
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      'gpt-4o',
      expect.anything(),
      expect.anything()
    )
    expect(bodyText()).toContain('测试结果：gpt-4o')
    expect(bodyText()).toContain('120 毫秒')
    expect(bodyText()).toContain('bad response status code 523')
  })

  it('only targets channels that publish the picked model', async () => {
    const { testModel } = render()

    pickModel('claude-4')
    await flushPromises()
    startButton().click()
    await flushPromises()

    expect(testModel).toHaveBeenCalledTimes(1)
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      'claude-4',
      expect.anything(),
      expect.anything()
    )
  })
})
