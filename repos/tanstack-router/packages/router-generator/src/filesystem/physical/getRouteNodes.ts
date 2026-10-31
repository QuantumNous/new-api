import path from 'node:path'
import * as fsp from 'node:fs/promises'
import {
  cleanPath,
  createRoutePathSegmentMetadata,
  determineInitialRoutePath,
  escapeRegExp,
  hasEscapedLeadingUnderscore,
  joinRoutePathSegmentMetadata,
  removeExt,
  replaceBackslash,
  routePathToVariable,
  unwrapBracketWrappedSegment,
} from '../../utils'
import { getRouteNodes as getRouteNodesVirtual } from '../virtual/getRouteNodes'
import { loadConfigFile } from '../virtual/loadConfigFile'
import { logging } from '../../logger'
import { rootPathId } from './rootPathId'
import type {
  VirtualRootRoute,
  VirtualRouteSubtreeConfig,
} from '@tanstack/virtual-file-routes'
import type { FsRouteType, GetRouteNodesResult, RouteNode } from '../../types'
import type { Config } from '../../config'

/**
 * Pre-compiled segment regexes for matching token patterns against route segments.
 * These are created once (in Generator constructor) and passed through to avoid
 * repeated regex compilation during route crawling.
 */
export interface TokenRegexBundle {
  indexTokenSegmentRegex: RegExp
  routeTokenSegmentRegex: RegExp
}

const disallowedRouteGroupConfiguration = /\(([^)]+)\).(ts|js|tsx|jsx|vue)/

const virtualConfigFileRegExp = /__virtual\.[mc]?[jt]s$/
export function isVirtualConfigFile(fileName: string): boolean {
  return virtualConfigFileRegExp.test(fileName)
}

export async function getRouteNodes(
  config: Pick<
    Config,
    | 'routesDirectory'
    | 'routeFilePrefix'
    | 'routeFileIgnorePrefix'
    | 'routeFileIgnorePattern'
    | 'disableLogging'
    | 'routeToken'
    | 'indexToken'
  >,
  root: string,
  tokenRegexes: TokenRegexBundle,
): Promise<GetRouteNodesResult> {
  const { routeFilePrefix, routeFileIgnorePrefix, routeFileIgnorePattern } =
    config

  const logger = logging({ disabled: config.disableLogging })
  const routeFileIgnoreRegExp = new RegExp(routeFileIgnorePattern ?? '', 'g')

  const routeNodes: Array<RouteNode> = []
  const allPhysicalDirectories: Array<string> = []

  async function recurse(dir: string) {
    const fullDir = path.resolve(config.routesDirectory, dir)
    let dirList = await fsp.readdir(fullDir, { withFileTypes: true })

    dirList = dirList.filter((d) => {
      if (
        d.name.startsWith('.') ||
        (routeFileIgnorePrefix && d.name.startsWith(routeFileIgnorePrefix))
      ) {
        return false
      }

      if (routeFilePrefix) {
        if (routeFileIgnorePattern) {
          return (
            d.name.startsWith(routeFilePrefix) &&
            !d.name.match(routeFileIgnoreRegExp)
          )
        }

        return d.name.startsWith(routeFilePrefix)
      }

      if (routeFileIgnorePattern) {
        return !d.name.match(routeFileIgnoreRegExp)
      }

      return true
    })

    const virtualConfigFile = dirList.find((dirent) => {
      return dirent.isFile() && isVirtualConfigFile(dirent.name)
    })

    if (virtualConfigFile !== undefined) {
      const virtualRouteConfigExport = await loadConfigFile(
        path.resolve(fullDir, virtualConfigFile.name),
      )
      let virtualRouteSubtreeConfig: VirtualRouteSubtreeConfig
      if (typeof virtualRouteConfigExport.default === 'function') {
        virtualRouteSubtreeConfig = await virtualRouteConfigExport.default()
      } else {
        virtualRouteSubtreeConfig = virtualRouteConfigExport.default
      }
      const dummyRoot: VirtualRootRoute = {
        type: 'root',
        file: '',
        children: virtualRouteSubtreeConfig,
      }
      const { routeNodes: virtualRouteNodes, physicalDirectories } =
        await getRouteNodesVirtual(
          {
            ...config,
            routesDirectory: fullDir,
            virtualRouteConfig: dummyRoot,
          },
          root,
          tokenRegexes,
        )
      allPhysicalDirectories.push(...physicalDirectories)
      virtualRouteNodes.forEach((node) => {
        const normalizedDir = dir === './' ? '' : dir
        const filePath = replaceBackslash(
          path.join(normalizedDir, node.filePath),
        )
        const { routePath: prefixPath, originalRoutePath: originalPrefixPath } =
          normalizedDir
            ? determineInitialRoutePath(normalizedDir)
            : { routePath: '', originalRoutePath: '' }
        const routePath = cleanPath(`${prefixPath}${node.routePath}`)

        node.variableName = routePathToVariable(
          cleanPath(`${prefixPath}/${removeExt(node.filePath)}`),
        )
        node._routePathSegmentMetadata = joinRoutePathSegmentMetadata(
          routePath,
          prefixPath,
          createRoutePathSegmentMetadata(prefixPath, originalPrefixPath),
          node._routePathSegmentMetadata,
        )
        node.routePath = routePath
        // Keep originalRoutePath aligned with routePath for escape detection
        if (node.originalRoutePath) {
          node.originalRoutePath = cleanPath(
            `${originalPrefixPath}${node.originalRoutePath}`,
          )
        }
        node.filePath = filePath
        // Virtual subtree nodes (from __virtual.ts) are embedded in a
        // physical directory tree. They should use path-based parent
        // inference, not the explicit virtual parent tracking. Clear any
        // _virtualParentRoutePath that was set at construction time.
        delete node._virtualParentRoutePath
      })

      routeNodes.push(...virtualRouteNodes)

      return
    }

    await Promise.all(
      dirList.map(async (dirent) => {
        const fullPath = replaceBackslash(path.join(fullDir, dirent.name))
        const relativePath = path.posix.join(dir, dirent.name)

        if (dirent.isDirectory()) {
          await recurse(relativePath)
        } else if (fullPath.match(/\.(tsx|ts|jsx|js|vue)$/)) {
          const filePath = replaceBackslash(path.join(dir, dirent.name))
          const filePathNoExt = removeExt(filePath)
          const {
            routePath: initialRoutePath,
            originalRoutePath: initialOriginalRoutePath,
          } = determineInitialRoutePath(filePathNoExt)

          let routePath = initialRoutePath
          let originalRoutePath = initialOriginalRoutePath

          if (routeFilePrefix) {
            routePath = routePath.replaceAll(routeFilePrefix, '')
            originalRoutePath = originalRoutePath.replaceAll(
              routeFilePrefix,
              '',
            )
          }

          if (disallowedRouteGroupConfiguration.test(dirent.name)) {
            const errorMessage = `A route configuration for a route group was found at \`${filePath}\`. This is not supported. Did you mean to use a layout/pathless route instead?`
            logger.error(`ERROR: ${errorMessage}`)
            throw new Error(errorMessage)
          }

          const meta = getRouteMeta(routePath, originalRoutePath, tokenRegexes)
          const variableName = meta.variableName
          let routeType: FsRouteType = meta.fsRouteType

          if (routeType === 'lazy') {
            routePath = routePath.replace(/\/lazy$/, '')
            originalRoutePath = originalRoutePath.replace(/\/lazy$/, '')
          }

          // this check needs to happen after the lazy route has been cleaned up
          // since the routePath is used to determine if a route is pathless
          if (
            isValidPathlessLayoutRoute(
              routePath,
              originalRoutePath,
              routeType,
              tokenRegexes,
            )
          ) {
            routeType = 'pathless_layout'
          }

          // Only show deprecation warning for .tsx/.ts files, not .vue files
          // Vue files using .component.vue is the Vue-native way
          const isVueFile = filePath.endsWith('.vue')
          if (!isVueFile) {
            ;(
              [
                ['component', 'component'],
                ['errorComponent', 'errorComponent'],
                ['notFoundComponent', 'notFoundComponent'],
                ['pendingComponent', 'pendingComponent'],
                ['loader', 'loader'],
              ] satisfies Array<[FsRouteType, string]>
            ).forEach(([matcher, type]) => {
              if (routeType === matcher) {
                logger.warn(
                  `WARNING: The \`.${type}.tsx\` suffix used for the ${filePath} file is deprecated. Use the new \`.lazy.tsx\` suffix instead.`,
                )
              }
            })
          }

          // Get the last segment of originalRoutePath to check for escaping
          const originalSegments = originalRoutePath.split('/').filter(Boolean)
          const lastOriginalSegmentForSuffix =
            originalSegments[originalSegments.length - 1] || ''

          const { routeTokenSegmentRegex, indexTokenSegmentRegex } =
            tokenRegexes

          // List of special suffixes that can be escaped
          const specialSuffixes = [
            'component',
            'errorComponent',
            'notFoundComponent',
            'pendingComponent',
            'loader',
            'lazy',
          ]

          const routePathSegments = routePath.split('/').filter(Boolean)
          const lastRouteSegment =
            routePathSegments[routePathSegments.length - 1] || ''

          const suffixToStrip = specialSuffixes.find((suffix) => {
            const endsWithSuffix = routePath.endsWith(`/${suffix}`)
            // A suffix is escaped if wrapped in brackets in the original: [lazy] means literal "lazy"
            const isEscaped =
              lastOriginalSegmentForSuffix.startsWith('[') &&
              lastOriginalSegmentForSuffix.endsWith(']') &&
              unwrapBracketWrappedSegment(lastOriginalSegmentForSuffix) ===
                suffix
            return endsWithSuffix && !isEscaped
          })

          const routeTokenCandidate = unwrapBracketWrappedSegment(
            lastOriginalSegmentForSuffix,
          )
          const isRouteTokenEscaped =
            lastOriginalSegmentForSuffix !== routeTokenCandidate &&
            routeTokenSegmentRegex.test(routeTokenCandidate)

          const shouldStripRouteToken =
            routeTokenSegmentRegex.test(lastRouteSegment) &&
            !isRouteTokenEscaped

          if (suffixToStrip || shouldStripRouteToken) {
            const stripSegment = suffixToStrip ?? lastRouteSegment
            routePath = routePath.replace(
              new RegExp(`/${escapeRegExp(stripSegment)}$`),
              '',
            )
            originalRoutePath = originalRoutePath.replace(
              new RegExp(`/${escapeRegExp(stripSegment)}$`),
              '',
            )
          }

          // Check if the index token should be treated specially or as a literal path
          // Escaping stays literal-only: if the last original segment is bracket-wrapped,
          // treat it as literal even if it matches the token regex.
          const lastOriginalSegment =
            originalRoutePath.split('/').filter(Boolean).pop() || ''

          const indexTokenCandidate =
            unwrapBracketWrappedSegment(lastOriginalSegment)
          const isIndexEscaped =
            lastOriginalSegment !== indexTokenCandidate &&
            indexTokenSegmentRegex.test(indexTokenCandidate)

          if (!isIndexEscaped) {
            const updatedRouteSegments = routePath.split('/').filter(Boolean)
            const updatedLastRouteSegment =
              updatedRouteSegments[updatedRouteSegments.length - 1] || ''

            if (indexTokenSegmentRegex.test(updatedLastRouteSegment)) {
              if (routePathSegments.length === 1) {
                routePath = '/'
              }

              // For layout routes, don't use '/' fallback - an empty path means
              // "layout for the parent path" which is important for physical() mounts
              // where route.tsx at root should have empty path, not '/'
              const isLayoutRoute = routeType === 'layout'

              routePath =
                routePath.replace(
                  new RegExp(`/${escapeRegExp(updatedLastRouteSegment)}$`),
                  '/',
                ) || (isLayoutRoute ? '' : '/')

              originalRoutePath =
                originalRoutePath.replace(
                  new RegExp(`/${escapeRegExp(indexTokenCandidate)}$`),
                  '/',
                ) || (isLayoutRoute ? '' : '/')
            }
          }

          routeNodes.push({
            filePath,
            fullPath,
            routePath,
            variableName,
            _fsRouteType: routeType,
            originalRoutePath,
            _routePathSegmentMetadata: createRoutePathSegmentMetadata(
              routePath,
              originalRoutePath,
            ),
          })
        }
      }),
    )

    return routeNodes
  }

  await recurse('./')

  // Find the root route node - prefer the actual route file over component/loader files
  const rootRouteNode =
    routeNodes.find(
      (d) =>
        d.routePath === `/${rootPathId}` &&
        ![
          'component',
          'errorComponent',
          'notFoundComponent',
          'pendingComponent',
          'loader',
          'lazy',
        ].includes(d._fsRouteType),
    ) ?? routeNodes.find((d) => d.routePath === `/${rootPathId}`)
  if (rootRouteNode) {
    rootRouteNode._fsRouteType = '__root'
    rootRouteNode.variableName = 'root'
  }

  return {
    rootRouteNode,
    routeNodes,
    physicalDirectories: allPhysicalDirectories,
  }
}

/**
 * Determines the metadata for a given route path based on the provided configuration.
 *
 * @param routePath - The determined initial routePath (with brackets removed).
 * @param originalRoutePath - The original route path (may contain brackets for escaped content).
 * @param tokenRegexes - Pre-compiled token regexes for matching.
 * @returns An object containing the type of the route and the variable name derived from the route path.
 */
export function getRouteMeta(
  routePath: string,
  originalRoutePath: string,
  tokenRegexes: TokenRegexBundle,
): {
  // `__root` is can be more easily determined by filtering down to routePath === /${rootPathId}
  // `pathless` is needs to determined after `lazy` has been cleaned up from the routePath
  fsRouteType: Extract<
    FsRouteType,
    | 'static'
    | 'layout'
    | 'api'
    | 'lazy'
    | 'loader'
    | 'component'
    | 'pendingComponent'
    | 'errorComponent'
    | 'notFoundComponent'
  >
  variableName: string
} {
  let fsRouteType: FsRouteType = 'static'

  // Get the last segment from the original path to check for escaping
  const originalSegments = originalRoutePath.split('/').filter(Boolean)
  const lastOriginalSegment =
    originalSegments[originalSegments.length - 1] || ''

  const { routeTokenSegmentRegex } = tokenRegexes

  // Helper to check if a specific suffix is escaped (literal-only)
  // A suffix is escaped if the original segment is wrapped in brackets: [lazy] means literal "lazy"
  const isSuffixEscaped = (suffix: string): boolean => {
    return (
      lastOriginalSegment.startsWith('[') &&
      lastOriginalSegment.endsWith(']') &&
      unwrapBracketWrappedSegment(lastOriginalSegment) === suffix
    )
  }

  const routeSegments = routePath.split('/').filter(Boolean)
  const lastRouteSegment = routeSegments[routeSegments.length - 1] || ''

  const routeTokenCandidate = unwrapBracketWrappedSegment(lastOriginalSegment)
  const isRouteTokenEscaped =
    lastOriginalSegment !== routeTokenCandidate &&
    routeTokenSegmentRegex.test(routeTokenCandidate)

  if (routeTokenSegmentRegex.test(lastRouteSegment) && !isRouteTokenEscaped) {
    // layout routes, i.e `/foo/route.tsx` or `/foo/_layout/route.tsx`
    fsRouteType = 'layout'
  } else if (routePath.endsWith('/lazy') && !isSuffixEscaped('lazy')) {
    // lazy routes, i.e. `/foo.lazy.tsx`
    fsRouteType = 'lazy'
  } else if (routePath.endsWith('/loader') && !isSuffixEscaped('loader')) {
    // loader routes, i.e. `/foo.loader.tsx`
    fsRouteType = 'loader'
  } else if (
    routePath.endsWith('/component') &&
    !isSuffixEscaped('component')
  ) {
    // component routes, i.e. `/foo.component.tsx`
    fsRouteType = 'component'
  } else if (
    routePath.endsWith('/pendingComponent') &&
    !isSuffixEscaped('pendingComponent')
  ) {
    // pending component routes, i.e. `/foo.pendingComponent.tsx`
    fsRouteType = 'pendingComponent'
  } else if (
    routePath.endsWith('/errorComponent') &&
    !isSuffixEscaped('errorComponent')
  ) {
    // error component routes, i.e. `/foo.errorComponent.tsx`
    fsRouteType = 'errorComponent'
  } else if (
    routePath.endsWith('/notFoundComponent') &&
    !isSuffixEscaped('notFoundComponent')
  ) {
    // not found component routes, i.e. `/foo.notFoundComponent.tsx`
    fsRouteType = 'notFoundComponent'
  }

  // Use originalRoutePath for variable name when any segment is fully
  // bracket-wrapped (e.g. [index], [route], [_]auth) to avoid collisions
  // with their non-escaped counterparts that get special token treatment
  const hasFullyEscapedSegment = originalSegments.some(
    (seg) =>
      seg.startsWith('[') &&
      seg.endsWith(']') &&
      !seg.slice(1, -1).includes('[') &&
      !seg.slice(1, -1).includes(']'),
  )
  const variableName = routePathToVariable(
    hasFullyEscapedSegment ? originalRoutePath : routePath,
  )

  return { fsRouteType, variableName }
}

/**
 * Used to validate if a route is a pathless layout route
 * @param normalizedRoutePath Normalized route path, i.e `/foo/_layout/route.tsx` and `/foo._layout.route.tsx` to `/foo/_layout/route`
 * @param originalRoutePath Original route path with brackets for escaped content
 * @param routeType The route type determined from file extension
 * @param tokenRegexes Pre-compiled token regexes for matching
 * @returns Boolean indicating if the route is a pathless layout route
 */
function isValidPathlessLayoutRoute(
  normalizedRoutePath: string,
  originalRoutePath: string,
  routeType: FsRouteType,
  tokenRegexes: TokenRegexBundle,
): boolean {
  if (routeType === 'lazy') {
    return false
  }

  const segments = normalizedRoutePath.split('/').filter(Boolean)
  const originalSegments = originalRoutePath.split('/').filter(Boolean)

  if (segments.length === 0) {
    return false
  }

  const lastRouteSegment = segments[segments.length - 1]!
  const lastOriginalSegment =
    originalSegments[originalSegments.length - 1] || ''
  const secondToLastRouteSegment = segments[segments.length - 2]
  const secondToLastOriginalSegment =
    originalSegments[originalSegments.length - 2]

  // If segment === __root, then exit as false
  if (lastRouteSegment === rootPathId) {
    return false
  }

  const { routeTokenSegmentRegex, indexTokenSegmentRegex } = tokenRegexes

  // If segment matches routeToken and secondToLastSegment is a string that starts with _, then exit as true
  // Since the route is actually a configuration route for a layout/pathless route
  // i.e. /foo/_layout/route.tsx === /foo/_layout.tsx
  // But if the underscore is escaped, it's not a pathless layout
  if (
    routeTokenSegmentRegex.test(lastRouteSegment) &&
    typeof secondToLastRouteSegment === 'string' &&
    typeof secondToLastOriginalSegment === 'string'
  ) {
    // Check if the underscore is escaped
    if (hasEscapedLeadingUnderscore(secondToLastOriginalSegment)) {
      return false
    }
    return secondToLastRouteSegment.startsWith('_')
  }

  // Segment starts with _ but check if it's escaped
  // If the original segment has [_] at the start, the underscore is escaped and it's not a pathless layout
  if (hasEscapedLeadingUnderscore(lastOriginalSegment)) {
    return false
  }

  return (
    !indexTokenSegmentRegex.test(lastRouteSegment) &&
    !routeTokenSegmentRegex.test(lastRouteSegment) &&
    lastRouteSegment.startsWith('_')
  )
}
