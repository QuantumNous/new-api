/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type {
  DashboardFlowGraph,
  DashboardFlowLink,
  DashboardFlowNode,
  FlowBuildOptions,
  FlowFilterOptions,
  FlowMetric,
  FlowNodeKind,
  FlowPathMode,
  FlowQuotaDataItem,
  FlowSummary,
  ProcessedFlowData,
} from '@/features/dashboard/types'
import { getDashboardChartColors } from './charts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VChartSpec = Record<string, any>

type FlowMetrics = {
  quota: number
  tokens: number
  inputTokens: number
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  cacheWriteTokens: number
  requests: number
}

type FlowSankeyLabels = {
  quota: string
  tokens: string
  inputTokens: string
  outputTokens: string
  cacheRead: string
  cacheWrite: string
  requests: string
  share: string
}

const DEFAULT_FLOW_PATH_MODE: FlowPathMode = 'channel'

const DEFAULT_FLOW_SANKEY_LABELS: FlowSankeyLabels = {
  quota: 'Quota',
  tokens: 'Tokens',
  inputTokens: 'Input Tokens',
  outputTokens: 'Output Tokens',
  cacheRead: 'Cache Read',
  cacheWrite: 'Cache Write',
  requests: 'Requests',
  share: 'Share',
}

const DEFAULT_FLOW_CHART_COLOR = '#1664FF'

function numberValue(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function requestCount(row: FlowQuotaDataItem): number {
  return numberValue(row.count)
}

function tokenCount(row: FlowQuotaDataItem): number {
  const computed = inputTokenCount(row) + numberValue(row.completion_tokens)
  if (computed > 0) return computed
  return numberValue(row.token_used)
}

function cacheReadTokenCount(row: FlowQuotaDataItem): number {
  return numberValue(row.cache_tokens)
}

function cacheWriteTokenCount(row: FlowQuotaDataItem): number {
  return numberValue(row.cache_write_tokens)
}

function inputTokenCount(row: FlowQuotaDataItem): number {
  const explicitInputTokens = numberValue(row.input_tokens)
  if (explicitInputTokens > 0) return explicitInputTokens

  const promptTokens = numberValue(row.prompt_tokens)
  const cacheTokens = cacheReadTokenCount(row)
  const cacheWriteTokens = cacheWriteTokenCount(row)
  if (cacheTokens > 0 || cacheWriteTokens > 0) {
    return Math.max(promptTokens - cacheTokens - cacheWriteTokens, 0)
  }
  return promptTokens
}

function rowMetrics(row: FlowQuotaDataItem): FlowMetrics {
  const promptTokens = numberValue(row.prompt_tokens)
  const completionTokens = numberValue(row.completion_tokens)
  const inputTokens = inputTokenCount(row)
  const cacheTokens = cacheReadTokenCount(row)
  const cacheWriteTokens = cacheWriteTokenCount(row)
  return {
    quota: numberValue(row.quota),
    tokens: tokenCount(row),
    inputTokens,
    promptTokens,
    completionTokens,
    cacheTokens,
    cacheWriteTokens,
    requests: requestCount(row),
  }
}

function metricValue(metrics: FlowMetrics, metric: FlowMetric): number {
  if (metric === 'requests') return metrics.requests
  if (metric === 'tokens') return metrics.tokens
  return metrics.quota
}

function userNodeId(row: FlowQuotaDataItem): string {
  return `user:${numberValue(row.user_id)}`
}

function tokenNodeId(row: FlowQuotaDataItem): string {
  const tokenID = numberValue(row.token_id)
  if (tokenID > 0) return `token:${tokenID}`
  return `token:${row.token_name || 'unknown'}`
}

function modelNodeId(row: FlowQuotaDataItem): string {
  return `model:${row.model_name || 'unknown'}`
}

function channelNodeId(row: FlowQuotaDataItem): string {
  const channelID = numberValue(row.channel_id)
  if (channelID > 0) return `channel:${channelID}`
  return `channel:${row.channel_name || 'unknown'}`
}

function userLabel(row: FlowQuotaDataItem): string {
  const userID = numberValue(row.user_id)
  return row.username || (userID > 0 ? `user-${userID}` : 'Unknown User')
}

function tokenLabel(row: FlowQuotaDataItem): string {
  const tokenID = numberValue(row.token_id)
  return row.token_name || (tokenID > 0 ? `token-${tokenID}` : 'Unknown Token')
}

function modelLabel(row: FlowQuotaDataItem): string {
  return row.model_name || 'Unknown Model'
}

function channelLabel(row: FlowQuotaDataItem): string {
  const channelID = numberValue(row.channel_id)
  return (
    row.channel_name || (channelID > 0 ? `channel-${channelID}` : 'Unknown')
  )
}

function formatNumber(value: number): string {
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value
  )
}

function colorAt(index: number, palette?: readonly string[]): string {
  const colors =
    palette && palette.length > 0 ? palette : getDashboardChartColors(index + 1)
  if (colors.length === 0) return DEFAULT_FLOW_CHART_COLOR
  return colors[index % colors.length] ?? DEFAULT_FLOW_CHART_COLOR
}

function colorPalette(
  colorCount: number,
  palette?: readonly string[]
): readonly string[] {
  if (palette && palette.length > 0) return palette
  const colors = getDashboardChartColors(colorCount)
  return colors.length > 0 ? colors : [DEFAULT_FLOW_CHART_COLOR]
}

function alphaColor(
  color: string,
  alpha: number
): { color: string; alpha: number } {
  const normalized = color.trim()
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return { color: normalized, alpha }
  }

  const value = Number.parseInt(hex, 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return {
    color: `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`,
    alpha: 1,
  }
}

function stableColorMap(
  keys: string[],
  palette?: readonly string[]
): Map<string, string> {
  const map = new Map<string, string>()
  const uniqueKeys = Array.from(new Set(keys))
  const colors = colorPalette(uniqueKeys.length, palette)
  uniqueKeys.forEach((key, index) => {
    map.set(key, colorAt(index, colors))
  })
  return map
}

function userColorMap(
  rows: FlowQuotaDataItem[],
  palette?: readonly string[]
): Map<string, string> {
  return stableColorMap(sortedUniqueNodeIds(rows, userNodeId), palette)
}

function sortedUniqueNodeIds(
  rows: FlowQuotaDataItem[],
  idForRow: (row: FlowQuotaDataItem) => string
): string[] {
  return Array.from(new Set(rows.map(idForRow))).sort((a, b) =>
    a.localeCompare(b)
  )
}

function flowColorMap(
  rows: FlowQuotaDataItem[],
  palette?: readonly string[]
): Map<string, string> {
  const keys = [
    ...sortedUniqueNodeIds(rows, userNodeId),
    ...sortedUniqueNodeIds(rows, tokenNodeId),
    ...sortedUniqueNodeIds(rows, modelNodeId),
    ...sortedUniqueNodeIds(rows, channelNodeId),
  ]
  return stableColorMap(keys, palette)
}

function filterRows(
  rows: FlowQuotaDataItem[],
  options: FlowBuildOptions = {}
): FlowQuotaDataItem[] {
  const selectedUsers = new Set(options.selectedUsers ?? [])
  const selectedTokensByUser = options.selectedTokensByUser ?? {}

  return rows.filter((row) => {
    const userID = userNodeId(row)
    const tokenID = tokenNodeId(row)
    if (selectedUsers.size > 0 && !selectedUsers.has(userID)) return false

    const selectedTokens = selectedTokensByUser[userID] ?? []
    if (selectedTokens.length > 0 && !selectedTokens.includes(tokenID)) {
      return false
    }
    return true
  })
}

function addNode(
  map: Map<string, DashboardFlowNode>,
  id: string,
  label: string,
  kind: FlowNodeKind,
  metrics: FlowMetrics,
  metric: FlowMetric,
  color: string,
  colorKey: string
): void {
  const previous = map.get(id) ?? {
    id,
    label,
    kind,
    value: 0,
    requests: 0,
    quota: 0,
    tokens: 0,
    inputTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheTokens: 0,
    cacheWriteTokens: 0,
    color,
    colorKey,
  }
  previous.value += metricValue(metrics, metric)
  previous.requests += metrics.requests
  previous.quota += metrics.quota
  previous.tokens += metrics.tokens
  previous.inputTokens += metrics.inputTokens
  previous.promptTokens += metrics.promptTokens
  previous.completionTokens += metrics.completionTokens
  previous.cacheTokens += metrics.cacheTokens
  previous.cacheWriteTokens += metrics.cacheWriteTokens
  map.set(id, previous)
}

function addLink(
  map: Map<string, DashboardFlowLink>,
  source: string,
  target: string,
  sourceLabel: string,
  targetLabel: string,
  metrics: FlowMetrics,
  metric: FlowMetric,
  color: string,
  colorKey: string
): void {
  const key = `${source}\u0000${target}`
  const previous = map.get(key) ?? {
    source,
    target,
    value: 0,
    requests: 0,
    quota: 0,
    tokens: 0,
    inputTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheTokens: 0,
    cacheWriteTokens: 0,
    sourceLabel,
    targetLabel,
    color,
    linkColor: color,
    linkAlpha: 1,
    hoverColor: color,
    colorKey,
    share: 0,
  }
  previous.value += metricValue(metrics, metric)
  previous.requests += metrics.requests
  previous.quota += metrics.quota
  previous.tokens += metrics.tokens
  previous.inputTokens += metrics.inputTokens
  previous.promptTokens += metrics.promptTokens
  previous.completionTokens += metrics.completionTokens
  previous.cacheTokens += metrics.cacheTokens
  previous.cacheWriteTokens += metrics.cacheWriteTokens
  map.set(key, previous)
}

function assignLinkDisplayColors(links: DashboardFlowLink[]): void {
  const linksBySource = new Map<string, DashboardFlowLink[]>()
  for (const link of links) {
    const sourceLinks = linksBySource.get(link.source) ?? []
    sourceLinks.push(link)
    linksBySource.set(link.source, sourceLinks)
  }

  for (const sourceLinks of linksBySource.values()) {
    const sortedLinks = [...sourceLinks].sort(
      (a, b) =>
        b.value - a.value || linkStableKey(a).localeCompare(linkStableKey(b))
    )
    const denominator = Math.max(sortedLinks.length - 1, 1)
    sortedLinks.forEach((link, index) => {
      const alpha =
        sortedLinks.length === 1 ? 0.34 : 0.24 + (index / denominator) * 0.2
      const displayColor = alphaColor(link.color, alpha)
      link.linkColor = displayColor.color
      link.linkAlpha = displayColor.alpha
      link.hoverColor = link.color
    })
  }
}

function byValueThenLabel<T extends { value: number; label: string }>(
  a: T,
  b: T
): number {
  return b.value - a.value || a.label.localeCompare(b.label)
}

function linkStableKey(link: Pick<DashboardFlowLink, 'source' | 'target'>) {
  return `${link.source}\u0000${link.target}`
}

function byLinkDrawPriority(
  a: DashboardFlowLink,
  b: DashboardFlowLink
): number {
  return b.value - a.value || linkStableKey(a).localeCompare(linkStableKey(b))
}

function buildSummary(rows: FlowQuotaDataItem[]): FlowSummary {
  return rows.reduce<FlowSummary>(
    (summary, row) => {
      const metrics = rowMetrics(row)
      summary.quota += metrics.quota
      summary.tokens += metrics.tokens
      summary.inputTokens += metrics.inputTokens
      summary.completionTokens += metrics.completionTokens
      summary.cacheTokens += metrics.cacheTokens
      summary.cacheWriteTokens += metrics.cacheWriteTokens
      summary.requests += metrics.requests
      return summary
    },
    {
      quota: 0,
      tokens: 0,
      inputTokens: 0,
      completionTokens: 0,
      cacheTokens: 0,
      cacheWriteTokens: 0,
      requests: 0,
    }
  )
}

function buildFlowGraph(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric,
  pathMode: FlowPathMode = DEFAULT_FLOW_PATH_MODE,
  includeTokenLayer = true,
  palette?: readonly string[]
): DashboardFlowGraph {
  const userNodes = new Map<string, DashboardFlowNode>()
  const tokenNodes = new Map<string, DashboardFlowNode>()
  const modelNodes = new Map<string, DashboardFlowNode>()
  const channelNodes = new Map<string, DashboardFlowNode>()
  const userTokenLinks = new Map<string, DashboardFlowLink>()
  const userModelLinks = new Map<string, DashboardFlowLink>()
  const userChannelLinks = new Map<string, DashboardFlowLink>()
  const tokenModelLinks = new Map<string, DashboardFlowLink>()
  const tokenChannelLinks = new Map<string, DashboardFlowLink>()
  const modelChannelLinks = new Map<string, DashboardFlowLink>()
  const colors = flowColorMap(rows, palette)

  for (const row of rows) {
    const metrics = rowMetrics(row)
    const userID = userNodeId(row)
    const tokenID = tokenNodeId(row)
    const modelID = modelNodeId(row)
    const channelID = channelNodeId(row)
    const userColor = colors.get(userID) ?? colorAt(0, palette)
    const tokenColor = colors.get(tokenID) ?? userColor
    const modelColor = colors.get(modelID) ?? userColor
    const channelColor = colors.get(channelID) ?? modelColor

    addNode(
      userNodes,
      userID,
      userLabel(row),
      'user',
      metrics,
      metric,
      userColor,
      userID
    )

    if (includeTokenLayer) {
      addNode(
        tokenNodes,
        tokenID,
        tokenLabel(row),
        'token',
        metrics,
        metric,
        tokenColor,
        tokenID
      )
      addLink(
        userTokenLinks,
        userID,
        tokenID,
        userLabel(row),
        tokenLabel(row),
        metrics,
        metric,
        userColor,
        userID
      )
    }

    if (pathMode === 'model' || pathMode === 'model-channel') {
      addNode(
        modelNodes,
        modelID,
        modelLabel(row),
        'model',
        metrics,
        metric,
        modelColor,
        modelID
      )
      const modelSourceID = includeTokenLayer ? tokenID : userID
      const modelSourceLabel = includeTokenLayer
        ? tokenLabel(row)
        : userLabel(row)
      const modelSourceColor = includeTokenLayer ? tokenColor : userColor
      const modelSourceColorKey = includeTokenLayer ? tokenID : userID
      addLink(
        includeTokenLayer ? tokenModelLinks : userModelLinks,
        modelSourceID,
        modelID,
        modelSourceLabel,
        modelLabel(row),
        metrics,
        metric,
        modelSourceColor,
        modelSourceColorKey
      )
    }

    if (pathMode === 'channel' || pathMode === 'model-channel') {
      addNode(
        channelNodes,
        channelID,
        channelLabel(row),
        'channel',
        metrics,
        metric,
        channelColor,
        channelID
      )
    }

    if (pathMode === 'channel') {
      const channelSourceID = includeTokenLayer ? tokenID : userID
      const channelSourceLabel = includeTokenLayer
        ? tokenLabel(row)
        : userLabel(row)
      const channelSourceColor = includeTokenLayer ? tokenColor : userColor
      const channelSourceColorKey = includeTokenLayer ? tokenID : userID
      addLink(
        includeTokenLayer ? tokenChannelLinks : userChannelLinks,
        channelSourceID,
        channelID,
        channelSourceLabel,
        channelLabel(row),
        metrics,
        metric,
        channelSourceColor,
        channelSourceColorKey
      )
    }

    if (pathMode === 'model-channel') {
      addLink(
        modelChannelLinks,
        modelID,
        channelID,
        modelLabel(row),
        channelLabel(row),
        metrics,
        metric,
        modelColor,
        modelID
      )
    }
  }

  const links = [
    ...Array.from(userTokenLinks.values()).sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    ),
    ...Array.from(userModelLinks.values()).sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    ),
    ...Array.from(userChannelLinks.values()).sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    ),
    ...Array.from(tokenModelLinks.values()).sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    ),
    ...Array.from(tokenChannelLinks.values()).sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    ),
    ...Array.from(modelChannelLinks.values()).sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    ),
  ]
  const total = links
    .filter((link) => link.source.startsWith('user:'))
    .reduce((sum, link) => sum + link.value, 0)
  for (const link of links) {
    link.share = total > 0 ? link.value / total : 0
  }
  assignLinkDisplayColors(links)

  return {
    nodes: [
      ...Array.from(userNodes.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      ...Array.from(tokenNodes.values()).sort(byValueThenLabel),
      ...Array.from(modelNodes.values()).sort(byValueThenLabel),
      ...Array.from(channelNodes.values()).sort(byValueThenLabel),
    ],
    links,
  }
}

export function buildFlowFilterOptions(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric = 'quota',
  palette?: readonly string[]
): FlowFilterOptions {
  const users = new Map<
    string,
    {
      label: string
      value: number
      color: string
      tokens: Map<string, { label: string; value: number }>
    }
  >()
  const colors = userColorMap(rows, palette)

  for (const row of rows) {
    const userID = userNodeId(row)
    const tokenID = tokenNodeId(row)
    const metrics = rowMetrics(row)
    const value = metricValue(metrics, metric)
    const user = users.get(userID) ?? {
      label: userLabel(row),
      value: 0,
      color: colors.get(userID) ?? colorAt(0, palette),
      tokens: new Map<string, { label: string; value: number }>(),
    }
    user.value += value
    const token = user.tokens.get(tokenID) ?? {
      label: tokenLabel(row),
      value: 0,
    }
    token.value += value
    user.tokens.set(tokenID, token)
    users.set(userID, user)
  }

  return {
    users: Array.from(users.entries())
      .map(([value, user]) => ({
        value,
        label: user.label,
        valueLabel: formatNumber(user.value),
        valueRaw: user.value,
        color: user.color,
        tokens: Array.from(user.tokens.entries())
          .map(([tokenValue, token]) => ({
            value: tokenValue,
            label: token.label,
            valueLabel: formatNumber(token.value),
            valueRaw: token.value,
          }))
          .sort(
            (a, b) => b.valueRaw - a.valueRaw || a.label.localeCompare(b.label)
          ),
      }))
      .sort(
        (a, b) => b.valueRaw - a.valueRaw || a.label.localeCompare(b.label)
      ),
  }
}

export function buildDashboardFlowData(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric = 'quota',
  options: FlowBuildOptions = {}
): ProcessedFlowData {
  const pathMode = options.pathMode ?? DEFAULT_FLOW_PATH_MODE
  const includeTokenLayer = options.includeTokenLayer ?? true
  const filteredRows = filterRows(rows, options)
  const palette = options.colorPalette

  return {
    summary: buildSummary(filteredRows),
    flow: buildFlowGraph(
      filteredRows,
      metric,
      pathMode,
      includeTokenLayer,
      palette
    ),
    filterOptions: buildFlowFilterOptions(rows, metric, palette),
  }
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined
}

function sankeyDatumSource(
  datum: Record<string, unknown>
): Record<string, unknown> {
  const nested = datum.datum
  if (Array.isArray(nested)) {
    const depth = numberValue(datum.depth)
    return recordValue(nested[depth]) ?? recordValue(nested[0]) ?? datum
  }
  return recordValue(nested) ?? datum
}

function sankeyDatumValue(
  datum: Record<string, unknown>,
  key: string
): unknown {
  if (datum[key] !== undefined) return datum[key]
  return sankeyDatumSource(datum)[key]
}

function isSankeyLinkDatum(datum: Record<string, unknown>): boolean {
  return (
    sankeyDatumValue(datum, 'source') !== undefined &&
    sankeyDatumValue(datum, 'target') !== undefined
  )
}

function tooltipMetricLines(
  valueFormatter: (value: number) => string,
  labels: FlowSankeyLabels
) {
  const metricValue = (datum: Record<string, unknown>, key: string) =>
    numberValue(sankeyDatumValue(datum, key))
  const formattedNumber = (datum: Record<string, unknown>, key: string) =>
    formatNumber(metricValue(datum, key))
  const hasMetric = (datum: Record<string, unknown>, key: string) =>
    metricValue(datum, key) > 0

  return [
    {
      key: labels.quota,
      value: (datum: Record<string, unknown>) =>
        valueFormatter(metricValue(datum, 'quota')),
    },
    {
      key: labels.tokens,
      value: (datum: Record<string, unknown>) =>
        formattedNumber(datum, 'tokens'),
    },
    {
      key: labels.inputTokens,
      value: (datum: Record<string, unknown>) =>
        formattedNumber(datum, 'inputTokens'),
    },
    {
      key: labels.outputTokens,
      value: (datum: Record<string, unknown>) =>
        formattedNumber(datum, 'completionTokens'),
    },
    {
      key: labels.cacheRead,
      value: (datum: Record<string, unknown>) =>
        formattedNumber(datum, 'cacheTokens'),
      visible: (datum: Record<string, unknown>) =>
        hasMetric(datum, 'cacheTokens'),
    },
    {
      key: labels.cacheWrite,
      value: (datum: Record<string, unknown>) =>
        formattedNumber(datum, 'cacheWriteTokens'),
      visible: (datum: Record<string, unknown>) =>
        hasMetric(datum, 'cacheWriteTokens'),
    },
    {
      key: labels.requests,
      value: (datum: Record<string, unknown>) =>
        formattedNumber(datum, 'requests'),
    },
    {
      key: labels.share,
      value: (datum: Record<string, unknown>) =>
        `${(metricValue(datum, 'share') * 100).toFixed(1)}%`,
      visible: (datum: Record<string, unknown>) => hasMetric(datum, 'share'),
    },
  ]
}

export function buildFlowSankeySpec(
  flow: DashboardFlowGraph,
  title: string,
  valueFormatter: (value: number) => string = formatNumber,
  labels: FlowSankeyLabels = DEFAULT_FLOW_SANKEY_LABELS
): VChartSpec {
  return {
    type: 'sankey',
    data: [
      {
        id: 'flow',
        values: [
          {
            nodes: flow.nodes.map((node) => ({
              key: node.id,
              name: node.label,
              rawLabel: node.label,
              kind: node.kind,
              value: node.value,
              requests: node.requests,
              quota: node.quota,
              tokens: node.tokens,
              inputTokens: node.inputTokens,
              promptTokens: node.promptTokens,
              completionTokens: node.completionTokens,
              cacheTokens: node.cacheTokens,
              cacheWriteTokens: node.cacheWriteTokens,
              color: node.color,
              colorKey: node.colorKey,
            })),
            links: flow.links
              .filter((link) => link.value > 0)
              .sort(byLinkDrawPriority)
              .map((link, index) => ({
                source: link.source,
                target: link.target,
                linkKey: linkStableKey(link),
                sourceLabel: link.sourceLabel,
                targetLabel: link.targetLabel,
                value: link.value,
                requests: link.requests,
                quota: link.quota,
                tokens: link.tokens,
                inputTokens: link.inputTokens,
                promptTokens: link.promptTokens,
                completionTokens: link.completionTokens,
                cacheTokens: link.cacheTokens,
                cacheWriteTokens: link.cacheWriteTokens,
                color: link.color,
                linkColor: link.linkColor,
                linkAlpha: link.linkAlpha,
                hoverColor: link.hoverColor,
                colorKey: link.colorKey,
                share: link.share,
                zIndex: index,
              })),
          },
        ],
      },
    ],
    categoryField: 'name',
    sourceField: 'source',
    targetField: 'target',
    valueField: 'value',
    nodeKey: 'key',
    direction: 'horizontal',
    nodeAlign: 'justify',
    crossNodeAlign: 'middle',
    linkSortBy: (
      a: { value?: number; source?: string; target?: string; index?: number },
      b: { value?: number; source?: string; target?: string; index?: number }
    ) =>
      numberValue(b.value) - numberValue(a.value) ||
      `${a.source ?? ''}\u0000${a.target ?? ''}`.localeCompare(
        `${b.source ?? ''}\u0000${b.target ?? ''}`
      ) ||
      numberValue(a.index) - numberValue(b.index),
    nodeGap: 14,
    nodeWidth: 16,
    minLinkHeight: 2,
    minNodeHeight: 8,
    title: {
      visible: false,
      text: title,
    },
    legends: { visible: false },
    label: {
      visible: true,
      position: 'outside',
      limit: 220,
      interactive: false,
      style: {
        fill: '#475569',
        fontSize: 11,
        fontWeight: 600,
      },
    },
    node: {
      interactive: true,
      style: {
        fill: (datum: Record<string, unknown>) =>
          String(sankeyDatumValue(datum, 'color') ?? colorAt(0)),
        fillOpacity: 0.92,
        stroke: 'rgba(148, 163, 184, 0.45)',
        lineWidth: 1,
        cursor: 'pointer',
        pickMode: 'accurate',
      },
      state: {
        hover: {
          fillOpacity: 1,
          stroke: 'rgba(15, 23, 42, 0.68)',
          lineWidth: 1.5,
        },
        selected: {
          fillOpacity: 1,
          stroke: 'rgba(15, 23, 42, 0.68)',
          lineWidth: 1.5,
        },
        blur: {
          fillOpacity: 0.22,
        },
      },
    },
    link: {
      interactive: true,
      style: {
        fill: (datum: Record<string, unknown>) =>
          String(
            sankeyDatumValue(datum, 'linkColor') ??
              sankeyDatumValue(datum, 'color') ??
              colorAt(0)
          ),
        fillOpacity: (datum: Record<string, unknown>) =>
          numberValue(sankeyDatumValue(datum, 'linkAlpha')) || 1,
        cursor: 'pointer',
        pickMode: 'accurate',
        boundsMode: 'accurate',
        zIndex: (datum: Record<string, unknown>) => {
          const zIndex = sankeyDatumValue(datum, 'zIndex')
          if (zIndex !== undefined) return numberValue(zIndex)
          return 1_000_000_000 - numberValue(sankeyDatumValue(datum, 'value'))
        },
      },
      state: {
        hover: {
          fill: (datum: Record<string, unknown>) =>
            String(
              sankeyDatumValue(datum, 'hoverColor') ??
                sankeyDatumValue(datum, 'color') ??
                colorAt(0)
            ),
          fillOpacity: 0.9,
        },
        selected: {
          fill: (datum: Record<string, unknown>) =>
            String(
              sankeyDatumValue(datum, 'hoverColor') ??
                sankeyDatumValue(datum, 'color') ??
                colorAt(0)
            ),
          fillOpacity: 0.9,
        },
        blur: {
          fillOpacity: 0.22,
        },
      },
    },
    emphasis: { enable: false, trigger: 'hover', effect: 'self' },
    tooltip: {
      trigger: 'hover',
      activeType: 'mark',
      dimension: { visible: false },
      group: { visible: false },
      mark: {
        checkOverlap: true,
        positionMode: 'pointer',
        visible: (datum: Record<string, unknown>) =>
          isSankeyLinkDatum(datum) ||
          sankeyDatumValue(datum, 'key') !== undefined,
        title: {
          value: (datum: Record<string, unknown>) => {
            const source = sankeyDatumValue(datum, 'source')
            const target = sankeyDatumValue(datum, 'target')
            if (source && target) {
              const sourceLabel = sankeyDatumValue(datum, 'sourceLabel')
              const targetLabel = sankeyDatumValue(datum, 'targetLabel')
              return `${sourceLabel ?? source} -> ${targetLabel ?? target}`
            }
            return `${sankeyDatumValue(datum, 'name') ?? sankeyDatumValue(datum, 'rawLabel') ?? ''}`
          },
        },
        content: tooltipMetricLines(valueFormatter, labels),
      },
    },
    background: { fill: 'transparent' },
    animation: false,
  }
}
