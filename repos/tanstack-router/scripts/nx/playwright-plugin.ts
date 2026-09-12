import { dirname } from 'node:path'
import { createNodesFromFiles, readJsonFile } from '@nx/devkit'
import type {
  CreateNodesContextV2,
  CreateNodesV2,
  TargetConfiguration,
} from '@nx/devkit'

export const createNodesV2: CreateNodesV2 = [
  '**/package.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, _options, context) =>
        createNodesInternal(configFile, context),
      configFiles,
      options,
      context,
    )
  },
]

function createNodesInternal(
  configFilePath: string,
  _context: CreateNodesContextV2,
) {
  const projectConfiguration = readJsonFile<{
    name?: string
    nx?: {
      metadata?: {
        playwrightShards?: number
        playwrightModes?: Array<RawPlaywrightModeMetadata>
      }
    }
  }>(configFilePath)
  const root = dirname(configFilePath)
  const packageName = projectConfiguration.name ?? root
  const playwrightModes =
    projectConfiguration.nx?.metadata?.playwrightModes ?? []

  if (playwrightModes.length > 0) {
    const { targets, targetGroupEntries } = buildModeTargets(
      root,
      packageName,
      playwrightModes,
    )

    return {
      projects: {
        [root]: {
          targets,
          metadata: {
            targetGroups: {
              playwright: targetGroupEntries,
            },
          },
          tags: ['playwright:sharded'],
        },
      },
    }
  }

  if (!projectConfiguration.nx?.metadata?.playwrightShards) {
    return {
      projects: {
        [root]: {},
      },
    }
  }

  const { targets, targetGroupEntries } = buildShardedTargets(
    root,
    packageName,
    projectConfiguration.nx.metadata.playwrightShards,
  )
  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [root]: {
        targets,
        metadata: {
          targetGroups: {
            playwright: targetGroupEntries,
          },
        },
        tags: ['playwright:sharded'],
      },
    },
  }
}

const CI_TARGET_NAME = 'test:e2e'
const MODE_TARGET_SEPARATOR = '--'
const TEST_INPUTS: TargetConfiguration['inputs'] = ['default', '^production']
const BUILD_INPUTS: TargetConfiguration['inputs'] = [
  'production',
  '^production',
]

const PLAYWRIGHT_TOOLCHAINS = ['vite', 'rsbuild'] as const
const PLAYWRIGHT_MODES = ['ssr', 'spa', 'prerender', 'preview'] as const

type PlaywrightToolchain = (typeof PLAYWRIGHT_TOOLCHAINS)[number]
type PlaywrightMode = (typeof PLAYWRIGHT_MODES)[number]

const PLAYWRIGHT_BUILD_COMMANDS: Record<PlaywrightToolchain, string> = {
  vite: 'vite build && tsc --noEmit',
  rsbuild: 'rsbuild build && tsc --noEmit',
}

type PlaywrightModeMetadata = {
  toolchain: PlaywrightToolchain
  mode: PlaywrightMode
  shards?: number
  name?: string
  env: Record<string, string>
}

type RawPlaywrightModeMetadata = {
  toolchain?: string
  mode?: string
  shards?: number
  name?: string
  env?: Record<string, string>
}

function validateModeMetadata(
  modeMetadata: RawPlaywrightModeMetadata,
  index: number,
): PlaywrightModeMetadata {
  const targetName = `${modeMetadata.toolchain ?? '<missing toolchain>'}:${modeMetadata.mode ?? '<missing mode>'}`

  if (!modeMetadata.toolchain || !modeMetadata.mode) {
    throw new Error(
      `[Playwright Sharding Plugin] Invalid playwrightModes[${index}] entry: ` +
        `${JSON.stringify(modeMetadata)}. Both "toolchain" and "mode" are required.`,
    )
  }

  if (
    !PLAYWRIGHT_TOOLCHAINS.includes(
      modeMetadata.toolchain as PlaywrightToolchain,
    )
  ) {
    throw new Error(
      `[Playwright Sharding Plugin] Invalid toolchain for playwrightModes[${index}]: ` +
        `${modeMetadata.toolchain}. Supported toolchains: ${PLAYWRIGHT_TOOLCHAINS.join(', ')}.`,
    )
  }

  if (!PLAYWRIGHT_MODES.includes(modeMetadata.mode as PlaywrightMode)) {
    throw new Error(
      `[Playwright Sharding Plugin] Invalid mode for playwrightModes[${index}]: ` +
        `${modeMetadata.mode}. Supported modes: ${PLAYWRIGHT_MODES.join(', ')}.`,
    )
  }

  if (modeMetadata.shards !== undefined) {
    const shardCount = Number(modeMetadata.shards)

    if (!Number.isInteger(shardCount) || shardCount < 1) {
      throw new Error(
        `[Playwright Sharding Plugin] Invalid shard count for ${targetName}: ${modeMetadata.shards}. ` +
          `Expected a positive integer.`,
      )
    }
  }

  if (
    modeMetadata.name !== undefined &&
    !/^[a-z0-9][a-z0-9-]*$/.test(modeMetadata.name)
  ) {
    throw new Error(
      `[Playwright Sharding Plugin] Invalid name for playwrightModes[${index}]: ` +
        `${modeMetadata.name}. Expected lowercase letters, numbers, and dashes.`,
    )
  }

  if (modeMetadata.env !== undefined) {
    if (
      typeof modeMetadata.env !== 'object' ||
      Array.isArray(modeMetadata.env)
    ) {
      throw new Error(
        `[Playwright Sharding Plugin] Invalid env for playwrightModes[${index}]: ` +
          `Expected an object of string values.`,
      )
    }

    for (const [key, value] of Object.entries(modeMetadata.env)) {
      if (typeof value !== 'string') {
        throw new Error(
          `[Playwright Sharding Plugin] Invalid env value for playwrightModes[${index}].${key}: ` +
            `Expected a string.`,
        )
      }
    }
  }

  return {
    toolchain: modeMetadata.toolchain as PlaywrightToolchain,
    mode: modeMetadata.mode as PlaywrightMode,
    shards: modeMetadata.shards,
    name: modeMetadata.name,
    env: modeMetadata.env ?? {},
  }
}

function buildModeTargets(
  projectRoot: string,
  packageName: string,
  modes: Array<RawPlaywrightModeMetadata>,
): {
  targets: Record<string, TargetConfiguration>
  targetGroupEntries: Array<string>
} {
  const targets: Record<string, TargetConfiguration> = {}
  const targetGroup: Array<string> = []
  const ciDependsOnTargets: Array<{
    target: string
    projects: 'self'
    params: 'forward'
  }> = []

  for (const [index, rawModeMetadata] of modes.entries()) {
    const modeMetadata = validateModeMetadata(rawModeMetadata, index)
    const variantTargetSuffix = modeMetadata.name
      ? `${MODE_TARGET_SEPARATOR}${modeMetadata.name}`
      : ''
    const variantPathSuffix = modeMetadata.name ? `-${modeMetadata.name}` : ''
    const modeTargetName = `${CI_TARGET_NAME}--${modeMetadata.toolchain}-${modeMetadata.mode}${variantTargetSuffix}`
    const buildTargetName = `build:${modeMetadata.toolchain}:${modeMetadata.mode}${modeMetadata.name ? `:${modeMetadata.name}` : ''}`
    const shardCount = modeMetadata.shards ?? 1
    const distDir = `dist-${modeMetadata.toolchain}-${modeMetadata.mode}${variantPathSuffix}`
    const modeEnv = {
      ...modeMetadata.env,
      MODE: modeMetadata.mode,
      TOOLCHAIN: modeMetadata.toolchain,
      E2E_TOOLCHAIN: modeMetadata.toolchain,
      E2E_DIST: distDir,
      E2E_DIST_DIR: distDir,
    }
    const modePortKey = `${packageName}-${modeMetadata.toolchain}-${modeMetadata.mode}${variantPathSuffix}`
    const modeDescription = `${modeMetadata.toolchain}/${modeMetadata.mode}${modeMetadata.name ? `/${modeMetadata.name}` : ''}`
    const modeShardTargets: Array<string> = []

    targets[buildTargetName] = {
      executor: 'nx:run-commands',
      options: {
        command: PLAYWRIGHT_BUILD_COMMANDS[modeMetadata.toolchain],
        cwd: projectRoot,
        env: modeEnv,
      },
      parallelism: false,
      cache: true,
      inputs: BUILD_INPUTS,
      dependsOn: ['^build'],
      outputs: [`{projectRoot}/${distDir}`],
      metadata: {
        technologies: ['playwright'],
        description: `Build artifacts for ${modeDescription} e2e tests`,
      },
    }
    targetGroup.push(buildTargetName)

    if (shardCount === 1) {
      targets[modeTargetName] = {
        executor: 'nx:run-commands',
        options: {
          command: 'playwright test --project=chromium',
          cwd: projectRoot,
          env: {
            ...modeEnv,
            E2E_PORT_KEY: modePortKey,
          },
        },
        cache: true,
        inputs: TEST_INPUTS,
        dependsOn: [buildTargetName],
        metadata: {
          technologies: ['playwright'],
          description: `Run Playwright tests for ${modeDescription}`,
        },
      }
      targetGroup.push(modeTargetName)
    } else {
      for (let shardIndex = 1; shardIndex <= shardCount; shardIndex++) {
        const shardTargetName = `${modeTargetName}${MODE_TARGET_SEPARATOR}shard-${shardIndex}-of-${shardCount}`
        const shardPortKey = `${modePortKey}-shard-${shardIndex}-of-${shardCount}`

        targets[shardTargetName] = {
          executor: 'nx:run-commands',
          options: {
            command: `playwright test --project=chromium --shard=${shardIndex}/${shardCount}`,
            cwd: projectRoot,
            env: {
              ...modeEnv,
              E2E_PORT_KEY: shardPortKey,
            },
          },
          cache: true,
          inputs: TEST_INPUTS,
          dependsOn: [buildTargetName],
          metadata: {
            technologies: ['playwright'],
            description: `Run Playwright ${modeDescription} shard ${shardIndex} of ${shardCount}`,
            help: {
              command: `npx playwright run --help`,
              example: {
                options: {
                  shard: `${shardIndex}/${shardCount}`,
                },
              },
            },
          },
        }

        modeShardTargets.push(shardTargetName)
        targetGroup.push(shardTargetName)
      }

      targets[modeTargetName] = {
        executor: 'nx:noop',
        cache: true,
        inputs: TEST_INPUTS,
        dependsOn: modeShardTargets.map((shardTargetName) => ({
          target: shardTargetName,
          projects: 'self' as const,
          params: 'forward' as const,
        })),
        metadata: {
          technologies: ['playwright'],
          description: `Run all Playwright ${modeDescription} shards (${shardCount} shards)`,
        },
      }
      targetGroup.push(modeTargetName)
    }

    ciDependsOnTargets.push({
      target: modeTargetName,
      projects: 'self',
      params: 'forward',
    })
  }

  targets[CI_TARGET_NAME] = {
    executor: 'nx:noop',
    cache: true,
    inputs: TEST_INPUTS,
    dependsOn: ciDependsOnTargets,
    metadata: {
      technologies: ['playwright'],
      description: `Run all Playwright modes (${modes.length} modes)`,
    },
  }

  return {
    targets,
    targetGroupEntries: [...targetGroup, CI_TARGET_NAME],
  }
}

function buildShardedTargets(
  projectRoot: string,
  packageName: string,
  shardCount: number,
): {
  targets: Record<string, TargetConfiguration>
  targetGroupEntries: Array<string>
} {
  const targets: Record<string, TargetConfiguration> = {}
  const targetGroup: Array<string> = []

  // Create individual shard targets
  for (let shardIndex = 1; shardIndex <= shardCount; shardIndex++) {
    const shardTargetName = `${CI_TARGET_NAME}--shard-${shardIndex}-of-${shardCount}`
    const e2ePortKey = `${packageName}-shard-${shardIndex}-of-${shardCount}`

    targets[shardTargetName] = {
      executor: 'nx:run-commands',
      options: {
        command: `playwright test --project=chromium --shard=${shardIndex}/${shardCount}`,
        cwd: projectRoot,
        env: {
          E2E_PORT_KEY: e2ePortKey,
        },
      },
      cache: true,
      inputs: TEST_INPUTS,
      dependsOn: [`^build`, 'build'],
      metadata: {
        technologies: ['playwright'],
        description: `Run Playwright shard ${shardIndex} of ${shardCount}`,
        help: {
          command: `npx playwright run --help`,
          example: {
            options: {
              shard: `${shardIndex}/${shardCount}`,
            },
          },
        },
      },
    }

    targetGroup.push(shardTargetName)
  }

  // Create the parent CI target that depends on merge (which itself depends on all shards)
  targets[CI_TARGET_NAME] = {
    executor: 'nx:noop',
    cache: true,
    inputs: TEST_INPUTS,
    dependsOn: targetGroup.map((shardTargetName) => ({
      target: shardTargetName,
      projects: 'self' as const,
      params: 'forward' as const,
    })),
    metadata: {
      technologies: ['playwright'],
      description: `Run all Playwright shards (${shardCount} shards)`,
    },
  }

  return {
    targets,
    targetGroupEntries: [...targetGroup, CI_TARGET_NAME],
  }
}
