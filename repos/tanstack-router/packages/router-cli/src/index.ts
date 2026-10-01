import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { getConfig } from '@tanstack/router-generator'
import { generate } from './generate'
import { watch } from './watch'

main()

export function main() {
  yargs(hideBin(process.argv))
    .scriptName('tsr')
    .usage('$0 <cmd> [args]')
    .command('generate', 'Generate the routes for a project', async () => {
      const config = getConfig()
      await generate(config, process.cwd())
    })
    .command(
      'watch',
      'Continuously watch and generate the routes for a project',
      () => {
        watch(process.cwd())
      },
    )
    .help().argv
}
