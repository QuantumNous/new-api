import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const BlogIndexPage = Vue.defineComponent({
  setup() {
    return () => <p>All articles</p>
  },
})

export const Route = createFileRoute('/blog/')({
  component: BlogIndexPage,
})
