import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const ROOT_PACKAGE_JSON = join(__dirname, '..', 'package.json')
const PACKAGES_DIR = join(__dirname, '..', 'packages')
const SUPPORTED_TS_VERSIONS = ['5.4', '5.5', '5.6', '5.7', '5.8', '5.9']
const LATEST_TS_VERSION =
  SUPPORTED_TS_VERSIONS[SUPPORTED_TS_VERSIONS.length - 1]

/**
 * @param {string} packagePath
 */
function updatePackageJson(packagePath) {
  const PREVIOUS_LATEST_VERSION =
    SUPPORTED_TS_VERSIONS[SUPPORTED_TS_VERSIONS.length - 2]

  if (PREVIOUS_LATEST_VERSION === undefined) {
    throw new Error('Previous latest version not found')
  }

  const packageJsonPath = join(packagePath, 'package.json')
  if (!existsSync(packageJsonPath)) return

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  packageJson.scripts = packageJson.scripts || {}

  const scriptKeys = Object.keys(packageJson.scripts)
  const updatedScripts = { ...packageJson.scripts }
  /** @type Record<string, string> */
  const cliArgs = {}

  // Remove old TS test scripts and store CLI arguments
  scriptKeys.forEach((key) => {
    if (key.startsWith('test:types:')) {
      const script = packageJson.scripts[key]
      const match = script.match(/(?:node \S+\/tsc\.js|tsc)(.*)/)
      cliArgs[key] = match ? match[1].trim() : ''
      delete updatedScripts[key]
    }
  })

  // Get CLI arguments from the previous latest version
  const previousLatestKey = `test:types:ts${PREVIOUS_LATEST_VERSION.replace('.', '')}`
  const previousLatestArgs = cliArgs[previousLatestKey] || ''

  // Insert new TS test scripts while maintaining order
  let insertIndex = scriptKeys.findIndex((key) => key.startsWith('test:types:'))
  if (insertIndex === -1) insertIndex = scriptKeys.length

  /** @type Record<string, string> */
  const newScripts = {}
  scriptKeys.forEach((key, index) => {
    if (index === insertIndex) {
      SUPPORTED_TS_VERSIONS.forEach((version, i) => {
        const scriptKey = `test:types:ts${version.replace('.', '')}`
        if (i === SUPPORTED_TS_VERSIONS.length - 1) {
          // Use "tsc" directly for the latest version
          newScripts[scriptKey] = `tsc ${previousLatestArgs}`.trim()
        } else {
          const args = cliArgs[scriptKey] || ''
          newScripts[scriptKey] =
            `node ../../node_modules/typescript${version.replace('.', '')}/lib/tsc.js ${args}`.trim()
        }
      })
    }
    if (!key.startsWith('test:types:')) {
      newScripts[key] = packageJson.scripts[key]
    }
  })

  packageJson.scripts = newScripts
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log(`Updated ${packageJsonPath}`)
}

function updateRootPackageJson() {
  if (!existsSync(ROOT_PACKAGE_JSON)) {
    return
  }

  const rootPackageJson = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8'))
  rootPackageJson.devDependencies = rootPackageJson.devDependencies || {}

  // Update main TypeScript version
  rootPackageJson.devDependencies['typescript'] = `^${LATEST_TS_VERSION}.0`

  // Remove old TypeScript aliases
  Object.keys(rootPackageJson.devDependencies).forEach((dep) => {
    if (dep.startsWith('typescript') && dep !== 'typescript') {
      delete rootPackageJson.devDependencies[dep]
    }
  })

  // Add supported TypeScript aliases
  SUPPORTED_TS_VERSIONS.slice(0, -1).forEach((version) => {
    rootPackageJson.devDependencies[`typescript${version.replace('.', '')}`] =
      `npm:typescript@${version}`
  })

  writeFileSync(
    ROOT_PACKAGE_JSON,
    JSON.stringify(rootPackageJson, null, 2) + '\n',
  )
  console.log(`Updated ${ROOT_PACKAGE_JSON}`)
}

function updateAllPackages() {
  if (!existsSync(PACKAGES_DIR)) {
    throw new Error(`Packages directory not found: ${PACKAGES_DIR}`)
  }

  const packageDirs = readdirSync(PACKAGES_DIR)
    .map((name) => join(PACKAGES_DIR, name))
    .filter((dir) => statSync(dir).isDirectory())
  packageDirs.forEach(updatePackageJson)
  updateRootPackageJson()
}

updateAllPackages()
