import {
  ErrorComponent,
  useLocation,
  createFileRoute,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { NotFound } from '~/components/NotFound'
import { getDocument } from '~/server/document'
import { capitalize, seo } from '~/utils/seo'

export const Route = createFileRoute(
  '/$project/$version/docs/framework/$framework/$',
)({
  loader: ({ params: { _splat } }) =>
    getDocument({
      data: _splat!,
    }),
  head: ({ loaderData, params }) => ({
    meta: seo({
      title: `${loaderData?.title || 'Project'} | TanStack ${capitalize(params.project)} ${capitalize(params.framework)}`,
    }),
  }),
  errorComponent: PostErrorComponent,
  component: Page,
  notFoundComponent: () => {
    return <NotFound>Document not found</NotFound>
  },
})

function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

function Page() {
  const pathname = useLocation({ select: (s) => s.pathname })
  const post = Route.useLoaderData()

  return (
    <div className="space-y-2">
      <h4
        data-testid="selected-doc-heading"
        className="text-xl font-bold underline"
      >
        {post.title}
      </h4>
      <div className="text-sm">{post.content}</div>
      <p className="py-2">
        <a href={pathname + '.md'} className="underline text-blue-500">
          View Raw Content
        </a>
      </p>
    </div>
  )
}
