import { api } from '@/lib/api'
import type { PricingData } from './type'

// ----------------------------------------------------------------------------
// Pricing APIs
// ----------------------------------------------------------------------------

// Get model pricing data
export async function getPricing(): Promise<PricingData> {
  const res = await api.get('/api/pricing')
  return res.data
}
