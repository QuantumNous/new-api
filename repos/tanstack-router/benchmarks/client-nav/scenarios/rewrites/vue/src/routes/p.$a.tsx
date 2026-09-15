import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { sectionLabel } from '../../../shared'

const SectionPage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <section>
        <h1>{sectionLabel(params.value.a)}</h1>
        <Outlet />
      </section>
    )
  },
})

export const Route = createFileRoute('/p/$a')({
  component: SectionPage,
})
