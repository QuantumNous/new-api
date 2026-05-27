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
        [600, 0],
        [900, 2],
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

  test('renders the model name instead of upstream monitor name', () => {
    const view = buildModelStatusView({
      success: true,
      message: '',
      data: [
        {
          categoryName: 'Claude 官方渠道',
          monitors: [
            {
              name: 'Claude Code AWS特价线路',
              model: 'claude-opus-4-7',
              group: 'Claude 官方渠道',
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

    assert.equal(view.groups[0]?.models[0]?.name, 'claude-opus-4-7')
    assert.equal(JSON.stringify(view).includes('AWS特价线路'), false)
  })

  test('normalizes dense model history into five-minute buckets for the last five hours', () => {
    const bucket = 1_800_000
    const now = bucket + 5 * 60 * 60
    const view = buildModelStatusView(
      {
        success: true,
        message: '',
        data: [
          {
            categoryName: 'Claude 中转渠道',
            monitors: [
              {
                name: 'claude-opus-4-7',
                model: 'claude-opus-4-7',
                group: 'Claude 中转渠道',
                uptime: 1,
                availability: 100,
                status: 1,
                latency: 900,
                updated_at: now,
                history: [
                  { timestamp: bucket - 60, status: 0, availability: 0, latency: 9000 },
                  { timestamp: bucket + 10, status: 1, availability: 100, latency: 1000 },
                  { timestamp: bucket + 90, status: 2, availability: 80, latency: 2000 },
                  { timestamp: bucket + 299, status: 1, availability: 100, latency: 3000 },
                  { timestamp: bucket + 301, status: 1, availability: 95, latency: 900 },
                ],
              },
            ],
          },
        ],
      },
      now
    )

    const history = view.groups[0]?.models[0]?.history ?? []
    assert.deepEqual(
      history.map((point) => [point.timestamp, point.status, point.availability, point.latency]),
      [
        [bucket, 2, 93.33, 2000],
        [bucket + 300, 1, 95, 900],
      ]
    )
  })

})
