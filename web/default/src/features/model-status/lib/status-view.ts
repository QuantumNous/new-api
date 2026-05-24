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
  ModelStatusCode,
  ModelStatusHealth,
  ModelStatusMonitor,
  ModelStatusPayload,
  ModelStatusTimelinePoint,
  ModelStatusView,
  ModelStatusViewGroup,
  ModelStatusViewModel,
  ModelStatusViewSummary,
} from '../types'

type MutableModel = Omit<ModelStatusViewModel, 'healthLabel'> & {
  historyByTimestamp: Map<number, ModelStatusTimelinePoint>
}

const DEFAULT_GROUP_NAME = '默认分组'

export function buildModelStatusView(
  payload?: ModelStatusPayload
): ModelStatusView {
  const modelMap = new Map<string, MutableModel>()

  for (const group of payload?.data ?? []) {
    for (const monitor of group.monitors ?? []) {
      mergeMonitor(modelMap, monitor, group.categoryName)
    }
  }

  const groups = buildGroups([...modelMap.values()])
  return {
    groups,
    summary: buildSummary(groups),
  }
}

export function statusToHealth(status: ModelStatusCode): ModelStatusHealth {
  if (status === 1) return 'up'
  if (status === 2) return 'degraded'
  if (status === 0) return 'down'
  return 'unknown'
}

export function compareStatusSeverity(
  left: ModelStatusCode,
  right: ModelStatusCode
): ModelStatusCode {
  return statusSeverity(left) >= statusSeverity(right) ? left : right
}

function mergeMonitor(
  modelMap: Map<string, MutableModel>,
  monitor: ModelStatusMonitor,
  categoryName?: string
) {
  const group = normalizeText(monitor.group || categoryName, DEFAULT_GROUP_NAME)
  const model = normalizeText(monitor.model || monitor.name, '未知模型')
  const key = `${group}\u0000${model}`
  const current =
    modelMap.get(key) ??
    createMutableModel(group, model, normalizeText(monitor.name, model))

  current.status = compareStatusSeverity(current.status, monitor.status)
  current.updatedAt = Math.max(current.updatedAt, monitor.updated_at || 0)
  current.availability = pickMetricForCurrentStatus(
    current.status,
    current.availability,
    monitor.status,
    monitor.availability
  )
  current.latency = pickMetricForCurrentStatus(
    current.status,
    current.latency,
    monitor.status,
    monitor.latency
  )

  for (const point of monitor.history ?? []) {
    mergeTimelinePoint(current.historyByTimestamp, point)
  }

  modelMap.set(key, current)
}

function createMutableModel(
  group: string,
  model: string,
  name: string
): MutableModel {
  return {
    name,
    model,
    group,
    status: 1,
    uptime: 0,
    availability: 0,
    latency: 0,
    updatedAt: 0,
    history: [],
    historyByTimestamp: new Map(),
  }
}

function mergeTimelinePoint(
  pointMap: Map<number, ModelStatusTimelinePoint>,
  point: ModelStatusTimelinePoint
) {
  const existing = pointMap.get(point.timestamp)
  if (!existing) {
    pointMap.set(point.timestamp, { ...point })
    return
  }

  const status = compareStatusSeverity(existing.status, point.status)
  pointMap.set(point.timestamp, {
    timestamp: point.timestamp,
    status,
    availability: pickMetricForCurrentStatus(
      status,
      existing.availability,
      point.status,
      point.availability
    ),
    latency: pickMetricForCurrentStatus(
      status,
      existing.latency,
      point.status,
      point.latency
    ),
  })
}

function buildGroups(models: MutableModel[]): ModelStatusViewGroup[] {
  const groupMap = new Map<string, ModelStatusViewGroup>()
  for (const model of models.map(finalizeModel)) {
    const group = groupMap.get(model.group) ?? createGroup(model.group)
    group.models.push(model)
    group.totalModels += 1
    group.updatedAt = Math.max(group.updatedAt, model.updatedAt)
    incrementHealthCount(group, model.healthLabel)
    groupMap.set(model.group, group)
  }

  return [...groupMap.values()]
    .map((group) => ({
      ...group,
      models: group.models.sort(compareModels),
    }))
    .sort(compareGroups)
}

function finalizeModel(model: MutableModel): ModelStatusViewModel {
  const history = [...model.historyByTimestamp.values()].sort(
    (left, right) => left.timestamp - right.timestamp
  )
  const upPoints = history.filter((point) => point.status === 1).length
  const uptime = history.length > 0 ? upPoints / history.length : model.uptime
  return {
    name: model.name,
    model: model.model,
    group: model.group,
    status: model.status,
    uptime,
    availability: model.availability,
    latency: model.latency,
    updatedAt: model.updatedAt,
    history,
    healthLabel: statusToHealth(model.status),
  }
}

function createGroup(name: string): ModelStatusViewGroup {
  return {
    name,
    totalModels: 0,
    upModels: 0,
    degradedModels: 0,
    downModels: 0,
    unknownModels: 0,
    updatedAt: 0,
    models: [],
  }
}

function buildSummary(groups: ModelStatusViewGroup[]): ModelStatusViewSummary {
  const summary = groups.reduce(
    (acc, group) => ({
      totalGroups: acc.totalGroups + 1,
      totalModels: acc.totalModels + group.totalModels,
      upModels: acc.upModels + group.upModels,
      degradedModels: acc.degradedModels + group.degradedModels,
      downModels: acc.downModels + group.downModels,
      unknownModels: acc.unknownModels + group.unknownModels,
      updatedAt: Math.max(acc.updatedAt, group.updatedAt),
      overallStatus: acc.overallStatus,
    }),
    {
      totalGroups: 0,
      totalModels: 0,
      upModels: 0,
      degradedModels: 0,
      downModels: 0,
      unknownModels: 0,
      updatedAt: 0,
      overallStatus: 'unknown' as ModelStatusHealth,
    }
  )
  summary.overallStatus = resolveOverallStatus(summary)
  return summary
}

function resolveOverallStatus(
  summary: ModelStatusViewSummary
): ModelStatusHealth {
  if (summary.totalModels === 0) return 'unknown'
  if (summary.downModels > 0) return 'down'
  if (summary.degradedModels > 0 || summary.unknownModels > 0) return 'degraded'
  return 'up'
}

function incrementHealthCount(
  group: ModelStatusViewGroup,
  health: ModelStatusHealth
) {
  if (health === 'up') group.upModels += 1
  if (health === 'degraded') group.degradedModels += 1
  if (health === 'down') group.downModels += 1
  if (health === 'unknown') group.unknownModels += 1
}

function compareModels(
  left: ModelStatusViewModel,
  right: ModelStatusViewModel
) {
  const severityDiff =
    statusSeverity(right.status) - statusSeverity(left.status)
  if (severityDiff !== 0) return severityDiff
  return left.model.localeCompare(right.model, 'zh-CN')
}

function compareGroups(
  left: ModelStatusViewGroup,
  right: ModelStatusViewGroup
) {
  const leftSeverity = Math.max(
    ...left.models.map((model) => statusSeverity(model.status)),
    0
  )
  const rightSeverity = Math.max(
    ...right.models.map((model) => statusSeverity(model.status)),
    0
  )
  if (leftSeverity !== rightSeverity) return rightSeverity - leftSeverity
  return left.name.localeCompare(right.name, 'zh-CN')
}

function pickMetricForCurrentStatus(
  targetStatus: ModelStatusCode,
  currentMetric: number,
  incomingStatus: ModelStatusCode,
  incomingMetric: number
) {
  return compareStatusSeverity(targetStatus, incomingStatus) === incomingStatus
    ? incomingMetric
    : currentMetric
}

function statusSeverity(status: ModelStatusCode): number {
  if (status === 0) return 4
  if (status === 2) return 3
  if (status === 1) return 1
  return 2
}

function normalizeText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}
