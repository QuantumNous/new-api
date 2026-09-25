import fs from 'fs'
import path from 'node:path'
import { globSync } from 'node:fs'

const rootDir = path.join(import.meta.dirname, '..')

// Build a map of package name -> current version from workspace
const packagesDir = path.join(rootDir, 'packages')
const packageMap = Object.fromEntries(
  globSync('*/package.json', { cwd: packagesDir }).map((p) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(packagesDir, p), 'utf-8'))
    return [pkg.name, pkg.version]
  }),
)

// Update all example package.json files
const examplesDir = path.join(rootDir, 'examples')
const examplePkgPaths = globSync('**/package.json', {
  cwd: examplesDir,
  exclude: (p) => p.includes('node_modules'),
})

let updatedCount = 0

for (const relPath of examplePkgPaths) {
  const fullPath = path.join(examplesDir, relPath)
  const content = fs.readFileSync(fullPath, 'utf-8')
  const pkg = JSON.parse(content)

  let changed = false
  for (const depType of ['dependencies', 'devDependencies']) {
    const deps = pkg[depType]
    if (!deps) continue
    for (const [name, range] of Object.entries(deps)) {
      if (packageMap[name] && range !== `^${packageMap[name]}`) {
        deps[name] = `^${packageMap[name]}`
        changed = true
      }
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n')
    updatedCount++
    console.log(`Updated ${relPath}`)
  }
}

console.log(`\nDone. Updated ${updatedCount} example(s).`)
