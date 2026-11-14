export interface LargePageRecord {
  id: string
  name: string
  description: string
}

export interface LargePageLevelData {
  level: number
  marker: string
  records: Array<LargePageRecord>
}

const recordCount = 200
const descriptionLength = 104

export function makeLargePageLevelData(level: number, seed: number) {
  const random = createDeterministicRandom(seed)

  return {
    level,
    marker: makeLargePageMarker(level),
    records: Array.from({ length: recordCount }, (_, index) => {
      const idToken = randomSegment(random)
      const descriptionTokenA = randomSegment(random)
      const descriptionTokenB = randomSegment(random)

      return {
        id: `l${level}-${index}-${idToken}`,
        name: makeLargePageRecordName(level, index),
        description: makeDescription(
          level,
          index,
          descriptionTokenA,
          descriptionTokenB,
        ),
      }
    }),
  } satisfies LargePageLevelData
}

export function makeLargePageHead(loaderData: LargePageLevelData | undefined) {
  if (!loaderData) {
    return {
      meta: [{ title: 'Peak Large Page' }],
    }
  }

  const first = loaderData.records[0]!
  const last = loaderData.records[loaderData.records.length - 1]!

  return {
    meta: [
      { title: `Peak Large Page L${loaderData.level} ${first.name}` },
      {
        name: `peak-large-page-l${loaderData.level}-count`,
        content: String(loaderData.records.length),
      },
      {
        name: `peak-large-page-l${loaderData.level}-first-id`,
        content: first.id,
      },
      {
        name: `peak-large-page-l${loaderData.level}-first-name`,
        content: first.name,
      },
      {
        name: `peak-large-page-l${loaderData.level}-last-id`,
        content: last.id,
      },
      {
        name: `peak-large-page-l${loaderData.level}-description`,
        content: first.description,
      },
    ],
  }
}

function makeLargePageRecordName(level: number, index: number) {
  return `peak-large-page-l${level}-record-${index}`
}

function makeLargePageMarker(level: number) {
  return `peak-large-page-level-${level}`
}

function makeDescription(
  level: number,
  index: number,
  tokenA: string,
  tokenB: string,
) {
  return `Level ${level} record ${index} uses seeded fragments ${tokenA} and ${tokenB} to keep a fresh deterministic loader payload.`.padEnd(
    descriptionLength,
    'x',
  )
}

// Local copy of the LCG from benchmarks/memory/server/bench-utils.ts - app
// source cannot import from outside the app root. Keep in sync.
function createDeterministicRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function randomSegment(random: () => number) {
  return Math.floor(random() * 1_000_000_000).toString(36)
}
