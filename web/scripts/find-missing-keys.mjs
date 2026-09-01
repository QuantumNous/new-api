import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')
const SRC_DIR = path.resolve('src')

const en = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, 'en.json'), 'utf8'))
const enKeys = new Set(Object.keys(en.translation))

const tCallRegex = /\bt\(\s*['"`]([^'"`\n]+?)['"`]\s*[,)]/g
const tCallMultilineRegex = /\bt\(\s*['"`]([^'"`]+?)['"`]\s*\)/g

async function walkDir(dir) {
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'locales', '_reports', '_extras'].includes(entry.name)) continue
      files.push(...(await walkDir(fullPath)))
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

const files = await walkDir(SRC_DIR)
const missingKeys = new Map()

for (const file of files) {
  const content = await fs.readFile(file, 'utf8')
  const relPath = path.relative(SRC_DIR, file)
  for (const regex of [tCallRegex, tCallMultilineRegex]) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(content)) !== null) {
      const key = match[1]
      if (key.startsWith('{{') || key.includes('${')) continue
      if (!enKeys.has(key)) {
        if (!missingKeys.has(key)) missingKeys.set(key, [])
        missingKeys.get(key).push(relPath)
      }
    }
  }
}

if (missingKeys.size === 0) {
  console.log('All t() keys found in en.json!')
} else {
  console.log(`Found ${missingKeys.size} missing keys:\n`)
  for (const [key, files] of [...missingKeys.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  "${key}"`)
    for (const f of [...new Set(files)]) console.log(`    -> ${f}`)
  }
}
