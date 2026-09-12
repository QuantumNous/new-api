import { createStart } from '@tanstack/solid-start'
import { benchPointAdapter } from './serialization'

export const startInstance = createStart(() => {
  return {
    defaultSsr: true,
    serializationAdapters: [benchPointAdapter],
  }
})
