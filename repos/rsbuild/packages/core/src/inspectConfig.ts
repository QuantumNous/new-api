import fs from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { RSBUILD_OUTPUTS_PATH } from './constants';
import { color, getNodeEnv, RspackChain, setNodeEnv, upperFirst } from './helpers';
import type { InitConfigsOptions } from './initConfigs';
import type { Logger } from './logger';
import type {
  InspectConfigOptions,
  InspectConfigResult,
  InternalContext,
  NormalizedConfig,
  NormalizedEnvironmentConfig,
  RsbuildPlugin,
  Rspack,
} from './types';

const normalizePluginObject = (plugin: RsbuildPlugin): RsbuildPlugin => {
  const { setup: _, ...rest } = plugin;
  return {
    ...rest,
    // use empty `setup` function as it's not meaningful in inspect config
    setup() {},
  };
};

type ConfigItem = {
  name: string;
  content: string;
};

async function emitConfigFiles({
  bundlerConfigs,
  environmentConfigs,
  extraConfigs,
  inspectOptions,
  logger,
}: {
  extraConfigs?: ConfigItem[];
  environmentConfigs: ConfigItem[];
  bundlerConfigs: ConfigItem[];
  inspectOptions: InspectConfigOptions & {
    outputPath: string;
  };
  logger: Logger;
}): Promise<void> {
  const { outputPath } = inspectOptions;
  const isSingle = environmentConfigs.length === 1;

  const files = [
    ...environmentConfigs.map(({ name, content }) => {
      const outputFile = isSingle ? 'rsbuild.config.mjs' : `rsbuild.config.${name}.mjs`;
      const label = isSingle ? 'Rsbuild config' : `Rsbuild config (${name})`;

      return {
        path: join(outputPath, outputFile),
        label,
        content,
      };
    }),
    ...bundlerConfigs.map(({ name, content }) => {
      const outputFile = `rspack.config.${name}.mjs`;
      let outputFilePath = join(outputPath, outputFile);

      // if filename is conflict, add a random id to the filename.
      if (fs.existsSync(outputFilePath)) {
        outputFilePath = outputFilePath.replace(/\.mjs$/, `.${Date.now()}.mjs`);
      }

      return {
        path: outputFilePath,
        label: `Rspack Config (${name})`,
        content,
      };
    }),
    ...(extraConfigs || []).map(({ name, content }) => ({
      path: join(outputPath, `${name}.config.mjs`),
      label: `${upperFirst(name)} Config`,
      content,
    })),
  ];

  await fs.promises.mkdir(outputPath, { recursive: true });

  await Promise.all(
    files.map(async (item) => {
      return fs.promises.writeFile(item.path, `export default ${item.content}`);
    }),
  );

  const fileInfos = files
    .map((item) => `  - ${color.bold(color.yellow(item.label))}: ${color.underline(item.path)}`)
    .join('\n');

  logger.success(`config inspection completed, generated files: \n\n${fileInfos}\n`);
}

export function stringifyConfig(config: unknown, verbose?: boolean): string {
  // rspackChain.toString can be used as a common stringify method
  return RspackChain.toString(config, { verbose });
}

const getInspectOutputPath = (
  context: InternalContext,
  inspectOptions: InspectConfigOptions,
): string => {
  const { outputPath } = inspectOptions;

  if (!outputPath) {
    return join(context.distPath, RSBUILD_OUTPUTS_PATH);
  }

  return isAbsolute(outputPath) ? outputPath : join(context.distPath, outputPath);
};

export async function inspectConfig({
  context,
  pluginManager,
  bundlerConfigs,
  inspectOptions = {},
}: InitConfigsOptions & {
  inspectOptions?: InspectConfigOptions;
  bundlerConfigs: Rspack.Configuration[];
}): Promise<InspectConfigResult> {
  if (inspectOptions.mode) {
    setNodeEnv(inspectOptions.mode);
  } else if (!getNodeEnv()) {
    setNodeEnv('development');
  }

  const stringifiedBundlerConfigs = bundlerConfigs.map((config, index) => ({
    name: config.name || String(index),
    content: stringifyConfig(config, inspectOptions.verbose),
  }));

  const { environments, ...rsbuildConfig } = context.normalizedConfig!;
  const normalizedRsbuildConfig: Omit<NormalizedConfig, 'environments'> = {
    ...rsbuildConfig,
    plugins: pluginManager.getPlugins().map(normalizePluginObject),
  };
  const stringifiedRsbuildConfig = stringifyConfig(normalizedRsbuildConfig, inspectOptions.verbose);

  const stringifiedEnvironmentConfigs: ConfigItem[] = [];

  for (const [name, config] of Object.entries(environments)) {
    const normalizedEnvConfig: NormalizedEnvironmentConfig = {
      ...config,
      plugins: pluginManager.getPlugins({ environment: name }).map(normalizePluginObject),
    };

    stringifiedEnvironmentConfigs.push({
      name,
      content: stringifyConfig(normalizedEnvConfig, inspectOptions.verbose),
    });
  }

  const outputPath = getInspectOutputPath(context, inspectOptions);

  const stringifiedExtraConfigs = inspectOptions.extraConfigs
    ? Object.entries(inspectOptions.extraConfigs).map(
        ([name, content]): ConfigItem => ({
          name,
          content:
            typeof content === 'string'
              ? content
              : stringifyConfig(content, inspectOptions.verbose),
        }),
      )
    : undefined;

  if (inspectOptions.writeToDisk) {
    await emitConfigFiles({
      bundlerConfigs: stringifiedBundlerConfigs,
      environmentConfigs: stringifiedEnvironmentConfigs,
      extraConfigs: stringifiedExtraConfigs,
      logger: context.logger,
      inspectOptions: {
        ...inspectOptions,
        outputPath,
      },
    });
  }

  return {
    rsbuildConfig: stringifiedRsbuildConfig,
    environmentConfigs: stringifiedEnvironmentConfigs.map((item) => item.content),
    bundlerConfigs: stringifiedBundlerConfigs.map((item) => item.content),
    origin: {
      rsbuildConfig,
      environmentConfigs: environments,
      bundlerConfigs,
    },
  };
}
