import type { EnvironmentModuleNode } from 'vite'

export function mergeHotUpdateModules(
  currentModules: Array<EnvironmentModuleNode>,
  additionalModules: Array<EnvironmentModuleNode>,
): Array<EnvironmentModuleNode> | undefined {
  if (additionalModules.length === 0) {
    return undefined
  }

  const mergedModules = currentModules.slice()
  const seenModules = new Set(currentModules)

  for (const mod of additionalModules) {
    if (seenModules.has(mod)) {
      continue
    }

    seenModules.add(mod)
    mergedModules.push(mod)
  }

  return mergedModules
}
