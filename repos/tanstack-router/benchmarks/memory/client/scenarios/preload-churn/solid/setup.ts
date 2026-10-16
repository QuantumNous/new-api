import type { ClientMemoryWorkload } from '#memory-client/benchmark'
import type * as App from './src/app'
import { createWorkload } from '../shared.ts'

const appModulePath = './dist/app.js'
const { getTrackedItemLoaderCount, mountTestApp } = (await import(
  /* @vite-ignore */ appModulePath
)) as typeof App

export const workload: ClientMemoryWorkload = createWorkload(
  'solid',
  mountTestApp,
  getTrackedItemLoaderCount,
)
