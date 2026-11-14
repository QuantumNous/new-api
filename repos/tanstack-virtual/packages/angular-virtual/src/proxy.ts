import { computed, untracked } from '@angular/core'
import type { Signal } from '@angular/core'

type SignalProxy<
  TInput extends Record<string | symbol, any>,
  TMethodsToPassThrough extends keyof TInput,
  TAttributesToTransformToSignals extends keyof TInput,
  TMethodsToTrack extends keyof TInput,
  TMethodsToTransformToSignals extends keyof TInput,
> = {
  [K in TMethodsToPassThrough]: TInput[K]
} & {
  [K in TAttributesToTransformToSignals]: Signal<TInput[K]>
} & {
  [K in TMethodsToTrack]: TInput[K]
} & {
  [K in TMethodsToTransformToSignals]: Signal<ReturnType<TInput[K]>>
}

export function signalProxy<
  TInput extends Record<string | symbol, any>,
  TMethodsToPassThrough extends keyof TInput,
  TAttributesToTransformToSignals extends keyof TInput,
  TMethodsToTrack extends keyof TInput,
  TMethodsToTransformToSignals extends keyof TInput,
>(
  inputSignal: Signal<TInput>,
  methodsToPassThrough: Array<TMethodsToPassThrough>,
  attributesToTransformToSignals: Array<TAttributesToTransformToSignals>,
  methodsToTrack: Array<TMethodsToTrack>,
  methodsToTransformToSignals: Array<TMethodsToTransformToSignals>,
): SignalProxy<
  TInput,
  TMethodsToPassThrough,
  TAttributesToTransformToSignals,
  TMethodsToTrack,
  TMethodsToTransformToSignals
> {
  // Type needed to proxy with the apply handler
  const callableTarget = (() => inputSignal()) as (() => TInput) &
    Record<PropertyKey, unknown>

  return new Proxy(callableTarget, {
    apply() {
      return inputSignal()
    },
    get(target, property) {
      const fieldValue = target[property as keyof typeof callableTarget]
      if (fieldValue !== undefined) return fieldValue

      // Methods that pass through: call on the instance without tracking the signal read
      if (methodsToPassThrough.includes(property as TMethodsToPassThrough)) {
        return (target[property] = (
          ...args: Parameters<TInput[typeof property]>
        ) => untracked(inputSignal)[property as keyof TInput](...args))
      }

      // Zero-arg methods exposed as computed signals
      if (
        methodsToTransformToSignals.includes(
          property as TMethodsToTransformToSignals,
        )
      ) {
        return (target[property] = computed(() =>
          (inputSignal()[property as keyof TInput] as () => unknown)(),
        ))
      }

      // Methods that need to be tracked, track instance changes and call the method
      if (methodsToTrack.includes(property as TMethodsToTrack)) {
        return (target[property] = (
          ...args: Parameters<TInput[typeof property]>
        ) => inputSignal()[property as keyof TInput](...args))
      }

      // Other values that are tracked as signals
      if (
        attributesToTransformToSignals.includes(
          property as TAttributesToTransformToSignals,
        )
      ) {
        return (target[property] = computed(
          () => inputSignal()[property as keyof TInput],
        ))
      }

      // All other fields. Any field that is not handled above will fail if the signal includes
      // input or model signals from a component and this is accessed before initialization.
      return untracked(inputSignal)[property as keyof TInput]
    },
    has(_, property: PropertyKey) {
      return property in untracked(inputSignal)
    },
    ownKeys() {
      return Reflect.ownKeys(untracked(inputSignal))
    },
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
  }) as SignalProxy<
    TInput,
    TMethodsToPassThrough,
    TAttributesToTransformToSignals,
    TMethodsToTrack,
    TMethodsToTransformToSignals
  >
}
