import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { FlowQuotaDataItem } from '../types'
import {
  buildDashboardFlowData,
  buildFlowFilterOptions,
  buildFlowSankeySpec,
} from './flow'

const rows: FlowQuotaDataItem[] = [
  {
    user_id: 1,
    username: 'alice',
    node_name: 'node-a',
    token_id: 11,
    token_name: 'primary',
    use_group: 'vip',
    channel_id: 101,
    channel_name: 'east',
    model_name: 'gpt-4.1',
    quota: 100,
    token_used: 40,
    count: 2,
  },
  {
    user_id: 1,
    username: 'alice',
    node_name: 'node-a',
    token_id: 11,
    token_name: 'primary',
    use_group: 'vip',
    channel_id: 102,
    channel_name: 'west',
    model_name: 'gpt-4.1',
    quota: 50,
    token_used: 20,
    count: 1,
  },
  {
    user_id: 2,
    username: 'bob',
    node_name: 'node-b',
    token_id: 22,
    token_name: 'backup',
    use_group: 'default',
    channel_id: 101,
    channel_name: 'east',
    model_name: 'claude-4-sonnet',
    quota: 70,
    token_used: 30,
    count: 3,
  },
]

describe('dashboard flow data', () => {
  test('builds normal user token-group-model flow', () => {
    const result = buildDashboardFlowData(rows.slice(0, 2), 'quota', {
      role: 'user',
    })

    assert.equal(result.summary.quota, 150)
    assert.equal(result.summary.tokens, 60)
    assert.equal(result.summary.requests, 3)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:vip', 'model:gpt-4.1', 150],
        ['token:11', 'group:vip', 150],
      ]
    )
    assert.equal(
      result.flow.nodes.some((node) => node.kind === 'channel'),
      false
    )
  })

  test('builds admin user-group-model-channel flow', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
    })

    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:default', 'model:claude-4-sonnet', 70],
        ['group:vip', 'model:gpt-4.1', 150],
        ['model:claude-4-sonnet', 'channel:101', 70],
        ['model:gpt-4.1', 'channel:101', 100],
        ['model:gpt-4.1', 'channel:102', 50],
        ['user:1', 'group:vip', 150],
        ['user:2', 'group:default', 70],
      ]
    )
  })

  test('builds root user-node-token-group-model-channel flow', () => {
    const result = buildDashboardFlowData(rows, 'requests', {
      role: 'root',
    })

    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:default', 'model:claude-4-sonnet', 3],
        ['group:vip', 'model:gpt-4.1', 3],
        ['model:claude-4-sonnet', 'channel:101', 3],
        ['model:gpt-4.1', 'channel:101', 2],
        ['model:gpt-4.1', 'channel:102', 1],
        ['node:node-a', 'token:11', 3],
        ['node:node-b', 'token:22', 3],
        ['token:11', 'group:vip', 3],
        ['token:22', 'group:default', 3],
        ['user:1', 'node:node-a', 3],
        ['user:2', 'node:node-b', 3],
      ]
    )
  })

  test('filters by selected users', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      selectedUsers: ['user:2'],
    })

    assert.equal(result.summary.quota, 70)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:default', 'model:claude-4-sonnet', 70],
        ['model:claude-4-sonnet', 'channel:101', 70],
        ['user:2', 'group:default', 70],
      ]
    )
  })

  test('reconnects links when a middle stage is hidden', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      visibleStages: ['user', 'model', 'channel'],
    })

    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['model:claude-4-sonnet', 'channel:101', 70],
        ['model:gpt-4.1', 'channel:101', 100],
        ['model:gpt-4.1', 'channel:102', 50],
        ['user:1', 'model:gpt-4.1', 150],
        ['user:2', 'model:claude-4-sonnet', 70],
      ]
    )
    assert.equal(
      result.flow.nodes.some((node) => node.kind === 'group'),
      false
    )
  })

  test('ignores stage filters that would leave fewer than two columns', () => {
    const result = buildDashboardFlowData(rows.slice(0, 2), 'quota', {
      role: 'user',
      visibleStages: ['model'],
    })

    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:vip', 'model:gpt-4.1', 150],
        ['token:11', 'group:vip', 150],
      ]
    )
  })

  test('builds user filter options with stable values', () => {
    const options = buildFlowFilterOptions(rows, 'quota')

    assert.deepEqual(
      options.users.map((user) => [user.value, user.label, user.valueLabel]),
      [
        ['user:1', 'alice', '150'],
        ['user:2', 'bob', '70'],
      ]
    )
    assert.notEqual(options.users[0].color, options.users[1].color)
  })

  test('builds Sankey spec with quota token request tooltips', () => {
    const result = buildDashboardFlowData(rows.slice(0, 1), 'quota', {
      role: 'root',
    })
    const flowSpec = buildFlowSankeySpec(result.flow, 'Flow')
    const values = flowSpec.data[0].values[0]
    const aliceNode = values.nodes.find(
      (node: Record<string, unknown>) => node.key === 'user:1'
    )
    const userNodeLink = values.links.find(
      (link: Record<string, unknown>) =>
        link.source === 'user:1' && link.target === 'node:node-a'
    )

    assert.equal(flowSpec.type, 'sankey')
    assert.equal(flowSpec.title.text, 'Flow')
    assert.equal(flowSpec.tooltip.mark.visible({ datum: aliceNode }), true)
    assert.equal(flowSpec.tooltip.mark.visible({ datum: userNodeLink }), true)
    assert.equal(flowSpec.animation, false)
    assert.equal(values.nodes.length, 6)
    assert.equal(values.links.length, 5)
    assert.equal(aliceNode.name, 'alice')
    assert.match(userNodeLink.linkColor, /^rgba\(/)

    const tooltipRows = flowSpec.tooltip.mark.content
    assert.deepEqual(
      tooltipRows
        .filter((row: Record<string, unknown>) =>
          typeof row.visible === 'function'
            ? row.visible({ datum: userNodeLink })
            : true
        )
        .map((row: Record<string, unknown>) => [
          row.key,
          typeof row.value === 'function'
            ? row.value({ datum: userNodeLink })
            : row.value,
        ]),
      [
        ['Quota', '100'],
        ['Tokens', '40'],
        ['Requests', '2'],
        ['Share', '100.0%'],
      ]
    )
  })
})
