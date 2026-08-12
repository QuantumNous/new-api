import { createSerializationAdapter } from '@tanstack/vue-router'
import { BenchPoint, benchPointAdapterKey } from '../../shared-data'

export const benchPointAdapter = createSerializationAdapter({
  key: benchPointAdapterKey,
  test: (value): value is BenchPoint => value instanceof BenchPoint,
  toSerializable: (point) => ({ x: point.x, y: point.y }),
  fromSerializable: (value: { x: number; y: number }) =>
    new BenchPoint(value.x, value.y),
})
