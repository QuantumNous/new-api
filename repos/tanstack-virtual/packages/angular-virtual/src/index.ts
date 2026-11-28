import {
  ApplicationRef,
  DestroyRef,
  Injector,
  afterRenderEffect,
  assertInInjectionContext,
  computed,
  inject,
  linkedSignal,
  runInInjectionContext,
  untracked,
} from '@angular/core'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import { signalProxy } from './proxy'
import type { ElementRef } from '@angular/core'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'
import type { AngularVirtualizer } from './types'

export * from '@tanstack/virtual-core'
export * from './types'

export type AngularVirtualizerOptions<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> = VirtualizerOptions<TScrollElement, TItemElement> & {
  /**
   * Whether to flush the DOM using `ApplicationRef.tick()`
   * @default true
   * */
  useApplicationRefTick?: boolean
}

export type AngularExtensionOptions = {
  /**
   * The injector to use for the virtualizer.
   * @default inject(Injector)
   */
  injector?: Injector
}

// Flush CD after virtual-core updates so template bindings hit the DOM
// before the next frame's scroll reconciliation reads `scrollHeight`.
function injectScheduleDomFlushViaAppRefTick() {
  const appRef = inject(ApplicationRef)
  const destroyRef = inject(DestroyRef)
  let hostDestroyed = false
  destroyRef.onDestroy(() => {
    hostDestroyed = true
  })
  let domFlushQueued = false

  return () => {
    if (domFlushQueued) return
    domFlushQueued = true
    queueMicrotask(() => {
      domFlushQueued = false
      if (hostDestroyed) return
      appRef.tick()
    })
  }
}

function injectVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: () => AngularVirtualizerOptions<TScrollElement, TItemElement>,
  extensions: AngularExtensionOptions = {},
) {
  let injector = extensions.injector
  if (!injector) {
    assertInInjectionContext(injectVirtualizerBase)
    injector = inject(Injector)
  }

  return runInInjectionContext(injector, () => {
    const scheduleDomFlush = injectScheduleDomFlushViaAppRefTick()

    const resolvedOptions = computed<
      VirtualizerOptions<TScrollElement, TItemElement>
    >(() => {
      const { useApplicationRefTick = true, ..._options } = options()
      return {
        ..._options,
        onChange: (instance, sync) => {
          reactiveVirtualizer.set(instance)
          if (useApplicationRefTick) {
            scheduleDomFlush()
          }
          _options.onChange?.(instance, sync)
        },
      }
    })

    // Computed here is used to lazily initialize the Virtualizer instance,
    // allowing it to be created after input/model signals are initialized.
    // Options are untracked to maintain a single instance of the Virtualizer.
    const lazyVirtualizer = computed(
      () => new Virtualizer(untracked(resolvedOptions)),
    )

    // The reference in onChange is safe since computed signals are not evaluated eagerly.
    const reactiveVirtualizer = linkedSignal(
      () => {
        const virtualizer = lazyVirtualizer()
        // If setOptions does not call onChange, it's safe to call it here
        virtualizer.setOptions(resolvedOptions())
        return virtualizer
      },
      { equal: () => false },
    )

    afterRenderEffect((cleanup) => {
      cleanup(lazyVirtualizer()._didMount())
    })

    afterRenderEffect(() => {
      reactiveVirtualizer()._willUpdate()
    })

    return signalProxy(
      reactiveVirtualizer,
      // Methods that pass through: call on the instance without tracking the signal read
      [
        '_didMount',
        '_willUpdate',
        'calculateRange',
        'getVirtualIndexes',
        'measure',
        'measureElement',
        'resizeItem',
        'scrollBy',
        'scrollToIndex',
        'scrollToOffset',
        'setOptions',
      ],
      // Attributes that will be transformed to signals
      [
        'isScrolling',
        'measurementsCache',
        'options',
        'range',
        'scrollDirection',
        'scrollElement',
        'scrollOffset',
        'scrollRect',
      ],
      // Methods that will be tracked to the virtualizer signal
      [
        'getOffsetForAlignment',
        'getOffsetForIndex',
        'getVirtualItemForOffset',
        'indexFromElement',
      ],
      // Zero-arg methods exposed as computed signals
      ['getTotalSize', 'getVirtualItems'],
      // The rest is passed as is, and can be accessed or called before initialization
    ) as unknown as AngularVirtualizer<TScrollElement, TItemElement>
  })
}

export function injectVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: () => PartialKeys<
    Omit<
      AngularVirtualizerOptions<TScrollElement, TItemElement>,
      'getScrollElement'
    >,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  > & {
    scrollElement: ElementRef<TScrollElement> | TScrollElement | undefined
  },
): AngularVirtualizer<TScrollElement, TItemElement> {
  return injectVirtualizerBase<TScrollElement, TItemElement>(() => {
    const _options = options()
    return {
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      getScrollElement: () => {
        const elementOrRef = _options.scrollElement
        return (
          (isElementRef(elementOrRef)
            ? elementOrRef.nativeElement
            : elementOrRef) ?? null
        )
      },
      ..._options,
    }
  })
}

function isElementRef<T extends Element>(
  elementOrRef: ElementRef<T> | T | undefined,
): elementOrRef is ElementRef<T> {
  return elementOrRef != null && 'nativeElement' in elementOrRef
}

export function injectWindowVirtualizer<TItemElement extends Element>(
  options: () => PartialKeys<
    AngularVirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): AngularVirtualizer<Window, TItemElement> {
  return injectVirtualizerBase<Window, TItemElement>(() => ({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () => (typeof document !== 'undefined' ? window.scrollY : 0),
    ...options(),
  }))
}
