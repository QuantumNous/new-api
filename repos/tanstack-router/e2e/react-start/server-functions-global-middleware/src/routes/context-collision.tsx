import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

const collisionMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    return next({
      sendContext: {
        trustedUser: 'client-user',
        clientNonce: 'client-nonce',
      },
    })
  },
)

const getCollisionContext = createServerFn()
  .middleware([collisionMiddleware])
  .handler(({ context }) => {
    return {
      trustedUser: context.trustedUser,
      clientNonce: context.clientNonce,
    }
  })

const postCollisionContext = createServerFn({ method: 'POST' })
  .middleware([collisionMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error('Expected FormData')
    }

    return {
      attempt: String(data.get('attempt') ?? ''),
    }
  })
  .handler(({ context, data }) => {
    return {
      trustedUser: context.trustedUser,
      clientNonce: context.clientNonce,
      attempt: data.attempt,
    }
  })

type CollisionResult = {
  trustedUser: string | undefined
  clientNonce: string | undefined
}

export const Route = createFileRoute('/context-collision')({
  loader: async () => {
    return {
      loaderResult: await getCollisionContext(),
    }
  },
  component: ContextCollisionComponent,
})

function ContextCollisionResult({
  label,
  result,
  testIdPrefix,
}: {
  label: string
  result: CollisionResult | null
  testIdPrefix: string
}) {
  const status =
    result &&
    result.trustedUser === 'server-user' &&
    result.clientNonce === 'client-nonce'
      ? 'PASS'
      : 'FAIL'

  return (
    <div className="mb-4">
      <h2 className="font-semibold">{label}</h2>
      <div>
        trustedUser:{' '}
        <span data-testid={`${testIdPrefix}-trusted-user`}>
          {result?.trustedUser ?? 'pending'}
        </span>
      </div>
      <div>
        clientNonce:{' '}
        <span data-testid={`${testIdPrefix}-client-nonce`}>
          {result?.clientNonce ?? 'pending'}
        </span>
      </div>
      <div data-testid={`${testIdPrefix}-status`}>{status}</div>
    </div>
  )
}

function ContextCollisionComponent() {
  const { loaderResult } = Route.useLoaderData()
  const [getResult, setGetResult] = useState<CollisionResult | null>(null)
  const [postResult, setPostResult] = useState<CollisionResult | null>(null)

  return (
    <div className="p-8">
      <h1 className="font-bold text-lg mb-4">
        Client Context Collision Regression
      </h1>

      <p className="mb-4 text-gray-600">
        Trusted request middleware context should win over colliding client
        sendContext keys while preserving non-colliding client context.
      </p>

      <ContextCollisionResult
        label="SSR loader result"
        result={loaderResult}
        testIdPrefix="loader"
      />

      <div className="mb-4 flex gap-4">
        <button
          data-testid="invoke-get-collision"
          type="button"
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={async () => {
            setGetResult(await getCollisionContext())
          }}
        >
          Call GET server function
        </button>

        <button
          data-testid="invoke-post-collision"
          type="button"
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={async () => {
            const formData = new FormData()
            formData.set('attempt', 'formdata')
            setPostResult(await postCollisionContext({ data: formData }))
          }}
        >
          Call POST server function
        </button>
      </div>

      <ContextCollisionResult
        label="Client GET result"
        result={getResult}
        testIdPrefix="get"
      />

      <ContextCollisionResult
        label="Client FormData POST result"
        result={postResult}
        testIdPrefix="post"
      />
    </div>
  )
}
