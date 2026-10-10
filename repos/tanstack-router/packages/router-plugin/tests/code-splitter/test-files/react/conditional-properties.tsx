import { createFileRoute } from '@tanstack/react-router'
import { isEnabled } from '@features/feature-flags'
import TrueImport from '@modules/true-component'
import { FalseComponent, falseLoader } from '@modules/false-component'

export const Route = createFileRoute('/posts')({
  component: isEnabled ? TrueImport.Component : FalseComponent,
  loader: isEnabled ? TrueImport.loader : falseLoader,
})
