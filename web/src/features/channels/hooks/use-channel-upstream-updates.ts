import { useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { normalizeModelList } from '../lib/upstream-update-utils'

function getManualIgnoredModelCount(settings: unknown): number {
  let parsed: Record<string, unknown> | null = null
  if (settings && typeof settings === 'object')
    parsed = settings as Record<string, unknown>
  else if (typeof settings === 'string') {
    try {
      parsed = JSON.parse(settings)
    } catch {
      parsed = null
    }
  }
  if (!parsed) return 0
  return normalizeModelList(
    (parsed.upstream_model_update_ignored_models as unknown[]) || []
  ).length
}

export function useChannelUpstreamUpdates(refresh: () => Promise<void>) {
  const { t } = useTranslation()

  const [showModal, setShowModal] = useState(false)
  const [channel, setChannel] = useState<{
    id: number
    [key: string]: unknown
  } | null>(null)
  const [addModels, setAddModels] = useState<string[]>([])
  const [removeModels, setRemoveModels] = useState<string[]>([])
  const [preferredTab, setPreferredTab] = useState<'add' | 'remove'>('add')
  const [applyLoading, setApplyLoading] = useState(false)
  const [detectAllLoading, setDetectAllLoading] = useState(false)
  const [applyAllLoading, setApplyAllLoading] = useState(false)

  const applyRef = useRef(false)
  const detectRef = useRef(false)
  const detectAllRef = useRef(false)
  const applyAllRef = useRef(false)

  const openModal = useCallback(
    (
      record: { id: number; [key: string]: unknown } | null,
      pendingAdd: string[] = [],
      pendingRemove: string[] = [],
      tab: 'add' | 'remove' = 'add'
    ) => {
      const normAdd = normalizeModelList(pendingAdd)
      const normRemove = normalizeModelList(pendingRemove)
      if (!record?.id || (normAdd.length === 0 && normRemove.length === 0)) {
        toast.info(t('No processable upstream model updates for this channel'))
        return
      }
      setChannel(record)
      setAddModels(normAdd)
      setRemoveModels(normRemove)
      setPreferredTab(tab)
      setShowModal(true)
    },
    [t]
  )

  const closeModal = useCallback(() => {
    setShowModal(false)
    setChannel(null)
    setAddModels([])
    setRemoveModels([])
    setPreferredTab('add')
  }, [])

  const applyUpdates = useCallback(
    async ({
      addModels: selectedAdd = [],
      removeModels: selectedRemove = [],
    }: {
      addModels?: string[]
      removeModels?: string[]
    } = {}) => {
      if (applyRef.current) return
      if (!channel?.id) {
        closeModal()
        return
      }
      applyRef.current = true
      setApplyLoading(true)
      try {
        const normSelectedAdd = normalizeModelList(selectedAdd)
        const selectedAddSet = new Set(normSelectedAdd)
        const ignoreModels = addModels.filter((m) => !selectedAddSet.has(m))

        const res = await api.post(
          '/api/channel/upstream_updates/apply',
          {
            id: channel.id,
            add_models: normSelectedAdd,
            ignore_models: ignoreModels,
            remove_models: normalizeModelList(selectedRemove),
          },
          { skipErrorHandler: true } as Record<string, unknown>
        )
        const { success, message, data } = res.data || {}
        if (!success) {
          toast.error(message || t('Operation failed'))
          return
        }

        toast.success(
          t(
            'Upstream model updates applied: {{added}} added, {{removed}} removed, {{ignored}} ignored this time, {{totalIgnored}} total ignored models',
            {
              added: data?.added_models?.length || 0,
              removed: data?.removed_models?.length || 0,
              ignored: normalizeModelList(ignoreModels).length,
              totalIgnored: getManualIgnoredModelCount(data?.settings),
            }
          )
        )
        closeModal()
        await refresh()
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { message?: string } }
          message?: string
        }
        toast.error(
          err?.response?.data?.message || err?.message || t('Operation failed')
        )
      } finally {
        applyRef.current = false
        setApplyLoading(false)
      }
    },
    [channel, addModels, closeModal, refresh, t]
  )

  const applyAllUpdates = useCallback(async () => {
    if (applyAllRef.current) return
    applyAllRef.current = true
    setApplyAllLoading(true)
    try {
      const res = await api.post(
        '/api/channel/upstream_updates/apply_all',
        {},
        { skipErrorHandler: true } as Record<string, unknown>
      )
      const { success, message, data } = res.data || {}
      if (!success) {
        toast.error(message || t('Batch processing failed'))
        return
      }

      toast.success(
        t(
          'Batch upstream model updates applied: {{channels}} channels, {{added}} added, {{removed}} removed, {{fails}} failed',
          {
            channels: data?.processed_channels || 0,
            added: data?.added_models || 0,
            removed: data?.removed_models || 0,
            fails: (data?.failed_channel_ids || []).length,
          }
        )
      )
      await refresh()
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } }
        message?: string
      }
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          t('Batch processing failed')
      )
    } finally {
      applyAllRef.current = false
      setApplyAllLoading(false)
    }
  }, [refresh, t])

  const detectChannelUpdates = useCallback(
    async (ch: { id: number; [key: string]: unknown } | null) => {
      if (detectRef.current || !ch?.id) return
      detectRef.current = true
      try {
        const res = await api.post(
          '/api/channel/upstream_updates/detect',
          { id: ch.id },
          { skipErrorHandler: true } as Record<string, unknown>
        )
        const { success, message, data } = res.data || {}
        if (!success) {
          toast.error(message || t('Detection failed'))
          return
        }

        toast.success(
          t('Detection complete: {{add}} to add, {{remove}} to remove', {
            add: data?.add_models?.length || 0,
            remove: data?.remove_models?.length || 0,
          })
        )
        await refresh()
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { message?: string } }
          message?: string
        }
        toast.error(
          err?.response?.data?.message || err?.message || t('Detection failed')
        )
      } finally {
        detectRef.current = false
      }
    },
    [refresh, t]
  )

  const detectAllUpdates = useCallback(async () => {
    if (detectAllRef.current) return
    detectAllRef.current = true
    setDetectAllLoading(true)
    try {
      const res = await api.post(
        '/api/channel/upstream_updates/detect_all',
        {},
        { skipErrorHandler: true } as Record<string, unknown>
      )
      const { success, message, data } = res.data || {}
      if (!success) {
        toast.error(message || t('Batch detection failed'))
        return
      }

      toast.success(
        t(
          'Batch detection complete: {{channels}} channels, {{add}} to add, {{remove}} to remove, {{fails}} failed',
          {
            channels: data?.processed_channels || 0,
            add: data?.detected_add_models || 0,
            remove: data?.detected_remove_models || 0,
            fails: (data?.failed_channel_ids || []).length,
          }
        )
      )
      await refresh()
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } }
        message?: string
      }
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          t('Batch detection failed')
      )
    } finally {
      detectAllRef.current = false
      setDetectAllLoading(false)
    }
  }, [refresh, t])

  return {
    showModal,
    channel,
    addModels,
    removeModels,
    preferredTab,
    applyLoading,
    detectAllLoading,
    applyAllLoading,
    openModal,
    closeModal,
    applyUpdates,
    applyAllUpdates,
    detectChannelUpdates,
    detectAllUpdates,
  }
}
