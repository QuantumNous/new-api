import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateSystemOption } from '../api'
import type { UpdateOptionRequest } from '../types'

export function useUpdateOption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateOptionRequest) => updateSystemOption(request),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['system-options'] })
        toast.success('Setting updated successfully')
      } else {
        toast.error(data.message || 'Failed to update setting')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update setting')
    },
  })
}
