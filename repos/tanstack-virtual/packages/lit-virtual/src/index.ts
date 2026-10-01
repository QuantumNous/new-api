import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'

class VirtualizerControllerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> implements ReactiveController {
  host: ReactiveControllerHost

  private readonly virtualizer: Virtualizer<TScrollElement, TItemElement>

  private cleanup: () => void = () => {}

  constructor(
    host: ReactiveControllerHost,
    options: VirtualizerOptions<TScrollElement, TItemElement>,
  ) {
    const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> = {
      ...options,
      onChange: (instance, sync) => {
        this.host.updateComplete.then(() => this.host.requestUpdate())
        options.onChange?.(instance, sync)
      },
    }
    this.virtualizer = new Virtualizer(resolvedOptions)
    ;(this.host = host).addController(this)
  }

  public getVirtualizer() {
    return this.virtualizer
  }

  hostConnected() {
    this.cleanup = this.virtualizer._didMount()
  }

  hostUpdated() {
    this.virtualizer._willUpdate()
  }

  hostDisconnected() {
    this.cleanup()
  }
}

export class VirtualizerController<
  TScrollElement extends Element,
  TItemElement extends Element,
> extends VirtualizerControllerBase<TScrollElement, TItemElement> {
  constructor(
    host: ReactiveControllerHost,
    options: PartialKeys<
      VirtualizerOptions<TScrollElement, TItemElement>,
      'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
    >,
  ) {
    super(host, {
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      ...options,
    })
  }
}

export class WindowVirtualizerController<
  TItemElement extends Element,
> extends VirtualizerControllerBase<Window, TItemElement> {
  constructor(
    host: ReactiveControllerHost,
    options: PartialKeys<
      VirtualizerOptions<Window, TItemElement>,
      | 'getScrollElement'
      | 'observeElementRect'
      | 'observeElementOffset'
      | 'scrollToFn'
    >,
  ) {
    super(host, {
      getScrollElement: () => (typeof document !== 'undefined' ? window : null),
      observeElementRect: observeWindowRect,
      observeElementOffset: observeWindowOffset,
      scrollToFn: windowScroll,
      initialOffset: () =>
        typeof document !== 'undefined' ? window.scrollY : 0,
      ...options,
    })
  }
}
