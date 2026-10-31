/**
 * Rsbuild SSR decode implementation.
 *
 * Bundler-owned rsbuild virtual modules re-export this module for SSR-side
 * Flight decode.
 */

import { createFromReadableStream as decodeFlightStream } from 'react-server-dom-rspack/client.node'

type ClientReferenceDeps = {
  js: Array<string>
  css: Array<string>
}

type OnClientReference = (reference: {
  id: string
  deps: ClientReferenceDeps
  runtime: 'rsbuild'
}) => void

type ImportManifestEntry = {
  id: string
  chunks: Array<string>
  cssFiles?: Array<string>
  name: string
  async?: boolean
}

type ClientManifest = Record<string, ImportManifestEntry>
type ServerConsumerModuleMap = null | Record<
  string,
  Record<string, ImportManifestEntry>
>
type ModuleLoading = null | {
  prefix: string
  crossOrigin?: 'use-credentials' | ''
}

declare const __rspack_rsc_manifest__: {
  moduleLoading: ModuleLoading
  serverConsumerModuleMap: ServerConsumerModuleMap
  clientManifest: ClientManifest
}

const CHUNK_FILENAME_INDEX = 1
const CHUNK_PAIR_SIZE = 2

let onClientReference: OnClientReference | undefined
let clientReferenceDepsByModuleId: Map<string, ClientReferenceDeps> | undefined

function getClientReferenceDepsByModuleId() {
  if (clientReferenceDepsByModuleId) return clientReferenceDepsByModuleId

  clientReferenceDepsByModuleId = new Map()
  const prefix = __rspack_rsc_manifest__.moduleLoading?.prefix ?? ''

  for (const entry of Object.values(__rspack_rsc_manifest__.clientManifest)) {
    let deps = clientReferenceDepsByModuleId.get(entry.id)
    if (!deps) {
      deps = { js: [], css: [] }
      clientReferenceDepsByModuleId.set(entry.id, deps)
    }

    // React/Rspack stores JS chunks as chunk id/filename pairs. CSS files are
    // separate manifest entries and are already emitted as public hrefs.
    for (
      let i = CHUNK_FILENAME_INDEX;
      i < entry.chunks.length;
      i += CHUNK_PAIR_SIZE
    ) {
      deps.js.push(prefix + entry.chunks[i])
    }

    if (entry.cssFiles) {
      deps.css.push(...entry.cssFiles)
    }
  }

  return clientReferenceDepsByModuleId
}

function emitClientReferencePreloadsForModule(moduleId: string) {
  const deps = getClientReferenceDepsByModuleId().get(moduleId)
  if (!onClientReference || !deps) return

  if (deps.js.length === 0 && deps.css.length === 0) {
    return
  }

  onClientReference({
    id: moduleId,
    deps,
    runtime: 'rsbuild',
  })
}

if (__rspack_rsc_manifest__.serverConsumerModuleMap) {
  __rspack_rsc_manifest__.serverConsumerModuleMap = new Proxy(
    __rspack_rsc_manifest__.serverConsumerModuleMap,
    {
      get(target, property, receiver) {
        const moduleExports = Reflect.get(target, property, receiver)

        if (typeof property === 'string' && moduleExports !== undefined) {
          emitClientReferencePreloadsForModule(property)
        }

        return moduleExports
      },
    },
  )
}

function setOnClientReference(callback: OnClientReference | undefined) {
  onClientReference = callback
}

async function createFromReadableStreamWithClientPreloads<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  options?: object,
): Promise<T> {
  return decodeFlightStream<T>(stream, options)
}

export {
  setOnClientReference,
  createFromReadableStreamWithClientPreloads as createFromReadableStream,
}
