import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { articleData } from '../../../shared'

const ArticlePage = Vue.defineComponent({
  setup() {
    const article = Route.useLoaderData()

    return () => (
      <article>{`${article.value.title} (${article.value.words} words)`}</article>
    )
  },
})

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => articleData(params.slug),
  component: ArticlePage,
})
