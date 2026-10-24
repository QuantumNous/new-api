---
title: Streaming Data from Server Functions
---

Streaming data from the server has become very popular thanks to the rise of AI apps. Luckily, it's a pretty easy task with TanStack Start, and what's even better: the streamed data is typed!

The two most popular ways of streaming data from server functions are using `ReadableStream`-s or async generators.

You can see how to implement both in the [Streaming Data From Server Functions example](https://github.com/TanStack/router/tree/main/examples/react/start-streaming-data-from-server-functions).

## Typed Readable Streams

Here's an example for a server function that streams an array of messages to the client in a type-safe manner:

```ts
type Message = {
  content: string
}

/**
  This server function returns a `ReadableStream`
  that streams `Message` chunks to the client.
*/
const streamingResponseFn = createServerFn().handler(async () => {
  // These are the messages that you want to send as chunks to the client
  const messages: Message[] = generateMessages()

  // This `ReadableStream` is typed, so each
  // will be of type `Message`.
  const stream = new ReadableStream<Message>({
    async start(controller) {
      for (const message of messages) {
        // Send the message
        controller.enqueue(message)
      }
      controller.close()
    },
  })

  return stream
})
```

When you consume this stream from the client, the streamed chunks will be properly typed:

```ts
const [message, setMessage] = useState('')

const getTypedReadableStreamResponse = useCallback(async () => {
  const response = await streamingResponseFn()

  if (!response) {
    return
  }

  const reader = response.getReader()
  let done = false
  while (!done) {
    const { value, done: doneReading } = await reader.read()
    done = doneReading
    if (value) {
      // Notice how we know the value of `chunk` (`Message | undefined`)
      // here, because it's coming from the typed `ReadableStream`
      const chunk = value.content
      setMessage((prev) => prev + chunk)
    }
  }
}, [])
```

## Async Generators in Server Functions

A much cleaner approach with the same results is to use an async generator function:

```ts
const streamingWithAnAsyncGeneratorFn = createServerFn().handler(
  async function* () {
    const messages: Message[] = generateMessages()
    for (const msg of messages) {
      await sleep(500)
      // The streamed chunks are still typed as `Message`
      yield msg
    }
  },
)
```

The client side code will also be leaner:

```ts
const getResponseFromTheAsyncGenerator = useCallback(async () => {
  for await (const msg of await streamingWithAnAsyncGeneratorFn()) {
    const chunk = msg.content
    setMessages((prev) => prev + chunk)
  }
}, [])
```
