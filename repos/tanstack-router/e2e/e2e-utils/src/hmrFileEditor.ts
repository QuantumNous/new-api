import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function replaceAll(source: string, from: string, to: string) {
  return source.split(from).join(to)
}

export type HmrFileEditorOptions<TFileKey extends string> = {
  rootDir?: string
  files: Record<TFileKey, string>
  normalizeSource?: (fileKey: TFileKey, source: string) => string
}

export function createHmrFileEditor<TFileKey extends string>(
  options: HmrFileEditorOptions<TFileKey>,
) {
  const files = Object.fromEntries(
    Object.entries(options.files).map(([key, filePath]) => [
      key,
      options.rootDir && !path.isAbsolute(filePath as string)
        ? path.join(options.rootDir, filePath as string)
        : (filePath as string),
    ]),
  ) as Record<TFileKey, string>
  const originalContents: Partial<Record<TFileKey, string>> = {}
  const pendingRestoreKeys = new Set<TFileKey>()
  const normalizeSource =
    options.normalizeSource ?? ((_fileKey: TFileKey, source: string) => source)

  async function captureOriginals() {
    for (const [key, filePath] of Object.entries(files) as Array<
      [TFileKey, string]
    >) {
      const current = await readFile(filePath, 'utf8')
      const normalized = normalizeSource(key, current)

      if (normalized !== current) {
        await writeFile(filePath, normalized)
        pendingRestoreKeys.add(key)
      }

      originalContents[key] = normalized
    }
  }

  const capturePromise = captureOriginals()

  async function restoreFiles(forceFileKeys: Iterable<TFileKey> = []) {
    const forceRestoreKeys = new Set(forceFileKeys)
    const restoredFileKeys: Array<TFileKey> = []

    for (const [key, filePath] of Object.entries(files) as Array<
      [TFileKey, string]
    >) {
      const content = originalContents[key]
      if (content === undefined) continue

      const current = await readFile(filePath, 'utf8')

      if (current !== content || forceRestoreKeys.has(key)) {
        await writeFile(filePath, content)
        restoredFileKeys.push(key)
      }
    }

    return restoredFileKeys
  }

  async function replaceText(fileKey: TFileKey, from: string, to: string) {
    const filePath = files[fileKey]
    const source = await readFile(filePath, 'utf8')

    if (!source.includes(from)) {
      throw new Error(`Expected file to include ${JSON.stringify(from)}`)
    }

    await writeFile(filePath, source.replace(from, to))
  }

  async function rewriteFile(
    fileKey: TFileKey,
    updater: (source: string) => string,
    options: { allowNoop?: boolean } = {},
  ) {
    const filePath = files[fileKey]
    const source = await readFile(filePath, 'utf8')
    const updated = updater(source)

    if (updated === source && !options.allowNoop) {
      throw new Error(`Expected ${filePath} to change during rewrite`)
    }

    await writeFile(filePath, updated)
  }

  async function replaceTextAndWait(
    fileKey: TFileKey,
    from: string,
    to: string,
    assertion: () => Promise<void>,
  ) {
    await replaceText(fileKey, from, to)
    await assertion()
  }

  async function rewriteFileAndWait(
    fileKey: TFileKey,
    updater: (source: string) => string,
    assertion: () => Promise<void>,
    options: { allowNoop?: boolean } = {},
  ) {
    await rewriteFile(fileKey, updater, options)
    await assertion()
  }

  return {
    files,
    pendingRestoreKeys,
    capturePromise,
    captureOriginals,
    restoreFiles,
    replaceText,
    replaceTextAndWait,
    rewriteFile,
    rewriteFileAndWait,
  }
}
