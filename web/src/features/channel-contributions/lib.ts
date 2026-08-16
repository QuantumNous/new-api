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
  ChannelContribution,
  ChannelContributionList,
  ChannelContributionModelTestResult,
  ChannelContributionProbeResult,
  ChannelContributionRawTestResult,
  ChannelContributionRevision,
  ChannelContributionRevisionStatus,
  ChannelContributionStatus,
  ChannelContributionTestRun,
} from './types'

export const activeTestRunStatuses = new Set(['queued', 'running'])

export function normalizeContributionList(
  data: ChannelContributionList | ChannelContribution[] | undefined
): ChannelContributionList {
  if (Array.isArray(data)) {
    return { items: data, total: data.length }
  }
  return {
    items: data?.items ?? [],
    total: data?.total ?? data?.items?.length ?? 0,
    page: data?.page,
    page_size: data?.page_size,
  }
}

export function parseContributionModels(
  models: string[] | string | undefined
): string[] {
  const values = Array.isArray(models) ? models : (models ?? '').split(',')
  return [
    ...new Set(values.map((model) => model.trim()).filter(Boolean)),
  ].slice(0, 100)
}

export function parseContributionModelMapping(
  mapping: Record<string, string> | string | undefined
): Record<string, string> {
  if (!mapping) return {}
  if (typeof mapping === 'object') return { ...mapping }
  try {
    const parsed = JSON.parse(mapping) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

export function formatContributionModelMapping(
  mapping: Record<string, string> | string | undefined
): string {
  const parsed = parseContributionModelMapping(mapping)
  return Object.keys(parsed).length > 0 ? JSON.stringify(parsed, null, 2) : ''
}

export function getContributionRevision(
  contribution: ChannelContribution | null | undefined
): ChannelContributionRevision | null {
  if (!contribution) return null
  const nested =
    contribution.pending_revision ??
    contribution.current_revision ??
    contribution.approved_revision
  if (nested) return nested
  if (!contribution.name || !contribution.type || !contribution.base_url) {
    return null
  }
  return {
    id: contribution.current_revision_id ?? contribution.id,
    contribution_id: contribution.id,
    revision_number: contribution.revision,
    name: contribution.name,
    type: contribution.type,
    base_url: contribution.base_url,
    key: contribution.key,
    group: contribution.group ?? '',
    models: contribution.models ?? [],
    model_mapping: contribution.model_mapping ?? {},
    config_hash: contribution.config_hash,
  }
}

export function getContributionName(contribution: ChannelContribution): string {
  return getContributionRevision(contribution)?.name ?? `#${contribution.id}`
}

export function getTestRunId(
  run: ChannelContributionTestRun | null | undefined
): number | string | null {
  const id = run?.run_id ?? run?.id
  return id ?? null
}

function isRawTestResult(
  result: ChannelContributionModelTestResult | ChannelContributionRawTestResult
): result is ChannelContributionRawTestResult {
  return (
    typeof (result as ChannelContributionRawTestResult).stream === 'boolean'
  )
}

export function getTestRunResults(
  run: ChannelContributionTestRun | null | undefined
): ChannelContributionModelTestResult[] {
  if (run?.model_results) return run.model_results
  const source = run?.results ?? []
  if (source.length === 0) return []
  if (!source.some(isRawTestResult)) {
    return source as ChannelContributionModelTestResult[]
  }

  const grouped = new Map<string, ChannelContributionModelTestResult>()
  for (const item of source) {
    if (!isRawTestResult(item)) continue
    const key = `${item.model}\u0000${item.endpoint_type ?? ''}`
    const current = grouped.get(key) ?? {
      model: item.model,
      endpoint_type: item.endpoint_type,
      stream_required: !/embedding|rerank/i.test(item.endpoint_type ?? ''),
      price_configured:
        item.price_configured ?? run?.pricing_ready ?? run?.price_configured,
    }
    if (typeof item.price_configured === 'boolean') {
      current.price_configured = item.price_configured
    }
    const probe: ChannelContributionProbeResult = {
      success: item.success,
      latency_ms: item.latency_ms,
      error: item.error,
    }
    if (item.stream) current.stream = probe
    else current.non_stream = probe
    grouped.set(key, current)
  }
  return [...grouped.values()]
}

export function isTestRunActive(
  run: ChannelContributionTestRun | null | undefined
): boolean {
  return Boolean(run && activeTestRunStatuses.has(run.status))
}

export function probePassed(
  probe: ChannelContributionProbeResult | null | undefined
): boolean {
  if (!probe) return false
  if (probe.success === true || probe.passed === true) return true
  return probe.status === 'passed' || probe.status === 'success'
}

export function modelTestPassed(
  result: ChannelContributionModelTestResult
): boolean {
  if (!probePassed(result.non_stream)) return false
  if (result.stream_required === false) return true
  return probePassed(result.stream)
}

export function testRunHasCompletePricing(
  run: ChannelContributionTestRun | null | undefined,
  currentPriceConfigured?: boolean
): boolean {
  if (typeof currentPriceConfigured === 'boolean') {
    return currentPriceConfigured
  }
  const results = getTestRunResults(run)
  if (
    results.length > 0 &&
    results.every((result) => typeof result.price_configured === 'boolean')
  ) {
    return results.every((result) => result.price_configured)
  }
  if (typeof run?.pricing_ready === 'boolean') return run.pricing_ready
  if (typeof run?.price_configured === 'boolean') return run.price_configured
  return (
    results.length > 0 && results.every((result) => result.price_configured)
  )
}

export function testRunPassed(
  run: ChannelContributionTestRun | null | undefined,
  currentPriceConfigured?: boolean
): boolean {
  if (!run || !['succeeded', 'passed'].includes(run.status)) return false
  if (!isTestRunFresh(run)) return false
  const results = getTestRunResults(run)
  return (
    results.length > 0 &&
    results.every(modelTestPassed) &&
    testRunHasCompletePricing(run, currentPriceConfigured)
  )
}

export function isTestRunFresh(
  run: ChannelContributionTestRun | null | undefined,
  now = Date.now()
): boolean {
  if (!run?.completed_at) return false
  const completedAt =
    run.completed_at > 10_000_000_000
      ? run.completed_at
      : run.completed_at * 1000
  return now - completedAt <= 30 * 60 * 1000 && now >= completedAt
}

export function getContributionTestRun(
  contribution: ChannelContribution | null | undefined
): ChannelContributionTestRun | null {
  return contribution?.latest_test_run ?? contribution?.test_run ?? null
}

export function canEditContribution(
  contribution: ChannelContribution | ChannelContributionStatus
): boolean {
  if (
    typeof contribution !== 'string' &&
    (contribution.pending_revision_id || contribution.pending_revision)
  ) {
    return false
  }
  const status =
    typeof contribution === 'string' ? contribution : contribution.status
  return ['draft', 'rejected', 'approved', 'unavailable'].includes(status)
}

export function hasPendingContributionRevision(
  contribution: ChannelContribution | null | undefined
): boolean {
  return Boolean(
    contribution &&
    (contribution.pending_revision_id ||
      contribution.pending_revision ||
      contribution.revision_status === 'pending')
  )
}

export function getSecondaryContributionRevisionStatus(
  contribution: ChannelContribution
): Extract<
  ChannelContributionRevisionStatus,
  'draft' | 'pending' | 'rejected'
> | null {
  if (!['approved', 'unavailable'].includes(contribution.status)) return null
  const status = contribution.revision_status
  return status === 'draft' || status === 'pending' || status === 'rejected'
    ? status
    : null
}

export function canWithdrawContribution(
  status: ChannelContributionStatus
): boolean {
  return status !== 'deleted'
}

export function isTurnstileReady(enabled: boolean, token: string): boolean {
  return !enabled || token.trim().length > 0
}

export async function executeTurnstileSubmission<T>(options: {
  enabled: boolean
  token: string
  submit: (token: string | undefined) => Promise<T>
  reset: () => void
}): Promise<{ called: boolean; result?: T }> {
  if (!isTurnstileReady(options.enabled, options.token)) {
    return { called: false }
  }

  try {
    const result = await options.submit(
      options.enabled ? options.token.trim() : undefined
    )
    return { called: true, result }
  } finally {
    if (options.enabled) options.reset()
  }
}

export function formatContributionTimestamp(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return '-'
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
  return new Date(milliseconds).toLocaleString()
}

export function getProbeError(
  probe: ChannelContributionProbeResult | null | undefined
): string {
  return probe?.error?.trim() || probe?.message?.trim() || ''
}

export function getProbeResponseTime(
  probe: ChannelContributionProbeResult | null | undefined
): number | null {
  const value =
    probe?.latency_ms ?? probe?.response_time_ms ?? probe?.response_time
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
