import { logger } from './logger'
import { getTemplateDir, appleTemplateProject } from './template'
import type { CreateScriptArgv, ProjectType } from './cli'
import { PACKAGE_NAME_SCOPE } from './cli'

export type Creator = (params: {
  projectName: string;
  projectRelativePath: string;
  description: string;
}) => Promise<void>;

export const createLibrary: Creator = async ({ projectName, description, projectRelativePath }) => {
  // absolute path
  const templateProject = getTemplateDir('library')

  await appleTemplateProject({
    sourceDir: templateProject,
    targetDir: projectRelativePath,
    context: {
      projectName,
      description,
      scope: PACKAGE_NAME_SCOPE,
    },
  })
}

export const createInfra: Creator = async ({ projectName, description, projectRelativePath }) => {
  // absolute path
  const templateProject = getTemplateDir('infra')

  await appleTemplateProject({
    sourceDir: templateProject,
    targetDir: projectRelativePath,
    context: {
      projectName,
      description,
      scope: PACKAGE_NAME_SCOPE,
    },
  })
}

const creatorMap: Partial<Record<ProjectType, Creator>> = {
  lib: createLibrary,
  // infra: createInfra,
}

export const createProject = async (
  projectName: string,
  projectRelativePath: string,
  description: string,
  _options: CreateScriptArgv,
) => {
  logger.info(`creating project "@${PACKAGE_NAME_SCOPE}/${projectName}" ...`)

  const creator = creatorMap['lib']!
  await creator({ projectName, description, projectRelativePath })

  logger.info(`created in \`${projectRelativePath}\``)
}
