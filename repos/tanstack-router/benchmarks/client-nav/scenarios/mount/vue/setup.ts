import { createMountLoopSetup } from '../../harness'
import { assertReady, readyTestId } from '../shared'
import type * as App from './src/main'

const appModulePath = './dist/app.js'
const { mountTestApp } = (await import(
  /* @vite-ignore */ appModulePath
)) as typeof App

export function setup() {
  return createMountLoopSetup({
    frameworkLabel: 'Vue',
    mount: mountTestApp,
    readyTestId,
    assertReady,
  })
}
