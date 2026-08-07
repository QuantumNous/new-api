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
export type AgentAccessState =
  | 'agent'
  | 'candidate'
  | 'none'
  | 'disabled'
  | 'transient-error'

export type AgentSummaryPayload = Record<string, unknown> & {
  ok?: boolean
  code?: string
  candidate?: boolean
  not_agent?: boolean
  apply_url?: string
  error?: string
  profile?: { status?: string }
}

export type AgentSummaryResult =
  | { state: 'agent'; summary: AgentSummaryPayload }
  | { state: 'candidate'; applyUrl?: string }
  | { state: 'none' }
  | { state: 'disabled' }
  | { state: 'transient-error'; status?: number; code?: string }

export type AgentSummaryState = AgentAccessState | 'loading'
