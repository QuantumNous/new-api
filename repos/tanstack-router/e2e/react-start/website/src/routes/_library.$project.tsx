import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getProject } from '~/server/projects'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_library/$project')({
  loader: ({ params: { project } }) => getProject({ data: project }),
  head: ({ loaderData }) => ({
    meta: seo({ title: `TanStack ${loaderData?.name || 'Project'}` }),
  }),
  component: () => (
    <div className="p-2">
      <Outlet />
    </div>
  ),
})
