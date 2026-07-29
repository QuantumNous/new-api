/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ArrowUpRight, Heart, Play, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { recordInspirationEvents } from '@/features/playground/api'
import type { InspirationRecipe } from '@/features/playground/inspiration/types'
import { cn } from '@/lib/utils'

type RecipeCardProps = {
  recipe: InspirationRecipe
  favorite: boolean
  /** Compact cards keep the in-canvas gallery dense; landing cards are taller. */
  compact?: boolean
  onOpen: () => void
  onFavorite: () => void
}

export function RecipeCard(props: RecipeCardProps) {
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

  const isVideo = props.recipe.modality === 'video'

  return (
    <article
      ref={ref}
      data-card-hover='true'
      className='group border-border/50 bg-card hover:border-border relative isolate overflow-hidden rounded-xl border shadow-xs'
    >
      <button
        type='button'
        onClick={props.onOpen}
        className='focus-visible:ring-ring block w-full text-left outline-none focus-visible:ring-2'
      >
        <div
          className={cn(
            'bg-muted relative w-full overflow-hidden',
            props.compact ? 'aspect-[16/10]' : 'aspect-[4/3]'
          )}
        >
          <img
            src={props.recipe.covers.medium}
            srcSet={`${props.recipe.covers.small} 480w, ${props.recipe.covers.medium} 960w, ${props.recipe.covers.large} 1536w`}
            sizes='(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw'
            width='960'
            height='720'
            loading='lazy'
            decoding='async'
            alt={props.recipe.title}
            className='size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]'
          />
          <div className='absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
          <span className='absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm'>
            {isVideo ? (
              <Play className='size-3' aria-hidden='true' />
            ) : (
              <Sparkles className='size-3' aria-hidden='true' />
            )}
            {isVideo ? t('Video series') : t('Image series')}
          </span>
          <span className='transition-ui pointer-events-none absolute right-3 bottom-3 inline-flex translate-y-1 items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-black opacity-0 shadow-sm duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100'>
            {t('Use template')}
            <ArrowUpRight className='size-3.5' aria-hidden='true' />
          </span>
        </div>
        <div className='space-y-1.5 p-3.5'>
          <div className='flex items-baseline justify-between gap-3'>
            <h3 className='text-sm leading-snug font-semibold text-balance'>
              {props.recipe.title}
            </h3>
            <span className='text-muted-foreground/80 shrink-0 text-[11px] tabular-nums'>
              {props.recipe.use_count} {t('uses')}
            </span>
          </div>
          <p className='text-muted-foreground line-clamp-1 text-xs text-pretty'>
            {props.recipe.description}
          </p>
        </div>
      </button>
      <button
        type='button'
        aria-label={props.favorite ? t('Remove favorite') : t('Favorite')}
        className={cn(
          'absolute top-2 right-2 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-[background-color,transform] duration-200 hover:scale-105 hover:bg-black/60',
          props.favorite && 'text-rose-400'
        )}
        onClick={props.onFavorite}
      >
        <Heart
          className={cn('size-4', props.favorite && 'fill-current')}
          aria-hidden='true'
        />
      </button>
    </article>
  )
}
