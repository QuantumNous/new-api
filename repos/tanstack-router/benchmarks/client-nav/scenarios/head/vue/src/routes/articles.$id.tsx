import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { articleDescription, articleHead, articleTitle } from '../../../shared'

const ArticlePage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <article>
        <h1>{articleTitle(params.value.id)}</h1>
        <p>{articleDescription(params.value.id)}</p>
      </article>
    )
  },
})

export const Route = createFileRoute('/articles/$id')({
  head: ({ params }) => articleHead(params.id),
  component: ArticlePage,
})
