import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { homeHead, homeTitle } from '../../../shared'

const HomePage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <h1>{homeTitle}</h1>
        <p>Landing page</p>
      </main>
    )
  },
})

export const Route = createFileRoute('/')({
  head: homeHead,
  component: HomePage,
})
