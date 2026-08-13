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
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { fetchTokenKey } from '@/features/keys/api'
import { ERROR_MESSAGES } from '@/features/keys/constants'

/**
 * The key list endpoint only ever returns masked keys, so the real value is
 * resolved to back copy actions and ready-to-run samples. Only the key the
 * user actually selected is resolved — never the whole visible list — to keep
 * unrelated secrets out of the page. Resolved values accumulate so keys the
 * user already revealed stay copyable after switching the selection.
 */
export function useResolvedApiKeys(
  selectedKeyId: number | null,
  enabled: boolean
): Record<number, string> {
  const { t } = useTranslation()
  const [resolvedKeys, setResolvedKeys] = useState<Record<number, string>>({})

  const keyQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'token-key', selectedKeyId],
    queryFn: async () => {
      const id = selectedKeyId as number
      const result = await fetchTokenKey(id)
      if (!result.success || !result.data?.key) {
        throw new Error(result.message || 'Failed to resolve the API key')
      }
      return { id, key: `sk-${result.data.key}` }
    },
    enabled: enabled && selectedKeyId !== null,
    // A token's secret never changes, so a resolved value is kept for the
    // whole session instead of being refetched on focus.
    staleTime: Infinity,
  })

  const resolved = keyQuery.data
  useEffect(() => {
    if (!resolved) return
    setResolvedKeys((prev) =>
      prev[resolved.id] === resolved.key
        ? prev
        : { ...prev, [resolved.id]: resolved.key }
    )
  }, [resolved])

  // Failures surface instead of leaving the copy affordance spinning
  // silently; React Query's default retry policy already reattempts first.
  const resolveFailed = keyQuery.isError
  useEffect(() => {
    if (resolveFailed) toast.error(t(ERROR_MESSAGES.UNEXPECTED))
  }, [resolveFailed, t])

  return resolvedKeys
}
