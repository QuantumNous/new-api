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
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PageTransition } from '@/components/page-transition'
import { getModelModality } from '@/features/playground/lib/studio/model-modality'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { canTryInPlayground } from '@/features/pricing/lib/playground-eligibility'
import { useAuthStore } from '@/stores/auth-store'
import { usePlaygroundStore } from '@/stores/playground-store'

import { InspirationGallery } from './inspiration-gallery'

export function Inspiration() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const pricing = usePricingData('playground')
  const availableModels = useMemo(
    () =>
      pricing.models.filter(canTryInPlayground).map((model) => ({
        name: model.model_name,
        modality: getModelModality(model),
      })),
    [pricing.models]
  )

  return (
    <div className='playground-discover-hero min-h-svh px-3 pt-20 pb-10 sm:px-6 sm:pt-24 xl:px-8'>
      <PageTransition className='mx-auto w-full max-w-7xl space-y-6'>
        <div>
          <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
            {t('Inspiration')}
          </h1>
        </div>
        <InspirationGallery
          isAuthenticated={Boolean(user)}
          availableModels={availableModels}
          onRequireAuth={() =>
            void navigate({
              to: '/sign-in',
              search: { redirect: '/inspiration' },
            })
          }
          onApply={(recipe) => {
            const store = usePlaygroundStore.getState()
            store.selectModel(recipe.model, undefined, {
              switchModality: recipe.modality,
            })
            store.setPrefill(recipe.prompt)
            void navigate({ to: '/playground' })
          }}
        />
      </PageTransition>
    </div>
  )
}
