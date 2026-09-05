import type { Module, ModuleLinker, SyntheticModule } from 'node:vm';

const isModuleNamespaceObject = (moduleExports: Record<string, unknown>) =>
  Object.prototype.toString.call(moduleExports) === '[object Module]';

const normalizeModuleExports = (moduleExports: unknown): Record<string, unknown> => {
  if (
    moduleExports !== null &&
    (typeof moduleExports === 'object' || typeof moduleExports === 'function')
  ) {
    return moduleExports as Record<string, unknown>;
  }

  return { default: moduleExports };
};

export const asModule = async (
  moduleExports: unknown,
  context: Record<string, unknown>,
  unlinked?: boolean,
): Promise<Module | SyntheticModule> => {
  const { Module, SyntheticModule } = await import('node:vm');

  if (moduleExports instanceof Module) {
    return moduleExports;
  }

  const normalizedModuleExports = normalizeModuleExports(moduleExports);
  const exports = [...new Set(['default', ...Object.keys(normalizedModuleExports)])];

  const syntheticModule = new SyntheticModule(
    exports,
    () => {
      for (const name of exports) {
        if (name === 'default') {
          const defaultExport =
            isModuleNamespaceObject(normalizedModuleExports) && 'default' in normalizedModuleExports
              ? normalizedModuleExports.default
              : moduleExports;
          syntheticModule.setExport(name, defaultExport);
        } else {
          syntheticModule.setExport(name, normalizedModuleExports[name]);
        }
      }
    },
    { context },
  );

  if (unlinked) return syntheticModule;

  await syntheticModule.link((() => {}) as unknown as ModuleLinker);
  await syntheticModule.evaluate();
  return syntheticModule;
};
