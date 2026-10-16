import { Generator } from '@tanstack/router-generator'
import type { Config } from '@tanstack/router-generator'

export async function generate(config: Config, root: string) {
  try {
    const generator = new Generator({
      config,
      root,
    })
    await generator.run()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
