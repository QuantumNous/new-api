import { e2eStartDummyServer } from '@tanstack/router-e2e-utils'
import packageJson from '../../package.json' with { type: 'json' }

export default async function setup() {
  await e2eStartDummyServer(process.env.E2E_PORT_KEY ?? packageJson.name)
}
