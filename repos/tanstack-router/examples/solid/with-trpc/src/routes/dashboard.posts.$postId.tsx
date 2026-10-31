import * as Solid from 'solid-js'
import { Link, createFileRoute } from '@tanstack/solid-router'
import { z } from 'zod'

export const Route = createFileRoute('/dashboard/posts/$postId')({
  validateSearch: z.object({
    showNotes: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  loader: async ({
    context: { trpc },
    params: { postId },
  }): Promise<{ id: string; title: string } | undefined> =>
    trpc.post.query(postId),
  component: DashboardPostsPostIdComponent,
})

function DashboardPostsPostIdComponent() {
  const post = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [notes, setNotes] = Solid.createSignal(search().notes ?? ``)

  Solid.createEffect(
    Solid.on(notes, () => {
      navigate({
        search: (old) => ({ ...old, notes: notes() ? notes() : undefined }),
        replace: true,
        params: true,
      })
    }),
  )

  if (!post()) {
    return <div>Post not found</div>
  }

  return (
    <div class="p-2 space-y-2">
      <div class="space-y-2">
        <h2 class="font-bold text-lg">
          <input
            value={post()?.id}
            class="border border-opacity-50 rounded-sm p-2 w-full"
            disabled
          />
        </h2>
        <div>
          <textarea
            value={post()?.title}
            rows={6}
            class="border border-opacity-50 p-2 rounded-sm w-full"
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
          class="text-blue-700"
        >
          {search().showNotes ? 'Close Notes' : 'Show Notes'}{' '}
        </Link>
        {search().showNotes ? (
          <>
            <div>
              <div class="h-2" />
              <textarea
                value={notes()}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                class="shadow-sm w-full p-2 rounded-sm"
                placeholder="Write some notes here..."
              />
              <div class="italic text-xs">
                Notes are stored in the URL. Try copying the URL into a new tab!
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
