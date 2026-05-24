import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { ModelStatusPayload } from '../types.ts'
import { buildModelStatusView } from './status-view.ts'

const samplePayload: ModelStatusPayload = {
  success: true,
  message: '',
  data: [
    {
      categoryName: 'HiddenProviderA',
      monitors: [
        {
          name: 'GPT 5.4',
          model: 'gpt-5.4',
          group: 'Codex',
          uptime: 1,
          availability: 100,
          status: 1,
          latency: 900,
          updated_at: 1000,
          history: [
            { timestamp: 700, status: 1, availability: 100, latency: 900 },
            { timestamp: 1000, status: 1, availability: 100, latency: 900 },
          ],
        },
      ],
    },
    {
      categoryName: 'HiddenProviderB',
      monitors: [
        {
          name: 'GPT 5.4',
          model: 'gpt-5.4',
          group: 'Codex',
          uptime: 0.5,
          availability: 70,
          status: 2,
          latency: 3200,
          updated_at: 1000,
          history: [
            { timestamp: 700, status: 0, availability: 0, latency: 20000 },
            { timestamp: 1000, status: 2, availability: 70, latency: 3200 },
          ],
        },
      ],
    },
  ],
}

describe('buildModelStatusView', () => {
  test('groups by public group and model without exposing providers', () => {
    const view = buildModelStatusView(samplePayload)

    assert.equal(view.groups.length, 1)
    assert.equal(view.groups[0]?.name, 'Codex')
    assert.equal(view.groups[0]?.models.length, 1)
    assert.equal(view.groups[0]?.models[0]?.model, 'gpt-5.4')
    assert.equal(view.groups[0]?.models[0]?.status, 2)
    assert.equal(JSON.stringify(view).includes('HiddenProvider'), false)
  })

  test('aggregates duplicate model history by worst status per timestamp', () => {
    const view = buildModelStatusView(samplePayload)
    const history = view.groups[0]?.models[0]?.history ?? []

    assert.deepEqual(
      history.map((point) => [point.timestamp, point.status]),
      [
        [700, 0],
        [1000, 2],
      ]
    )
    assert.equal(view.summary.totalModels, 1)
    assert.equal(view.summary.degradedModels, 1)
    assert.equal(view.summary.downModels, 0)
  })

  test('uses api categoryName when monitor group is omitted', () => {
    const view = buildModelStatusView({
      success: true,
      message: '',
      data: [
        {
          categoryName: 'GPT 中转渠道',
          monitors: [
            {
              name: 'GPT 5.4',
              model: 'gpt-5.4',
              uptime: 1,
              availability: 100,
              status: 1,
              latency: 900,
              updated_at: 1000,
              history: [],
            },
          ],
        },
      ],
    })

    assert.equal(view.groups.length, 1)
    assert.equal(view.groups[0]?.name, 'GPT 中转渠道')
    assert.equal(view.groups[0]?.models[0]?.group, 'GPT 中转渠道')
  })
})
