import { e2eStopDummyServer } from '@tanstack/router-e2e-utils'
import packageJson from '../../package.json' with { type: 'json' }
import { ssrStylesMode, useNitro, viteBundledDev } from '../../env'

function getPortKey() {
  let key = packageJson.name
  if (ssrStylesMode !== 'default') {
    key += `-${ssrStylesMode}`
  }
  if (useNitro) {
    key += '-nitro'
  }
  if (viteBundledDev) {
    key += '-bundled-dev'
  }
  return key
}

export default async function teardown() {
  await e2eStopDummyServer(getPortKey())
}
