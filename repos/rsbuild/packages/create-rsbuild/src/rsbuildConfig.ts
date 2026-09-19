import fs from 'node:fs';
import path from 'node:path';

export type ConfigPlugin = {
  id: string;
  importName: string;
  source: string;
  importLine?: string;
  call?: string;
  order?: number;
};

export const tailwindcssPlugin: ConfigPlugin = {
  id: 'tailwindcss',
  importName: 'pluginTailwindcss',
  source: '@rsbuild/plugin-tailwindcss',
  order: 20,
};

type ConfigState = {
  file: string;
  base: string;
  plugins: Map<string, ConfigPlugin>;
};

// Tool actions may update the same config file one after another. Keep the
// original config and regenerate from it so plugin order stays deterministic.
const cache = new Map<string, ConfigState>();
const configFiles = ['rsbuild.config.ts', 'rsbuild.config.js'];
const indent = '  ';

const normalize = (code: string) => code.replaceAll('\r\n', '\n');

const getCall = ({ importName, call }: ConfigPlugin) => call ?? `${importName}()`;

const addImport = (code: string, plugin: ConfigPlugin) => {
  if (code.includes(plugin.source)) {
    return code;
  }

  const lines = code.split('\n');
  const index = lines.findLastIndex((line) => line.startsWith('import '));

  lines.splice(
    index + 1,
    0,
    plugin.importLine ?? `import { ${plugin.importName} } from '${plugin.source}';`,
  );

  return lines.join('\n');
};

const formatCall = (call: string) => {
  const lines = call.split('\n');
  return lines
    .map((line, index) => {
      const comma = index === lines.length - 1 ? ',' : '';
      return `${indent}${indent}${line}${comma}`;
    })
    .join('\n');
};

const formatPlugins = (calls: string[]) => {
  if (calls.every((call) => !call.includes('\n'))) {
    return `${indent}plugins: [${calls.join(', ')}],`;
  }

  const lines = [`${indent}plugins: [`, ...calls.map(formatCall), `${indent}],`];
  return lines.join('\n');
};

const addReactCompilerOption = (code: string) => {
  if (code.includes('reactCompiler:')) {
    return code;
  }

  const reactCompilerCall = `pluginReact({
  reactCompiler: true,
})`;
  const multiLineCall = `${indent}${indent}pluginReact(),`;
  const replaceCall = (call: string) => (call === 'pluginReact()' ? reactCompilerCall : call);
  const next = code
    .replace(/^ {2}plugins: \[(.*pluginReact\(\).*)\],$/m, (_, calls: string) =>
      formatPlugins(calls.split(', ').map(replaceCall)),
    )
    .replace(multiLineCall, formatCall(reactCompilerCall));

  if (next !== code) {
    return next;
  }

  throw new Error('Failed to update rsbuild.config: pluginReact call not found.');
};

const addPluginsField = (code: string, calls: string[]) => {
  if (code.includes('defineConfig({});')) {
    return code.replace('defineConfig({});', `defineConfig({\n${formatPlugins(calls)}\n});`);
  }

  const next = code.replace(
    'export default defineConfig({\n',
    `export default defineConfig({\n${formatPlugins(calls)}\n`,
  );

  if (next === code) {
    throw new Error('Failed to update rsbuild.config: defineConfig object not found.');
  }

  return next;
};

const addCalls = (code: string, plugins: ConfigPlugin[]) => {
  const calls = plugins.map(getCall);
  const lines = code.split('\n');
  const start = lines.findIndex((line) => line.includes('plugins: ['));

  if (start === -1) {
    return addPluginsField(code, calls);
  }

  const pluginsLine = lines[start].trim();
  if (pluginsLine.endsWith('],')) {
    const rawCalls = /^plugins: \[(.*)\],$/.exec(pluginsLine)?.[1]?.trim();
    const oldCalls = rawCalls ? [rawCalls] : [];
    lines[start] = formatPlugins([...oldCalls, ...calls]);
    return lines.join('\n');
  }

  // Existing multi-line plugins arrays are kept as-is; new plugin calls are
  // inserted before the closing bracket.
  const end = lines.findIndex((line, index) => index > start && line.trim() === '],');

  if (end === -1) {
    throw new Error('Failed to update rsbuild.config: plugins array not found.');
  }

  lines.splice(end, 0, ...calls.map(formatCall));
  return lines.join('\n');
};

const applyPlugins = (base: string, plugins: ConfigPlugin[]) => {
  let code = base;

  for (const plugin of plugins) {
    code = addImport(code, plugin);
  }

  return addCalls(code, plugins);
};

const findConfig = (dir: string) => {
  return configFiles.map((name) => path.join(dir, name)).find((file) => fs.existsSync(file));
};

export const addPluginsToRsbuildConfig = async (dir: string, plugins: ConfigPlugin[]) => {
  const file = findConfig(dir);

  if (!file) {
    return;
  }

  const state = cache.get(dir) ?? {
    file,
    // Normalize line endings before editing so string matching works on Windows.
    base: normalize(await fs.promises.readFile(file, 'utf-8')),
    plugins: new Map<string, ConfigPlugin>(),
  };

  for (const plugin of plugins) {
    state.plugins.set(plugin.id, plugin);
  }

  cache.set(dir, state);

  // Reapply every selected plugin to the original config on each call. This
  // avoids appending to previously generated code when multiple tools are used.
  const ordered = [...state.plugins.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  await fs.promises.writeFile(state.file, applyPlugins(state.base, ordered));
};

export const enableReactCompilerInRsbuildConfig = async (dir: string) => {
  const file = findConfig(dir);

  if (!file) {
    return;
  }

  const code = normalize(await fs.promises.readFile(file, 'utf-8'));
  await fs.promises.writeFile(file, addReactCompilerOption(code));
};
