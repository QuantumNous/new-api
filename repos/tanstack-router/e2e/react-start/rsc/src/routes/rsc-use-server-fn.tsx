import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { pageStyles } from '~/utils/styles'

const getMessage = createServerFn({ method: 'GET' }).handler(async () => {
  return 'useServerFn works with RSC builds'
})

export const Route = createFileRoute('/rsc-use-server-fn')({
  component: RscUseServerFnComponent,
})

function RscUseServerFnComponent() {
  const getMessageFn = useServerFn(getMessage)
  const [message, setMessage] = React.useState('')

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-use-server-fn-title" style={pageStyles.title}>
        useServerFn with RSC
      </h1>
      <button
        type="button"
        data-testid="rsc-use-server-fn-button"
        onClick={async () => {
          setMessage(await getMessageFn())
        }}
      >
        Call server function
      </button>
      <p data-testid="rsc-use-server-fn-message">
        {message || 'No message yet'}
      </p>
    </div>
  )
}
