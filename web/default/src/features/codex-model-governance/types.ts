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
export type CodexModelGovernanceStatus =
  | 'active'
  | 'unsupported_pending_review'
  | 'unsupported_disabled'
  | 'removed'
  | 'ignored'

export type CodexModelGovernanceReviewAction =
  | 'confirm_remove'
  | 'restore'
  | 'ignore'
  | 'disable'

export type CodexModelGovernanceRecord = {
  id: number
  model_name: string
  status: CodexModelGovernanceStatus
  source: string
  matched_rule: string
  last_error: string
  affected_channel_ids: number[]
  disabled_channel_ids: number[]
  abilities_disabled: boolean
  detected_at: number
  last_checked_at: number
  last_alerted_at: number
  reviewed_at: number
  reviewed_by: number
  review_note: string
}

export type CodexModelGovernanceListParams = {
  status?: CodexModelGovernanceStatus
}

export type CodexModelGovernanceReviewRequest = {
  action: CodexModelGovernanceReviewAction
  note: string
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}
