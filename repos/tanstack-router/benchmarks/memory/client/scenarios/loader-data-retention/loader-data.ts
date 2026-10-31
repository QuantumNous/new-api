import {
  createDeterministicRandom,
  randomSegment,
} from '#memory-client/bench-utils'

export const loaderPayloadRecordCount = 512

const loaderPayloadCharsPerRecord = 1024

type LoaderRecord = {
  key: string
  value: string
}

export function createLoaderData(id: string) {
  const random = createDeterministicRandom(hashId(id))
  const records: Array<LoaderRecord> = []

  for (let index = 0; index < loaderPayloadRecordCount; index++) {
    records.push({
      key: `${id}:${index}:${randomSegment(random)}`,
      value: createRecordValue(id, index, random),
    })
  }

  return { id, records }
}

function createRecordValue(id: string, index: number, random: () => number) {
  const firstSegment = randomSegment(random)
  const secondSegment = randomSegment(random)
  const segment = `${id}:${index}:${firstSegment}:${secondSegment}:`

  return segment
    .repeat(Math.ceil(loaderPayloadCharsPerRecord / segment.length))
    .slice(0, loaderPayloadCharsPerRecord)
}

function hashId(id: string) {
  let hash = 2166136261

  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
