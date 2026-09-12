import { getDummyServerPort } from '@tanstack/router-e2e-utils'
import { getE2EPortKey } from '../utils/getE2EPortKey.ts'

const timeoutMs = 10_000
const retryIntervalMs = 100

export default async function waitForDummyServer() {
  const port = await getDummyServerPort(getE2EPortKey())
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/`)

      if (response.ok) {
        return
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs))
  }

  throw new Error(`Timed out waiting for dummy server on port ${port}`)
}
