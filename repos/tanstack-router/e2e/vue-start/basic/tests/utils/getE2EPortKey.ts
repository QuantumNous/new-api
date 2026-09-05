import { getPackageName } from './getPackageName.ts'

export function getE2EPortKey() {
  return process.env.E2E_PORT_KEY ?? getPackageName()
}
