import type { Rspack } from '@rsbuild/core';

/** Match plugin by constructor name. */
export const matchPlugin = (config: Rspack.Configuration, pluginName: string, all?: boolean) => {
  const result = config.plugins?.filter((item) => item?.constructor.name === pluginName);

  if (Array.isArray(result)) {
    return all ? result : result[0] || null;
  }
  return result || null;
};

export function matchRules(config: Rspack.Configuration, testFile: string): Rspack.RuleSetRules {
  if (!config.module?.rules) {
    return [];
  }

  const isMatch = (test: Rspack.RuleSetCondition, testFile: string) => {
    if (test instanceof RegExp && test.test(testFile)) {
      return true;
    }
  };

  return config.module.rules.filter((rule) => {
    if (rule && typeof rule === 'object' && rule.test) {
      if (isMatch(rule.test, testFile)) {
        return true;
      }

      if (Array.isArray(rule.test) && rule.test.some((test) => isMatch(test, testFile))) {
        return true;
      }
    }

    return false;
  });
}
