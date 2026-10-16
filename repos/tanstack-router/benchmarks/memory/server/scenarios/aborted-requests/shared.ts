import { settleAndPinGc } from '#memory-server/bench-utils'
import type { StartRequestHandler } from '#memory-server/bench-utils'

export type { StartRequestHandler }

type Framework = 'react' | 'solid' | 'vue'

type AbortedRequestReadMode = 'first-chunk' | 'shell-before-deferred'
type AbortedRequestCancelMode = 'plain' | 'swallow-abort-error'

type AbortedRequestMode = {
  readMode: AbortedRequestReadMode
  cancelMode: AbortedRequestCancelMode
}

const abortedRequestIterations = 40
let abortedRequestCounter = 0
const eagerMarker = 'data-bench="aborted-requests-eager"'
const alphaFallbackMarker = 'data-bench="aborted-requests-alpha-fallback"'
const betaFallbackMarker = 'data-bench="aborted-requests-beta-fallback"'
const alphaFirstRecord = (id: string) => `deferred-alpha-${id}-0`
const alphaLastRecord = (id: string) => `deferred-alpha-${id}-19`
const betaFirstRecord = (id: string) => `deferred-beta-${id}-0`
const betaLastRecord = (id: string) => `deferred-beta-${id}-19`

const textDecoder = new TextDecoder()
const abortedRequestModes: Record<Framework, AbortedRequestMode> = {
  react: {
    readMode: 'first-chunk',
    cancelMode: 'plain',
  },
  solid: {
    readMode: 'first-chunk',
    cancelMode: 'plain',
  },
  vue: {
    readMode: 'shell-before-deferred',
    cancelMode: 'swallow-abort-error',
  },
}

const documentRequestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildStreamRequest(id: string, signal?: AbortSignal) {
  const init: RequestInit = { ...documentRequestInit }

  if (signal) {
    init.signal = signal
  }

  return new Request(`http://localhost/stream/${id}`, init)
}

function validateDocumentResponse(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Expected status 200 for ${request.url}, got ${response.status}`,
    )
  }
}

async function readFirstChunk(response: Response, request: Request) {
  if (!response.body) {
    throw new Error(`Expected response body for ${request.url}`)
  }

  const reader = response.body.getReader()
  const result = await reader.read()
  const value = result.value

  if (result.done || !value || value.byteLength === 0) {
    await reader.cancel()
    throw new Error(`Expected a non-empty first chunk for ${request.url}`)
  }

  return {
    reader,
    value,
  }
}

async function readShellBeforeDeferred(
  response: Response,
  request: Request,
  id: string,
) {
  if (!response.body) {
    throw new Error(`Expected response body for ${request.url}`)
  }

  const reader = response.body.getReader()
  let text = ''

  while (true) {
    const result = await reader.read()
    const value = result.value

    if (result.done || !value || value.byteLength === 0) {
      await reader.cancel()
      throw new Error(`Expected shell content for ${request.url}`)
    }

    text += textDecoder.decode(value, { stream: true })

    for (const marker of [
      alphaFirstRecord(id),
      alphaLastRecord(id),
      betaFirstRecord(id),
      betaLastRecord(id),
    ]) {
      if (text.includes(marker)) {
        await reader.cancel()
        throw new Error(
          `Shell chunks already included deferred content ${marker}`,
        )
      }
    }

    if (
      text.includes(eagerMarker) &&
      text.includes(alphaFallbackMarker) &&
      text.includes(betaFallbackMarker)
    ) {
      return {
        reader,
        text,
      }
    }
  }
}

async function readSanityStream(
  response: Response,
  request: Request,
  mode: AbortedRequestMode,
  id: string,
) {
  if (mode.readMode === 'shell-before-deferred') {
    return readShellBeforeDeferred(response, request, id)
  }

  const { reader, value } = await readFirstChunk(response, request)

  return {
    reader,
    text: textDecoder.decode(value),
  }
}

function readLoopStream(
  mode: AbortedRequestReadMode,
  response: Response,
  request: Request,
  id: string,
) {
  if (mode === 'shell-before-deferred') {
    return readShellBeforeDeferred(response, request, id)
  }

  return readFirstChunk(response, request)
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  mode: AbortedRequestCancelMode,
) {
  if (mode === 'swallow-abort-error') {
    try {
      await reader.cancel()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
    }

    return
  }

  await reader.cancel()
}

// Post-abort settlement barrier. Settles renderer teardown across a fixed
// number of event-loop turns, then (under CodSpeed) pins a collection point
// after every aborted request, so the measured peak cannot drift with how
// much floating garbage the previous iterations happened to leave behind.
async function drainCancellation() {
  await settleAndPinGc()
}

async function assertAbortedRequestsSanity(
  handler: StartRequestHandler,
  mode: AbortedRequestMode,
) {
  const fullId = 'sanity-full'
  const fullRequest = buildStreamRequest(fullId)
  const fullResponse = await handler.fetch(fullRequest)
  validateDocumentResponse(fullResponse, fullRequest)

  const fullBody = await fullResponse.text()

  if (!fullBody.includes(eagerMarker)) {
    throw new Error('Expected full sanity response to include the eager marker')
  }

  const midStreamId = 'sanity-mid-stream'
  const controller = new AbortController()
  const midStreamRequest = buildStreamRequest(midStreamId, controller.signal)
  const midStreamResponse = await handler.fetch(midStreamRequest)
  validateDocumentResponse(midStreamResponse, midStreamRequest)

  const { reader, text } = await readSanityStream(
    midStreamResponse,
    midStreamRequest,
    mode,
    midStreamId,
  )

  if (!text.includes(eagerMarker)) {
    throw new Error('Expected sanity stream to include the eager marker')
  }

  // reader.cancel() is the response-stream cancellation path if the handler
  // does not observe Request.signal for this in-process request.
  controller.abort()
  await cancelReader(reader, mode.cancelMode)
  await drainCancellation()
}

async function runAbortedRequestLoop(
  handler: StartRequestHandler,
  mode: AbortedRequestMode,
) {
  for (let index = 0; index < abortedRequestIterations; index++) {
    const controller = new AbortController()
    const id = `abort-${(abortedRequestCounter++).toString(36)}`
    const request = buildStreamRequest(id, controller.signal)
    const response = await handler.fetch(request)
    validateDocumentResponse(response, request)

    const { reader } = await readLoopStream(
      mode.readMode,
      response,
      request,
      id,
    )
    controller.abort()
    await cancelReader(reader, mode.cancelMode)
    await drainCancellation()
  }
}

export function createWorkloadGroup(
  framework: Framework,
  handler: StartRequestHandler,
) {
  const mode = abortedRequestModes[framework]
  const run = () => runAbortedRequestLoop(handler, mode)

  return {
    sanity: () => assertAbortedRequestsSanity(handler, mode),
    workloads: [
      {
        name: `mem server aborted-requests (${framework})`,
        run,
      },
    ],
  }
}
