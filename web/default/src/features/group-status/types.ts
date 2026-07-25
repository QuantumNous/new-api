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
export type GroupModelStatus =
  | 'healthy'
  | 'slow'
  | 'down'
  | 'observing'
  | string

export type GroupStatusSeriesPoint = {
  ts: number
  success_rate: number | null
  request_count: number
}

export type GroupStatusModel = {
  model: string
  status: GroupModelStatus
  success_rate: number | null
  sample_window: number
  series_window: number
  bucket_seconds: number
  request_count: number
  series: GroupStatusSeriesPoint[]
}

export type GroupStatusGroup = {
  group: string
  status: GroupModelStatus
  request_count: number
  models: GroupStatusModel[]
}

export type GroupStatusResponse = {
  success: boolean
  message?: string
  data: GroupStatusGroup[]
}
