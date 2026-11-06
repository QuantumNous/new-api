import minimist, { ParsedArgs } from 'minimist'
import fs, { promises as fsp, constants } from 'fs'
import path from 'path'
import chalk from 'chalk'
import prompts from 'prompts'
import { RushConfiguration } from '@microsoft/rush-lib'
import { $ } from 'zx'
import readline from 'readline'
import { createProject } from './create'
import { logger } from './logger'

export enum ProjectType {
  Library = 'lib',
  // Infra = 'infra',
  // Component = 'component',
  // App = 'app',
}

export interface CreateScriptArgv extends ParsedArgs {
  name?: string;
  // type: ProjectType;
}

export const PACKAGE_NAME_SCOPE = 'visactor';

function verifyProjectName(name?: string): { valid: boolean; message?: string } {
  if (!name) {
    return {
      valid: false,
      message: `project name can't be empty"`,
    }
  }

  if (name.match(new RegExp(`/^@?${PACKAGE_NAME_SCOPE}/`))) {
    return {
      valid: false,
      message: `don't input with prefix 'PACKAGE_NAME_SCOPE'`,
    }
  }

  const projects = RushConfiguration.loadFromDefaultLocation({
    startingFolder: process.cwd(),
  })
  const isExistsProject = projects.findProjectByShorthandName(`@${PACKAGE_NAME_SCOPE}/${name}`)
  if (isExistsProject) {
    return {
      valid: false,
      message: 'project name has exists in rush.json `projects` field',
    }
  }

  if (!name.match(/^[a-z.-]+$/)) {
    return {
      valid: false,
      message: 'package name only support chars: a-z . -',
    }
  }

  return { valid: true }
}

function getProjectRelativePath(type: ProjectType, projectName: string) {
  const projectPathMap: Record<ProjectType, string> = {
    lib: 'packages',
    // infra: 'infra',
  }

  return `${projectPathMap[type]}/${projectName}`
}

async function create() {
  const argv = minimist(process.argv.slice(2)) as CreateScriptArgv

  let projectName = argv.name

  if (!projectName) {
    const { name } = await prompts({
      type: 'text',
      name: 'name',
      message: `What's your project named? ${chalk.reset.gray(`(@${PACKAGE_NAME_SCOPE}/_____)`)}`,
      validate: (name) => {
        const { valid, message } = verifyProjectName(name)
        if (valid) {
          return true
        }
        return message!
      },
    })

    projectName = name
  }

  const { valid, message } = verifyProjectName(projectName)
  if (!valid) {
    logger.error(message)
    process.exit(1)
  }

  const projectRelativePath = getProjectRelativePath(ProjectType.Library, projectName!)
  const projectPath = path.resolve(process.cwd(), projectRelativePath)
  try {
    await fsp.access(projectPath, constants.R_OK | constants.W_OK)
    logger.error(`The path ${projectRelativePath} you will created exists`)
    process.exit(1)
  } catch (_err) {}

  const { description = '' } = await prompts({
    type: 'text',
    name: 'description',
    message: `description of project ${chalk.reset.gray('(default: "")')}`,
  })

  await createProject(projectName!, projectRelativePath, description, argv)

  await appendProjectToRushJson(projectName!, projectRelativePath)

  $`rush --debug update`
}


function appendProjectToRushJson(packageName: string, projectRelativePath: string) {
  return new Promise((resolve) => {
    const rushJsonPath = path.resolve(process.cwd(), 'rush.json')

    const result: string[] = []
    const rl = readline.createInterface({ input: fs.createReadStream(rushJsonPath) })
    rl.on('line', (l) => {
      if (l.trim().startsWith('"projects":')) {
        result.push(l)
        result.push('    {')
        result.push(`      "packageName": "@${PACKAGE_NAME_SCOPE}/${packageName}",`)
        result.push(`      "projectFolder": "${projectRelativePath}",`)
        result.push(`      "shouldPublish": false`)
        result.push('    },')
      } else {
        result.push(l)
      }
    })

    rl.on('close', () => {
      fs.writeFileSync(rushJsonPath, result.join('\n'), { encoding: 'utf-8' })
      logger.info(`Append project ${packageName} to rush.json successful`)
      resolve(undefined)
    })
  })
}

create().catch((err) => {
  console.error('[rush create] failed', err)
})
