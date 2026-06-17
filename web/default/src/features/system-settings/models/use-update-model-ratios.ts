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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ModelRatioData } from './model-pricing-core'

export function useUpdateModelRatios() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ModelRatioData) => {
      const parseRatioOption = (value: string) => {
        if (!value || value.trim() === '') return {}
        try {
          const parsed = JSON.parse(value)
          return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
          return {}
        }
      }

      const getCurrentOptions = async () => {
        const res = await api.get<{
          success: boolean
          message?: string
          data?: Array<{ key: string; value: string }>
        }>('/api/option/')
        const response = res.data

        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch current options')
        }

        const optionsMap: Record<string, string> = {}
        response.data?.forEach((opt) => {
          optionsMap[opt.key] = opt.value
        })
        return optionsMap
      }

      const currentOptions = await getCurrentOptions()

      const updates: Array<{ key: string; value: string }> = []

      // Parse current JSON settings
      const currentModelPrice = parseRatioOption(currentOptions.ModelPrice || '{}')
      const currentModelRatio = parseRatioOption(currentOptions.ModelRatio || '{}')
      const currentCompletionRatio = parseRatioOption(
        currentOptions.CompletionRatio || '{}'
      )
      const currentCacheRatio = parseRatioOption(currentOptions.CacheRatio || '{}')
      const currentCreateCacheRatio = parseRatioOption(
        currentOptions.CreateCacheRatio || '{}'
      )
      const currentImageRatio = parseRatioOption(currentOptions.ImageRatio || '{}')
      const currentAudioRatio = parseRatioOption(currentOptions.AudioRatio || '{}')
      const currentAudioCompletionRatio = parseRatioOption(
        currentOptions.AudioCompletionRatio || '{}'
      )
      const currentBillingMode = parseRatioOption(
        currentOptions['billing_setting.billing_mode'] || '{}'
      )
      const currentBillingExpr = parseRatioOption(
        currentOptions['billing_setting.billing_expr'] || '{}'
      )

      const hasValue = (value: unknown) =>
        value !== '' && value !== null && value !== undefined && value !== false

      const toNumberOrString = (value?: string) => {
        if (!hasValue(value)) return null
        const num = Number(value)
        return Number.isFinite(num) ? num : null
      }

      const modelName = data.name

      // Update billing mode
      if (data.billingMode === 'tiered_expr') {
        currentBillingMode[modelName] = 'tiered_expr'
        currentBillingExpr[modelName] = data.billingExpr || ''
        // Clear token-based pricing
        delete currentModelPrice[modelName]
        delete currentModelRatio[modelName]
        delete currentCompletionRatio[modelName]
        delete currentCacheRatio[modelName]
        delete currentCreateCacheRatio[modelName]
        delete currentImageRatio[modelName]
        delete currentAudioRatio[modelName]
        delete currentAudioCompletionRatio[modelName]
      } else if (data.billingMode === 'per-request') {
        // Fixed price per request
        delete currentBillingMode[modelName]
        delete currentBillingExpr[modelName]

        const priceValue = toNumberOrString(data.price)
        if (hasValue(priceValue)) {
          currentModelPrice[modelName] = priceValue
        } else {
          delete currentModelPrice[modelName]
        }

        // Clear token-based ratios
        delete currentModelRatio[modelName]
        delete currentCompletionRatio[modelName]
        delete currentCacheRatio[modelName]
        delete currentCreateCacheRatio[modelName]
        delete currentImageRatio[modelName]
        delete currentAudioRatio[modelName]
        delete currentAudioCompletionRatio[modelName]
      } else {
        // Per-token pricing
        delete currentBillingMode[modelName]
        delete currentBillingExpr[modelName]
        delete currentModelPrice[modelName]

        const ratioValue = toNumberOrString(data.ratio)
        if (hasValue(ratioValue)) {
          currentModelRatio[modelName] = ratioValue
        } else {
          delete currentModelRatio[modelName]
        }

        const completionValue = toNumberOrString(data.completionRatio)
        if (hasValue(completionValue)) {
          currentCompletionRatio[modelName] = completionValue
        } else {
          delete currentCompletionRatio[modelName]
        }

        const cacheValue = toNumberOrString(data.cacheRatio)
        if (hasValue(cacheValue)) {
          currentCacheRatio[modelName] = cacheValue
        } else {
          delete currentCacheRatio[modelName]
        }

        const createCacheValue = toNumberOrString(data.createCacheRatio)
        if (hasValue(createCacheValue)) {
          currentCreateCacheRatio[modelName] = createCacheValue
        } else {
          delete currentCreateCacheRatio[modelName]
        }

        const imageValue = toNumberOrString(data.imageRatio)
        if (hasValue(imageValue)) {
          currentImageRatio[modelName] = imageValue
        } else {
          delete currentImageRatio[modelName]
        }

        const audioValue = toNumberOrString(data.audioRatio)
        if (hasValue(audioValue)) {
          currentAudioRatio[modelName] = audioValue
        } else {
          delete currentAudioRatio[modelName]
        }

        const audioCompletionValue = toNumberOrString(data.audioCompletionRatio)
        if (hasValue(audioCompletionValue)) {
          currentAudioCompletionRatio[modelName] = audioCompletionValue
        } else {
          delete currentAudioCompletionRatio[modelName]
        }
      }

      // Prepare updates
      updates.push(
        { key: 'ModelPrice', value: JSON.stringify(currentModelPrice) },
        { key: 'ModelRatio', value: JSON.stringify(currentModelRatio) },
        { key: 'CompletionRatio', value: JSON.stringify(currentCompletionRatio) },
        { key: 'CacheRatio', value: JSON.stringify(currentCacheRatio) },
        { key: 'CreateCacheRatio', value: JSON.stringify(currentCreateCacheRatio) },
        { key: 'ImageRatio', value: JSON.stringify(currentImageRatio) },
        { key: 'AudioRatio', value: JSON.stringify(currentAudioRatio) },
        {
          key: 'AudioCompletionRatio',
          value: JSON.stringify(currentAudioCompletionRatio),
        },
        {
          key: 'billing_setting.billing_mode',
          value: JSON.stringify(currentBillingMode),
        },
        {
          key: 'billing_setting.billing_expr',
          value: JSON.stringify(currentBillingExpr),
        }
      )

      // Send all updates
      for (const update of updates) {
        const res = await api.put('/api/option/', update)
        const response = res.data
        if (!response.success) {
          throw new Error(response.message || 'Failed to update option')
        }
      }

      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      queryClient.invalidateQueries({ queryKey: ['enabled-models'] })
    },
  })
}
