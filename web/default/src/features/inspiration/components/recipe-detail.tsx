/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
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

import {
  applyTargetsForModality,
  AUTORUN_STORAGE_KEY,
  readAutorunPreference,
} from '../lib/apply-targets'
import type {
  InspirationApplyOption,
  InspirationApplyTarget,
  RecipeApplyHandler,
} from '../types'

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

type RecipeDetailProps = {
  recipe: InspirationRecipe | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isAuthenticated: boolean
  onRequireAuth: () => void
  availableModels: Array<{ name: string; modality: string }>
  /** Apply destinations; the picker hides itself when a single target is given. */
  targets?: InspirationApplyOption[]
  applyLabel?: string
  showAutoRun?: boolean
  onApply: RecipeApplyHandler
}

export function RecipeDetail(props: RecipeDetailProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<RecipeValues>({})
  const [collectionName, setCollectionName] = useState('')
  const [applyTarget, setApplyTarget] =
    useState<InspirationApplyTarget>('image')
  const [autoRun, setAutoRun] = useState(readAutorunPreference)

  const targetOptions =
    props.targets ??
    (props.recipe ? applyTargetsForModality(props.recipe.modality) : [])
  const defaultTarget = targetOptions[0]?.value

  useEffect(() => {
    if (!props.recipe) return
    setValues(initialRecipeValues(props.recipe))
    if (defaultTarget) setApplyTarget(defaultTarget)
  }, [props.recipe, defaultTarget])

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
      (save) => save.template_id === recipe.id && save.collection_id === 0
    ) ?? false
  const model = resolveRecipeModel(
    recipe,
    props.availableModels
      .filter((item) => item.modality === recipe.modality)
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
          <SheetTitle className='text-balance'>{recipe.title}</SheetTitle>
          <SheetDescription className='text-pretty'>
            {recipe.description}
          </SheetDescription>
        </SheetHeader>
        <div className='space-y-5 px-4 pb-4'>
          <img
            src={recipe.covers.large}
            srcSet={`${recipe.covers.medium} 960w, ${recipe.covers.large} 1536w`}
            sizes='(min-width: 640px) 640px, 100vw'
            width='1536'
            height='864'
            alt={recipe.title}
            className='aspect-video w-full rounded-lg object-cover'
          />
          {recipe.examples.length > 0 && (
            <div className='grid grid-cols-2 gap-2'>
              {recipe.examples.map((example) => (
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
          {recipe.explanation && (
            <p className='text-muted-foreground text-sm text-pretty'>
              {recipe.explanation}
            </p>
          )}
          <div className='grid gap-3'>
            {recipe.variables.map((variable) => (
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
          {recipe.negative_prompt && (
            <section className='space-y-2'>
              <h3 className='text-sm font-semibold'>{t('Negative prompt')}</h3>
              <p className='bg-muted text-muted-foreground rounded-lg p-3 text-xs whitespace-pre-wrap'>
                {recipe.negative_prompt}
              </p>
            </section>
          )}
          <section className='space-y-2 text-sm'>
            <p>
              <strong>{t('Recommended')}:</strong>{' '}
              {recipe.model_policy.recommended.join(', ') || '—'}
            </p>
            <p>
              <strong>{t('Compatible models')}:</strong>{' '}
              {recipe.model_policy.compatible.join(', ') ||
                t('Any model for this modality')}
            </p>
            <p>
              <strong>{t('Parameters')}:</strong>{' '}
              {Object.entries(recipe.parameters)
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(' · ') || '—'}
            </p>
          </section>
          <section className='space-y-2'>
            <h3 className='text-sm font-semibold'>{t('Collections')}</h3>
            {library.data?.collections.map((collection) => {
              const saved = library.data.saves.some(
                (save) =>
                  save.template_id === recipe.id &&
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
          {targetOptions.length > 1 || props.showAutoRun !== false ? (
            <div className='flex flex-wrap items-center gap-3'>
              {targetOptions.length > 1 ? (
                <NativeSelect
                  value={applyTarget}
                  aria-label={t('Apply target')}
                  onChange={(event) =>
                    setApplyTarget(event.target.value as InspirationApplyTarget)
                  }
                >
                  {targetOptions.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {t(option.label)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : null}
              {props.showAutoRun === false ? null : (
                <label className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={autoRun}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true
                      setAutoRun(enabled)
                      try {
                        window.localStorage.setItem(
                          AUTORUN_STORAGE_KEY,
                          enabled ? '1' : '0'
                        )
                      } catch {
                        // The preference remains active for this session.
                      }
                    }}
                  />
                  {t('Generate right away')}
                </label>
              )}
            </div>
          ) : null}
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
                const target = targetOptions.some(
                  (option) => option.value === applyTarget
                )
                  ? applyTarget
                  : (targetOptions[0]?.value ?? 'note')
                props.onApply(
                  {
                    id: recipe.id,
                    versionId: recipe.version_id,
                    title: recipe.title,
                    modality: recipe.modality,
                    model,
                    prompt: compiled.prompt,
                    negativePrompt: recipe.negative_prompt,
                    parameters: recipe.parameters,
                  },
                  { target, autoRun }
                )
                void recordInspirationEvents(recipe, 'apply')
                props.onOpenChange(false)
              }}
            >
              {props.applyLabel ? t(props.applyLabel) : t('Apply')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
