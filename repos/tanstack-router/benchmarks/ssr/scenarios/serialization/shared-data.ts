export class BenchPoint {
  constructor(
    public x: number,
    public y: number,
  ) {}

  get label() {
    return `${this.x}:${this.y}`
  }
}

export interface PlainSerializationPayload {
  label: string
  createdAt: string
  lookup: Array<[string, { index: number; label: string }]>
  tags: Array<string>
  count: string
  nested: Array<{ id: string; values: Array<number>; flag: boolean }>
  points: Array<{ x: number; y: number; label: string }>
  problem: { message: string }
}

export interface RichSerializationPayload {
  label: string
  createdAt: Date
  lookup: Map<string, { index: number; label: string }>
  tags: Set<string>
  count: bigint
  nested: Array<{ id: string; values: Array<number>; flag: boolean }>
  points: Array<BenchPoint>
  problem: Error
}

export const benchPointAdapterKey = '$bench/point'
export const richDateIso = '2024-02-03T04:05:06.000Z'

function makeNested(id: string) {
  return Array.from({ length: 16 }, (_, index) => ({
    id: `${id}-nested-${index}`,
    values: [index, index + 1, index + 2],
    flag: index % 2 === 0,
  }))
}

function makeLookup(
  id: string,
): Array<[string, { index: number; label: string }]> {
  return Array.from(
    { length: 8 },
    (_, index): [string, { index: number; label: string }] => {
      const key = `k${index}`

      return [key, { index, label: `${id}-map-${index}` }]
    },
  )
}

function makeTags(id: string) {
  return Array.from({ length: 8 }, (_, index) => `${id}-tag-${index}`)
}

function makePlainPoints() {
  return Array.from({ length: 4 }, (_, index) => {
    const point = new BenchPoint(index * 10, index * 10 + 5)

    return { x: point.x, y: point.y, label: point.label }
  })
}

export function makeRichSerializationData(
  id: string,
): RichSerializationPayload {
  return {
    label: `rich-${id}`,
    createdAt: new Date(richDateIso),
    lookup: new Map(makeLookup(id)),
    tags: new Set(makeTags(id)),
    count: 9_007_199_254_740_993n,
    nested: makeNested(id),
    points: Array.from(
      { length: 4 },
      (_, index) => new BenchPoint(index * 10, index * 10 + 5),
    ),
    problem: new Error(`rich-problem-${id}`),
  }
}

export function makePlainSerializationData(
  id: string,
): PlainSerializationPayload {
  return {
    label: `plain-${id}`,
    createdAt: richDateIso,
    lookup: makeLookup(id),
    tags: makeTags(id),
    count: '9007199254740993',
    nested: makeNested(id),
    points: makePlainPoints(),
    problem: { message: `rich-problem-${id}` },
  }
}
