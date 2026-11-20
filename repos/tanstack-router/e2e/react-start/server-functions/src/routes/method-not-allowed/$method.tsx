import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import z from 'zod'

export const Route = createFileRoute('/method-not-allowed/$method')({
  params: z.object({
    method: z.union([
      z.literal('undefined'),
      z.literal('get'),
      z.literal('post'),
    ]),
  }),
  component: MethodNotAllowedFn,
})

export const getableServerFn = createServerFn({ method: 'GET' }).handler(() => {
  return new Response('Hello, World!')
})

export const undefinedMethodServerFn = createServerFn().handler(() => {
  return new Response('Hello, World!')
})

export const postableServerFn = createServerFn({ method: 'POST' }).handler(
  () => {
    return new Response('Hello, World!')
  },
)

const TEST_METHODS = ['GET', 'POST', 'PUT', 'OPTIONS'] as const
const SERVER_FN_URLS = {
  undefined: undefinedMethodServerFn.url,
  get: getableServerFn.url,
  post: postableServerFn.url,
}
function MethodButton({
  testMethod,
  serverFnUrl,
}: {
  testMethod: string
  serverFnUrl: string
}) {
  const [fetchResult, setFetchResult] = useState<
    readonly [number, string] | null
  >(null)

  const fetchFn = async () => {
    const response = await fetch(serverFnUrl, {
      method: testMethod,
    })
    setFetchResult([response.status, await response.text()])
  }

  const lower = testMethod.toLowerCase()

  return (
    <>
      <button data-testid={`${lower}-button`} onClick={fetchFn}>
        Fetch {testMethod}
      </button>
      <pre data-testid={`${lower}-fetch-result`}>
        {JSON.stringify(fetchResult)}
      </pre>
    </>
  )
}

function MethodNotAllowedFn() {
  const { method } = Route.useParams()
  const serverFnUrl = SERVER_FN_URLS[method]

  return (
    <div className="flex flex-col gap-2">
      <h1>Method Not Allowed {method.toUpperCase()}</h1>

      {TEST_METHODS.map((testMethod) => (
        <MethodButton
          key={testMethod}
          testMethod={testMethod}
          serverFnUrl={serverFnUrl}
        />
      ))}
    </div>
  )
}
