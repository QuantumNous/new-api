import { localDummyServer } from './localDummyServer'
import { getDummyServerPort } from './derivePort'

export async function e2eStartDummyServer(input: string) {
  const port = await getDummyServerPort(input)

  return await localDummyServer(port)
}

export async function e2eStopDummyServer(input: string) {
  const port = await getDummyServerPort(input)

  await fetch(`http://localhost:${port}/stop`, {
    method: 'POST',
  })
}
