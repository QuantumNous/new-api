#!/usr/bin/env node
/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * Motion lint — the two transition rules oxlint cannot express, because they
 * are about Tailwind class content rather than JS syntax.
 *
 *  1. `transition-all` is banned. It interpolates every property that happens
 *     to change, including layout ones, and re-runs on every class swap. Use
 *     `transition-ui` (the project whitelist utility in `src/styles/index.css`)
 *     or an explicit `transition-[a,b]` list.
 *  2. `transition-[...]` may not name a layout-triggering property. Animating
 *     width/height/top/aspect-ratio relayouts the subtree every frame; prefer
 *     `transform` (scale/translate) or `opacity`.
 *
 * Files in LAYOUT_TRANSITION_ALLOWLIST animate geometry for a real reason and
 * are exempt from rule 2 — each entry carries that reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const LAYOUT_PROPERTIES = new Set([
  'width',
  'height',
  'max-height',
  'min-height',
  'max-width',
  'min-width',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-inline-start',
  'inset-inline-end',
  'margin',
  'padding',
  'aspect-ratio',
  'flex-basis',
  'font-size',
  'border-radius',
])

/** Geometry animations that are deliberate. Keep the reason with the entry. */
const LAYOUT_TRANSITION_ALLOWLIST = new Map([
  [
    'src/components/ui/sidebar.tsx',
    'The sidebar collapse *is* a width animation; there is no transform equivalent.',
  ],
  [
    'src/components/ui/navigation-menu.tsx',
    'Base UI morphs the popup between panels of different size.',
  ],
  [
    'src/components/ui/progress.tsx',
    'Base UI drives the indicator through inline width / inset-inline-start.',
  ],
  [
    'src/components/ai-elements/code-block.tsx',
    'Collapsible code block expands to its natural height.',
  ],
  [
    'src/features/workbench/components/canvas-guide.tsx',
    'The onboarding spotlight tracks an arbitrary element box.',
  ],
  [
    'src/components/layout/components/public-header.tsx',
    'The scroll-condensing header genuinely reflows its max-width and padding.',
  ],
])

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    } else if (/\.(?:ts|tsx)$/.test(entry)) {
      yield full
    }
  }
}

const problems = []

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  const allowLayout = LAYOUT_TRANSITION_ALLOWLIST.has(rel)

  lines.forEach((line, index) => {
    const at = `${rel}:${index + 1}`

    if (/\btransition-all\b/.test(line) && !line.trimStart().startsWith('//')) {
      problems.push(
        `${at}  transition-all is banned — use transition-ui or an explicit transition-[a,b] list.`
      )
    }

    if (allowLayout) return

    for (const match of line.matchAll(/\btransition-\[([^\]]+)\]/g)) {
      const named = match[1].split(',').map((part) => part.trim())
      const offenders = named.filter((property) =>
        LAYOUT_PROPERTIES.has(property)
      )
      if (offenders.length > 0) {
        problems.push(
          `${at}  transition-[${match[1]}] animates layout (${offenders.join(', ')}) — prefer transform/opacity, or add the file to LAYOUT_TRANSITION_ALLOWLIST with a reason.`
        )
      }
    }
  })
}

if (problems.length > 0) {
  console.error(`motion lint: ${problems.length} problem(s)\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

console.log('motion lint: no transition-all or layout-property transitions.')
