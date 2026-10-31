import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'

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
  const formRef = React.useRef<HTMLFormElement | null>(null)
  const [multipartResult, setMultipartResult] = React.useState({})

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    if (!formRef.current) {
      return
    }

    const formData = new FormData(formRef.current)
    multipartFormDataServerFn({ data: formData }).then(setMultipartResult)
  }

  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>Multipart Server Fn POST Call</h3>
      <div className="overflow-y-auto">
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
        className="flex flex-col gap-2"
        action={multipartFormDataServerFn.url}
        method="POST"
        encType="multipart/form-data"
        ref={formRef}
        data-testid="multipart-form"
      >
        <input type="text" name="input_field" defaultValue="test field value" />
        <input
          type="file"
          name="input_file"
          data-testid="multipart-form-file-input"
        />
        <button
          type="submit"
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Submit (native)
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Submit (onClick)
        </button>
      </form>
      <div className="overflow-y-auto">
        <pre data-testid="multipart-form-response">
          {JSON.stringify(multipartResult)}
        </pre>
      </div>
    </div>
  )
}
