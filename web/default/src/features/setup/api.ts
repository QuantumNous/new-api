import { api } from '@/lib/api'
import type { SetupFormValues, SetupResponse } from './types'

export async function getSetupStatus(): Promise<SetupResponse> {
  const res = await api.get('/api/setup', {
    // We want fresh status on every visit.
    params: {
      t: Date.now(),
    },
  })
  return res.data
}

export async function submitSetup(
  payload: Record<string, unknown>
): Promise<SetupResponse> {
  const res = await api.post('/api/setup', payload)
  return res.data
}

export function buildSetupPayload(
  values: SetupFormValues,
  rootInitialized: boolean
) {
  const { usageMode, ...rest } = values

  const basePayload = {
    SelfUseModeEnabled: usageMode === 'self',
    DemoSiteEnabled: usageMode === 'demo',
  }

  if (rootInitialized) {
    return basePayload
  }

  return {
    ...rest,
    ...basePayload,
  }
}
