import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../router'
import { Spinner } from './-components/spinner'

export const Route = createFileRoute('/dashboard/posts/$postId')({
  validateSearch: z.object({
    showNotes: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  loader: async ({ context: { trpc, queryClient }, params: { postId } }) => {
    await queryClient.ensureQueryData(trpc.post.queryOptions(postId))
  },
  pendingComponent: Spinner,
  component: DashboardPostsPostIdComponent,
})

function DashboardPostsPostIdComponent() {
  const postId = Route.useParams({ select: (d) => d.postId })

  const postQuery = useQuery(trpc.post.queryOptions(postId))
  const post = postQuery.data

  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [notes, setNotes] = React.useState(search.notes ?? ``)

  React.useEffect(() => {
    navigate({
      search: (old) => ({ ...old, notes: notes ? notes : undefined }),
      replace: true,
      params: true,
    })
  }, [notes])

  if (!post) {
    return <div>Post not found</div>
  }

  return (
    <div className="p-2 space-y-2" key={post.id}>
      <div className="space-y-2">
        <h2 className="font-bold text-lg">
          <input
            defaultValue={post.id}
            className="border border-opacity-50 rounded-sm p-2 w-full"
            disabled
          />
        </h2>
        <div>
          <textarea
            defaultValue={post.title}
            rows={6}
            className="border border-opacity-50 p-2 rounded-sm w-full"
            disabled
          />
        </div>
      </div>
      <div>
        <Link
          from={Route.fullPath}
          search={(old) => ({
            ...old,
            showNotes: old.showNotes ? undefined : true,
          })}
          params={true}
          className="text-blue-700"
        >
          {search.showNotes ? 'Close Notes' : 'Show Notes'}{' '}
        </Link>
        {search.showNotes ? (
          <>
            <div>
              <div className="h-2" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="shadow-sm w-full p-2 rounded-sm"
                placeholder="Write some notes here..."
              />
              <div className="italic text-xs">
                Notes are stored in the URL. Try copying the URL into a new tab!
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
