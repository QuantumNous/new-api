import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export interface PublicPricingDTO {
  id: number
  plan_key: string
  locale: string
  title: string
  description: string
  billing_mode: string
  price_text: string
  features: string // JSON 数组字符串
  sort: number
  enabled: boolean
}

export interface PublicModelCategoryDTO {
  id: number
  category: string
  locale: string
  title: string
  description: string
  models: string // JSON 数组字符串
  sort: number
  enabled: boolean
}

function localeParam(): string {
  const { i18n } = useTranslation()
  return i18n.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function usePublicPricing() {
  const locale = localeParam()
  return useQuery<PublicPricingDTO[]>({
    queryKey: ['public-pricing', locale],
    queryFn: async () => {
      const res = await fetch(`/api/public/pricing?locale=${locale}`)
      const json = await res.json()
      return json?.data ?? []
    },
  })
}

export function usePublicModelCategories() {
  const locale = localeParam()
  return useQuery<PublicModelCategoryDTO[]>({
    queryKey: ['public-model-categories', locale],
    queryFn: async () => {
      const res = await fetch(`/api/public/model-categories?locale=${locale}`)
      const json = await res.json()
      return json?.data ?? []
    },
  })
}
