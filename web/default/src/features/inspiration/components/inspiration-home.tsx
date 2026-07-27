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
import { cn } from '@/lib/utils'
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
    <div className='mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8'>
      <section className='border-border/60 relative overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-500/12 via-blue-500/8 to-transparent p-6 sm:p-9'>
        <div
          aria-hidden='true'
          className='pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-violet-500/20 blur-3xl'
        />
        <div className='relative max-w-2xl space-y-3'>
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {t('Inspiration')}
          </h1>
          <p className='text-muted-foreground text-sm text-pretty sm:text-base'>
            {t(
              'Pick an image or video template to start with a ready-made canvas, or open a free-form project and build your own flow.'
            )}
          </p>
        </div>
      </section>

      <div
        role='tablist'
        aria-label={t('Inspiration sections')}
        className='bg-muted/60 mt-6 inline-flex rounded-full p-1'
      >
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.value}
            type='button'
            role='tab'
            aria-selected={props.view === tab.value}
            onClick={() => props.onViewChange(tab.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              props.view === tab.value
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className='size-4' aria-hidden='true' />
            {t(tab.label)}
          </button>
        ))}
      </div>

      <div className='mt-6'>
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
