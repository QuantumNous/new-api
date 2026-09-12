import { createJiti } from 'jiti'

export async function loadConfigFile(filePath: string) {
  const jiti = createJiti(filePath, {
    interopDefault: false,
    tsconfigPaths: true,
  })
  const loaded = await jiti.import<any>(filePath)
  return loaded
}
