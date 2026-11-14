import { createFileRoute } from '@tanstack/vue-router'
import { EditingBComponent } from '../components/EditingBComponent'

export const Route = createFileRoute('/editing-b')({
  component: EditingBComponent,
})
