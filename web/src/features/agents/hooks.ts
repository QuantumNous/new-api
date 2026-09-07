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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { useAuthStore } from '@/stores/auth-store'

import { getAgentSelf, getCustomerPrice, previewAgentInvitation } from './api'

export function useInvitationPreview(token: string | null) {
  const [expired, setExpired] = useState(false)
  const query = useQuery({
    queryKey: ['agent-invitation-preview', token],
    queryFn: () => previewAgentInvitation(token ?? ''),
    enabled: token !== null,
    retry: false,
    staleTime: 0,
    refetchInterval: 30000,
  })
  useEffect(() => {
    const expiry = query.data?.expires_at
    setExpired(expiry !== undefined && Date.now() >= expiry * 1000)
    if (expiry === undefined) return
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, expiry * 1000 - Date.now())
    )
    return () => window.clearTimeout(timer)
  }, [token, query.data?.expires_at])
  return {
    query,
    blocked: token !== null && (!query.data || !!query.error || expired),
    expired,
  }
}

export function useAgentSelf() {
  const userId = useAuthStore((state) => state.auth.user?.id)
  return useQuery({
    queryKey: ['agent-self', userId],
    queryFn: getAgentSelf,
    enabled: Boolean(userId),
    staleTime: 15000,
    refetchInterval: 30000,
  })
}
export function useCustomerPrice() {
  const userId = useAuthStore((state) => state.auth.user?.id)
  return useQuery({
    queryKey: ['agent-customer-price', userId],
    queryFn: getCustomerPrice,
    enabled: Boolean(userId),
    staleTime: 0,
    refetchInterval: 15000,
  })
}
