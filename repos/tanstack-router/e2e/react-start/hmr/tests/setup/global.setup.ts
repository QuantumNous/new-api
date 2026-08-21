import {
  e2eStartDummyServer,
  getTestServerPort,
  preOptimizeDevServer,
  waitForServer,
} from '@tanstack/router-e2e-utils'
import packageJson from '../../package.json' with { type: 'json' }

function getE2EPortKey() {
  const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
  return process.env.E2E_PORT_KEY ?? `${packageJson.name}-${toolchain}`
}

export default async function setup() {
  const e2ePortKey = getE2EPortKey()

  await e2eStartDummyServer(e2ePortKey)

  const port = await getTestServerPort(e2ePortKey)
  const baseURL = `http://localhost:${port}`

  await waitForServer(baseURL)
  await preOptimizeDevServer({
    baseURL,
    readyTestId: 'hydrated',
  })
}
