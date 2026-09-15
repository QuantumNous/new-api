import fs from 'node:fs'
import { getRandomPort } from 'get-port-please'

/**
 * Check if a port has been allocated, if it hasn't generate a random port and save it.
 * @param {string} input - port test allocation
 * @returns {number} A random port.
 */
export async function derivePort(input: string): Promise<number> {
  const portFile = `port-${input}.txt`

  if (!fs.existsSync(portFile)) {
    fs.writeFileSync(portFile, (await getRandomPort()).toString())
  }

  const portNumber = parseInt(await fs.promises.readFile(portFile, 'utf-8'))
  console.info(`Mapped "${input}" to port ${portNumber}`)
  return portNumber
}

export async function getDummyServerPort(input: string): Promise<number> {
  return await derivePort(`${input}-external`)
}

export async function getTestServerPort(input: string): Promise<number> {
  return await derivePort(input)
}
