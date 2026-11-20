import {
  e2eStartDummyServer,
  getTestServerPort,
  preOptimizeDevServer,
  waitForServer,
} from '@tanstack/router-e2e-utils'
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

export default async function setup() {
  const portKey = getPortKey()

  await e2eStartDummyServer(portKey)

  if (process.env.MODE !== 'dev') return

  const port = await getTestServerPort(portKey)
  const baseURL = `http://localhost:${port}`

  await waitForServer(baseURL)
  await preOptimizeDevServer({
    baseURL,
    readyTestId: 'home-heading',
  })
}
