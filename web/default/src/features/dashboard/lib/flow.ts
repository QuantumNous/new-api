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
  FlowLinkSelection,
  FlowMetric,
  FlowNodeFilter,
  FlowNodeKind,
  FlowOverflowMode,
  FlowQuotaDataItem,
  FlowRole,
  FlowSankeyData,
  FlowSankeyLinkDatum,
  FlowSankeyNodeDatum,
  FlowSummary,
  ProcessedFlowData,
} from '@/features/dashboard/types'
import { getCurrentIntlLocale } from '@/i18n/languages'

import { USER_CHART_COLORS } from './chart-palette'

type FlowMetrics = {
  quota: number
  tokens: number
  requests: number
}

type FlowPathNode = {
  id: string
  label: string
  kind: FlowNodeKind
}

type PreparedFlowPath = {
  path: FlowPathNode[]
  metrics: FlowMetrics
}

type FlowNodeRank = {
  node: FlowPathNode
  value: number
}

type FlowPathContext = {
  deletedTokenLabel?: (tokenId: number) => string
}

type FlowGraphOptions = {
  topNodeLimit?: number
  overflowMode?: FlowOverflowMode
  otherNodeLabel?: (kind: FlowNodeKind) => string
  activeNode?: FlowNodeFilter
  activeLink?: FlowLinkSelection
  maskSensitive?: boolean
}

type FlowHighlightSets = {
  nodes: Set<string>
  links: Set<string>
}

const EMPTY_FLOW_PATH_CONTEXT: FlowPathContext = {}

const DEFAULT_FLOW_ROLE: FlowRole = 'user'

const DEFAULT_FLOW_OVERFLOW_MODE: FlowOverflowMode = 'aggregate'

const DEFAULT_FLOW_CHART_COLOR = '#1664FF'

const FLOW_NODE_KINDS: readonly FlowNodeKind[] = [
  'user',
  'node',
  'token',
  'group',
  'model',
  'channel',
]
const FLOW_NODE_KIND_SET = new Set<FlowNodeKind>(FLOW_NODE_KINDS)

const OTHER_FLOW_NODE_IDS: Record<FlowNodeKind, string> = {
  user: 'user:__other__',
  node: 'node:__other__',
  token: 'token:__other__',
  group: 'group:__other__',
  model: 'model:__other__',
  channel: 'channel:__other__',
}

const DEFAULT_OTHER_FLOW_NODE_LABELS: Record<FlowNodeKind, string> = {
  user: 'Other users',
  node: 'Other nodes',
  token: 'Other tokens',
  group: 'Other groups',
  model: 'Other models',
  channel: 'Other channels',
}

// Kinds whose labels can leak identity (people, keys, infra, business setup).
// Model names are public, so they stay visible even when masking is on.
const SENSITIVE_FLOW_KINDS = new Set<FlowNodeKind>([
  'user',
  'node',
  'token',
  'group',
  'channel',
])

const OTHER_FLOW_NODE_ID_SET = new Set<string>(
  Object.values(OTHER_FLOW_NODE_IDS)
)

function numberValue(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isFlowNodeKind(value: unknown): value is FlowNodeKind {
  return (
    typeof value === 'string' && FLOW_NODE_KIND_SET.has(value as FlowNodeKind)
  )
}

function rowMetrics(row: FlowQuotaDataItem): FlowMetrics {
  return {
    quota: numberValue(row.quota),
    tokens: numberValue(row.token_used),
    requests: numberValue(row.count),
  }
}

function metricValue(metrics: FlowMetrics, metric: FlowMetric): number {
  if (metric === 'requests') return metrics.requests
  if (metric === 'tokens') return metrics.tokens
  return metrics.quota
}

function userNode(row: FlowQuotaDataItem): FlowPathNode {
  const userID = numberValue(row.user_id)
  return {
    id: userID > 0 ? `user:${userID}` : `user:${row.username || 'unknown'}`,
    label: row.username || (userID > 0 ? `user-${userID}` : 'Unknown User'),
    kind: 'user',
  }
}

function nodeNameNode(row: FlowQuotaDataItem): FlowPathNode {
  const nodeName = row.node_name || 'default-node'
  return {
    id: `node:${nodeName}`,
    label: nodeName,
    kind: 'node',
  }
}

function tokenNode(row: FlowQuotaDataItem, ctx: FlowPathContext): FlowPathNode {
  const tokenID = numberValue(row.token_id)
  return {
    id:
      tokenID > 0 ? `token:${tokenID}` : `token:${row.token_name || 'unknown'}`,
    label: row.token_name || deletedTokenLabel(tokenID, ctx),
    kind: 'token',
  }
}

function deletedTokenLabel(tokenID: number, ctx: FlowPathContext): string {
  if (tokenID <= 0) return 'Unknown Token'
  return ctx.deletedTokenLabel?.(tokenID) ?? `token-${tokenID}`
}

function groupNode(row: FlowQuotaDataItem): FlowPathNode {
  const useGroup = row.use_group || 'unknown'
  return {
    id: `group:${useGroup}`,
    label: useGroup,
    kind: 'group',
  }
}

function modelNode(row: FlowQuotaDataItem): FlowPathNode {
  const model = row.model_name || 'unknown'
  return {
    id: `model:${model}`,
    label: row.model_name || 'Unknown Model',
    kind: 'model',
  }
}

function channelNode(row: FlowQuotaDataItem): FlowPathNode {
  const channelID = numberValue(row.channel_id)
  return {
    id:
      channelID > 0
        ? `channel:${channelID}`
        : `channel:${row.channel_name || 'unknown'}`,
    label:
      row.channel_name || (channelID > 0 ? `channel-${channelID}` : 'Unknown'),
    kind: 'channel',
  }
}

const NODE_BUILDERS: Record<
  FlowNodeKind,
  (row: FlowQuotaDataItem, ctx: FlowPathContext) => FlowPathNode
> = {
  user: userNode,
  node: nodeNameNode,
  token: tokenNode,
  group: groupNode,
  model: modelNode,
  channel: channelNode,
}

const ROLE_FLOW_STAGES: Record<FlowRole, FlowNodeKind[]> = {
  root: ['user', 'node', 'token', 'group', 'model', 'channel'],
  admin: ['user', 'group', 'model', 'channel'],
  user: ['token', 'group', 'model'],
}

// A Sankey needs at least two columns to draw any link, so hiding stages can
// never collapse the path below this many columns.
const MIN_FLOW_STAGES = 2

export function getFlowStages(role: FlowRole): FlowNodeKind[] {
  return ROLE_FLOW_STAGES[role] ?? ROLE_FLOW_STAGES.user
}

function resolveVisibleStages(
  role: FlowRole,
  visibleStages?: FlowNodeKind[]
): FlowNodeKind[] {
  const stages = getFlowStages(role)
  if (!visibleStages) return stages
  const visible = new Set(visibleStages)
  const filtered = stages.filter((stage) => visible.has(stage))
  return filtered.length >= MIN_FLOW_STAGES ? filtered : stages
}

function flowPathForStages(
  row: FlowQuotaDataItem,
  stages: FlowNodeKind[],
  ctx: FlowPathContext = EMPTY_FLOW_PATH_CONTEXT
): FlowPathNode[] {
  return stages.map((stage) => NODE_BUILDERS[stage](row, ctx))
}

// Link colors are derived by blending alpha into the node color, and the Sankey
// paints them as SVG fills, so the flow palette must be resolved hex rather
// than the CSS variables the DOM-based dashboard charts use.
function colorAt(index: number, palette?: readonly string[]): string {
  const colors = palette && palette.length > 0 ? palette : USER_CHART_COLORS
  if (colors.length === 0) return DEFAULT_FLOW_CHART_COLOR
  return colors[index % colors.length] ?? DEFAULT_FLOW_CHART_COLOR
}

function stableColorMap(
  keys: string[],
  palette?: readonly string[]
): Map<string, string> {
  const map = new Map<string, string>()
  const uniqueKeys = [...new Set(keys)]
  uniqueKeys.forEach((key, index) => {
    map.set(key, colorAt(index, palette))
  })
  return map
}

function filterRows(
  rows: FlowQuotaDataItem[],
  options: FlowBuildOptions = {}
): FlowQuotaDataItem[] {
  const selectedUsers = new Set(options.selectedUsers ?? [])
  if (selectedUsers.size === 0) return rows
  return rows.filter((row) => selectedUsers.has(userNode(row).id))
}

function nodeFilterKey(filter: FlowNodeFilter): string {
  return `${filter.kind}\u0000${filter.id}`
}

function normalizeSelectedNodeFilters(
  selectedNodes: readonly FlowNodeFilter[] | undefined,
  stages: readonly FlowNodeKind[]
): Map<FlowNodeKind, Set<string>> {
  const visibleKinds = new Set(stages)
  const filters = new Map<FlowNodeKind, Set<string>>()

  for (const filter of selectedNodes ?? []) {
    if (!visibleKinds.has(filter.kind)) continue
    const selected = filters.get(filter.kind) ?? new Set<string>()
    selected.add(filter.id)
    filters.set(filter.kind, selected)
  }

  return filters
}

function pathMatchesNodeFilters(
  path: FlowPathNode[],
  filters: Map<FlowNodeKind, Set<string>>
): boolean {
  if (filters.size === 0) return true

  const pathNodesByKind = new Map<FlowNodeKind, Set<string>>()
  for (const node of path) {
    const ids = pathNodesByKind.get(node.kind) ?? new Set<string>()
    ids.add(node.id)
    pathNodesByKind.set(node.kind, ids)
  }

  for (const [kind, selectedIds] of filters) {
    const pathIds = pathNodesByKind.get(kind)
    if (!pathIds) return false

    let hasSelectedNode = false
    for (const id of selectedIds) {
      if (pathIds.has(id)) {
        hasSelectedNode = true
        break
      }
    }
    if (!hasSelectedNode) return false
  }

  return true
}

function filterRowsByNodes(
  rows: FlowQuotaDataItem[],
  selectedNodes: readonly FlowNodeFilter[] | undefined,
  stages: FlowNodeKind[],
  ctx: FlowPathContext
): FlowQuotaDataItem[] {
  const filters = normalizeSelectedNodeFilters(selectedNodes, stages)
  if (filters.size === 0) return rows

  return rows.filter((row) =>
    pathMatchesNodeFilters(flowPathForStages(row, stages, ctx), filters)
  )
}

function selectedNodeFiltersExceptKind(
  selectedNodes: readonly FlowNodeFilter[] | undefined,
  kind: FlowNodeKind
): FlowNodeFilter[] | undefined {
  const filtered = (selectedNodes ?? []).filter(
    (filter) => filter.kind !== kind
  )
  return filtered.length > 0 ? filtered : undefined
}

function addNode(
  map: Map<string, DashboardFlowNode>,
  pathNode: FlowPathNode,
  metrics: FlowMetrics,
  metric: FlowMetric,
  color: string
): void {
  const previous = map.get(pathNode.id) ?? {
    id: pathNode.id,
    label: pathNode.label,
    kind: pathNode.kind,
    value: 0,
    requests: 0,
    quota: 0,
    tokens: 0,
    color,
  }
  previous.value += metricValue(metrics, metric)
  previous.requests += metrics.requests
  previous.quota += metrics.quota
  previous.tokens += metrics.tokens
  map.set(pathNode.id, previous)
}

function addLink(
  map: Map<string, DashboardFlowLink>,
  source: FlowPathNode,
  target: FlowPathNode,
  metrics: FlowMetrics,
  metric: FlowMetric,
  color: string
): void {
  const key = `${source.id}\u0000${target.id}`
  const previous = map.get(key) ?? {
    source: source.id,
    target: target.id,
    value: 0,
    requests: 0,
    quota: 0,
    tokens: 0,
    sourceLabel: source.label,
    targetLabel: target.label,
    color,
    linkAlpha: 1,
    share: 0,
  }
  previous.value += metricValue(metrics, metric)
  previous.requests += metrics.requests
  previous.quota += metrics.quota
  previous.tokens += metrics.tokens
  map.set(key, previous)
}

// Links leaving the same node share its color, so they are separated by resting
// opacity instead: the widest ribbon is the faintest, which keeps the narrow
// ribbons stacked above it readable.
function assignLinkRestingOpacity(links: DashboardFlowLink[]): void {
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
      link.linkAlpha =
        sortedLinks.length === 1 ? 0.34 : 0.24 + (index / denominator) * 0.2
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

function pathLinkKey(source: FlowPathNode, target: FlowPathNode): string {
  return `${source.id}\u0000${target.id}`
}

// Recharts paints links in array order, so the array is ordered back to front:
// dimmed ribbons first, highlighted ribbons last, and wider ribbons beneath
// narrower ones so a thin flow never disappears under a thick one.
// `highlighted`/`dimmed` are undefined while nothing is selected, which makes
// those subtractions NaN and falls through to the value ordering.
function byLinkPaintOrder(a: DashboardFlowLink, b: DashboardFlowLink): number {
  return (
    Number(b.dimmed) - Number(a.dimmed) ||
    Number(a.highlighted) - Number(b.highlighted) ||
    b.value - a.value ||
    linkStableKey(a).localeCompare(linkStableKey(b))
  )
}

function buildSummary(rows: FlowQuotaDataItem[]): FlowSummary {
  return rows.reduce<FlowSummary>(
    (summary, row) => {
      const metrics = rowMetrics(row)
      summary.quota += metrics.quota
      summary.tokens += metrics.tokens
      summary.requests += metrics.requests
      return summary
    },
    {
      quota: 0,
      tokens: 0,
      requests: 0,
    }
  )
}

function normalizeTopNodeLimit(limit?: number): number | undefined {
  if (limit === undefined) return undefined
  const parsed = Math.floor(limit)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function otherFlowNode(
  kind: FlowNodeKind,
  labeler?: (kind: FlowNodeKind) => string
): FlowPathNode {
  return {
    id: OTHER_FLOW_NODE_IDS[kind],
    label: labeler?.(kind) ?? DEFAULT_OTHER_FLOW_NODE_LABELS[kind],
    kind,
  }
}

function buildTopNodeSets(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric,
  stages: FlowNodeKind[],
  limit: number | undefined,
  ctx: FlowPathContext
): Map<FlowNodeKind, Set<string>> | undefined {
  if (!limit) return undefined

  const totals = new Map<FlowNodeKind, Map<string, FlowNodeRank>>()
  for (const stage of stages) {
    totals.set(stage, new Map())
  }

  for (const row of rows) {
    const metrics = rowMetrics(row)
    const value = metricValue(metrics, metric)
    const path = flowPathForStages(row, stages, ctx)
    for (const node of path) {
      const stageTotals = totals.get(node.kind)
      if (!stageTotals) continue
      const current = stageTotals.get(node.id) ?? { node, value: 0 }
      current.value += value
      stageTotals.set(node.id, current)
    }
  }

  const topSets = new Map<FlowNodeKind, Set<string>>()
  for (const [kind, stageTotals] of totals) {
    const topIds = [...stageTotals.values()]
      .sort(
        (a, b) =>
          b.value - a.value ||
          a.node.label.localeCompare(b.node.label) ||
          a.node.id.localeCompare(b.node.id)
      )
      .slice(0, limit)
      .map((rank) => rank.node.id)
    topSets.set(kind, new Set(topIds))
  }

  return topSets
}

function isTopFlowNode(
  node: FlowPathNode,
  topNodeSets?: Map<FlowNodeKind, Set<string>>
): boolean {
  const topNodes = topNodeSets?.get(node.kind)
  return !topNodes || topNodes.has(node.id)
}

function applyTopNodeLimit(
  path: FlowPathNode[],
  topNodeSets: Map<FlowNodeKind, Set<string>> | undefined,
  mode: FlowOverflowMode,
  labeler?: (kind: FlowNodeKind) => string
): FlowPathNode[] | undefined {
  if (!topNodeSets) return path
  const containsOverflowNode = path.some(
    (node) => !isTopFlowNode(node, topNodeSets)
  )
  if (!containsOverflowNode) return path
  if (mode === 'hide') return undefined
  return path.map((node) =>
    isTopFlowNode(node, topNodeSets) ? node : otherFlowNode(node.kind, labeler)
  )
}

function pathContainsFlowNode(
  path: FlowPathNode[],
  filter: FlowNodeFilter
): boolean {
  return path.some((node) => node.kind === filter.kind && node.id === filter.id)
}

function pathContainsFlowLink(
  path: FlowPathNode[],
  link: FlowLinkSelection
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i]?.id === link.source && path[i + 1]?.id === link.target) {
      return true
    }
  }
  return false
}

function buildFlowHighlightSets(
  preparedPaths: PreparedFlowPath[],
  activeNode: FlowNodeFilter | undefined,
  activeLink: FlowLinkSelection | undefined,
  stages: FlowNodeKind[]
): FlowHighlightSets | undefined {
  const nodeActive = Boolean(activeNode && stages.includes(activeNode.kind))
  if (!nodeActive && !activeLink) return undefined

  // A link selection highlights paths that traverse that exact edge; otherwise
  // fall back to highlighting paths that pass through the active node.
  const matchesPath = (path: FlowPathNode[]): boolean => {
    if (activeLink) return pathContainsFlowLink(path, activeLink)
    return activeNode ? pathContainsFlowNode(path, activeNode) : false
  }

  const highlightedNodes = new Set<string>()
  const highlightedLinks = new Set<string>()
  for (const prepared of preparedPaths) {
    const { path } = prepared
    if (!matchesPath(path)) continue

    for (const node of path) {
      highlightedNodes.add(node.id)
    }
    for (let i = 0; i < path.length - 1; i++) {
      const source = path[i]
      const target = path[i + 1]
      if (!source || !target) continue
      highlightedLinks.add(pathLinkKey(source, target))
    }
  }

  if (highlightedNodes.size === 0) return undefined
  return {
    nodes: highlightedNodes,
    links: highlightedLinks,
  }
}

// Fully masks a label. Nodes stay distinct because the Sankey identifies them
// by `key` (the node id), not by this display text, so identical masked labels
// never merge.
const FLOW_MASK_TEXT = '\u2022\u2022\u2022\u2022'

function maskFlowLabel(label: string): string {
  if (label.length === 0) return label
  return FLOW_MASK_TEXT
}

// Masks sensitive node/link labels in place. Node identity (`id`) is untouched,
// so links, highlighting, and layout stay exactly the same; only the rendered
// text changes.
function maskFlowGraphLabels(
  nodes: Map<string, DashboardFlowNode>,
  links: Map<string, DashboardFlowLink>
): void {
  const maskedById = new Map<string, string>()
  for (const node of nodes.values()) {
    if (!SENSITIVE_FLOW_KINDS.has(node.kind)) continue
    if (OTHER_FLOW_NODE_ID_SET.has(node.id)) continue
    const masked = maskFlowLabel(node.label)
    node.label = masked
    maskedById.set(node.id, masked)
  }
  if (maskedById.size === 0) return
  for (const link of links.values()) {
    const sourceMasked = maskedById.get(link.source)
    if (sourceMasked !== undefined) link.sourceLabel = sourceMasked
    const targetMasked = maskedById.get(link.target)
    if (targetMasked !== undefined) link.targetLabel = targetMasked
  }
}

function applyFlowHighlights(
  nodes: Iterable<DashboardFlowNode>,
  links: Iterable<DashboardFlowLink>,
  highlightSets: FlowHighlightSets | undefined
): void {
  if (!highlightSets) return

  for (const node of nodes) {
    node.highlighted = highlightSets.nodes.has(node.id)
    node.dimmed = !node.highlighted
  }
  for (const link of links) {
    const highlighted = highlightSets.links.has(linkStableKey(link))
    link.highlighted = highlighted
    link.dimmed = !highlighted
  }
}

function buildFlowGraph(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric,
  role: FlowRole,
  palette?: readonly string[],
  visibleStages?: FlowNodeKind[],
  ctx: FlowPathContext = EMPTY_FLOW_PATH_CONTEXT,
  options: FlowGraphOptions = {}
): DashboardFlowGraph {
  const stages = resolveVisibleStages(role, visibleStages)
  const topNodeSets = buildTopNodeSets(
    rows,
    metric,
    stages,
    normalizeTopNodeLimit(options.topNodeLimit),
    ctx
  )
  const overflowMode = options.overflowMode ?? DEFAULT_FLOW_OVERFLOW_MODE
  const preparedPaths: PreparedFlowPath[] = []

  for (const row of rows) {
    const path = applyTopNodeLimit(
      flowPathForStages(row, stages, ctx),
      topNodeSets,
      overflowMode,
      options.otherNodeLabel
    )
    if (!path) continue
    preparedPaths.push({ path, metrics: rowMetrics(row) })
  }

  const nodes = new Map<string, DashboardFlowNode>()
  const links = new Map<string, DashboardFlowLink>()
  const colors = stableColorMap(
    preparedPaths
      .map((prepared) => prepared.path[0]?.id)
      .filter((id): id is string => Boolean(id))
      .sort((a, b) => a.localeCompare(b)),
    palette
  )

  for (const prepared of preparedPaths) {
    const { path, metrics } = prepared
    const root = path[0]
    if (!root) continue
    const color = colors.get(root.id) ?? colorAt(0, palette)

    for (const node of path) {
      addNode(nodes, node, metrics, metric, color)
    }
    for (let i = 0; i < path.length - 1; i++) {
      const source = path[i]
      const target = path[i + 1]
      if (!source || !target) continue
      addLink(links, source, target, metrics, metric, color)
    }
  }
  if (options.maskSensitive) {
    maskFlowGraphLabels(nodes, links)
  }
  applyFlowHighlights(
    nodes.values(),
    links.values(),
    buildFlowHighlightSets(
      preparedPaths,
      options.activeNode,
      options.activeLink,
      stages
    )
  )

  const flowLinks = [...links.values()].sort(
    (a, b) =>
      a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
  )
  const firstStepSources = new Set(
    preparedPaths
      .map((prepared) => prepared.path[0]?.id)
      .filter((id): id is string => Boolean(id))
  )
  const total = flowLinks
    .filter((link) => firstStepSources.has(link.source))
    .reduce((sum, link) => sum + link.value, 0)
  for (const link of flowLinks) {
    link.share = total > 0 ? link.value / total : 0
  }
  assignLinkRestingOpacity(flowLinks)

  return {
    nodes: [...nodes.values()].sort(byValueThenLabel),
    links: flowLinks,
  }
}

function formatNumber(value: number): string {
  return Intl.NumberFormat(getCurrentIntlLocale(), {
    maximumFractionDigits: 0,
  }).format(value)
}

function buildUserFilterOptions(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric = 'quota',
  palette?: readonly string[]
): FlowFilterOptions['users'] {
  const users = new Map<
    string,
    {
      label: string
      value: number
      color: string
    }
  >()
  const colors = stableColorMap(
    rows.map((row) => userNode(row).id).sort((a, b) => a.localeCompare(b)),
    palette
  )

  for (const row of rows) {
    const user = userNode(row)
    if (!row.user_id && !row.username) continue
    const metrics = rowMetrics(row)
    const value = metricValue(metrics, metric)
    const current = users.get(user.id) ?? {
      label: user.label,
      value: 0,
      color: colors.get(user.id) ?? colorAt(0, palette),
    }
    current.value += value
    users.set(user.id, current)
  }

  return [...users.entries()]
    .map(([value, user]) => ({
      value,
      label: user.label,
      valueLabel: formatNumber(user.value),
      valueRaw: user.value,
      color: user.color,
    }))
    .sort((a, b) => b.valueRaw - a.valueRaw || a.label.localeCompare(b.label))
}

function buildNodeFilterOptions(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric,
  role: FlowRole,
  visibleStages: FlowNodeKind[] | undefined,
  palette: readonly string[] | undefined,
  ctx: FlowPathContext,
  selectedNodes?: readonly FlowNodeFilter[]
): FlowFilterOptions['nodes'] {
  const stages = resolveVisibleStages(role, visibleStages)
  const stageOrder = new Map(stages.map((stage, index) => [stage, index]))
  const colorIds = new Set<string>()
  for (const row of rows) {
    for (const node of flowPathForStages(row, stages, ctx)) {
      colorIds.add(node.id)
    }
  }

  const colors = stableColorMap(
    [...colorIds].sort((a, b) => a.localeCompare(b)),
    palette
  )
  const options: FlowFilterOptions['nodes'] = []

  for (const stage of stages) {
    const totals = new Map<
      string,
      {
        node: FlowPathNode
        value: number
      }
    >()
    const candidateRows = filterRowsByNodes(
      rows,
      selectedNodeFiltersExceptKind(selectedNodes, stage),
      stages,
      ctx
    )

    for (const row of candidateRows) {
      const metrics = rowMetrics(row)
      const value = metricValue(metrics, metric)
      const node = NODE_BUILDERS[stage](row, ctx)
      const key = nodeFilterKey({ kind: node.kind, id: node.id })
      const current = totals.get(key) ?? { node, value: 0 }
      current.value += value
      totals.set(key, current)
    }

    for (const rank of totals.values()) {
      options.push({
        kind: rank.node.kind,
        value: rank.node.id,
        label: rank.node.label,
        valueLabel: formatNumber(rank.value),
        valueRaw: rank.value,
        color: colors.get(rank.node.id) ?? colorAt(0, palette),
      })
    }
  }

  return options.sort(
    (a, b) =>
      (stageOrder.get(a.kind) ?? 0) - (stageOrder.get(b.kind) ?? 0) ||
      b.valueRaw - a.valueRaw ||
      a.label.localeCompare(b.label) ||
      a.value.localeCompare(b.value)
  )
}

export function buildFlowFilterOptions(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric = 'quota',
  palette?: readonly string[],
  role: FlowRole = DEFAULT_FLOW_ROLE,
  visibleStages?: FlowNodeKind[],
  selectedNodes?: readonly FlowNodeFilter[]
): FlowFilterOptions {
  return {
    users: buildUserFilterOptions(rows, metric, palette),
    nodes: buildNodeFilterOptions(
      rows,
      metric,
      role,
      visibleStages,
      palette,
      EMPTY_FLOW_PATH_CONTEXT,
      selectedNodes
    ),
  }
}

export function buildDashboardFlowData(
  rows: FlowQuotaDataItem[],
  metric: FlowMetric = 'quota',
  options: FlowBuildOptions = {}
): ProcessedFlowData {
  const role = options.role ?? DEFAULT_FLOW_ROLE
  const palette = options.colorPalette
  const ctx = {
    deletedTokenLabel: options.deletedTokenLabel,
  }
  const stages = resolveVisibleStages(role, options.visibleStages)
  const userFilteredRows = filterRows(rows, options)
  const filteredRows = filterRowsByNodes(
    userFilteredRows,
    options.selectedNodes,
    stages,
    ctx
  )

  return {
    summary: buildSummary(filteredRows),
    flow: buildFlowGraph(
      filteredRows,
      metric,
      role,
      palette,
      options.visibleStages,
      ctx,
      {
        topNodeLimit: options.topNodeLimit,
        overflowMode: options.overflowMode,
        otherNodeLabel: options.otherNodeLabel,
        activeNode: options.activeNode,
        activeLink: options.activeLink,
        maskSensitive: options.maskSensitive,
      }
    ),
    filterOptions: {
      users: buildUserFilterOptions(rows, metric, palette),
      nodes: buildNodeFilterOptions(
        userFilteredRows,
        metric,
        role,
        options.visibleStages,
        palette,
        ctx,
        options.selectedNodes
      ),
    },
  }
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined
}

// Recharts hands the datum we supplied back as `payload` on the clicked node or
// link, so selections are read straight from that payload. Node payloads are
// merged with the computed layout and link payloads replace `source`/`target`
// with node objects, which is why both carry their own id fields.
export function flowNodeFilterFromSankeyNode(
  payload: unknown
): FlowNodeFilter | undefined {
  const record = recordValue(payload)
  const id = record?.nodeId
  const kind = record?.kind
  if (typeof id !== 'string' || !isFlowNodeKind(kind)) return undefined
  return { kind, id }
}

export function flowLinkSelectionFromSankeyLink(
  payload: unknown
): FlowLinkSelection | undefined {
  const record = recordValue(payload)
  const source = record?.sourceId
  const target = record?.targetId
  if (typeof source !== 'string' || typeof target !== 'string') return undefined
  return { source, target }
}

/**
 * Adapts the graph to the shape the Recharts `Sankey` expects: links address
 * nodes by their index in the `nodes` array, so zero-value links are dropped
 * first and only the nodes they connect are emitted.
 */
export function buildFlowSankeyRechartsData(
  flow: DashboardFlowGraph
): FlowSankeyData {
  const drawableLinks = flow.links.filter((link) => link.value > 0)
  const linkedNodeIds = new Set<string>()
  for (const link of drawableLinks) {
    linkedNodeIds.add(link.source)
    linkedNodeIds.add(link.target)
  }

  // Node order decides the vertical order inside each Sankey column, so it
  // follows the graph order (value descending) and stays independent of the
  // current selection to keep the layout stable while highlighting.
  const nodes: FlowSankeyNodeDatum[] = []
  const nodeIndexById = new Map<string, number>()
  for (const node of flow.nodes) {
    if (!linkedNodeIds.has(node.id)) continue
    nodeIndexById.set(node.id, nodes.length)
    nodes.push({
      name: node.label,
      nodeId: node.id,
      kind: node.kind,
      requests: node.requests,
      quota: node.quota,
      tokens: node.tokens,
      color: node.color,
      highlighted: node.highlighted === true,
      dimmed: node.dimmed === true,
    })
  }

  const links: FlowSankeyLinkDatum[] = []
  for (const link of [...drawableLinks].sort(byLinkPaintOrder)) {
    const source = nodeIndexById.get(link.source)
    const target = nodeIndexById.get(link.target)
    if (source === undefined || target === undefined) continue
    links.push({
      source,
      target,
      value: link.value,
      sourceId: link.source,
      targetId: link.target,
      sourceLabel: link.sourceLabel,
      targetLabel: link.targetLabel,
      requests: link.requests,
      quota: link.quota,
      tokens: link.tokens,
      color: link.color,
      linkAlpha: link.linkAlpha,
      share: link.share,
      highlighted: link.highlighted === true,
      dimmed: link.dimmed === true,
    })
  }

  return { nodes, links }
}
