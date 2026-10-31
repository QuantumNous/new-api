import { e2eStopDummyServer } from '@tanstack/router-e2e-utils'
import packageJson from '../../package.json' with { type: 'json' }

function getE2EPortKey() {
  const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
  return process.env.E2E_PORT_KEY ?? `${packageJson.name}-${toolchain}`
}

export default async function teardown() {
  await e2eStopDummyServer(getE2EPortKey())
}
