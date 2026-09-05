const recordCount = 20

export type RecordGroup = 'alpha' | 'beta'

export interface DeferredRecord {
  id: string
  label: string
}

export function makeAbortedRequestRecords(
  id: string,
  group: RecordGroup,
): Array<DeferredRecord> {
  return Array.from({ length: recordCount }, (_, index) => ({
    id: `${group}-${id}-${index}`,
    label: `deferred-${group}-${id}-${index}`,
  }))
}
