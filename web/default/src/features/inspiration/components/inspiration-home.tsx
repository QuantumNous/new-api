/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FolderOpen, LayoutGrid } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { InspirationRecipe } from '@/features/playground/inspiration/types'
import { getModelModality } from '@/features/playground/lib/studio/model-modality'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { canTryInPlayground } from '@/features/pricing/lib/playground-eligibility'
import { createCanvasProject } from '@/features/workbench/api'
import type { CanvasDocument } from '@/features/workbench/types'
import { useAuthStore } from '@/stores/auth-store'

import { CANVAS_PROJECTS_QUERY_KEY } from '../constants'
import {
  blankCanvasDocument,
  canvasDocumentFromRecipe,
} from '../lib/recipe-canvas'
import type { AppliedInspirationRecipe, InspirationApplyOption } from '../types'
import { InspirationProjects } from './inspiration-projects'
import { InspirationTemplates } from './inspiration-templates'
import { RecipeDetail } from './recipe-detail'
import { SegmentedTabs } from './segmented-tabs'

export type InspirationView = 'templates' | 'projects'

const VIEW_TABS: Array<{
  value: InspirationView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'templates', label: 'Templates', icon: LayoutGrid },
  { value: 'projects', label: 'My projects', icon: FolderOpen },
]

const PROJECT_TARGETS: InspirationApplyOption[] = [
  { value: 'image', label: 'New project from template' },
]

export function InspirationHome(props: {
  view: InspirationView
  onViewChange: (view: InspirationView) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const pricing = usePricingData('playground')
  const [selected, setSelected] = useState<InspirationRecipe | null>(null)

  const availableModels = useMemo(
    () =>
      pricing.models.filter(canTryInPlayground).map((model) => ({
        name: model.model_name,
        modality: getModelModality(model),
      })),
    [pricing.models]
  )

  const requireAuth = () =>
    void navigate({ to: '/sign-in', search: { redirect: '/inspiration' } })

  const createProject = useMutation({
    mutationFn: (input: { title: string; doc: CanvasDocument }) =>
      createCanvasProject({
        title: input.title,
        doc: JSON.stringify(input.doc),
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({
        queryKey: CANVAS_PROJECTS_QUERY_KEY,
      })
      void navigate({
        to: '/inspiration/$projectId',
        params: { projectId: String(project.id) },
      })
    },
    onError: () => toast.error(t('Failed to create the canvas')),
  })

  const startProject = (input: { title: string; doc: CanvasDocument }) => {
    if (!user) {
      requireAuth()
      return
    }
    createProject.mutate(input)
  }

  const applyRecipe = (recipe: AppliedInspirationRecipe) =>
    startProject({
      title: recipe.title || t('Untitled canvas'),
      doc: canvasDocumentFromRecipe(recipe),
    })

  return (
    <div className='mx-auto w-full max-w-7xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8'>
      <header className='landing-animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div className='max-w-xl space-y-1.5'>
          <p className='text-primary/90 text-[11px] font-semibold tracking-[0.2em] uppercase'>
            {t('Canvas templates')}
          </p>
          <h1 className='text-2xl font-semibold tracking-tight text-balance sm:text-3xl'>
            {t('Inspiration')}
          </h1>
          <p className='text-muted-foreground text-sm text-pretty'>
            {t(
              'Start from a ready-made image or video canvas — pick one, tweak the prompt, run it.'
            )}
          </p>
        </div>
        <SegmentedTabs
          value={props.view}
          onChange={props.onViewChange}
          options={VIEW_TABS}
          ariaLabel={t('Inspiration sections')}
        />
      </header>

      <div
        className='landing-animate-fade-up mt-6'
        style={{ animationDelay: '90ms' }}
      >
        {props.view === 'templates' ? (
          <InspirationTemplates
            isAuthenticated={Boolean(user)}
            creating={createProject.isPending}
            onRequireAuth={requireAuth}
            onSelectRecipe={setSelected}
            onCreateBlank={() =>
              startProject({
                title: t('Untitled canvas'),
                doc: blankCanvasDocument(),
              })
            }
          />
        ) : (
          <InspirationProjects
            isAuthenticated={Boolean(user)}
            creating={createProject.isPending}
            onRequireAuth={requireAuth}
            onCreateBlank={() =>
              startProject({
                title: t('Untitled canvas'),
                doc: blankCanvasDocument(),
              })
            }
          />
        )}
      </div>

      <RecipeDetail
        recipe={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        isAuthenticated={Boolean(user)}
        onRequireAuth={requireAuth}
        availableModels={availableModels}
        targets={PROJECT_TARGETS}
        applyLabel='Create project'
        showAutoRun={false}
        onApply={applyRecipe}
      />
    </div>
  )
}
