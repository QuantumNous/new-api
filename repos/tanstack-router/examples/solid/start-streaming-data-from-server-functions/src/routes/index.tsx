import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { createSignal } from 'solid-js'
import { z } from 'zod'

/**
  This schema will be used to define the type
  of each chunk in the `ReadableStream`.
  (It mimics OpenAI's streaming response format.)
*/
const textPartSchema = z.object({
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().optional(),
      }),
      index: z.number(),
      finish_reason: z.string().nullable(),
    }),
  ),
})

export type TextPart = z.infer<typeof textPartSchema>

/**
  This helper function generates the array of messages
  that we'll stream to the client.
*/
function generateMessages() {
  const messages = Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 100),
  ).map((n, i) =>
    textPartSchema.parse({
      choices: [
        {
          delta: { content: `Number #${i + 1}: ${n}\n` },
          index: i,
          finish_reason: null,
        },
      ],
    }),
  )
  return messages
}

/**
  This helper function is used to simulate the
  delay between each message being sent.
*/
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
  This server function returns a `ReadableStream`
  that streams `TextPart` chunks to the client.
*/
const streamingResponseFn = createServerFn().handler(async () => {
  const messages = generateMessages()
  // This `ReadableStream` is typed, so each
  // will be of type `TextPart`.
  const stream = new ReadableStream<TextPart>({
    async start(controller) {
      for (const message of messages) {
        // simulate network latency
        await sleep(500)
        controller.enqueue(message)
      }
      controller.close()
    },
  })

  return stream
})

/**
  You can also use an async generator function to stream
  typed chunks to the client.
*/
const streamingWithAnAsyncGeneratorFn = createServerFn().handler(
  async function* () {
    const messages = generateMessages()
    for (const msg of messages) {
      await sleep(500)
      // The streamed chunks are still typed as `TextPart`
      yield msg
    }
  },
)

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [readableStreamMessages, setReadableStreamMessages] = createSignal('')

  const [asyncGeneratorFuncMessages, setAsyncGeneratorFuncMessages] =
    createSignal('')

  const getTypedReadableStreamResponse = async () => {
    const response = await streamingResponseFn()

    if (!response) {
      return
    }

    const reader = response.getReader()
    let done = false
    setReadableStreamMessages('')
    while (!done) {
      const { value, done: doneReading } = await reader.read()
      done = doneReading
      if (value) {
        // Notice how we know the value of `chunk` (`TextPart | undefined`)
        // here, because it's coming from the typed `ReadableStream`
        const chunk = value?.choices[0].delta.content
        if (chunk) {
          setReadableStreamMessages((prev) => prev + chunk)
        }
      }
    }
  }

  const getResponseFromTheAsyncGenerator = async () => {
    setAsyncGeneratorFuncMessages('')
    for await (const msg of await streamingWithAnAsyncGeneratorFn()) {
      const chunk = msg?.choices[0].delta.content
      if (chunk) {
        setAsyncGeneratorFuncMessages((prev) => prev + chunk)
      }
    }
  }

  return (
    <main>
      <h1>Typed Readable Stream</h1>
      <div id="streamed-results">
        <button onClick={() => getTypedReadableStreamResponse()}>
          Get 10 random numbers (ReadableStream)
        </button>
        <button onClick={() => getResponseFromTheAsyncGenerator()}>
          Get 10 random numbers (Async Generator Function)
        </button>
        <pre>{readableStreamMessages()}</pre>
        <pre>{asyncGeneratorFuncMessages()}</pre>
      </div>
    </main>
  )
}
