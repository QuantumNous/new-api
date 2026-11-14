import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { glob } from 'tinyglobby'

type PackageJson = {
  name?: string
  scripts?: Record<string, string>
}

const filter = process.env.EXAMPLE_FILTER
const skipPackageBuild = process.env.SKIP_PACKAGE_BUILD === 'true'

if (!skipPackageBuild) {
  const nxBin =
    process.platform === 'win32'
      ? 'node_modules/.bin/nx.cmd'
      : 'node_modules/.bin/nx'

  console.log('\nBuilding workspace packages')

  const packageBuild = spawnSync(
    nxBin,
    ['run-many', '--target=build', '--exclude=examples/**'],
    {
      env: {
        ...process.env,
        NX_DAEMON: 'false',
      },
      stdio: 'inherit',
    },
  )

  if (packageBuild.status !== 0) {
    console.log('\nWorkspace package build failed.')
    process.exit(1)
  }
}

const packageJsonPaths = await glob('examples/*/*/package.json')
const examples = packageJsonPaths
  .map((packageJsonPath) => {
    const directory = path.dirname(packageJsonPath)
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf-8'),
    ) as PackageJson

    return {
      directory,
      name: packageJson.name ?? directory,
      hasBuild: Boolean(packageJson.scripts?.build),
    }
  })
  .filter((example) => !filter || example.directory.includes(filter))
  .sort((a, b) => a.directory.localeCompare(b.directory))

const failures: Array<string> = []

for (let index = 0; index < examples.length; index++) {
  const example = examples[index]!

  if (!example.hasBuild) {
    failures.push(`${example.directory} is missing a build script`)
    continue
  }

  console.log(`\n[${index + 1}/${examples.length}] ${example.directory}`)

  const result = spawnSync('npm', ['run', 'build', '--silent'], {
    cwd: example.directory,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    failures.push(`${example.directory} (${example.name})`)
  }
}

if (failures.length > 0) {
  console.log(
    `\nFailed examples:\n${failures.map((failure) => `- ${failure}`).join('\n')}`,
  )
  process.exit(1)
}

console.log(`\nBuilt ${examples.length} examples successfully.`)
