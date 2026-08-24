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
import { useCallback } from 'react'
import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ApiKeys } from '@/features/keys'
import { API_KEY_STATUS_OPTIONS } from '@/features/keys/constants'

const apiKeySearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(undefined),
  status: z
    .array(z.enum(API_KEY_STATUS_OPTIONS.map((s) => s.value as `${number}`)))
    .optional()
    .catch([]),
  filter: z.string().optional().catch(''),
  token: z.string().optional().catch(''),
  keyGroup: z.array(z.string()).optional().catch([]),
  open: z.literal('create').optional().catch(undefined),
  group: z.string().min(1).optional().catch(undefined),
})

export function validateApiKeySearch(search: Record<string, unknown>) {
  const parsed = apiKeySearchSchema.parse(search)
  const create = search.create
  const isAutoCreate =
    create === '1' || create === 1 || create === true || create === 'true'

  const result = {
    ...parsed,
    ...(isAutoCreate ? { create: 1 as const } : {}),
  }
  if (result.open !== 'create') {
    delete result.group
  }
  return result
}

export function clearAutoCreateSearch(search: Record<string, unknown>) {
  return { ...search, create: undefined }
}

export function clearCreateDialogSearch(search: Record<string, unknown>) {
  return { ...search, open: undefined, group: undefined }
}

export const Route = createFileRoute('/_authenticated/keys/')({
  validateSearch: validateApiKeySearch,
  component: ApiKeysRoute,
})

function ApiKeysRoute() {
  const { create, open, group } = Route.useSearch()
  const navigate = Route.useNavigate()
  const handleAutoCreateConsumed = useCallback(() => {
    navigate({
      replace: true,
      search: clearAutoCreateSearch,
    })
  }, [navigate])
  const handleCreateDialogConsumed = useCallback(() => {
    navigate({
      replace: true,
      search: clearCreateDialogSearch,
    })
  }, [navigate])

  return (
    <ApiKeys
      autoCreateRequested={create === 1}
      onAutoCreateConsumed={handleAutoCreateConsumed}
      createDialogRequested={open === 'create'}
      requestedCreateGroup={group}
      onCreateDialogConsumed={handleCreateDialogConsumed}
    />
  )
}
