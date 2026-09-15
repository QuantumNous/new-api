// Ambient type declaration for .marko template imports.
// @marko/vite compiles .marko files to browser templates exposing mount().
// The full Marko.Template type is available via the marko package but
// requires the Marko language toolchain. For test imports we declare the
// minimal shape we actually use.
declare module '*.marko' {
  const template: {
    mount: (
      input: Record<string, unknown>,
      container: Element | DocumentFragment,
    ) => { destroy: () => void }
  }
  export default template
}

// Type declarations for @marko/vite and @marko/run/vite.
// Both export the same Vite plugin factory; @marko/run/vite re-exports from
// @marko/vite. Users may import from either path depending on their setup.
// The actual packages may ship their own types; these are fallbacks.
declare module '@marko/vite' {
  import type { Plugin } from 'vite'

  function marko(options?: Record<string, unknown>): Plugin
  export default marko
}

declare module '@marko/run/vite' {
  import type { Plugin } from 'vite'

  function marko(options?: Record<string, unknown>): Plugin
  export default marko
}
