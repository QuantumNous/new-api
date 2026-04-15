import { useMutation, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'
import {
  createCustomOAuthProvider,
  updateCustomOAuthProvider,
  deleteCustomOAuthProvider,
  discoverOIDCEndpoints,
} from '../api'
import type { CustomOAuthProvider, DiscoveryResponse } from '../types'

function useInvalidateOnSuccess() {
  const queryClient = useQueryClient()
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-oauth-providers'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  }
}

export function useCreateProvider() {
  const invalidate = useInvalidateOnSuccess()

  return useMutation({
    mutationFn: (data: Omit<CustomOAuthProvider, 'id'>) =>
      createCustomOAuthProvider(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('Provider created successfully'))
        invalidate.onSuccess()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to create provider'))
    },
  })
}

export function useUpdateProvider() {
  const invalidate = useInvalidateOnSuccess()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Partial<CustomOAuthProvider>
    }) => updateCustomOAuthProvider(id, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('Provider updated successfully'))
        invalidate.onSuccess()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to update provider'))
    },
  })
}

export function useDeleteProvider() {
  const invalidate = useInvalidateOnSuccess()

  return useMutation({
    mutationFn: (id: number) => deleteCustomOAuthProvider(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('Provider deleted successfully'))
        invalidate.onSuccess()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to delete provider'))
    },
  })
}

export function useDiscoverEndpoints() {
  return useMutation({
    mutationFn: (wellKnownUrl: string) => discoverOIDCEndpoints(wellKnownUrl),
    onSuccess: (res: DiscoveryResponse) => {
      if (res.success) {
        toast.success(i18next.t('OIDC endpoints discovered successfully'))
      }
    },
    onError: (error: Error) => {
      toast.error(
        error.message || i18next.t('Failed to discover OIDC endpoints')
      )
    },
  })
}
