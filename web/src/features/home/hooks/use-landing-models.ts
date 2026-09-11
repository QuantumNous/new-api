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

import { getLandingModels } from '../api'
import {
  DEFAULT_LANDING_MODELS,
  type LandingModelsConfig,
} from '../lib/default-landing-models'

const STORAGE_KEY = 'landing_models'

function parseConfig(raw: string | undefined | null): LandingModelsConfig {
  if (!raw) return DEFAULT_LANDING_MODELS
  try {
    const parsed = JSON.parse(raw) as Partial<LandingModelsConfig>
    if (!parsed.serviceRoutes || !parsed.coverage) {
      return DEFAULT_LANDING_MODELS
    }
    return parsed as LandingModelsConfig
  } catch {
    return DEFAULT_LANDING_MODELS
  }
}

export function useLandingModels(): LandingModelsConfig {
  const [config, setConfig] = useState<LandingModelsConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANDING_MODELS
    const cached = window.localStorage.getItem(STORAGE_KEY)
    return cached ? parseConfig(cached) : DEFAULT_LANDING_MODELS
  })

  useEffect(() => {
    let mounted = true
    getLandingModels()
      .then((res) => {
        if (!mounted) return
        if (res.success && res.data) {
          const parsed = parseConfig(res.data)
          setConfig(parsed)
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
          } catch {
            // storage unavailable
          }
        }
      })
      .catch(() => {
        // Keep the cached or default config.
      })
    return () => {
      mounted = false
    }
  }, [])

  return config
}
