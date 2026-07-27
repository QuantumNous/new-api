/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  getInspirationLibrary,
  listInspirationCategories,
  listInspirationTemplates,
  recordInspirationEvents,
  setInspirationFavorite,
} from '@/features/playground/api'
import type { InspirationRecipe } from '@/features/playground/inspiration/types'

import type { RecipeApplyHandler } from '../types'
import { RecipeCard } from './recipe-card'
import { RecipeDetail } from './recipe-detail'

type InspirationGalleryProps = {
  isAuthenticated: boolean
  availableModels: Array<{ name: string; modality: string }>
  onRequireAuth: () => void
  onApply: RecipeApplyHandler
}

/**
 * Compact template browser embedded in the canvas editor sheet. The landing
 * page uses {@link InspirationTemplates} instead.
 */
export function InspirationGallery(props: InspirationGalleryProps) {
  const { t } = useTranslation()
  const [category, setCategory] = useState('all')
  const [modality, setModality] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InspirationRecipe | null>(null)

  const categories = useQuery({
    queryKey: ['playground', 'inspiration', 'categories'],
    queryFn: listInspirationCategories,
    staleTime: 60_000,
  })
  const recipes = useQuery({
    queryKey: ['playground', 'inspiration', 'templates', category, modality],
    queryFn: () =>
      listInspirationTemplates({
        category: category === 'all' ? undefined : category,
        modality: modality === 'all' ? undefined : modality,
        page_size: 50,
      }),
    staleTime: 60_000,
  })
  const library = useQuery({
    queryKey: ['playground', 'inspiration', 'library'],
    queryFn: getInspirationLibrary,
    enabled: props.isAuthenticated,
  })

  const favorites = new Set(
    library.data?.saves
      .filter((save) => save.collection_id === 0)
      .map((save) => save.template_id)
  )
  const visible = useMemo(
    () =>
      (recipes.data ?? []).filter((recipe) =>
        `${recipe.title} ${recipe.description} ${recipe.tags.join(' ')}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [recipes.data, search]
  )

  const favorite = async (recipe: InspirationRecipe) => {
    if (!props.isAuthenticated) {
      props.onRequireAuth()
      return
    }
    await setInspirationFavorite(recipe.id, !favorites.has(recipe.id))
    await library.refetch()
  }

  if (recipes.isError) {
    return (
      <div className='py-16 text-center'>
        <p className='text-muted-foreground mb-3 text-sm'>
          {t('Could not load recipes')}
        </p>
        <Button onClick={() => void recipes.refetch()}>{t('Try again')}</Button>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 md:flex-row'>
        <label className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-3 size-4' />
          <span className='sr-only'>{t('Search')}</span>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Search')}
            className='border-input h-9 w-full rounded-md border pl-9 text-sm'
          />
        </label>
        <select
          aria-label={t('Category')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className='border-input h-9 rounded-md border px-3 text-sm'
        >
          <option value='all'>{t('All')}</option>
          {categories.data?.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Modality')}
          value={modality}
          onChange={(event) => setModality(event.target.value)}
          className='border-input h-9 rounded-md border px-3 text-sm'
        >
          <option value='all'>{t('All')}</option>
          {['chat', 'image', 'video', 'audio'].map((item) => (
            <option key={item} value={item}>
              {t(item.charAt(0).toUpperCase() + item.slice(1))}
            </option>
          ))}
        </select>
      </div>
      {recipes.isLoading && (
        <div className='text-muted-foreground flex justify-center gap-2 py-16 text-sm'>
          <Loader2 className='size-4 animate-spin' />
          {t('Loading')}
        </div>
      )}
      {!recipes.isLoading && visible.length === 0 && (
        <div className='py-16 text-center'>
          <p className='text-muted-foreground mb-3 text-sm'>
            {t('No results found')}
          </p>
          <Button
            variant='outline'
            onClick={() => {
              setSearch('')
              setCategory('all')
              setModality('all')
            }}
          >
            {t('Clear filters')}
          </Button>
        </div>
      )}
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {visible.map((recipe) => (
          <RecipeCard
            key={`${recipe.id}-${recipe.version_id}`}
            recipe={recipe}
            compact
            favorite={favorites.has(recipe.id)}
            onFavorite={() => void favorite(recipe)}
            onOpen={() => {
              setSelected(recipe)
              void recordInspirationEvents(recipe, 'open')
            }}
          />
        ))}
      </div>
      <RecipeDetail
        recipe={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        isAuthenticated={props.isAuthenticated}
        onRequireAuth={props.onRequireAuth}
        availableModels={props.availableModels}
        onApply={props.onApply}
      />
    </div>
  )
}
