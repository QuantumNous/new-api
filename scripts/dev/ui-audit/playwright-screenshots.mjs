/**
 * @deprecated Use playwright-page-audit.mjs (screenshots + visible-text scan + reports).
 * Kept as a thin wrapper for backward compatibility.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const audit = path.join(__dirname, 'playwright-page-audit.mjs')
const r = spawnSync(process.execPath, [audit], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(r.status ?? 1)
