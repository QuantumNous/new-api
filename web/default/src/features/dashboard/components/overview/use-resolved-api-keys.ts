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
import { fetchTokenKeysBatch } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'

/**
 * The key list endpoint only ever returns masked keys, so the real values are
 * resolved in one batch to back copy actions and ready-to-run samples. Gated on
 * `enabled` so merely loading the overview never reveals full keys.
 */
export function useResolvedApiKeys(
  keys: ApiKey[],
  enabled: boolean
): Record<number, string> {
  const [resolvedKeys, setResolvedKeys] = useState<Record<number, string>>({})

  const pendingSignature = !enabled
    ? ''
    : keys
        .map((key) => key.id)
        .filter((id) => !(id in resolvedKeys))
        .join(',')

  useEffect(() => {
    if (!pendingSignature) return

    let cancelled = false
    const ids = pendingSignature.split(',').map(Number)

    void fetchTokenKeysBatch(ids).then((result) => {
      if (cancelled || !result.success || !result.data?.keys) return
      const next: Record<number, string> = {}
      for (const [id, key] of Object.entries(result.data.keys)) {
        next[Number(id)] = `sk-${key}`
      }
      setResolvedKeys((prev) => ({ ...prev, ...next }))
    })

    return () => {
      cancelled = true
    }
  }, [pendingSignature])

  return resolvedKeys
}
