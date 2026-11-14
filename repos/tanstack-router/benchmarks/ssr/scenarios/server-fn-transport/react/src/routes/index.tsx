import { createFileRoute } from '@tanstack/react-router'
import { formEcho, rawResp, streamOut } from '../fns'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <main
      data-form={formEcho.url}
      data-raw={rawResp.url}
      data-stream={streamOut.url}
    >
      server-fn transport benchmark
    </main>
  )
}
