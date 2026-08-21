import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { docsDescription, docsSectionHead, docsTitle } from '../../../shared'

const DocsSectionPage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <article>
        <h1>{docsTitle(params.value.section)}</h1>
        <p>{docsDescription(params.value.section)}</p>
      </article>
    )
  },
})

export const Route = createFileRoute('/docs/$section')({
  head: ({ params }) => docsSectionHead(params.section),
  component: DocsSectionPage,
})
