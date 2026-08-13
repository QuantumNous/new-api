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
import { useAuthStore } from '@/stores/auth-store'
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
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [resolvedKeys, setResolvedKeys] = useState<Record<number, string>>({})

  // A different account must never see key material resolved for the
  // previous one, even if a token id happens to repeat across accounts.
  useEffect(() => {
    setResolvedKeys({})
  }, [userId])

  const keyId =
    typeof selectedKeyId === 'number' && Number.isFinite(selectedKeyId)
      ? selectedKeyId
      : null

  const keyQuery = useQuery({
    // Scoped to the signed-in user so an account switch in the same session
    // can never surface the previous user's plaintext key from the cache.
    queryKey: ['dashboard', 'overview', 'token-key', userId, keyId],
    queryFn: async () => {
      if (keyId === null) throw new Error('No API key selected')
      const result = await fetchTokenKey(keyId)
      if (!result.success || !result.data?.key) {
        throw new Error(result.message || 'Failed to resolve the API key')
      }
      return { id: keyId, key: `sk-${result.data.key}` }
    },
    enabled: enabled && keyId !== null && userId !== undefined,
    // Plaintext key material must not linger in the shared query cache:
    // consider it stale after a minute and drop unused entries after five.
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
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
