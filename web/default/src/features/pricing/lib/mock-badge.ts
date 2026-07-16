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
import {
  PROFILE_BY_NAME,
  PROFILE_SPECS,
} from './mock-stats'
import {
  hashStringToSeed,
  randomInRange,
  seededRandom,
} from './seed'
import type { ModelPerfBadgeData } from '../components/model-perf-badge'

// ---------------------------------------------------------------------------
// Mock badge data — deterministic fallback for models without real perf data
// ---------------------------------------------------------------------------
//
// When the backend has no traffic for a model (cold-start, no relay requests),
// `perf_metrics` returns nothing and `ModelPerfBadge` renders null. This
// helper generates plausible badge data from the same profile specs used by
// mock-stats.ts so every model card shows health indicators immediately.
//
// Values are deterministic (seeded from model name) and intentionally close to
// what the real metrics would show, so the transition from mock → real data
// is barely noticeable to end users.

/**
 * Build a deterministic `ModelPerfBadgeData` from the model name alone.
 * Uses the same profile system as mock-stats.ts for consistency.
 */
export function buildMockBadgeData(modelName: string): ModelPerfBadgeData {
  const profile = PROFILE_BY_NAME(modelName)
  const spec = PROFILE_SPECS[profile]
  const seed = hashStringToSeed(modelName)
  const rand = seededRandom(seed)

  // Use TTFT range as a proxy for avg_latency_ms on the badge (the badge
  // field is "average latency" which in practice is close to TTFT for
  // streaming models and end-to-end latency otherwise).
  const avgLatencyMs = Math.round(randomInRange(rand, spec.ttftRange[0], spec.ttftRange[1]))

  // Throughput: broadcast 0 for non-text profiles so the badge shows "—"
  // just like the real perf API does for embedding/image/audio models.
  const avgTps = spec.throughputRange[1] === 0
    ? 0
    : Math.round(randomInRange(rand, spec.throughputRange[0], spec.throughputRange[1]) * 10) / 10

  // Uptime map: badge uses recent 3 bucket success rates. Generate 3
  // slightly varying values around the profile uptime to produce the
  // characteristic 3-dot status bar.
  const baseUptime = randomInRange(rand, spec.uptimeRange[0], spec.uptimeRange[1])
  const recentSuccessRates: number[] = []
  for (let i = 0; i < 3; i++) {
    // Small per-bucket jitter ±0.3 pp around base uptime
    const jitter = (rand() - 0.5) * 0.6
    recentSuccessRates.push(
      Math.round(Math.min(100, Math.max(95, baseUptime + jitter)) * 100) / 100
    )
  }

  return {
    avg_latency_ms: avgLatencyMs,
    avg_tps: avgTps,
    success_rate: Math.round(baseUptime * 100) / 100,
    recent_success_rates: recentSuccessRates,
    is_mock: true,
  }
}
