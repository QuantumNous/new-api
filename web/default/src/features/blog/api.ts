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

import { api } from '@/lib/api'
import { BLOG_PAGE_SIZE } from './constants'
import type { ApiResponse, BlogListQuery, BlogListResult, BlogPost } from './types'

function buildListParams(query: BlogListQuery) {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: BLOG_PAGE_SIZE,
  }

  const search = query.q?.trim()
  if (search) {
    params.q = search
  }

  if (query.categoryIds && query.categoryIds.length > 0) {
    params.categoryIds = query.categoryIds.join(',')
  }

  return params
}

export async function getBlogList(
  query: BlogListQuery
): Promise<ApiResponse<BlogListResult>> {
  const res = await api.get<ApiResponse<BlogListResult>>('/api/blog/list', {
    params: buildListParams(query),
  })
  return res.data
}

export async function getBlogPost(
  slug: string,
  categoryIds?: number[]
): Promise<ApiResponse<BlogPost>> {
  const params: Record<string, string> = {}
  if (categoryIds && categoryIds.length > 0) {
    params.categoryIds = categoryIds.join(',')
  }
  const res = await api.get<ApiResponse<BlogPost>>(
    `/api/blog/detail/${encodeURIComponent(slug)}`,
    { params }
  )
  return res.data
}
