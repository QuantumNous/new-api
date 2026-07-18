/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export function buildQueryParams(
  params: Record<string, unknown>
): URLSearchParams {
  const queryParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value))
    }
  })

  return queryParams
}

export function buildLogCursorScope(
  isAdmin: boolean,
  pageSize: number,
  searchParams: Record<string, unknown>,
  columnFilters: unknown
): string {
  const { page: _page, pageSize: _pageSize, ...filters } = searchParams
  return JSON.stringify([isAdmin, pageSize, filters, columnFilters])
}

export function estimateCursorTotalCount(
  pageIndex: number,
  pageSize: number,
  itemCount: number,
  hasMore: boolean
): number {
  const viewedBefore = Math.max(0, pageIndex) * Math.max(0, pageSize)
  const currentItems = Math.max(0, itemCount)
  const nextPageHint = hasMore ? Math.max(0, pageSize) : 0
  return viewedBefore + currentItems + nextPageHint
}
