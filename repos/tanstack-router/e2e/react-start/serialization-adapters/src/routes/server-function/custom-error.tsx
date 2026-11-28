import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { useState } from 'react'
import { z } from 'zod'
import { CustomError } from '~/CustomError'

const schema = z.object({ hello: z.string() })
const serverFnThrowing = createServerFn()
  .validator(schema)
  .handler(async ({ data }) => {
    if (data.hello === 'world') {
      return 'Hello, world!'
    }
    setResponseStatus(499)
    throw new CustomError('Invalid input', { foo: 'bar', bar: BigInt(123) })
  })

export const Route = createFileRoute('/server-function/custom-error')({
  component: RouteComponent,
})

function RouteComponent() {
  const [validResponse, setValidResponse] = useState<any>(null)
  const [invalidResponse, setInvalidResponse] = useState<CustomError | null>(
    null,
  )

  return (
    <div>
      <button
        data-testid="server-function-valid-input"
        onClick={() =>
          serverFnThrowing({ data: { hello: 'world' } }).then(setValidResponse)
        }
      >
        trigger valid input
      </button>
      <div data-testid="server-function-valid-response">
        {JSON.stringify(validResponse)}
      </div>

      <br />
      <button
        data-testid="server-function-invalid-input"
        onClick={() =>
          serverFnThrowing({ data: { hello: 'error' } }).catch((err) => {
            if (err instanceof CustomError) {
              setInvalidResponse(err)
            } else {
              throw new Error('expected CustomError')
            }
          })
        }
      >
        trigger invalid input
      </button>
      <div data-testid="server-function-invalid-response">
        {invalidResponse
          ? JSON.stringify({
              message: invalidResponse.message,
              foo: invalidResponse.foo,
              bar: invalidResponse.bar.toString(),
            })
          : JSON.stringify(validResponse)}
      </div>
    </div>
  )
}
