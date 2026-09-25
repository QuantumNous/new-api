import { toJSONAsync } from 'seroval'
import {
  createDeterministicRandom,
  randomSegment,
  runRequestLoop,
} from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

type FnUrls = {
  form: string
  raw: string
  stream: string
}

type MultipartPayloadSpec = {
  alpha: string
  beta: string
  gamma: string
  fileName: string
  fileContents: string
}

type MultipartPayload = MultipartPayloadSpec & {
  body: ArrayBuffer
  contentType: string
}

type QueryPayload = {
  query: string
  expectedBody: string
}

type FrameStats = {
  jsonFrames: number
  chunkFrames: number
  endFrames: number
  errorFrames: number
  chunkBytes: number
}

export type ServerFnTransportBenchContext = {
  urls: FnUrls
  multipartPayloads: Array<MultipartPayload>
  rawPayloads: Array<QueryPayload>
  streamPayloads: Array<QueryPayload>
  rawExpectedBodiesByUrl: Map<string, string>
}

const benchmarkSeed = 0xdecafbad
const origin = 'http://localhost'
const tssContentTypeFramed = 'application/x-tss-framed'
const xTssSerialized = 'x-tss-serialized'
const xTssRawResponse = 'x-tss-raw'
const acceptHeader = `${tssContentTypeFramed}, application/x-ndjson, application/json`
const frameHeaderSize = 9
const frameTypeJson = 0
const frameTypeChunk = 1
const frameTypeEnd = 2
const frameTypeError = 3
const streamChunkCount = 8
const streamChunkSize = 1024
const multipartFileSize = 1024
const commonHeaders = {
  'x-tsr-serverFn': 'true',
  'sec-fetch-site': 'same-origin',
  accept: acceptHeader,
} satisfies HeadersInit
const serverFnMultipartLoopIterations = 125
const serverFnRawResponseLoopIterations = 175
const serverFnRawStreamLoopIterations = 100

export const serverFnTransportBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
} as const

function makeFixedSizeString(seed: string, size: number) {
  let value = ''

  while (value.length < size) {
    value += `${seed}:${value.length.toString(36)};`
  }

  return value.slice(0, size)
}

function createMultipartPayloadSpecs() {
  const random = createDeterministicRandom(benchmarkSeed)

  return Array.from({ length: 10 }, (_, index): MultipartPayloadSpec => {
    const alpha = `alpha-${index}-${randomSegment(random)}`
    const beta = `beta-${index}-${randomSegment(random)}`
    const gamma = `gamma-${index}-${randomSegment(random)}`

    return {
      alpha,
      beta,
      gamma,
      fileName: `bench-${index}.txt`,
      fileContents: makeFixedSizeString(
        `${alpha}:${beta}:${gamma}`,
        multipartFileSize,
      ),
    }
  })
}

async function createMultipartPayload(
  spec: MultipartPayloadSpec,
): Promise<MultipartPayload> {
  const formData = new FormData()
  formData.set('alpha', spec.alpha)
  formData.set('beta', spec.beta)
  formData.set('gamma', spec.gamma)
  formData.set(
    'upload',
    new File([spec.fileContents], spec.fileName, { type: 'text/plain' }),
  )

  const request = new Request(`${origin}/__multipart-encode`, {
    method: 'POST',
    body: formData,
  })
  const contentType = request.headers.get('content-type')

  if (!contentType?.includes('multipart/form-data')) {
    throw new Error(`Expected multipart content type, received ${contentType}`)
  }

  return {
    ...spec,
    body: await request.arrayBuffer(),
    contentType,
  }
}

async function createMultipartPayloads() {
  return await Promise.all(
    createMultipartPayloadSpecs().map((spec) => createMultipartPayload(spec)),
  )
}

function createTransportInputs(prefix: string) {
  const random = createDeterministicRandom(benchmarkSeed ^ prefix.length)

  return Array.from(
    { length: 10 },
    (_, index) =>
      `${prefix}-${index}-${randomSegment(random)}-${randomSegment(random)}`,
  )
}

async function createQueryPayloads(
  inputs: Array<string>,
  expectedBody: (input: string) => string,
) {
  return await Promise.all(
    inputs.map(async (input): Promise<QueryPayload> => {
      const body = JSON.stringify(await toJSONAsync({ data: input }))
      const query = `?${new URLSearchParams({ payload: body })}`

      return {
        query,
        expectedBody: expectedBody(input),
      }
    }),
  )
}

async function discoverUrls(handler: StartRequestHandler) {
  const response = await handler.fetch(new Request(`${origin}/api/fn-urls`))

  if (response.status === 404) {
    throw new Error('URL discovery route returned 404 for /api/fn-urls')
  }

  if (response.status !== 200) {
    throw new Error(
      `URL discovery failed with status ${response.status}: ${await response.text()}`,
    )
  }

  const urls = (await response.json()) as Partial<FnUrls>

  if (
    typeof urls.form !== 'string' ||
    typeof urls.raw !== 'string' ||
    typeof urls.stream !== 'string'
  ) {
    throw new Error(
      `URL discovery returned invalid payload: ${JSON.stringify(urls)}`,
    )
  }

  return { form: urls.form, raw: urls.raw, stream: urls.stream }
}

function buildMultipartRequest(
  urls: FnUrls,
  payloads: Array<MultipartPayload>,
  index: number,
) {
  const payload = payloads[index % payloads.length]!

  return new Request(`${origin}${urls.form}`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'content-type': payload.contentType,
    },
    body: payload.body,
  })
}

function buildRawResponseRequest(
  urls: FnUrls,
  payloads: Array<QueryPayload>,
  index: number,
) {
  const payload = payloads[index % payloads.length]!

  return new Request(`${origin}${urls.raw}${payload.query}`, {
    method: 'GET',
    headers: commonHeaders,
  })
}

function buildRawStreamRequest(
  urls: FnUrls,
  payloads: Array<QueryPayload>,
  index: number,
) {
  const payload = payloads[index % payloads.length]!

  return new Request(`${origin}${urls.stream}${payload.query}`, {
    method: 'GET',
    headers: commonHeaders,
  })
}

async function assertSerializedResponse({
  response,
  label,
}: {
  response: Response
  label: string
}) {
  const text = await response.text()

  if (response.status === 403) {
    throw new Error(
      `${label} sanity check failed with 403. Check CSRF headers.`,
    )
  }

  if (response.status === 404) {
    throw new Error(
      `${label} sanity check failed with 404. The discovered server function URL is stale.`,
    )
  }

  if (response.status !== 200) {
    throw new Error(
      `${label} sanity check failed with status ${response.status}: ${text}`,
    )
  }

  if (!response.headers.get(xTssSerialized)) {
    throw new Error(`${label} sanity check missing ${xTssSerialized} header`)
  }

  return text
}

function assertMultipartBody(text: string, payload: MultipartPayload) {
  const expectedMarkers = [
    payload.alpha,
    payload.beta,
    payload.gamma,
    payload.fileName,
    'fileSize',
    multipartFileSize.toString(),
  ]

  for (const marker of expectedMarkers) {
    if (!text.includes(marker)) {
      throw new Error(
        `Multipart sanity check missing marker ${marker}: ${text}`,
      )
    }
  }
}

async function assertRawResponse(response: Response, expectedBody: string) {
  const text = await response.text()

  if (response.status !== 200) {
    throw new Error(
      `raw-response sanity check failed with status ${response.status}: ${text}`,
    )
  }

  if (response.headers.get(xTssRawResponse) !== 'true') {
    throw new Error(
      `raw-response sanity check missing ${xTssRawResponse} header`,
    )
  }

  if (text !== expectedBody) {
    throw new Error(
      `raw-response sanity check expected ${expectedBody}, received ${text}`,
    )
  }
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  )
}

function decodeFrameStats(buffer: ArrayBuffer): FrameStats {
  const bytes = new Uint8Array(buffer)
  let offset = 0
  const stats: FrameStats = {
    jsonFrames: 0,
    chunkFrames: 0,
    endFrames: 0,
    errorFrames: 0,
    chunkBytes: 0,
  }

  while (offset < bytes.length) {
    if (offset + frameHeaderSize > bytes.length) {
      throw new Error(`Incomplete frame header at byte ${offset}`)
    }

    const type = bytes[offset]
    const length = readUint32(bytes, offset + 5)
    const payloadStart = offset + frameHeaderSize
    const payloadEnd = payloadStart + length

    if (payloadEnd > bytes.length) {
      throw new Error(`Incomplete frame payload at byte ${offset}`)
    }

    if (type === frameTypeJson) {
      stats.jsonFrames++
    } else if (type === frameTypeChunk) {
      stats.chunkFrames++
      stats.chunkBytes += length
    } else if (type === frameTypeEnd) {
      stats.endFrames++
    } else if (type === frameTypeError) {
      stats.errorFrames++
    } else {
      throw new Error(`Unknown frame type ${type} at byte ${offset}`)
    }

    offset = payloadEnd
  }

  return stats
}

async function assertRawStream(response: Response) {
  if (response.status !== 200) {
    throw new Error(
      `raw-stream sanity check failed with status ${response.status}: ${await response.text()}`,
    )
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes(tssContentTypeFramed)) {
    throw new Error(
      `raw-stream sanity check expected framed content type, received ${contentType}`,
    )
  }

  if (!response.headers.get(xTssSerialized)) {
    throw new Error(`raw-stream sanity check missing ${xTssSerialized} header`)
  }

  const stats = decodeFrameStats(await response.arrayBuffer())
  const expectedChunkBytes = streamChunkCount * streamChunkSize

  if (stats.jsonFrames < 1) {
    throw new Error('raw-stream sanity check expected at least one JSON frame')
  }

  if (stats.chunkFrames !== streamChunkCount) {
    throw new Error(
      `raw-stream sanity check expected ${streamChunkCount} chunk frames, received ${stats.chunkFrames}`,
    )
  }

  if (stats.endFrames !== 1) {
    throw new Error(
      `raw-stream sanity check expected one END frame, received ${stats.endFrames}`,
    )
  }

  if (stats.errorFrames !== 0) {
    throw new Error(
      `raw-stream sanity check received ${stats.errorFrames} ERROR frames`,
    )
  }

  if (stats.chunkBytes !== expectedChunkBytes) {
    throw new Error(
      `raw-stream sanity check expected ${expectedChunkBytes} chunk bytes, received ${stats.chunkBytes}`,
    )
  }
}

function validateStatus(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Request failed with non-200 status ${response.status} (${request.url})`,
    )
  }
}

function validateSerializedResponse(response: Response, request: Request) {
  validateStatus(response, request)

  if (!response.headers.get(xTssSerialized)) {
    throw new Error(`Request missing ${xTssSerialized} header (${request.url})`)
  }
}

function validateRawResponse(response: Response, request: Request) {
  validateStatus(response, request)

  if (response.headers.get(xTssRawResponse) !== 'true') {
    throw new Error(
      `Request missing ${xTssRawResponse} header (${request.url})`,
    )
  }
}

function validateRawStreamResponse(response: Response, request: Request) {
  validateSerializedResponse(response, request)

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes(tssContentTypeFramed)) {
    throw new Error(
      `Request missing framed content type (${request.url}): ${contentType}`,
    )
  }
}

export async function setupServerFnTransportBench(
  handler: StartRequestHandler,
) {
  const urls = await discoverUrls(handler)
  const multipartPayloads = await createMultipartPayloads()
  const rawPayloads = await createQueryPayloads(
    createTransportInputs('raw'),
    (input) => `raw-${input}`,
  )
  const streamPayloads = await createQueryPayloads(
    createTransportInputs('stream'),
    (input) => `stream-${input}`,
  )
  const rawExpectedBodiesByUrl = new Map(
    rawPayloads.map((payload) => [
      `${origin}${urls.raw}${payload.query}`,
      payload.expectedBody,
    ]),
  )

  return {
    urls,
    multipartPayloads,
    rawPayloads,
    streamPayloads,
    rawExpectedBodiesByUrl,
  }
}

export async function assertServerFnTransportScenario(
  handler: StartRequestHandler,
  context: ServerFnTransportBenchContext,
) {
  const multipartPayload = context.multipartPayloads[0]!
  const multipartText = await assertSerializedResponse({
    response: await handler.fetch(
      buildMultipartRequest(context.urls, context.multipartPayloads, 0),
    ),
    label: 'multipart',
  })
  assertMultipartBody(multipartText, multipartPayload)

  await assertRawResponse(
    await handler.fetch(
      buildRawResponseRequest(context.urls, context.rawPayloads, 0),
    ),
    context.rawPayloads[0]!.expectedBody,
  )

  await assertRawStream(
    await handler.fetch(
      buildRawStreamRequest(context.urls, context.streamPayloads, 0),
    ),
  )
}

export function runServerFnMultipartRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnTransportBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnMultipartLoopIterations,
    buildRequest: (_random, index) =>
      buildMultipartRequest(context.urls, context.multipartPayloads, index),
    validateResponse: validateSerializedResponse,
  })
}

export function runServerFnRawResponseRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnTransportBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnRawResponseLoopIterations,
    buildRequest: (_random, index) =>
      buildRawResponseRequest(context.urls, context.rawPayloads, index),
    validateResponse: validateRawResponse,
  })
}

export function runServerFnRawStreamRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnTransportBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnRawStreamLoopIterations,
    buildRequest: (_random, index) =>
      buildRawStreamRequest(context.urls, context.streamPayloads, index),
    validateResponse: validateRawStreamResponse,
  })
}
