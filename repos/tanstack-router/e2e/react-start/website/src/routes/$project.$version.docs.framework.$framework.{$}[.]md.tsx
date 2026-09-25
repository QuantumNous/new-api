import { createFileRoute } from '@tanstack/react-router'
import { getDocument } from '~/server/document'

export const Route = createFileRoute(
  '/$project/$version/docs/framework/$framework/{$}.md',
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = params['_splat'] || ''
        const docPath = splat.split('.md')[0]
        if (!docPath) {
          return new Response('Document not found', { status: 404 })
        }
        const doc = await getDocument({ data: docPath })
        const markdown = `# ${doc.title}\n\n${doc.content}`
        return new Response(markdown, {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': `inline; filename="${doc.title}.md"`,
          },
        })
      },
    },
  },
})
