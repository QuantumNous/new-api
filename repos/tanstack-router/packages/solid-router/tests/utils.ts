import type { Mock } from 'vitest'

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function createTimer() {
  let time = Date.now()

  return {
    start: () => {
      time = Date.now()
    },
    getTime: () => {
      return Date.now() - time
    },
  }
}

export const getIntersectionObserverMock = ({
  observe,
  disconnect,
}: {
  observe: Mock
  disconnect: Mock
}) => {
  return class IO implements IntersectionObserver {
    root: Document | Element | null
    rootMargin: string
    scrollMargin: string
    thresholds: Array<number>
    constructor(
      _cb: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.root = options?.root ?? null
      this.rootMargin = options?.rootMargin ?? '0px'
      this.scrollMargin = options?.scrollMargin ?? '0px'
      this.thresholds = options?.threshold ?? ([0] as any)
    }

    takeRecords(): Array<IntersectionObserverEntry> {
      return []
    }
    unobserve(): void {}
    observe(): void {
      observe()
    }
    disconnect(): void {
      disconnect()
    }
  }
}

export function getSearchParamsFromURI(uri: string) {
  const [, paramString] = uri.split('?')
  return new URLSearchParams(paramString)
}
