import { useSystemConfigStore } from '@/stores/system-config-store'

export function useCommissionConfig() {
  const config = useSystemConfigStore((state) => state.config)
  return {
    commissionEnabled: config.commissionEnabled ?? false,
    commissionMaxLevel: config.commissionMaxLevel ?? 3,
  }
}
