export interface LevelDataItem {
  id: string
  name: string
  flags: number
}

export interface LevelData {
  items: Array<LevelDataItem>
  meta: {
    source: string
    page: number
    label: string
  }
}

function hashLevelInput(input: string, salt: number) {
  let value = salt >>> 0

  for (let index = 0; index < input.length; index++) {
    value = (value * 33 + input.charCodeAt(index) + index) >>> 0
  }

  for (let index = 0; index < 16; index++) {
    value = (value ^ (value << 13)) >>> 0
    value = (value ^ (value >> 17)) >>> 0
    value = (value ^ (value << 5)) >>> 0
  }

  return value
}

export function makeLevelData(source: string, page: number): LevelData {
  const safePage = page | 0
  const seedInput = `${source}:${safePage}`
  const seed = hashLevelInput(seedInput, 0x9e3779b9)

  return {
    items: Array.from({ length: 50 }, (_, index) => {
      const hash = hashLevelInput(`${seedInput}:${index}`, seed + index)
      const hashLabel = (hash & 0xffff).toString(36)

      return {
        id: `${index.toString(36)}-${hashLabel}`,
        name: `${source}:${safePage}:item-${index}`,
        flags: hash & 15,
      }
    }),
    meta: {
      source,
      page: safePage,
      label: `source ${source} page ${safePage}`,
    },
  }
}
