import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { FlowQuotaDataItem } from '../types'
import { getDashboardChartColors } from './charts'
import {
  buildDashboardFlowData,
  buildFlowFilterOptions,
  buildFlowSankeySpec,
} from './flow'

const rows: FlowQuotaDataItem[] = [
  {
    user_id: 1,
    username: 'alice',
    token_id: 11,
    token_name: 'primary',
    channel_id: 101,
    channel_name: 'east',
    model_name: 'gpt-4.1',
    quota: 100,
    token_used: 40,
    prompt_tokens: 25,
    completion_tokens: 15,
    count: 2,
  },
  {
    user_id: 1,
    username: 'alice',
    token_id: 11,
    token_name: 'primary',
    channel_id: 102,
    channel_name: 'west',
    model_name: 'gpt-4.1',
    quota: 50,
    token_used: 20,
    prompt_tokens: 12,
    completion_tokens: 8,
    count: 1,
  },
  {
    user_id: 1,
    username: 'alice',
    token_id: 12,
    token_name: 'secondary',
    channel_id: 103,
    channel_name: 'north',
    model_name: 'claude-4-sonnet',
    quota: 30,
    token_used: 10,
    prompt_tokens: 6,
    completion_tokens: 4,
    count: 1,
  },
  {
    user_id: 2,
    username: 'bob',
    token_id: 22,
    token_name: 'backup',
    channel_id: 101,
    channel_name: 'east',
    model_name: 'claude-4-sonnet',
    quota: 70,
    token_used: 30,
    prompt_tokens: 18,
    completion_tokens: 12,
    count: 3,
  },
]

const cacheRows: FlowQuotaDataItem[] = [
  {
    user_id: 1,
    username: 'dry',
    token_id: 11,
    token_name: 'dry-key',
    channel_id: 101,
    channel_name: 'east',
    model_name: 'gpt-4.1',
    quota: 100,
    token_used: 90,
    input_tokens: 70,
    prompt_tokens: 100,
    completion_tokens: 20,
    cache_tokens: 25,
    cache_write_tokens: 5,
    count: 2,
  },
  {
    user_id: 2,
    username: 'jrc',
    token_id: 22,
    token_name: 'jrc-key',
    channel_id: 102,
    channel_name: 'west',
    model_name: 'claude-4-sonnet',
    quota: 80,
    token_used: 50,
    input_tokens: 40,
    prompt_tokens: 40,
    completion_tokens: 10,
    cache_tokens: 18,
    cache_write_tokens: 2,
    count: 1,
  },
]

describe('dashboard flow data', () => {
  test('builds user to token to channel links from quota rows', () => {
    const result = buildDashboardFlowData(rows, 'quota')

    assert.equal(result.summary.quota, 250)
    assert.equal(result.summary.tokens, 100)
    assert.equal(result.summary.requests, 7)
    assert.deepEqual(
      result.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
        link.requests,
      ]),
      [
        ['user:1', 'token:11', 150, 3],
        ['user:1', 'token:12', 30, 1],
        ['user:2', 'token:22', 70, 3],
        ['token:11', 'channel:101', 100, 2],
        ['token:11', 'channel:102', 50, 1],
        ['token:12', 'channel:103', 30, 1],
        ['token:22', 'channel:101', 70, 3],
      ]
    )
  })

  test('builds user to token to model links when model mode is selected', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model',
    })

    assert.deepEqual(
      result.flow.nodes.map((node) => [node.id, node.kind, node.label]),
      [
        ['user:1', 'user', 'alice'],
        ['user:2', 'user', 'bob'],
        ['token:11', 'token', 'primary'],
        ['token:22', 'token', 'backup'],
        ['token:12', 'token', 'secondary'],
        ['model:gpt-4.1', 'model', 'gpt-4.1'],
        ['model:claude-4-sonnet', 'model', 'claude-4-sonnet'],
      ]
    )
    assert.deepEqual(
      result.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
        link.requests,
      ]),
      [
        ['user:1', 'token:11', 150, 3],
        ['user:1', 'token:12', 30, 1],
        ['user:2', 'token:22', 70, 3],
        ['token:11', 'model:gpt-4.1', 150, 3],
        ['token:12', 'model:claude-4-sonnet', 30, 1],
        ['token:22', 'model:claude-4-sonnet', 70, 3],
      ]
    )
  })

  test('builds user to token to model to channel links when both dimensions are enabled', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model-channel',
    })

    assert.deepEqual(
      result.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
        link.requests,
      ]),
      [
        ['user:1', 'token:11', 150, 3],
        ['user:1', 'token:12', 30, 1],
        ['user:2', 'token:22', 70, 3],
        ['token:11', 'model:gpt-4.1', 150, 3],
        ['token:12', 'model:claude-4-sonnet', 30, 1],
        ['token:22', 'model:claude-4-sonnet', 70, 3],
        ['model:claude-4-sonnet', 'channel:101', 70, 3],
        ['model:claude-4-sonnet', 'channel:103', 30, 1],
        ['model:gpt-4.1', 'channel:101', 100, 2],
        ['model:gpt-4.1', 'channel:102', 50, 1],
      ]
    )
  })

  test('can hide the token layer while preserving user-model-channel order', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model-channel',
      includeTokenLayer: false,
    })

    assert.deepEqual(
      result.flow.nodes.map((node) => node.kind),
      ['user', 'user', 'model', 'model', 'channel', 'channel', 'channel']
    )
    assert.equal(
      result.flow.nodes.some((node) => node.kind === 'token'),
      false
    )
    assert.deepEqual(
      result.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
        link.requests,
      ]),
      [
        ['user:1', 'model:claude-4-sonnet', 30, 1],
        ['user:1', 'model:gpt-4.1', 150, 3],
        ['user:2', 'model:claude-4-sonnet', 70, 3],
        ['model:claude-4-sonnet', 'channel:101', 70, 3],
        ['model:claude-4-sonnet', 'channel:103', 30, 1],
        ['model:gpt-4.1', 'channel:101', 100, 2],
        ['model:gpt-4.1', 'channel:102', 50, 1],
      ]
    )
  })

  test('keeps downstream node colors stable when the token layer is hidden', () => {
    const palette = [
      '#101010',
      '#202020',
      '#303030',
      '#404040',
      '#505050',
      '#606060',
      '#707070',
      '#808080',
      '#909090',
      '#a0a0a0',
    ]
    const withTokenLayer = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model-channel',
      includeTokenLayer: true,
      colorPalette: palette,
    })
    const withoutTokenLayer = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model-channel',
      includeTokenLayer: false,
      colorPalette: palette,
    })
    const colorByID = (result: typeof withTokenLayer, id: string) => {
      const node = result.flow.nodes.find((item) => item.id === id)
      assert.ok(node)
      return node.color
    }

    for (const nodeID of [
      'user:1',
      'user:2',
      'model:claude-4-sonnet',
      'model:gpt-4.1',
      'channel:101',
      'channel:102',
      'channel:103',
    ]) {
      assert.equal(
        colorByID(withTokenLayer, nodeID),
        colorByID(withoutTokenLayer, nodeID)
      )
    }
  })

  test('can hide the token layer for single downstream dimensions', () => {
    const channelResult = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'channel',
      includeTokenLayer: false,
    })
    const modelResult = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model',
      includeTokenLayer: false,
    })

    assert.deepEqual(
      channelResult.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
      ]),
      [
        ['user:1', 'channel:101', 100],
        ['user:1', 'channel:102', 50],
        ['user:1', 'channel:103', 30],
        ['user:2', 'channel:101', 70],
      ]
    )
    assert.deepEqual(
      modelResult.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
      ]),
      [
        ['user:1', 'model:claude-4-sonnet', 30],
        ['user:1', 'model:gpt-4.1', 150],
        ['user:2', 'model:claude-4-sonnet', 70],
      ]
    )
  })

  test('filters by selected users and per-user selected tokens', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      pathMode: 'model-channel',
      selectedUsers: ['user:1'],
      selectedTokensByUser: {
        'user:1': ['token:12'],
      },
    })

    assert.equal(result.summary.quota, 30)
    assert.deepEqual(
      result.flow.links.map((link) => [link.source, link.target, link.value]),
      [
        ['user:1', 'token:12', 30],
        ['token:12', 'model:claude-4-sonnet', 30],
        ['model:claude-4-sonnet', 'channel:103', 30],
      ]
    )
  })

  test('builds user and token filter options with stable colors', () => {
    const options = buildFlowFilterOptions(rows, 'quota')

    assert.deepEqual(
      options.users.map((user) => [
        user.value,
        user.label,
        user.valueLabel,
        user.tokens.map((token) => [token.value, token.label]),
      ]),
      [
        [
          'user:1',
          'alice',
          '180',
          [
            ['token:11', 'primary'],
            ['token:12', 'secondary'],
          ],
        ],
        ['user:2', 'bob', '70', [['token:22', 'backup']]],
      ]
    )
    assert.notEqual(options.users[0].color, options.users[1].color)
  })

  test('uses non-cache input plus output tokens for token metric', () => {
    const result = buildDashboardFlowData(cacheRows, 'tokens', {
      pathMode: 'model-channel',
    })

    assert.equal(result.summary.tokens, 140)
    assert.equal(result.summary.inputTokens, 110)
    assert.equal(result.summary.completionTokens, 30)
    assert.equal(result.summary.cacheTokens, 43)
    assert.equal(result.summary.cacheWriteTokens, 7)
    assert.deepEqual(
      result.flow.links.map((link) => [
        link.source,
        link.target,
        link.value,
        link.inputTokens,
        link.completionTokens,
        link.cacheTokens,
        link.cacheWriteTokens,
      ]),
      [
        ['user:1', 'token:11', 90, 70, 20, 25, 5],
        ['user:2', 'token:22', 50, 40, 10, 18, 2],
        ['token:11', 'model:gpt-4.1', 90, 70, 20, 25, 5],
        ['token:22', 'model:claude-4-sonnet', 50, 40, 10, 18, 2],
        ['model:claude-4-sonnet', 'channel:102', 50, 40, 10, 18, 2],
        ['model:gpt-4.1', 'channel:101', 90, 70, 20, 25, 5],
      ]
    )
  })

  test('assigns globally distinct node colors and source-colored links while the palette is large enough', () => {
    const palette = [
      '#101010',
      '#202020',
      '#303030',
      '#404040',
      '#505050',
      '#606060',
      '#707070',
      '#808080',
    ]
    const result = buildDashboardFlowData(cacheRows, 'quota', {
      pathMode: 'model-channel',
      colorPalette: palette,
    })
    const nodeColors = result.flow.nodes.map((node) => node.color)
    const userDry = result.flow.nodes.find((node) => node.id === 'user:1')
    const tokenDry = result.flow.nodes.find((node) => node.id === 'token:11')
    const modelGpt = result.flow.nodes.find(
      (node) => node.id === 'model:gpt-4.1'
    )
    const linkUserToken = result.flow.links.find(
      (link) => link.source === 'user:1' && link.target === 'token:11'
    )
    const linkTokenModel = result.flow.links.find(
      (link) => link.source === 'token:11' && link.target === 'model:gpt-4.1'
    )
    const linkModelChannel = result.flow.links.find(
      (link) => link.source === 'model:gpt-4.1' && link.target === 'channel:101'
    )

    assert.ok(userDry)
    assert.ok(tokenDry)
    assert.ok(modelGpt)
    assert.equal(new Set(nodeColors).size, nodeColors.length)
    assert.equal(userDry.color, palette[0])
    assert.notEqual(userDry.color, tokenDry.color)
    assert.notEqual(tokenDry.color, modelGpt.color)
    assert.equal(linkUserToken?.color, userDry.color)
    assert.equal(linkUserToken?.hoverColor, linkUserToken?.color)
    assert.equal(linkTokenModel?.color, tokenDry.color)
    assert.equal(linkModelChannel?.color, modelGpt.color)
  })

  test('builds an interactive Sankey spec with in-chart labels and nested datum metrics', () => {
    const result = buildDashboardFlowData(cacheRows, 'quota', {
      pathMode: 'model-channel',
    })
    const flowSpec = buildFlowSankeySpec(result.flow, 'Flow')
    const values = flowSpec.data[0].values[0]
    const dryNode = values.nodes.find(
      (node: Record<string, unknown>) => node.key === 'user:1'
    )
    const dryLink = values.links.find(
      (link: Record<string, unknown>) =>
        link.source === 'user:1' && link.target === 'token:11'
    )

    assert.equal(flowSpec.type, 'sankey')
    assert.equal(flowSpec.title.text, 'Flow')
    assert.deepEqual(flowSpec.legends, { visible: false })
    assert.equal(flowSpec.label.visible, true)
    assert.equal(flowSpec.label.position, 'outside')
    assert.equal(flowSpec.node.interactive, true)
    assert.equal(flowSpec.link.interactive, true)
    assert.equal(flowSpec.link.state.hover.fillOpacity, 0.9)
    assert.equal(flowSpec.emphasis.enable, false)
    assert.equal(flowSpec.emphasis.trigger, 'hover')
    assert.equal(flowSpec.emphasis.effect, 'self')
    assert.equal(flowSpec.tooltip.trigger, 'hover')
    assert.equal(flowSpec.tooltip.activeType, 'mark')
    assert.equal(flowSpec.tooltip.dimension.visible, false)
    assert.equal(flowSpec.tooltip.group.visible, false)
    assert.equal(flowSpec.tooltip.mark.checkOverlap, true)
    assert.equal(flowSpec.tooltip.mark.visible({ datum: dryNode }), true)
    assert.equal(flowSpec.tooltip.mark.visible({ datum: dryLink }), true)
    assert.equal(flowSpec.animation, false)
    assert.equal(flowSpec.data[0].id, 'flow')
    assert.equal(values.nodes.length, 8)
    assert.equal(values.links.length, 6)
    assert.ok(dryNode)
    assert.ok(dryLink)
    assert.equal(dryNode.name, 'dry')
    assert.equal(dryNode.rawLabel, 'dry')
    assert.equal(
      values.nodes.some((node: Record<string, unknown>) =>
        /^(User|Key|Model|Channel): /.test(String(node.name))
      ),
      false
    )
    assert.equal(
      flowSpec.node.style.fill({
        datum: [dryNode],
        depth: 0,
      }),
      dryNode.color
    )
    assert.equal(
      flowSpec.link.style.fill({
        datum: dryLink,
      }),
      dryLink.linkColor
    )
    assert.equal(dryLink.color, dryNode.color)
    assert.match(dryLink.linkColor, /^rgba\(/)
    assert.notEqual(dryLink.linkColor, dryLink.color)
    assert.equal(
      flowSpec.link.state.hover.fill({
        datum: dryLink,
      }),
      dryLink.color
    )
    assert.equal(flowSpec.label.style.fill, '#475569')
    assert.equal(flowSpec.link.style.pickMode, 'accurate')
    assert.equal(flowSpec.link.style.boundsMode, 'accurate')
    assert.equal('pickStrokeBuffer' in flowSpec.link.style, false)
    assert.equal(flowSpec.linkSortBy({ value: 1 }, { value: 5 }), 4)
    assert.equal(
      flowSpec.link.style.zIndex({ datum: { value: 30 } }) >
        flowSpec.link.style.zIndex({ datum: { value: 150 } }),
      true
    )

    const tooltipRows = flowSpec.tooltip.mark.content
    assert.deepEqual(
      tooltipRows
        .filter((row: Record<string, unknown>) =>
          typeof row.visible === 'function'
            ? row.visible({ datum: dryNode })
            : true
        )
        .map((row: Record<string, unknown>) => [
          row.key,
          typeof row.value === 'function'
            ? row.value({ datum: dryNode })
            : row.value,
        ]),
      [
        ['Quota', '100'],
        ['Tokens', '90'],
        ['Input Tokens', '70'],
        ['Output Tokens', '20'],
        ['Cache Read', '25'],
        ['Cache Write', '5'],
        ['Requests', '2'],
      ]
    )
    assert.deepEqual(
      tooltipRows
        .filter((row: Record<string, unknown>) =>
          typeof row.visible === 'function'
            ? row.visible({ datum: dryLink })
            : true
        )
        .map((row: Record<string, unknown>) => [
          row.key,
          typeof row.value === 'function'
            ? row.value({ datum: dryLink })
            : row.value,
        ]),
      [
        ['Quota', '100'],
        ['Tokens', '90'],
        ['Input Tokens', '70'],
        ['Output Tokens', '20'],
        ['Cache Read', '25'],
        ['Cache Write', '5'],
        ['Requests', '2'],
        ['Share', '55.6%'],
      ]
    )
  })

  test('uses the shared dashboard VChart color palette', () => {
    const result = buildDashboardFlowData(cacheRows, 'quota', {
      pathMode: 'model-channel',
    })
    const expectedPalette = getDashboardChartColors(result.flow.nodes.length)
    const colors = Array.from(
      new Set(result.flow.nodes.map((node) => node.color))
    )

    assert.ok(colors.length > 1)
    assert.deepEqual(
      [...colors].sort(),
      expectedPalette.slice(0, colors.length).sort()
    )
    assert.equal(flowLabelFill(), '#475569')
  })

  test('orders Sankey links so thinner links are drawn after thicker links', () => {
    const result = buildDashboardFlowData(rows, 'quota')
    const flowSpec = buildFlowSankeySpec(result.flow, 'Flow')
    const values = flowSpec.data[0].values[0]
    const linkValues = values.links.map(
      (link: Record<string, unknown>) => link.value
    )

    assert.deepEqual(linkValues, [150, 100, 70, 70, 50, 30, 30])
    assert.equal(values.links.at(-1).value, 30)
  })

  test('makes thinner branches from the same source darker than thicker branches', () => {
    const branchRows: FlowQuotaDataItem[] = [
      {
        user_id: 1,
        username: 'source',
        token_id: 11,
        token_name: 'z-heavy',
        channel_id: 101,
        channel_name: 'east',
        model_name: 'gpt-4.1',
        quota: 100,
        prompt_tokens: 60,
        completion_tokens: 40,
        count: 10,
      },
      {
        user_id: 1,
        username: 'source',
        token_id: 12,
        token_name: 'a-light',
        channel_id: 102,
        channel_name: 'west',
        model_name: 'gpt-4.1',
        quota: 10,
        prompt_tokens: 6,
        completion_tokens: 4,
        count: 1,
      },
    ]
    const result = buildDashboardFlowData(branchRows, 'quota')
    const heavy = result.flow.links.find(
      (link) => link.source === 'user:1' && link.target === 'token:11'
    )
    const light = result.flow.links.find(
      (link) => link.source === 'user:1' && link.target === 'token:12'
    )

    assert.ok(heavy)
    assert.ok(light)
    assert.equal(heavy.color, light.color)
    assert.ok(alphaFromRgba(heavy.linkColor) < alphaFromRgba(light.linkColor))
  })

  test('assigns deterministic z-indexes for equal-value links', () => {
    const result = buildDashboardFlowData(rows, 'quota')
    const flowSpec = buildFlowSankeySpec(result.flow, 'Flow')
    const values = flowSpec.data[0].values[0]
    const equalValueLinks = values.links.filter(
      (link: Record<string, unknown>) => link.value === 30
    )
    const zIndexes = equalValueLinks.map((link: Record<string, unknown>) =>
      flowSpec.link.style.zIndex({ datum: link })
    )

    assert.equal(equalValueLinks.length, 2)
    assert.equal(new Set(zIndexes).size, equalValueLinks.length)
  })
})

function alphaFromRgba(color: string): number {
  const match = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/.exec(
    color
  )
  assert.ok(match)
  return Number(match[1])
}

function flowLabelFill(): string {
  return buildFlowSankeySpec({ nodes: [], links: [] }, 'Flow').label.style.fill
}
