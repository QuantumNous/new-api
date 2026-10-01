import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { blogContext } from '../../../shared'

const BlogLayout = Vue.defineComponent({
  setup() {
    return () => (
      <section>
        <h2>Blog</h2>
        <Outlet />
      </section>
    )
  },
})

export const Route = createFileRoute('/blog')({
  beforeLoad: () => blogContext(),
  component: BlogLayout,
})
