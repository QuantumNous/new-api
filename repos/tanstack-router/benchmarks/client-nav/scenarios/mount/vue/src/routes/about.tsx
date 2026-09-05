import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const AboutPage = Vue.defineComponent({
  setup() {
    return () => <p>About</p>
  },
})

export const Route = createFileRoute('/about')({
  component: AboutPage,
})
