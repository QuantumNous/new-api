import { e2eStopDummyServer } from '@tanstack/router-e2e-utils'
import { getE2EPortKey } from '../utils/getE2EPortKey.ts'

export default async function teardown() {
  try {
    await e2eStopDummyServer(getE2EPortKey())
  } catch {}
}
