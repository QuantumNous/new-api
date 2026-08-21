import path from 'pathe'
import type { GetConfigFn, TanStackStartCoreOptions } from '../types'

function buildRouteTreeFileFooter(opts: {
  generatedRouteTreePath: string
  startFilePath: string | undefined
  routerFilePath: string
  framework: TanStackStartCoreOptions['framework']
  userFooter?: Array<string> | (() => Array<string>)
}): Array<string> {
  function getImportPath(absolutePath: string) {
    let relativePath = path.relative(
      path.dirname(opts.generatedRouteTreePath),
      absolutePath,
    )

    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath
    }

    return relativePath.split(path.sep).join('/')
  }

  function appendFooterBlock(lines: Array<string>, block: string) {
    if (!block) {
      return
    }

    if (lines.length > 0) {
      lines[lines.length - 1] += `\n${block}`
      return
    }

    lines.push(block)
  }

  const footer: Array<string> = []

  appendFooterBlock(
    footer,
    `import type { getRouter } from '${getImportPath(opts.routerFilePath)}'`,
  )

  if (opts.startFilePath) {
    appendFooterBlock(
      footer,
      `import type { startInstance } from '${getImportPath(opts.startFilePath)}'`,
    )
  } else {
    appendFooterBlock(
      footer,
      `import type { createStart } from '@tanstack/${opts.framework}-start'`,
    )
  }

  appendFooterBlock(
    footer,
    `declare module '@tanstack/${opts.framework}-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>`,
  )

  if (opts.startFilePath) {
    appendFooterBlock(
      footer,
      `    config: Awaited<ReturnType<typeof startInstance.getOptions>>`,
    )
  }

  appendFooterBlock(
    footer,
    `  }
}`,
  )

  if (opts.userFooter) {
    footer.push(
      ...(Array.isArray(opts.userFooter) ? opts.userFooter : opts.userFooter()),
    )
  }

  return footer
}

export function buildRouteTreeFileFooterFromConfig(opts: {
  generatedRouteTreePath: string
  getConfig: GetConfigFn
  corePluginOpts: TanStackStartCoreOptions
}): Array<string> {
  const { startConfig, resolvedStartConfig } = opts.getConfig()
  return buildRouteTreeFileFooter({
    generatedRouteTreePath: opts.generatedRouteTreePath,
    startFilePath: resolvedStartConfig.startFilePath,
    routerFilePath: resolvedStartConfig.routerFilePath,
    framework: opts.corePluginOpts.framework,
    userFooter: startConfig.router.routeTreeFileFooter,
  })
}
