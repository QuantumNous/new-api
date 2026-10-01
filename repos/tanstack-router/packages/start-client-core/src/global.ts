import type { AnyStartInstanceOptions } from './createStart'

declare global {
  interface Window {
    __TSS_START_OPTIONS__?: AnyStartInstanceOptions
  }
}

export {}
