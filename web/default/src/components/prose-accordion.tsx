/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { ReactNode } from 'react'

import { AnimateInView } from '@/components/animate-in-view'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

/** One collapsible row: a question or an install target. */
export interface ProseAccordionEntry {
  id: string
  label: string
  body: ReactNode
}

/**
 * The card-framed accordion the install guide and the FAQ both render. Both are long-form
 * prose in identical chrome, so the shell lives here and the sections supply only content.
 */
export function ProseAccordion(props: { entries: ProseAccordionEntry[] }) {
  return (
    <AnimateInView delay={80}>
      <Accordion className='border-border bg-card rounded-2xl border px-4 shadow-xs'>
        {props.entries.map((entry) => (
          <AccordionItem key={entry.id} value={entry.id}>
            <AccordionTrigger className='text-sm font-medium'>
              {entry.label}
            </AccordionTrigger>
            <AccordionContent className='text-muted-foreground space-y-2 pb-4 text-sm leading-6'>
              {entry.body}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </AnimateInView>
  )
}
