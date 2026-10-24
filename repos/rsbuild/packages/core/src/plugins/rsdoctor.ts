import { pathToFileURL } from 'node:url';
import { isWindows } from '../constants';
import { color, require } from '../helpers';
import type { RsbuildPlugin, Rspack } from '../types';

type RsdoctorExports = {
  RsdoctorRspackPlugin: { new (): Rspack.RspackPluginInstance };
};

type MaybeRsdoctorPlugin = Rspack.RspackPluginInstance & {
  isRsdoctorPlugin?: boolean;
};

export const pluginRsdoctor = (): RsbuildPlugin => ({
  name: 'rsbuild:rsdoctor',

  setup(api) {
    api.onBeforeCreateCompiler(async ({ bundlerConfigs }) => {
      // If Rsdoctor isn't enabled, skip this plugin.
      if (process.env.RSDOCTOR !== 'true') {
        return;
      }

      // Add Rsdoctor plugin to start analysis.
      const pluginName = 'RsdoctorRspackPlugin';

      const isRsdoctorPlugin = (plugin: MaybeRsdoctorPlugin) =>
        plugin?.isRsdoctorPlugin === true || plugin?.constructor?.name === pluginName;

      for (const config of bundlerConfigs) {
        // If user has added the Rsdoctor plugin manually, skip the auto-registration.
        const registered = config.plugins?.some((plugin) =>
          isRsdoctorPlugin(plugin as unknown as MaybeRsdoctorPlugin),
        );

        if (registered) {
          return;
        }
      }

      const packageName = '@rsdoctor/rspack-plugin';
      let packagePath: string;

      try {
        packagePath = require.resolve(packageName, {
          paths: [api.context.rootPath],
        });
      } catch {
        api.logger.warn(
          `\`process.env.RSDOCTOR\` enabled, please install ${color.bold(color.yellow(packageName))} package.`,
        );
        return;
      }

      let module: RsdoctorExports;
      try {
        const moduleURL = isWindows ? pathToFileURL(packagePath).href : packagePath;
        module = await import(moduleURL);
      } catch {
        api.logger.error(
          `\`process.env.RSDOCTOR\` enabled, but failed to load ${color.bold(color.yellow(packageName))} module.`,
        );
        return;
      }

      if (!module || !module[pluginName]) {
        return;
      }

      for (const config of bundlerConfigs) {
        config.plugins ||= [];
        config.plugins.push(new module[pluginName]());
      }

      api.logger.info(`${color.bold(color.yellow(packageName))} enabled.`);
    });
  },
});
