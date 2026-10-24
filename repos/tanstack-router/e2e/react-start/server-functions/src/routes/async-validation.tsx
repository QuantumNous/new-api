import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import React from 'react'
import { z } from 'zod'

export const Route = createFileRoute('/async-validation')({
  component: RouteComponent,
})

const asyncValidationSchema = z
  .string()
  .refine((data) => Promise.resolve(data !== 'invalid'))

const asyncValidationServerFn = createServerFn()
  .validator(asyncValidationSchema)
  .handler(({ data }) => data)

function RouteComponent() {
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>(
    undefined,
  )
  const [result, setResult] = React.useState<string | undefined>(undefined)

  const callServerFn = async (value: string) => {
    setErrorMessage(undefined)
    setResult(undefined)

    try {
      const serverFnResult = await asyncValidationServerFn({ data: value })
      setResult(serverFnResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'unknown')
    }
  }

  return (
    <div>
      <button
        data-testid="run-with-valid-btn"
        onClick={() => {
          callServerFn('valid')
        }}
      >
        call server function with valid value
      </button>
      <br />
      <button
        data-testid="run-with-invalid-btn"
        onClick={() => {
          callServerFn('invalid')
        }}
      >
        call server function with invalid value
      </button>
      <div className="p-2">
        result: <p data-testid="result">{result ?? '$undefined'}</p>
      </div>
      <div className="p-2">
        message:{' '}
        <p data-testid="errorMessage">{errorMessage ?? '$undefined'}</p>
      </div>
    </div>
  )
}
