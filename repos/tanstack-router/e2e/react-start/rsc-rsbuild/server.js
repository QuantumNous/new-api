import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const distDir = process.env.E2E_DIST_DIR || 'dist'

function resolveDistClientDir() {
  return path.resolve(distDir, 'client')
}

function resolveDistServerEntryPath() {
  const serverJsPath = path.resolve(distDir, 'server', 'server.js')
  if (fs.existsSync(serverJsPath)) {
    return serverJsPath
  }

  const indexJsPath = path.resolve(distDir, 'server', 'index.js')
  if (fs.existsSync(indexJsPath)) {
    return indexJsPath
  }

  return serverJsPath
}

export function resolveStartCommand() {
  const distClientDir = resolveDistClientDir()
  const distServerEntryPath = resolveDistServerEntryPath()
  return `srvx --prod -s ${JSON.stringify(distClientDir)} ${JSON.stringify(distServerEntryPath)}`
}

export function start() {
  const child = spawn(
    'srvx',
    ['--prod', '-s', resolveDistClientDir(), resolveDistServerEntryPath()],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  start()
}
