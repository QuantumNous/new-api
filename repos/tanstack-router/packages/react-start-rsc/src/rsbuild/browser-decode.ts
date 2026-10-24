/**
 * Rsbuild browser decode implementation.
 *
 * Bundler-owned rsbuild virtual modules re-export this module for browser-side
 * Flight decode.
 */

export {
  createFromReadableStream,
  createFromFetch,
} from 'react-server-dom-rspack/client.browser'
