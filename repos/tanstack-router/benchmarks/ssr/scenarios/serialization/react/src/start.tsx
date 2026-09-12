import { createStart } from '@tanstack/react-start'
import { benchPointAdapter } from './serialization'

export const startInstance = createStart(() => {
  return {
    defaultSsr: true,
    serializationAdapters: [benchPointAdapter],
  }
})
