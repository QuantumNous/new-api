export interface SmallPayload {
  label: string
}

export interface BigPayload {
  label: string
  chunks: Array<{
    index: number
    value: string
  }>
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
export const streamChunkCount = 96
export const streamChunkLength = 192

export function sleep0() {
  return new Promise<void>((resolve) => setTimeout(resolve, 1))
}

function hashId(id: string) {
  let state = 2166136261

  for (let index = 0; index < id.length; index++) {
    state ^= id.charCodeAt(index)
    state = Math.imul(state, 16777619) >>> 0
  }

  return state || 1
}

function nextState(state: number) {
  return (state * 1664525 + 1013904223) >>> 0
}

function makeChunk(seed: number) {
  let state = seed
  let value = ''

  for (let index = 0; index < streamChunkLength; index++) {
    state = nextState(state)
    value += alphabet[state % alphabet.length]
  }

  return { state, value }
}

export function makeBigPayload(id: string): BigPayload {
  let state = hashId(id)
  const chunks: BigPayload['chunks'] = []

  for (let index = 0; index < streamChunkCount; index++) {
    const chunk = makeChunk(state + index)
    state = chunk.state
    chunks.push({
      index,
      value: `${id}:${index}:${chunk.value}`,
    })
  }

  return {
    label: `slow-big-${id}`,
    chunks,
  }
}
