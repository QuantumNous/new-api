/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Copy, Heart, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
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
import { cn } from '@/lib/utils'

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
  const describedBy = props.error ? `${id}-error` : undefined
  let field
  if (props.variable.type === 'textarea') {
    field = (
      <Textarea
        id={id}
        value={props.value}
        required={props.variable.required}
        aria-invalid={Boolean(props.error)}
        aria-describedby={describedBy}
        className='min-h-24'
        maxLength={props.variable.max_length ?? undefined}
        placeholder={props.variable.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    )
  } else if (props.variable.type === 'select') {
    field = (
      <NativeSelect
        id={id}
        value={props.value}
        required={props.variable.required}
        aria-invalid={Boolean(props.error)}
        aria-describedby={describedBy}
        className='w-full'
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.variable.options.map((option) => (
          <NativeSelectOption key={option}>{option}</NativeSelectOption>
        ))}
      </NativeSelect>
    )
  } else {
    field = (
      <Input
        id={id}
        value={props.value}
        required={props.variable.required}
        aria-invalid={Boolean(props.error)}
        aria-describedby={describedBy}
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
    <div className='space-y-1.5'>
      <label
        htmlFor={id}
        className='text-foreground/90 text-[13px] font-medium'
      >
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
  const [detailsOpen, setDetailsOpen] = useState(false)

  const targetOptions =
    props.targets ??
    (props.recipe ? applyTargetsForModality(props.recipe.modality) : [])
  const defaultTarget = targetOptions[0]?.value

  useEffect(() => {
    if (!props.recipe) return
    setValues(initialRecipeValues(props.recipe))
    setDetailsOpen(false)
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
  const canApply =
    Object.keys(compiled.errors).length === 0 && compiled.unknown.length === 0
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
  const handleApply = () => {
    if (!model) {
      toast.error(t('No compatible model is available'))
      return
    }
    const target = targetOptions.some((option) => option.value === applyTarget)
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
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='right'
        className={sideDrawerContentClassName('sm:max-w-lg')}
      >
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle className='text-balance'>{recipe.title}</SheetTitle>
          <SheetDescription className='text-pretty'>
            {recipe.description}
          </SheetDescription>
        </SheetHeader>

        <div className='flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'>
          <div className='px-4 pt-4 sm:px-6 sm:pt-5'>
            <div className='relative overflow-hidden rounded-xl'>
              <img
                src={recipe.covers.large}
                srcSet={`${recipe.covers.medium} 960w, ${recipe.covers.large} 1536w`}
                sizes='(min-width: 640px) 512px, 100vw'
                width='1536'
                height='864'
                alt={recipe.title}
                className='aspect-video w-full object-cover'
              />
              {model ? (
                <span className='absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm'>
                  <Sparkles className='size-3' aria-hidden='true' />
                  {model}
                </span>
              ) : null}
            </div>
          </div>

          <div className='flex flex-col gap-6 px-4 py-5 sm:px-6'>
            {recipe.variables.length > 0 ? (
              <section className='grid gap-4'>
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
              </section>
            ) : null}

            {compiled.unknown.length > 0 && (
              <p className='text-destructive text-xs'>
                {t('Unknown placeholders')}: {compiled.unknown.join(', ')}
              </p>
            )}

            <section className='space-y-2'>
              <div className='flex items-center justify-between'>
                <h3 className='text-[13px] font-semibold'>
                  {t('Final prompt')}
                </h3>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 gap-1.5 px-2 text-xs'
                  onClick={() => void copy()}
                >
                  <Copy className='size-3.5' aria-hidden='true' />
                  {t('Copy')}
                </Button>
              </div>
              <pre className='bg-muted/70 text-foreground/85 max-h-48 overflow-auto rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap'>
                {compiled.prompt}
              </pre>
            </section>

            <div className='border-border/60 border-t pt-1'>
              <button
                type='button'
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
                className='focus-visible:ring-ring text-muted-foreground hover:text-foreground flex w-full items-center justify-between rounded-sm py-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2'
              >
                {t('More details')}
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform duration-200',
                    detailsOpen && 'rotate-180'
                  )}
                  aria-hidden='true'
                />
              </button>

              {detailsOpen ? (
                <div className='animate-in fade-in slide-in-from-top-1 space-y-5 pt-2 duration-200'>
                  {recipe.explanation ? (
                    <p className='text-muted-foreground text-xs text-pretty'>
                      {recipe.explanation}
                    </p>
                  ) : null}

                  {recipe.examples.length > 0 ? (
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
                          <figcaption className='text-muted-foreground mt-1 text-[11px]'>
                            {example.caption}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}

                  {recipe.negative_prompt ? (
                    <section className='space-y-1.5'>
                      <h4 className='text-xs font-semibold'>
                        {t('Negative prompt')}
                      </h4>
                      <p className='bg-muted/70 text-muted-foreground rounded-lg p-3 text-xs whitespace-pre-wrap'>
                        {recipe.negative_prompt}
                      </p>
                    </section>
                  ) : null}

                  <section className='text-muted-foreground space-y-1.5 text-xs'>
                    <p>
                      <span className='text-foreground/80 font-medium'>
                        {t('Recommended')}:
                      </span>{' '}
                      {recipe.model_policy.recommended.join(', ') || '—'}
                    </p>
                    <p>
                      <span className='text-foreground/80 font-medium'>
                        {t('Compatible models')}:
                      </span>{' '}
                      {recipe.model_policy.compatible.join(', ') ||
                        t('Any model for this modality')}
                    </p>
                    <p>
                      <span className='text-foreground/80 font-medium'>
                        {t('Parameters')}:
                      </span>{' '}
                      {Object.entries(recipe.parameters)
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(' · ') || '—'}
                    </p>
                  </section>

                  <section className='space-y-2'>
                    <h4 className='text-xs font-semibold'>
                      {t('Collections')}
                    </h4>
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
                          <Checkbox
                            checked={saved}
                            onCheckedChange={() =>
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
                      <Input
                        value={collectionName}
                        onChange={(event) =>
                          setCollectionName(event.target.value)
                        }
                        placeholder={t('Collection name')}
                        className='min-w-0 flex-1'
                      />
                      <Button
                        variant='outline'
                        disabled={!collectionName.trim()}
                        onClick={() => {
                          if (!requireAuth()) return
                          mutateLibrary.mutate(async () => {
                            const collection =
                              await createInspirationCollection(
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
              ) : null}
            </div>
          </div>
        </div>

        <SheetFooter
          className={cn(
            sideDrawerFooterClassName(),
            'flex flex-col gap-3 sm:flex-col sm:items-stretch'
          )}
        >
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
          <div className='flex items-center gap-2'>
            <Button
              size='icon'
              variant='outline'
              aria-label={t('Copy prompt')}
              title={t('Copy prompt')}
              onClick={() => void copy()}
            >
              <Copy />
            </Button>
            <Button
              size='icon'
              variant='outline'
              aria-label={favorite ? t('Remove favorite') : t('Favorite')}
              title={favorite ? t('Remove favorite') : t('Favorite')}
              className={cn(favorite && 'text-rose-500')}
              onClick={() => {
                if (!requireAuth()) return
                mutateLibrary.mutate(() =>
                  setInspirationFavorite(recipe.id, !favorite)
                )
              }}
            >
              <Heart className={favorite ? 'fill-current' : ''} />
            </Button>
            <Button
              className='flex-1'
              disabled={!canApply}
              onClick={handleApply}
            >
              {props.applyLabel ? t(props.applyLabel) : t('Apply')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
