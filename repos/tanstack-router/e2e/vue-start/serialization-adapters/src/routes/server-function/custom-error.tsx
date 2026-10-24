import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { setResponseStatus } from '@tanstack/vue-start/server'
import { defineComponent, ref } from 'vue'
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

const RouteComponent = defineComponent({
  name: 'ServerFunctionCustomErrorRoute',
  setup() {
    const validResponse = ref<any>(null)
    const invalidResponse = ref<CustomError | null>(null)

    return () => (
      <div>
        <button
          data-testid="server-function-valid-input"
          onClick={() =>
            serverFnThrowing({ data: { hello: 'world' } }).then(
              (res) => (validResponse.value = res),
            )
          }
        >
          trigger valid input
        </button>
        <div data-testid="server-function-valid-response">
          {JSON.stringify(validResponse.value)}
        </div>

        <br />
        <button
          data-testid="server-function-invalid-input"
          onClick={() =>
            serverFnThrowing({ data: { hello: 'error' } }).catch((err) => {
              if (err instanceof CustomError) {
                invalidResponse.value = err
              } else {
                throw new Error('expected CustomError')
              }
            })
          }
        >
          trigger invalid input
        </button>
        <div data-testid="server-function-invalid-response">
          {invalidResponse.value
            ? JSON.stringify({
                message: invalidResponse.value.message,
                foo: invalidResponse.value.foo,
                bar: invalidResponse.value.bar.toString(),
              })
            : JSON.stringify(invalidResponse.value)}
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/server-function/custom-error')({
  component: RouteComponent,
})
