const mapEntryCount = 500
const setEntryCount = 500
const temporalEntryCount = 500
const nestedTreeDepth = 5
const nestedTreeBreadth = 6
const payloadTextLength = 150

export interface MapPayloadValue {
  index: number
  label: string
  createdAt: Date
  count: bigint
  text: string
}

export interface NestedPayloadNode {
  id: string
  depth: number
  text: string
  values: Array<number>
  children: Array<NestedPayloadNode>
}

export interface SerializationPayload {
  id: string
  lookup: Map<string, MapPayloadValue>
  tags: Set<string>
  dates: Array<Date>
  bigints: Array<bigint>
  tree: NestedPayloadNode
}

export function makeSerializationPayload(id: string): SerializationPayload {
  const hash = hashId(id)
  const baseTimestamp = Date.UTC(2024, 0, 1) + hash

  return {
    id,
    lookup: new Map(
      Array.from(
        { length: mapEntryCount },
        (_, index): [string, MapPayloadValue] => [
          makeMapKey(id, index),
          {
            index,
            label: `${id}-map-${index}`,
            createdAt: new Date(baseTimestamp + index * 1_000),
            count: BigInt(hash) * 10_000n + BigInt(index),
            text: makePayloadText(id, `map-${index}`),
          },
        ],
      ),
    ),
    tags: new Set(
      Array.from({ length: setEntryCount }, (_, index) =>
        makePayloadText(id, `set-${index}`),
      ),
    ),
    dates: Array.from(
      { length: temporalEntryCount },
      (_, index) => new Date(baseTimestamp + index * 60_000),
    ),
    bigints: Array.from(
      { length: temporalEntryCount },
      (_, index) => BigInt(hash) * 1_000_000n + BigInt(index),
    ),
    tree: makeNestedTree(id, 0, 'root', hash),
  }
}

function makeMapKey(id: string, index: number) {
  return `map-${id}-${index.toString().padStart(3, '0')}`
}

function makeNestedTree(
  id: string,
  depth: number,
  path: string,
  hash: number,
): NestedPayloadNode {
  return {
    id: `${id}-node-${path}`,
    depth,
    text: makePayloadText(id, `tree-${depth}-${path}`),
    values: [hash, depth, path.length],
    children:
      depth === nestedTreeDepth
        ? []
        : Array.from({ length: nestedTreeBreadth }, (_, index) =>
            makeNestedTree(id, depth + 1, `${path}-${index}`, hash),
          ),
  }
}

function makePayloadText(id: string, segment: string) {
  const filler = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let value = `${id}|${segment}|`

  while (value.length < payloadTextLength) {
    value += filler
  }

  return value.slice(0, payloadTextLength)
}

function hashId(id: string) {
  let hash = 2_166_136_261

  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}
