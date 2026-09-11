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

export type RouteKind = 'priority' | 'free' | 'value'

export type RouteGroup = {
  id: string
  kind: RouteKind
  group: string
  description: string
  models: string[]
}

export type CoverageRow = {
  mark: string
  family: string
  description: string
  routeType: string
}

export type LandingModelsConfig = {
  serviceRoutes: RouteGroup[]
  coverage: CoverageRow[]
}

/**
 * Default model configuration for the landing page.
 *
 * Admins can override this via the `LandingModels` option (JSON with the same
 * shape) in system settings; the frontend falls back to this shape when the
 * option is empty or unparseable.
 */
export const DEFAULT_LANDING_MODELS: LandingModelsConfig = {
  serviceRoutes: [
    {
      id: 'priority',
      kind: 'priority',
      group: 'default',
      description:
        'Green groups receive priority maintenance and are usually more stable.',
      models: ['CodexPro', 'ClaudeKiro', 'Claude', 'ClaudeCursor'],
    },
    {
      id: 'free',
      kind: 'free',
      group: 'free',
      description:
        'Open-source resources for exploration and lighter workloads.',
      models: ['Kimi-K2.6', 'bge-m3', 'fal.ai'],
    },
    {
      id: 'value',
      kind: 'value',
      group: 'value',
      description:
        'Low pricing is an extra benefit, not an SLA. Caching, latency, and upstream pools can vary.',
      models: ['Gemini', 'NIM', 'PayPerReq', 'Codex2', 'ClaudeKiro2', 'Grok'],
    },
  ],
  coverage: [
    {
      mark: 'Claude',
      family: 'Claude',
      description: 'Reasoning / coding / agents',
      routeType: 'Kiro · Web · Max 20x · Cursor',
    },
    {
      mark: 'Codex',
      family: 'Codex',
      description: 'Coding / tool calls',
      routeType: 'Pro · Plus · K12 account pool',
    },
    {
      mark: 'Gemini',
      family: 'Gemini',
      description: 'Multimodal / long context',
      routeType: 'AI Studio · proxy',
    },
    {
      mark: 'Grok',
      family: 'Grok',
      description: 'Real-time interaction / reasoning',
      routeType: 'Super · proxy',
    },
    {
      mark: 'N',
      family: 'NIM',
      description: 'NVIDIA models / low multiplier',
      routeType: '0.0005 per request · account pool',
    },
    {
      mark: 'Zhipu',
      family: 'DeepSeek / Zhipu',
      description: 'Dedicated GPU instances',
      routeType: 'Mostly FP8 · FP4 at peak',
    },
    {
      mark: 'I',
      family: 'Image models',
      description: 'Image generation / editing',
      routeType: 'Free · routed aggregation',
    },
  ],
}
