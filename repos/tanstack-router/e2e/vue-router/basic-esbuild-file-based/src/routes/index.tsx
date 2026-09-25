import { createFileRoute } from '@tanstack/vue-router'
import VueLogo from '../components/VueLogo.vue'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div class="p-2">
      <h3>Welcome Home!</h3>
      <VueLogo textColor="orange" />
    </div>
  )
}
