const payloadByteLength = 20 * 1024
const payloadChunkCount = 32
const payloadChunkSize = payloadByteLength / payloadChunkCount
const trackedLoaderIdPrefix = 'sanity-'
const trackedItemLoaderCalls = new Map<string, number>()

export function createItemPayload(id: string) {
  let seed = hashId(id)
  const chunks = new Array<string>(payloadChunkCount)

  for (let index = 0; index < payloadChunkCount; index++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    chunks[index] = createPayloadChunk(id, index, seed)
  }

  return {
    id,
    chunks,
    byteLength: payloadByteLength,
  }
}

export function trackItemLoaderCall(id: string) {
  if (!id.startsWith(trackedLoaderIdPrefix)) {
    return
  }

  trackedItemLoaderCalls.set(id, (trackedItemLoaderCalls.get(id) ?? 0) + 1)
}

export function getTrackedItemLoaderCount(id: string) {
  return trackedItemLoaderCalls.get(id) ?? 0
}

function createPayloadChunk(id: string, index: number, seed: number) {
  const token = `${id}:${index.toString(36)}:${seed.toString(36)}:`
  const repeatCount = Math.ceil(payloadChunkSize / token.length)

  return token.repeat(repeatCount).slice(0, payloadChunkSize)
}

function hashId(id: string) {
  let hash = 2166136261

  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
