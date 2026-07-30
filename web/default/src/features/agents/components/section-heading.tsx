/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { AnimateInView } from '@/components/animate-in-view'

/**
 * Eyebrow / title / lede block opening each section, matching the landing page's
 * marketing rhythm. `id` is what the owning `<section>` points its aria-labelledby at.
 */
export function SectionHeading(props: {
  id: string
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <AnimateInView className='mb-8 max-w-2xl md:mb-12'>
      <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
        {props.eyebrow}
      </p>
      <h2
        id={props.id}
        className='text-2xl font-bold tracking-tight text-balance md:text-3xl'
      >
        {props.title}
      </h2>
      {props.description && (
        <p className='text-muted-foreground mt-3 text-sm leading-relaxed text-pretty md:text-base'>
          {props.description}
        </p>
      )}
    </AnimateInView>
  )
}
