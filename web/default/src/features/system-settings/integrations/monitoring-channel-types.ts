import { CHANNEL_TYPE_OPTIONS } from '../../channels/constants.ts'

const channelTypeOrder = new Map(
  CHANNEL_TYPE_OPTIONS.map((option, index) => [option.value, index])
)

function isIntegerChannelTypeId(value: unknown): value is number {
  return Number.isInteger(value)
}

export function normalizeChannelTypeIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }

  const ids = new Set<number>()
  value.forEach((item) => {
    const id = Number(item)
    if (isIntegerChannelTypeId(id)) {
      ids.add(id)
    }
  })

  const knownIds: number[] = []
  const unknownIds: number[] = []
  ids.forEach((id) => {
    if (channelTypeOrder.has(id)) {
      knownIds.push(id)
      return
    }
    unknownIds.push(id)
  })

  knownIds.sort((a, b) => {
    return (channelTypeOrder.get(a) ?? 0) - (channelTypeOrder.get(b) ?? 0)
  })
  unknownIds.sort((a, b) => a - b)

  return [...knownIds, ...unknownIds]
}

export function areAllKnownChannelTypesSelected(value: number[]): boolean {
  const selected = new Set(value)
  return CHANNEL_TYPE_OPTIONS.every((option) => selected.has(option.value))
}

export function getUnknownChannelTypeIds(value: number[]): number[] {
  return normalizeChannelTypeIds(value).filter((id) => !channelTypeOrder.has(id))
}

export function selectAllKnownChannelTypeIds(value: number[]): number[] {
  return normalizeChannelTypeIds([
    ...value,
    ...CHANNEL_TYPE_OPTIONS.map((option) => option.value),
  ])
}
