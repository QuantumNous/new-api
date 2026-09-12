import chokidar from 'chokidar'
import {
  Generator,
  getConfig,
  resolveConfigPath,
} from '@tanstack/router-generator'
import type { FileEventType } from '@tanstack/router-generator'

export function watch(root: string) {
  const configPath = resolveConfigPath({
    configDirectory: root,
  })
  const configWatcher = chokidar.watch(configPath)

  let watcher = new chokidar.FSWatcher({})

  const generatorWatcher = () => {
    const config = getConfig()
    const generator = new Generator({ config, root })

    watcher.close()

    console.info(`TSR: Watching routes (${config.routesDirectory})...`)
    watcher = chokidar.watch(config.routesDirectory)

    watcher.on('ready', async () => {
      const handle = async () => {
        try {
          await generator.run()
        } catch (err) {
          console.error(err)
          console.info()
        }
      }

      await handle()

      watcher.on('all', (event, path) => {
        let type: FileEventType | undefined
        switch (event) {
          case 'add':
            type = 'create'
            break
          case 'change':
            type = 'update'
            break
          case 'unlink':
            type = 'delete'
            break
        }
        if (type) {
          return generator.run({ path, type })
        }
        return generator.run()
      })
    })
  }

  configWatcher.on('ready', generatorWatcher)
  configWatcher.on('change', generatorWatcher)
}
