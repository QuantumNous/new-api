import { createFileRoute } from '@tanstack/react-router'
import { Board } from '~/components/Board'
import { Loader } from '~/components/Loader'
import { boardQueries } from '~/queries'

export const Route = createFileRoute('/boards/$boardId')({
  component: Home,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(boardQueries.detail(params.boardId))
  },
})

function Home() {
  const { boardId } = Route.useParams()

  return <Board boardId={boardId} />
}
