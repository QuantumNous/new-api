/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Heart, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  createInspirationCollection,
  getInspirationLibrary,
  listInspirationCategories,
  listInspirationTemplates,
  recordInspirationEvents,
  setInspirationCollectionTemplate,
  setInspirationFavorite,
} from '@/features/playground/api'
import {
  compileRecipe,
  initialRecipeValues,
  resolveRecipeModel,
  type RecipeFieldError,
  type RecipeValues,
} from '@/features/playground/inspiration/compile-recipe'
import type {
  InspirationRecipe,
  InspirationVariable,
} from '@/features/playground/inspiration/types'
import type { StudioModality } from '@/features/playground/types'

export type AppliedInspirationRecipe = {
  id: number
  versionId: number
  title: string
  modality: StudioModality
  model: string
  prompt: string
  negativePrompt?: string
  parameters: Record<string, unknown>
}

type Props = {
  isAuthenticated: boolean
  availableModels: Array<{ name: string; modality: string }>
  onRequireAuth: () => void
  onApply: (recipe: AppliedInspirationRecipe) => void
}

function RecipeCard(props: {
  recipe: InspirationRecipe
  favorite: boolean
  onOpen: () => void
  onFavorite: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        void recordInspirationEvents(props.recipe, 'impression')
        observer.disconnect()
      },
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [props.recipe])
  return (
    <article
      ref={ref}
      className='border-border bg-card overflow-hidden rounded-xl border shadow-xs'
    >
      <button
        type='button'
        onClick={props.onOpen}
        className='focus-visible:ring-ring block w-full text-left outline-none focus-visible:ring-2'
      >
        <img
          src={props.recipe.covers.medium}
          srcSet={`${props.recipe.covers.small} 480w, ${props.recipe.covers.medium} 960w, ${props.recipe.covers.large} 1536w`}
          sizes='(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw'
          width='960'
          height='540'
          loading='lazy'
          decoding='async'
          alt={props.recipe.title}
          className='aspect-video w-full object-cover'
        />
        <div className='space-y-2 p-3'>
          <div className='flex items-start justify-between gap-3'>
            <h2 className='text-sm font-semibold text-balance'>
              {props.recipe.title}
            </h2>
            <span className='text-muted-foreground shrink-0 text-[10px] tabular-nums'>
              {props.recipe.use_count} {t('uses')}
            </span>
          </div>
          <p className='text-muted-foreground line-clamp-2 text-xs text-pretty'>
            {props.recipe.description}
          </p>
          <div className='flex flex-wrap gap-1'>
            {props.recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]'
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </button>
      <div className='border-border flex justify-end border-t p-2'>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          aria-label={props.favorite ? t('Remove favorite') : t('Favorite')}
          onClick={props.onFavorite}
        >
          <Heart className={props.favorite ? 'fill-current' : ''} />
        </Button>
      </div>
    </article>
  )
}

function VariableField(props: {
  variable: InspirationVariable
  value: string | number
  error?: RecipeFieldError
  onChange: (value: string | number) => void
}) {
  const { t } = useTranslation()
  const id = `recipe-${props.variable.key}`
  const common = {
    id,
    value: props.value,
    required: props.variable.required,
    'aria-invalid': Boolean(props.error),
    'aria-describedby': props.error ? `${id}-error` : undefined,
    className:
      'border-input bg-background h-9 w-full rounded-md border px-3 text-sm',
  }
  let field
  if (props.variable.type === 'textarea') {
    field = (
      <textarea
        {...common}
        className={`${common.className} min-h-24 py-2`}
        maxLength={props.variable.max_length ?? undefined}
        placeholder={props.variable.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    )
  } else if (props.variable.type === 'select') {
    field = (
      <select
        {...common}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.variable.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    )
  } else {
    field = (
      <input
        {...common}
        type={props.variable.type}
        min={props.variable.min ?? undefined}
        max={props.variable.max ?? undefined}
        maxLength={props.variable.max_length ?? undefined}
        placeholder={props.variable.placeholder}
        onChange={(event) =>
          props.onChange(
            props.variable.type === 'number'
              ? event.target.valueAsNumber
              : event.target.value
          )
        }
      />
    )
  }
  return (
    <div className='space-y-1'>
      <label htmlFor={id} className='text-sm font-medium'>
        {props.variable.label}
        {props.variable.required ? ' *' : ''}
      </label>
      {field}
      {props.error && (
        <p id={`${id}-error`} className='text-destructive text-xs'>
          {t(props.error.key, props.error.values)}
        </p>
      )}
    </div>
  )
}

function RecipeDetail(props: {
  recipe: InspirationRecipe | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isAuthenticated: boolean
  onRequireAuth: () => void
  availableModels: Props['availableModels']
  onApply: Props['onApply']
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<RecipeValues>({})
  const [collectionName, setCollectionName] = useState('')
  useEffect(() => {
    if (props.recipe) {
      setValues(initialRecipeValues(props.recipe))
    }
  }, [props.recipe])
  const compiled = props.recipe ? compileRecipe(props.recipe, values) : null
  const library = useQuery({
    queryKey: ['playground', 'inspiration', 'library'],
    queryFn: getInspirationLibrary,
    enabled: props.isAuthenticated && props.open,
  })
  const mutateLibrary = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['playground', 'inspiration', 'library'],
      }),
    onError: () => toast.error(t('Something went wrong')),
  })
  if (!props.recipe || !compiled) return null
  const recipe = props.recipe
  const favorite =
    library.data?.saves.some(
      (save) =>
        save.template_id === props.recipe?.id && save.collection_id === 0
    ) ?? false
  const model = resolveRecipeModel(
    props.recipe,
    props.availableModels
      .filter((item) => item.modality === props.recipe?.modality)
      .map((item) => item.name)
  )
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(compiled.prompt)
      void recordInspirationEvents(recipe, 'copy')
      toast.success(t('Copied'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }
  const requireAuth = () => {
    if (props.isAuthenticated) return true
    props.onRequireAuth()
    return false
  }
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='right'
        className='w-full overflow-y-auto sm:max-w-2xl'
      >
        <SheetHeader>
          <SheetTitle className='text-balance'>{props.recipe.title}</SheetTitle>
          <SheetDescription className='text-pretty'>
            {props.recipe.description}
          </SheetDescription>
        </SheetHeader>
        <div className='space-y-5 px-4 pb-4'>
          <img
            src={props.recipe.covers.large}
            srcSet={`${props.recipe.covers.medium} 960w, ${props.recipe.covers.large} 1536w`}
            sizes='(min-width: 640px) 640px, 100vw'
            width='1536'
            height='864'
            alt={props.recipe.title}
            className='aspect-video w-full rounded-lg object-cover'
          />
          {props.recipe.examples.length > 0 && (
            <div className='grid grid-cols-2 gap-2'>
              {props.recipe.examples.map((example) => (
                <figure key={example.url}>
                  <img
                    src={example.url}
                    alt={example.caption}
                    width='640'
                    height='360'
                    className='aspect-video rounded-md object-cover'
                  />
                  <figcaption className='text-muted-foreground mt-1 text-xs'>
                    {example.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {props.recipe.explanation && (
            <p className='text-muted-foreground text-sm text-pretty'>
              {props.recipe.explanation}
            </p>
          )}
          <div className='grid gap-3'>
            {props.recipe.variables.map((variable) => (
              <VariableField
                key={variable.key}
                variable={variable}
                value={values[variable.key] ?? ''}
                error={compiled.errors[variable.key]}
                onChange={(value) =>
                  setValues((current) => ({
                    ...current,
                    [variable.key]: value,
                  }))
                }
              />
            ))}
          </div>
          {compiled.unknown.length > 0 && (
            <p className='text-destructive text-xs'>
              {t('Unknown placeholders')}: {compiled.unknown.join(', ')}
            </p>
          )}
          <section className='space-y-2'>
            <h3 className='text-sm font-semibold'>{t('Final prompt')}</h3>
            <pre className='bg-muted max-h-56 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap'>
              {compiled.prompt}
            </pre>
          </section>
          {props.recipe.negative_prompt && (
            <section className='space-y-2'>
              <h3 className='text-sm font-semibold'>{t('Negative prompt')}</h3>
              <p className='bg-muted text-muted-foreground rounded-lg p-3 text-xs whitespace-pre-wrap'>
                {props.recipe.negative_prompt}
              </p>
            </section>
          )}
          <section className='space-y-2 text-sm'>
            <p>
              <strong>{t('Recommended')}:</strong>{' '}
              {props.recipe.model_policy.recommended.join(', ') || '—'}
            </p>
            <p>
              <strong>{t('Compatible models')}:</strong>{' '}
              {props.recipe.model_policy.compatible.join(', ') ||
                t('Any model for this modality')}
            </p>
            <p>
              <strong>{t('Parameters')}:</strong>{' '}
              {Object.entries(props.recipe.parameters)
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(' · ') || '—'}
            </p>
          </section>
          <section className='space-y-2'>
            <h3 className='text-sm font-semibold'>{t('Collections')}</h3>
            {library.data?.collections.map((collection) => {
              const saved = library.data.saves.some(
                (save) =>
                  save.template_id === props.recipe?.id &&
                  save.collection_id === collection.id
              )
              return (
                <label
                  key={collection.id}
                  className='flex items-center gap-2 text-sm'
                >
                  <input
                    type='checkbox'
                    checked={saved}
                    onChange={() =>
                      mutateLibrary.mutate(() =>
                        setInspirationCollectionTemplate(
                          collection.id,
                          recipe.id,
                          !saved
                        )
                      )
                    }
                  />
                  {collection.name}
                </label>
              )
            })}
            <div className='flex gap-2'>
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                placeholder={t('Collection name')}
                className='border-input h-9 min-w-0 flex-1 rounded-md border px-3 text-sm'
              />
              <Button
                variant='outline'
                disabled={!collectionName.trim()}
                onClick={() => {
                  if (!requireAuth()) return
                  mutateLibrary.mutate(async () => {
                    const collection = await createInspirationCollection(
                      collectionName.trim()
                    )
                    await setInspirationCollectionTemplate(
                      collection.id,
                      recipe.id,
                      true
                    )
                    setCollectionName('')
                  })
                }}
              >
                {t('Create')}
              </Button>
            </div>
          </section>
        </div>
        <SheetFooter className='bg-background sticky bottom-0 border-t sm:flex-col sm:items-stretch'>
          <div className='flex flex-wrap gap-2 sm:flex-row sm:justify-end'>
            <Button variant='outline' onClick={() => void copy()}>
              <Copy />
              {t('Copy prompt')}
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                if (!requireAuth()) return
                mutateLibrary.mutate(() =>
                  setInspirationFavorite(recipe.id, !favorite)
                )
              }}
            >
              <Heart className={favorite ? 'fill-current' : ''} />
              {t('Favorite')}
            </Button>
            <Button
              disabled={
                Object.keys(compiled.errors).length > 0 ||
                compiled.unknown.length > 0
              }
              onClick={() => {
                if (!model) {
                  toast.error(t('No compatible model is available'))
                  return
                }
                props.onApply({
                  id: recipe.id,
                  versionId: recipe.version_id,
                  title: recipe.title,
                  modality: recipe.modality,
                  model,
                  prompt: compiled.prompt,
                  negativePrompt: recipe.negative_prompt,
                  parameters: recipe.parameters,
                })
                void recordInspirationEvents(recipe, 'apply')
                props.onOpenChange(false)
              }}
            >
              {t('Apply')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function InspirationGallery(props: Props) {
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
