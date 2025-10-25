import { type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteVendor as deleteVendorAPI } from '../api'
import { vendorsQueryKeys, modelsQueryKeys } from './query-keys'

// ============================================================================
// Vendor Actions
// ============================================================================

/**
 * Delete a vendor
 */
export async function handleDeleteVendor(
  id: number,
  queryClient?: QueryClient,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await deleteVendorAPI(id)
    if (response.success) {
      toast.success('Vendor deleted successfully')
      queryClient?.invalidateQueries({ queryKey: vendorsQueryKeys.lists() })
      queryClient?.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
      onSuccess?.()
    } else {
      toast.error(response.message || 'Failed to delete vendor')
    }
  } catch (error: any) {
    toast.error(error?.message || 'Failed to delete vendor')
  }
}
