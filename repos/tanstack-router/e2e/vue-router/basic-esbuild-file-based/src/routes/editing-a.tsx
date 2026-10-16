import { createFileRoute } from '@tanstack/vue-router'
import { EditingAComponent } from '../components/EditingAComponent'

export const Route = createFileRoute('/editing-a')({
  component: EditingAComponent,
})
