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

interface CommissionConfig {
  enabled: boolean
  maxLevel: number
}

const DEFAULT_CONFIG: CommissionConfig = {
  enabled: false,
  maxLevel: 3,
}

/**
 * Hook to get commission system configuration from /api/status
 * Reads commission_enabled and commission_max_level
 */
export function useCommissionConfig(): CommissionConfig & { loading: boolean } {
  const [config, setConfig] = useState<CommissionConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/status')
        if (!response.ok) return

        const data = await response.json()
        if (!data.success) return

        setConfig({
          enabled: data.data?.commission_enabled ?? false,
          maxLevel: data.data?.commission_max_level ?? 3,
        })
      } catch (error) {
        console.error('Failed to load commission config:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [])

  return { ...config, loading }
}
