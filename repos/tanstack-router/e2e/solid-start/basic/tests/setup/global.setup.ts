import { e2eStartDummyServer } from '@tanstack/router-e2e-utils'
import { getE2EPortKey } from '../utils/getE2EPortKey.ts'

export default async function setup() {
  await e2eStartDummyServer(getE2EPortKey())
}
