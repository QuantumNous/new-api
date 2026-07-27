// Run `tauri build` on Windows with an empty updater-key passphrase.
//
// The BoxAI updater key has no passphrase, and tauri stops on an interactive password prompt
// unless TAURI_SIGNING_PRIVATE_KEY_PASSWORD is present and empty. Windows shells cannot express
// that: `$env:X = ""` and `set X=` both delete the variable. Node builds the child's environment
// block directly, so it can hand down a genuinely empty value.
//
//   node packaging/win_tauri_build.mjs <gui-dir> <bundles>

import { spawnSync } from 'node:child_process'

const [guiDir, bundles] = process.argv.slice(2)
if (!guiDir || !bundles) {
  console.error('usage: node win_tauri_build.mjs <gui-dir> <bundles>')
  process.exit(2)
}

const env = { ...process.env }
if (env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) {
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
}

const result = spawnSync('npm', ['run', 'tauri', 'build', '--', '--bundles', bundles], {
  cwd: guiDir,
  env,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
