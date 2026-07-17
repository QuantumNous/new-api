import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { FlowQuotaDataItem } from '../types'
import { buildDashboardFlowData, buildFlowSankeySpec } from './flow'

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

const topLimitRows: FlowQuotaDataItem[] = [
  {
    user_id: 1,
    username: 'alpha',
    use_group: 'vip',
    channel_id: 201,
    channel_name: 'channel-a',
    model_name: 'model-a',
    quota: 100,
    token_used: 1_000,
    count: 1,
  },
  {
    user_id: 2,
    username: 'beta',
    use_group: 'default',
    channel_id: 202,
    channel_name: 'channel-b',
    model_name: 'model-b',
    quota: 80,
    token_used: 10,
    count: 20,
  },
  {
    user_id: 3,
    username: 'gamma',
    use_group: 'free',
    channel_id: 203,
    channel_name: 'channel-c',
    model_name: 'model-c',
    quota: 10,
    token_used: 2_000,
    count: 5,
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

  test('filters rows by selected flow nodes', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      selectedNodes: [{ kind: 'model', id: 'model:gpt-4.1' }],
    })

    assert.equal(result.summary.quota, 150)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:vip', 'model:gpt-4.1', 150],
        ['model:gpt-4.1', 'channel:101', 100],
        ['model:gpt-4.1', 'channel:102', 50],
        ['user:1', 'group:vip', 150],
      ]
    )
  })

  test('combines node filters with OR inside a column and AND across columns', () => {
    const sameColumn = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      selectedNodes: [
        { kind: 'model', id: 'model:gpt-4.1' },
        { kind: 'model', id: 'model:claude-4-sonnet' },
      ],
    })
    const crossColumn = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      selectedNodes: [
        { kind: 'model', id: 'model:gpt-4.1' },
        { kind: 'channel', id: 'channel:101' },
      ],
    })

    assert.equal(sameColumn.summary.quota, 220)
    assert.equal(crossColumn.summary.quota, 100)
    assert.deepEqual(
      crossColumn.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
      ]),
      [
        ['group:vip', 'model:gpt-4.1', 100],
        ['model:gpt-4.1', 'channel:101', 100],
        ['user:1', 'group:vip', 100],
      ]
    )
  })

  test('combines user and node filters', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      selectedUsers: ['user:1'],
      selectedNodes: [{ kind: 'channel', id: 'channel:101' }],
    })

    assert.equal(result.summary.quota, 100)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:vip', 'model:gpt-4.1', 100],
        ['model:gpt-4.1', 'channel:101', 100],
        ['user:1', 'group:vip', 100],
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
    const options = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
    }).filterOptions

    assert.deepEqual(
      options.users.map((user) => [user.value, user.label, user.valueLabel]),
      [
        ['user:1', 'alice', '150'],
        ['user:2', 'bob', '70'],
      ]
    )
    assert.notEqual(options.users[0].color, options.users[1].color)
  })

  test('builds node filter options without applying top limits', () => {
    const result = buildDashboardFlowData(topLimitRows, 'quota', {
      role: 'admin',
      topNodeLimit: 1,
      overflowMode: 'aggregate',
    })

    assert.equal(
      result.filterOptions.nodes.some(
        (option) => option.kind === 'model' && option.value === 'model:model-c'
      ),
      true
    )
    assert.deepEqual(
      result.filterOptions.nodes
        .filter((option) => option.kind === 'model')
        .map((option) => [option.value, option.valueLabel]),
      [
        ['model:model-a', '100'],
        ['model:model-b', '80'],
        ['model:model-c', '10'],
      ]
    )
  })

  test('facets node filter options by selected nodes from other columns', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
      selectedNodes: [{ kind: 'node', id: 'node:node-a' }],
    })
    const nodeOptions = result.filterOptions.nodes

    assert.deepEqual(
      nodeOptions
        .filter((option) => option.kind === 'node')
        .map((option) => [option.value, option.valueLabel]),
      [
        ['node:node-a', '150'],
        ['node:node-b', '70'],
      ]
    )
    assert.deepEqual(
      nodeOptions
        .filter((option) => option.kind === 'token')
        .map((option) => [option.value, option.valueLabel]),
      [['token:11', '150']]
    )
    assert.deepEqual(
      nodeOptions
        .filter((option) => option.kind === 'channel')
        .map((option) => [option.value, option.valueLabel]),
      [
        ['channel:101', '100'],
        ['channel:102', '50'],
      ]
    )
  })

  test('keeps same-column node options available for OR filtering', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      selectedNodes: [{ kind: 'model', id: 'model:gpt-4.1' }],
    })

    assert.deepEqual(
      result.filterOptions.nodes
        .filter((option) => option.kind === 'model')
        .map((option) => [option.value, option.valueLabel]),
      [
        ['model:gpt-4.1', '150'],
        ['model:claude-4-sonnet', '70'],
      ]
    )
    assert.deepEqual(
      result.filterOptions.nodes
        .filter((option) => option.kind === 'channel')
        .map((option) => [option.value, option.valueLabel]),
      [
        ['channel:101', '100'],
        ['channel:102', '50'],
      ]
    )
  })

  test('combines user filters with faceted node filter options', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
      selectedUsers: ['user:1'],
      selectedNodes: [{ kind: 'channel', id: 'channel:101' }],
    })

    assert.equal(result.summary.quota, 100)
    assert.deepEqual(
      result.filterOptions.nodes
        .filter((option) => option.kind === 'model')
        .map((option) => [option.value, option.valueLabel]),
      [['model:gpt-4.1', '100']]
    )
    assert.deepEqual(
      result.filterOptions.nodes
        .filter((option) => option.kind === 'channel')
        .map((option) => [option.value, option.valueLabel]),
      [
        ['channel:101', '100'],
        ['channel:102', '50'],
      ]
    )
  })

  test('aggregates overflow nodes into per-column Other buckets', () => {
    const result = buildDashboardFlowData(topLimitRows, 'quota', {
      role: 'admin',
      topNodeLimit: 2,
      overflowMode: 'aggregate',
      otherNodeLabel: (kind) => `Other ${kind}`,
    })
    const nodeIds = new Set(result.flow.nodes.map((node) => node.id))
    const otherUser = result.flow.nodes.find(
      (node) => node.id === 'user:__other__'
    )
    const otherFirstStepLink = result.flow.links.find(
      (link) =>
        link.source === 'user:__other__' && link.target === 'group:__other__'
    )
    const firstStepTotal = result.flow.links
      .filter((link) => link.source.startsWith('user:'))
      .reduce((sum, link) => sum + link.value, 0)

    assert.equal(result.summary.quota, 190)
    assert.equal(firstStepTotal, 190)
    assert.equal(otherUser?.label, 'Other user')
    assert.equal(otherFirstStepLink?.value, 10)
    assert.equal(nodeIds.has('user:3'), false)
    assert.equal(nodeIds.has('group:free'), false)
    assert.equal(nodeIds.has('model:model-c'), false)
    assert.equal(nodeIds.has('channel:203'), false)
    assert.equal(nodeIds.has('user:__other__'), true)
    assert.equal(nodeIds.has('group:__other__'), true)
    assert.equal(nodeIds.has('model:__other__'), true)
    assert.equal(nodeIds.has('channel:__other__'), true)
  })

  test('hides overflow paths when overflow mode is hide', () => {
    const result = buildDashboardFlowData(topLimitRows, 'quota', {
      role: 'admin',
      topNodeLimit: 2,
      overflowMode: 'hide',
      otherNodeLabel: (kind) => `Other ${kind}`,
    })
    const nodeIds = new Set(result.flow.nodes.map((node) => node.id))
    const firstStepTotal = result.flow.links
      .filter((link) => link.source.startsWith('user:'))
      .reduce((sum, link) => sum + link.value, 0)

    assert.equal(result.summary.quota, 190)
    assert.equal(firstStepTotal, 180)
    assert.equal(nodeIds.has('user:3'), false)
    assert.equal(nodeIds.has('user:__other__'), false)
    assert.equal(nodeIds.has('model:__other__'), false)
  })

  test('ranks top nodes using the selected flow metric', () => {
    const byQuota = buildDashboardFlowData(topLimitRows, 'quota', {
      role: 'admin',
      topNodeLimit: 1,
      overflowMode: 'aggregate',
    })
    const byRequests = buildDashboardFlowData(topLimitRows, 'requests', {
      role: 'admin',
      topNodeLimit: 1,
      overflowMode: 'aggregate',
    })
    const byTokens = buildDashboardFlowData(topLimitRows, 'tokens', {
      role: 'admin',
      topNodeLimit: 1,
      overflowMode: 'aggregate',
    })

    assert.equal(
      byQuota.flow.nodes.some((node) => node.id === 'user:1'),
      true
    )
    assert.equal(
      byRequests.flow.nodes.some((node) => node.id === 'user:2'),
      true
    )
    assert.equal(
      byTokens.flow.nodes.some((node) => node.id === 'user:3'),
      true
    )
  })

  test('applies top limits only to visible stages', () => {
    const result = buildDashboardFlowData(topLimitRows, 'quota', {
      role: 'admin',
      visibleStages: ['user', 'model'],
      topNodeLimit: 1,
      overflowMode: 'aggregate',
    })
    const nodeIds = new Set(result.flow.nodes.map((node) => node.id))

    assert.equal(nodeIds.has('user:1'), true)
    assert.equal(nodeIds.has('user:__other__'), true)
    assert.equal(nodeIds.has('model:model-a'), true)
    assert.equal(nodeIds.has('model:__other__'), true)
    assert.equal(nodeIds.has('group:__other__'), false)
    assert.equal(nodeIds.has('channel:__other__'), false)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['user:__other__', 'model:__other__', 90],
        ['user:1', 'model:model-a', 100],
      ]
    )
  })

  test('applies top limits after node filters', () => {
    const result = buildDashboardFlowData(topLimitRows, 'quota', {
      role: 'admin',
      selectedNodes: [{ kind: 'model', id: 'model:model-c' }],
      topNodeLimit: 1,
      overflowMode: 'aggregate',
    })
    const nodeIds = new Set(result.flow.nodes.map((node) => node.id))

    assert.equal(result.summary.quota, 10)
    assert.equal(nodeIds.has('model:model-c'), true)
    assert.equal(nodeIds.has('model:__other__'), false)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['group:free', 'model:model-c', 10],
        ['model:model-c', 'channel:203', 10],
        ['user:3', 'group:free', 10],
      ]
    )
  })

  test('ignores selected node filters for hidden stages', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'admin',
      visibleStages: ['user', 'model', 'channel'],
      selectedNodes: [{ kind: 'group', id: 'group:vip' }],
    })

    assert.equal(result.summary.quota, 220)
    assert.equal(
      result.flow.nodes.some((node) => node.id === 'group:vip'),
      false
    )
  })

  test('highlights full paths that contain the active user node', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
      activeNode: { kind: 'user', id: 'user:1' },
    })
    const nodeState = new Map(
      result.flow.nodes.map((node) => [
        node.id,
        { highlighted: node.highlighted, dimmed: node.dimmed },
      ])
    )
    const linkState = new Map(
      result.flow.links.map((link) => [
        `${link.source}->${link.target}`,
        { highlighted: link.highlighted, dimmed: link.dimmed },
      ])
    )

    assert.deepEqual(nodeState.get('user:1'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(nodeState.get('node:node-a'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(nodeState.get('model:gpt-4.1'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(nodeState.get('channel:101'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(nodeState.get('user:2'), {
      highlighted: false,
      dimmed: true,
    })
    assert.deepEqual(linkState.get('user:1->node:node-a'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(linkState.get('model:gpt-4.1->channel:101'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(linkState.get('model:claude-4-sonnet->channel:101'), {
      highlighted: false,
      dimmed: true,
    })
  })

  test('highlights full paths that traverse the active link', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
      activeLink: { source: 'model:gpt-4.1', target: 'channel:101' },
    })
    const nodeState = new Map(
      result.flow.nodes.map((node) => [
        node.id,
        { highlighted: node.highlighted, dimmed: node.dimmed },
      ])
    )
    const linkState = new Map(
      result.flow.links.map((link) => [
        `${link.source}->${link.target}`,
        { highlighted: link.highlighted, dimmed: link.dimmed },
      ])
    )

    assert.deepEqual(linkState.get('model:gpt-4.1->channel:101'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(linkState.get('model:gpt-4.1->channel:102'), {
      highlighted: false,
      dimmed: true,
    })
    assert.deepEqual(nodeState.get('user:1'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(nodeState.get('node:node-a'), {
      highlighted: true,
      dimmed: false,
    })
    assert.deepEqual(nodeState.get('user:2'), {
      highlighted: false,
      dimmed: true,
    })
  })

  test('highlights shared aggregate edges when they contain an active path', () => {
    const sharedRows: FlowQuotaDataItem[] = [
      {
        user_id: 1,
        username: 'alice',
        use_group: 'vip',
        channel_id: 101,
        channel_name: 'east',
        model_name: 'gpt-4.1',
        quota: 100,
        token_used: 40,
        count: 2,
      },
      {
        user_id: 2,
        username: 'bob',
        use_group: 'vip',
        channel_id: 101,
        channel_name: 'east',
        model_name: 'gpt-4.1',
        quota: 50,
        token_used: 20,
        count: 1,
      },
    ]
    const result = buildDashboardFlowData(sharedRows, 'quota', {
      role: 'admin',
      activeNode: { kind: 'user', id: 'user:1' },
    })
    const sharedLink = result.flow.links.find(
      (link) => link.source === 'group:vip' && link.target === 'model:gpt-4.1'
    )
    const inactiveUserLink = result.flow.links.find(
      (link) => link.source === 'user:2' && link.target === 'group:vip'
    )

    assert.equal(sharedLink?.value, 150)
    assert.equal(sharedLink?.highlighted, true)
    assert.equal(sharedLink?.dimmed, false)
    assert.equal(inactiveUserLink?.highlighted, false)
    assert.equal(inactiveUserLink?.dimmed, true)
  })

  test('does not emit highlight states without a visible active node', () => {
    const withoutActive = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
    })
    const hiddenActive = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
      visibleStages: ['node', 'token'],
      activeNode: { kind: 'user', id: 'user:1' },
    })

    assert.equal(
      withoutActive.flow.nodes.every(
        (node) => node.highlighted === undefined && node.dimmed === undefined
      ),
      true
    )
    assert.equal(
      withoutActive.flow.links.every(
        (link) => link.highlighted === undefined && link.dimmed === undefined
      ),
      true
    )
    assert.equal(
      hiddenActive.flow.nodes.every(
        (node) => node.highlighted === undefined && node.dimmed === undefined
      ),
      true
    )
    assert.equal(
      hiddenActive.flow.links.every(
        (link) => link.highlighted === undefined && link.dimmed === undefined
      ),
      true
    )
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
    assert.deepEqual(flowSpec.emphasis, { enable: false })
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

  test('maps active flow highlight states into the Sankey spec', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      role: 'root',
      activeNode: { kind: 'user', id: 'user:1' },
    })
    const flowSpec = buildFlowSankeySpec(result.flow, 'Flow')
    const values = flowSpec.data[0].values[0]
    const aliceNode = values.nodes.find(
      (node: Record<string, unknown>) => node.key === 'user:1'
    )
    const bobNode = values.nodes.find(
      (node: Record<string, unknown>) => node.key === 'user:2'
    )
    const highlightedLink = values.links.find(
      (link: Record<string, unknown>) =>
        link.source === 'model:gpt-4.1' && link.target === 'channel:101'
    )
    const dimmedLink = values.links.find(
      (link: Record<string, unknown>) =>
        link.source === 'model:claude-4-sonnet' && link.target === 'channel:101'
    )
    const nodeOpacity = flowSpec.node.style.fillOpacity
    const linkOpacity = flowSpec.link.style.fillOpacity

    assert.deepEqual(flowSpec.emphasis, { enable: false })
    assert.equal(aliceNode.highlighted, true)
    assert.equal(bobNode.dimmed, true)
    assert.equal(highlightedLink.highlighted, true)
    assert.equal(dimmedLink.dimmed, true)
    assert.equal(nodeOpacity(aliceNode), 1)
    assert.equal(nodeOpacity(bobNode), 0.18)
    assert.equal(linkOpacity(highlightedLink), 0.86)
    assert.equal(linkOpacity(dimmedLink), 0.08)
    assert.equal(highlightedLink.zIndex > dimmedLink.zIndex, true)
  })
})
