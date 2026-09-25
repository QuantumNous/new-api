import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'

export const Route = createFileRoute('/submit-post-formdata')({
  component: SubmitPostFormDataFn,
})

const testValues = {
  name: 'Sean',
}

export const greetUser = createServerFn({ method: 'POST' })
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) {
      throw new Error('Invalid! FormData is required')
    }
    const name = data.get('name')

    if (!name) {
      throw new Error('Name is required')
    }

    return {
      name: name.toString(),
    }
  })
  .handler(({ data: { name } }) => {
    return new Response(`Hello, ${name}!`)
  })

function SubmitPostFormDataFn() {
  return (
    <div class="p-2 m-2 grid gap-2">
      <h3>Submit POST FormData Fn Call</h3>
      <div class="overflow-y-auto">
        It should return navigate and return{' '}
        <code>
          <pre data-testid="expected-submit-post-formdata-server-fn-result">
            Hello, {testValues.name}!
          </pre>
        </code>
      </div>
      <form
        class="flex flex-col gap-2"
        data-testid="submit-post-formdata-form"
        method="post"
        action={greetUser.url}
      >
        <input type="text" name="name" value={testValues.name} />
        <button
          type="submit"
          data-testid="test-submit-post-formdata-fn-calls-btn"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Submit (native)
        </button>
      </form>
    </div>
  )
}
