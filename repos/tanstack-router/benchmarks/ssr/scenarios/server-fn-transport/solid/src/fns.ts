import { RawStream, createServerFn } from '@tanstack/solid-start'

type FormEchoData = {
  alpha: string
  beta: string
  gamma: string
  upload: File
}

const streamChunkCount = 8
const streamChunkSize = 1024

function getStringField(formData: FormData, field: string) {
  const value = formData.get(field)

  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string`)
  }

  return value
}

function validateFormData(input: unknown): FormEchoData {
  if (!(input instanceof FormData)) {
    throw new Error('Expected FormData input')
  }

  const upload = input.get('upload')
  if (!(upload instanceof File)) {
    throw new Error('Expected upload to be a File')
  }

  return {
    alpha: getStringField(input, 'alpha'),
    beta: getStringField(input, 'beta'),
    gamma: getStringField(input, 'gamma'),
    upload,
  }
}

function validateString(input: unknown) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('Expected non-empty string input')
  }

  return input
}

function createDeterministicStream(seed: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let chunkIndex = 0; chunkIndex < streamChunkCount; chunkIndex++) {
        const chunk = new Uint8Array(streamChunkSize)

        for (let byteIndex = 0; byteIndex < chunk.length; byteIndex++) {
          chunk[byteIndex] =
            (seed.charCodeAt(byteIndex % seed.length) +
              byteIndex +
              chunkIndex) &
            0xff
        }

        controller.enqueue(chunk)
      }

      controller.close()
    },
  })
}

export const formEcho = createServerFn({ method: 'POST' })
  .validator(validateFormData)
  .handler(async ({ data }) => {
    const contents = await data.upload.text()

    return {
      alpha: data.alpha,
      beta: data.beta,
      gamma: data.gamma,
      fileName: data.upload.name,
      fileSize: data.upload.size,
      filePreview: contents.slice(0, 32),
    }
  })

export const rawResp = createServerFn({ method: 'GET' })
  .validator(validateString)
  .handler(({ data }) => {
    return new Response(`raw-${data}`, {
      headers: { 'content-type': 'text/plain' },
    })
  })

export const streamOut = createServerFn({ method: 'GET' })
  .validator(validateString)
  .handler(({ data }) => {
    return {
      label: `stream-${data}`,
      data: new RawStream(createDeterministicStream(data)),
    }
  })
