import type { DevServerFnModuleSpecifierEncoder } from '../../start-compiler/types'

export function createViteDevServerFnModuleSpecifierEncoder(
  root: string,
): DevServerFnModuleSpecifierEncoder {
  const normalizedRoot = root.replace(/\\/g, '/')
  const rootWithTrailingSlash = normalizedRoot.endsWith('/')
    ? normalizedRoot
    : `${normalizedRoot}/`

  return ({ extractedFilename }) => {
    const normalizedFile = extractedFilename.replace(/\\/g, '/')

    if (normalizedFile.startsWith(rootWithTrailingSlash)) {
      return `/${normalizedFile.slice(rootWithTrailingSlash.length)}`
    }

    return normalizedFile.startsWith('/')
      ? `/@fs${normalizedFile}`
      : `/@fs/${normalizedFile}`
  }
}

export function decodeViteDevServerModuleSpecifier(
  moduleSpecifier: string,
): string {
  let sourceFile = moduleSpecifier

  if (sourceFile.startsWith('/@id/')) {
    sourceFile = sourceFile.slice('/@id/'.length)
  } else if (sourceFile.startsWith('/@fs/')) {
    sourceFile = sourceFile.slice('/@fs'.length)
    sourceFile = sourceFile.replace(/^\/([A-Za-z]:\/)/, '$1')
  } else if (sourceFile.startsWith('/')) {
    sourceFile = sourceFile.slice(1)
  }

  const queryIndex = sourceFile.indexOf('?')

  return queryIndex === -1 ? sourceFile : sourceFile.slice(0, queryIndex)
}
