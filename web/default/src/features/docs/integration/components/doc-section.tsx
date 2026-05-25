import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DocStepListProps = {
  steps: ReactNode[]
  className?: string
}

export function DocStepList(props: DocStepListProps) {
  return (
    <ol className={cn('list-decimal space-y-6 ps-5 marker:font-semibold', props.className)}>
      {props.steps.map((step, index) => (
        <li key={index} className='text-muted-foreground ps-2 leading-relaxed'>
          {step}
        </li>
      ))}
    </ol>
  )
}

type DocSectionProps = {
  title: string
  children: ReactNode
  id?: string
}

export function DocSection(props: DocSectionProps) {
  return (
    <section id={props.id} className='scroll-mt-24 space-y-4'>
      <h2 className='text-foreground text-xl font-semibold tracking-tight'>
        {props.title}
      </h2>
      <div className='space-y-4'>{props.children}</div>
    </section>
  )
}

type DocPageHeaderProps = {
  title: string
  description: string
}

export function DocPageHeader(props: DocPageHeaderProps) {
  return (
    <header className='space-y-3 border-b pb-8'>
      <h1 className='text-3xl font-bold tracking-tight'>{props.title}</h1>
      <p className='text-muted-foreground text-lg leading-relaxed'>
        {props.description}
      </p>
    </header>
  )
}
