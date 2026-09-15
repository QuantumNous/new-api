import type { AnyRouter } from './router'

declare global {
  interface Window {
    __TSR_ROUTER__?: AnyRouter
  }
}

export {}
