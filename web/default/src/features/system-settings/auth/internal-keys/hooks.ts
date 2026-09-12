import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'

import {
  createInternalKey,
  deleteInternalKey,
  getInternalKeys,
  updateInternalKey,
} from './api'

const INTERNAL_KEYS_QUERY_KEY = ['internal-keys'] as const

export function useInternalKeys() {
  return useQuery({
    queryKey: INTERNAL_KEYS_QUERY_KEY,
    queryFn: async () => {
      const res = await getInternalKeys()
      return res.data ?? []
    },
  })
}

export function useCreateInternalKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      key_id: string
      name: string
      status: number
      key?: string
    }) => createInternalKey(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('Internal key created'))
        queryClient.invalidateQueries({ queryKey: INTERNAL_KEYS_QUERY_KEY })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to create internal key'))
    },
  })
}

export function useUpdateInternalKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      id: number
      name: string
      status: number
      key?: string
    }) => updateInternalKey(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('Internal key updated'))
        queryClient.invalidateQueries({ queryKey: INTERNAL_KEYS_QUERY_KEY })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to update internal key'))
    },
  })
}

export function useDeleteInternalKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteInternalKey(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('Internal key deleted'))
        queryClient.invalidateQueries({ queryKey: INTERNAL_KEYS_QUERY_KEY })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to delete internal key'))
    },
  })
}
