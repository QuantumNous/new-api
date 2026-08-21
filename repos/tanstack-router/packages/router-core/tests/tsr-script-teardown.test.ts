import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import minifiedTsrBootStrapScript from '../src/ssr/tsrScript?script-string'

type TsrBootstrap = {
  h: () => void
  e: () => void
  c: () => void
}

// Assign `self.$_TSR`.
function installBootstrap(): TsrBootstrap {
  new Function(minifiedTsrBootStrapScript)()
  return (window as any).$_TSR
}

describe('$_TSR client teardown', () => {
  beforeEach(() => {
    ;(window as any).$R = { tsr: [] }
    delete (window as any).$_TSR
  })

  afterEach(() => {
    delete (window as any).$_TSR
    delete (window as any).$R
  })

  test('does not tear down until both hydrated and streamEnded', () => {
    const tsr = installBootstrap()

    tsr.h()
    expect((window as any).$_TSR).toBeDefined()

    tsr.e()
    expect((window as any).$_TSR).toBeUndefined()
  })

  test('removes both $_TSR and $R[tsr] on teardown', () => {
    const tsr = installBootstrap()

    tsr.h()
    tsr.e()

    expect((window as any).$_TSR).toBeUndefined()
    expect((window as any).$R.tsr).toBeUndefined()
  })
})
