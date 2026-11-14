import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'
import { createServerFn } from '@tanstack/solid-start'

export const Route = createFileRoute('/multipart')({
  component: MultipartServerFnCall,
})

const multipartFormDataServerFn = createServerFn({ method: 'POST' })
  .validator((x: unknown) => {
    if (!(x instanceof FormData)) {
      throw new Error('Invalid form data')
    }

    const value = x.get('input_field')
    const file = x.get('input_file')

    if (typeof value !== 'string') {
      throw new Error('Submitted value is not a string')
    }

    if (!(file instanceof File)) {
      throw new Error('File is required')
    }

    return {
      submittedValue: value,
      file,
    }
  })
  .handler(async ({ data }) => {
    const contents = await data.file.text()
    return {
      value: data.submittedValue,
      file: {
        name: data.file.name,
        size: data.file.size,
        contents: contents,
      },
    }
  })

function MultipartServerFnCall() {
  let formRef: HTMLFormElement | undefined
  const [multipartResult, setMultipartResult] = Solid.createSignal({})

  const handleSubmit = (e: any) => {
    e.preventDefault()

    if (!formRef) {
      return
    }

    const formData = new FormData(formRef)
    multipartFormDataServerFn({ data: formData }).then(setMultipartResult)
  }

  return (
    <div class="p-2 m-2 grid gap-2">
      <h3>Multipart Server Fn POST Call</h3>
      <div class="overflow-y-auto">
        It should return{' '}
        <code>
          <pre data-testid="expected-multipart-server-fn-result">
            {JSON.stringify({
              value: 'test field value',
              file: { name: 'my_file.txt', size: 9, contents: 'test data' },
            })}
          </pre>
        </code>
      </div>
      <form
        class="flex flex-col gap-2"
        action={multipartFormDataServerFn.url}
        method="post"
        enctype="multipart/form-data"
        ref={formRef}
        data-testid="multipart-form"
      >
        <input type="text" name="input_field" value="test field value" />
        <input
          type="file"
          name="input_file"
          data-testid="multipart-form-file-input"
        />
        <button
          type="submit"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Submit (native)
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Submit (onClick)
        </button>
      </form>
      <div class="overflow-y-auto">
        <pre data-testid="multipart-form-response">
          {JSON.stringify(multipartResult())}
        </pre>
      </div>
    </div>
  )
}
