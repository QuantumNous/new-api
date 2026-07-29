/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import { Image as ImageIcon, Loader2, Plus, Search, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getInspirationLibrary,
  listInspirationCategories,
  listInspirationTemplates,
  recordInspirationEvents,
  setInspirationFavorite,
} from '@/features/playground/api'
import type { InspirationRecipe } from '@/features/playground/inspiration/types'

import type { InspirationSeries } from '../types'
import { RecipeCard } from './recipe-card'
import { SegmentedTabs } from './segmented-tabs'

const SERIES_TABS: Array<{
  value: InspirationSeries
  label: string
  icon: typeof ImageIcon
}> = [
  { value: 'image', label: 'Image series', icon: ImageIcon },
  { value: 'video', label: 'Video series', icon: Video },
]

type InspirationTemplatesProps = {
  isAuthenticated: boolean
  creating: boolean
  onRequireAuth: () => void
  onSelectRecipe: (recipe: InspirationRecipe) => void
  onCreateBlank: () => void
}

export function InspirationTemplates(props: InspirationTemplatesProps) {
  const { t } = useTranslation()
  const [series, setSeries] = useState<InspirationSeries>('image')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const categories = useQuery({
    queryKey: ['playground', 'inspiration', 'categories'],
    queryFn: listInspirationCategories,
    staleTime: 60_000,
  })
  const recipes = useQuery({
    queryKey: ['playground', 'inspiration', 'templates', category, series],
    queryFn: () =>
      listInspirationTemplates({
        category: category === 'all' ? undefined : category,
        modality: series,
        page_size: 60,
      }),
    staleTime: 60_000,
  })
  const library = useQuery({
    queryKey: ['playground', 'inspiration', 'library'],
    queryFn: getInspirationLibrary,
    enabled: props.isAuthenticated,
  })

  const favorites = useMemo(
    () =>
      new Set(
        library.data?.saves
          .filter((save) => save.collection_id === 0)
          .map((save) => save.template_id)
      ),
    [library.data]
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

  const toggleFavorite = async (recipe: InspirationRecipe) => {
    if (!props.isAuthenticated) {
      props.onRequireAuth()
      return
    }
    await setInspirationFavorite(recipe.id, !favorites.has(recipe.id))
    await library.refetch()
  }

  return (
    <section className='space-y-5'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
        <SegmentedTabs
          value={series}
          onChange={setSeries}
          options={SERIES_TABS}
          ariaLabel={t('Template series')}
        />

        <div className='flex flex-1 flex-col gap-3 sm:flex-row lg:justify-end'>
          <label className='relative sm:w-64'>
            <Search
              className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2'
              aria-hidden='true'
            />
            <span className='sr-only'>{t('Search templates')}</span>
            <Input
              type='search'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search templates')}
              className='pl-9'
            />
          </label>
          <NativeSelect
            aria-label={t('Category')}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className='w-full sm:w-auto'
          >
            <NativeSelectOption value='all'>
              {t('All categories')}
            </NativeSelectOption>
            {categories.data?.map((item) => (
              <NativeSelectOption key={item.slug} value={item.slug}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {recipes.isError ? (
        <ErrorState
          title={t('Could not load recipes')}
          onRetry={() => void recipes.refetch()}
        />
      ) : null}

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        <button
          type='button'
          disabled={props.creating}
          onClick={props.onCreateBlank}
          className='border-border/60 hover:border-primary/50 hover:bg-accent/30 group focus-visible:ring-ring flex min-h-[14rem] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed p-6 text-center transition-[border-color,background-color] outline-none focus-visible:ring-2 disabled:opacity-60'
        >
          <span className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110'>
            {props.creating ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Plus className='size-4' />
            )}
          </span>
          <span className='text-sm font-semibold'>
            {t('New free-form project')}
          </span>
          <span className='text-muted-foreground max-w-[15rem] text-xs text-pretty'>
            {t('Start from an empty canvas and compose your own workflow.')}
          </span>
        </button>

        {recipes.isLoading
          ? null
          : visible.map((recipe, index) => (
              <div
                key={`${recipe.id}-${recipe.version_id}`}
                className='landing-animate-fade-up'
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <RecipeCard
                  recipe={recipe}
                  favorite={favorites.has(recipe.id)}
                  onFavorite={() => void toggleFavorite(recipe)}
                  onOpen={() => {
                    props.onSelectRecipe(recipe)
                    void recordInspirationEvents(recipe, 'open')
                  }}
                />
              </div>
            ))}
      </div>

      {recipes.isLoading ? (
        <div
          className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          aria-busy='true'
          aria-label={t('Loading')}
        >
          {Array.from({ length: 4 }, (_, i) => `recipe-skeleton-${i}`).map(
            (key) => (
              <div
                key={key}
                className='border-border/50 space-y-3 overflow-hidden rounded-xl border p-3'
              >
                <Skeleton className='aspect-[4/3] w-full rounded-lg' />
                <Skeleton className='h-4 w-3/4' />
              </div>
            )
          )}
        </div>
      ) : null}

      {!recipes.isLoading && !recipes.isError && visible.length === 0 ? (
        <EmptyState
          icon={Search}
          bordered={false}
          className='min-h-[180px]'
          title={t('No results found')}
          action={
            <Button
              variant='outline'
              onClick={() => {
                setSearch('')
                setCategory('all')
              }}
            >
              {t('Clear filters')}
            </Button>
          }
        />
      ) : null}
    </section>
  )
}
