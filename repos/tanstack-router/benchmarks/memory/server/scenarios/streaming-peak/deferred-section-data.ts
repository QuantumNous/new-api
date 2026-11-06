const deferredRecordCount = 250
const recordValueLength = 128

interface DeferredRecord {
  id: string
  value: string
}

export interface DeferredSectionPayload {
  index: number
  records: Array<DeferredRecord>
}

export function makeDeferredSectionPayload(
  id: string,
  sectionIndex: number,
): DeferredSectionPayload {
  return {
    index: sectionIndex,
    records: Array.from({ length: deferredRecordCount }, (_, recordIndex) => ({
      id: `${id}-${sectionIndex}-${recordIndex}`,
      value: makeRecordValue(id, sectionIndex, recordIndex),
    })),
  }
}

function makeRecordValue(
  id: string,
  sectionIndex: number,
  recordIndex: number,
) {
  const token = `${id}:${sectionIndex}:${recordIndex}:streaming-peak-record;`

  return token
    .repeat(Math.ceil(recordValueLength / token.length))
    .slice(0, recordValueLength)
}
