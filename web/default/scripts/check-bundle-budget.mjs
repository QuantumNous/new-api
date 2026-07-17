/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const html = await readFile(
  path.join(projectRoot, 'dist', 'index.html'),
  'utf8'
)
const match = html.match(
  /<script[^>]+src=["']([^"']*\/index\.[0-9a-f]+\.js)["']/i
)

if (!match) {
  throw new Error(
    'Unable to locate the fingerprinted index bundle in dist/index.html'
  )
}

const relativeBundlePath = match[1].replace(/^\//, '')
const source = await readFile(
  path.join(projectRoot, 'dist', relativeBundlePath)
)
const gzipBytes = gzipSync(source, { level: 9 }).byteLength
const budgetBytes = Number(process.env.BUNDLE_GZIP_BUDGET_KB || 400) * 1024

console.log(
  `${relativeBundlePath}: ${(gzipBytes / 1024).toFixed(1)} KiB gzip (budget ${(budgetBytes / 1024).toFixed(0)} KiB)`
)

if (gzipBytes > budgetBytes) {
  throw new Error(
    `Entry bundle exceeds gzip budget by ${((gzipBytes - budgetBytes) / 1024).toFixed(1)} KiB`
  )
}
