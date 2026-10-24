import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { docsLayoutHead } from '../../../shared'

const DocsLayout = Vue.defineComponent({
  setup() {
    return () => (
      <section>
        <h2>Docs</h2>
        <Outlet />
      </section>
    )
  },
})

export const Route = createFileRoute('/docs')({
  head: docsLayoutHead,
  component: DocsLayout,
})
