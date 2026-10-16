import {
  ChangeDetectorRef,
  ComponentRef,
  inject,
  Injectable,
  Injector,
  KeyValueDiffer,
  KeyValueDiffers,
  OutputEmitterRef,
  OutputRefSubscription,
  ViewContainerRef,
} from '@angular/core'
import { FlexRenderComponent } from './flex-render-component'

@Injectable()
export class FlexRenderComponentFactory {
  #viewContainerRef = inject(ViewContainerRef)

  createComponent<T>(
    flexRenderComponent: FlexRenderComponent<T>,
    componentInjector: Injector
  ): FlexRenderComponentRef<T> {
    const componentRef = this.#viewContainerRef.createComponent(
      flexRenderComponent.component,
      {
        injector: componentInjector,
      }
    )
    const view = new FlexRenderComponentRef(
      componentRef,
      flexRenderComponent,
      componentInjector
    )

    const { inputs, outputs } = flexRenderComponent

    if (inputs) view.setInputs(inputs)
    if (outputs) view.setOutputs(outputs)

    return view
  }
}

export class FlexRenderComponentRef<T> {
  readonly #keyValueDiffersFactory: KeyValueDiffers
  #componentData: FlexRenderComponent<T>
  #inputValueDiffer: KeyValueDiffer<string, unknown>

  readonly #outputRegistry: FlexRenderComponentOutputManager

  constructor(
    readonly componentRef: ComponentRef<T>,
    componentData: FlexRenderComponent<T>,
    readonly componentInjector: Injector
  ) {
    this.#componentData = componentData
    this.#keyValueDiffersFactory = componentInjector.get(KeyValueDiffers)

    this.#outputRegistry = new FlexRenderComponentOutputManager(
      this.#keyValueDiffersFactory,
      this.outputs
    )

    this.#inputValueDiffer = this.#keyValueDiffersFactory
      .find(this.inputs)
      .create()
    this.#inputValueDiffer.diff(this.inputs)

    this.componentRef.onDestroy(() => this.#outputRegistry.unsubscribeAll())
  }

  get component() {
    return this.#componentData.component
  }

  get inputs() {
    return this.#componentData.inputs ?? {}
  }

  get outputs() {
    return this.#componentData.outputs ?? {}
  }

  /**
   * Get component input and output diff by the given item
   */
  diff(item: FlexRenderComponent<T>) {
    return {
      inputDiff: this.#inputValueDiffer.diff(item.inputs ?? {}),
      outputDiff: this.#outputRegistry.diff(item.outputs ?? {}),
    }
  }
  /**
   *
   * @param compare Whether the current ref component instance is the same as the given one
   */
  eqType(compare: FlexRenderComponent<T>): boolean {
    return compare.component === this.component
  }

  /**
   * Tries to update current component refs input by the new given content component.
   */
  update(content: FlexRenderComponent<T>) {
    const eq = this.eqType(content)
    if (!eq) return
    const { inputDiff, outputDiff } = this.diff(content)
    if (inputDiff) {
      inputDiff.forEachAddedItem(item =>
        this.setInput(item.key, item.currentValue)
      )
      inputDiff.forEachChangedItem(item =>
        this.setInput(item.key, item.currentValue)
      )
      inputDiff.forEachRemovedItem(item => this.setInput(item.key, undefined))
    }
    if (outputDiff) {
      outputDiff.forEachAddedItem(item => {
        this.setOutput(item.key, item.currentValue)
      })
      outputDiff.forEachChangedItem(item => {
        if (item.currentValue) {
          this.#outputRegistry.setListener(item.key, item.currentValue)
        } else {
          this.#outputRegistry.unsubscribe(item.key)
        }
      })
      outputDiff.forEachRemovedItem(item => {
        this.#outputRegistry.unsubscribe(item.key)
      })
    }

    this.#componentData = content
  }

  markAsDirty(): void {
    this.componentRef.injector.get(ChangeDetectorRef).markForCheck()
  }

  setInputs(inputs: Record<string, unknown>) {
    for (const prop in inputs) {
      this.setInput(prop, inputs[prop])
    }
  }

  setInput(key: string, value: unknown) {
    if (this.#componentData.allowedInputNames.includes(key)) {
      this.componentRef.setInput(key, value)
    }
  }

  setOutputs(
    outputs: Record<
      string,
      OutputEmitterRef<unknown>['emit'] | null | undefined
    >
  ) {
    this.#outputRegistry.unsubscribeAll()
    for (const prop in outputs) {
      this.setOutput(prop, outputs[prop])
    }
  }

  setOutput(
    outputName: string,
    emit: OutputEmitterRef<unknown>['emit'] | undefined | null
  ): void {
    if (!this.#componentData.allowedOutputNames.includes(outputName)) return
    if (!emit) {
      this.#outputRegistry.unsubscribe(outputName)
      return
    }

    const hasListener = this.#outputRegistry.hasListener(outputName)
    this.#outputRegistry.setListener(outputName, emit)

    if (hasListener) {
      return
    }

    const instance = this.componentRef.instance
    const output = instance[outputName as keyof typeof instance]
    if (output && output instanceof OutputEmitterRef) {
      output.subscribe(value => {
        this.#outputRegistry.getListener(outputName)?.(value)
      })
    }
  }
}

class FlexRenderComponentOutputManager {
  readonly #outputSubscribers: Record<string, OutputRefSubscription> = {}
  readonly #outputListeners: Record<string, (...args: any[]) => void> = {}

  readonly #valueDiffer: KeyValueDiffer<
    string,
    undefined | null | OutputEmitterRef<unknown>['emit']
  >

  constructor(keyValueDiffers: KeyValueDiffers, initialOutputs: any) {
    this.#valueDiffer = keyValueDiffers.find(initialOutputs).create()
    if (initialOutputs) {
      this.#valueDiffer.diff(initialOutputs)
    }
  }

  hasListener(outputName: string) {
    return outputName in this.#outputListeners
  }

  setListener(outputName: string, callback: (...args: any[]) => void) {
    this.#outputListeners[outputName] = callback
  }

  getListener(outputName: string) {
    return this.#outputListeners[outputName]
  }

  unsubscribeAll(): void {
    for (const prop in this.#outputSubscribers) {
      this.unsubscribe(prop)
    }
  }

  unsubscribe(outputName: string) {
    if (outputName in this.#outputSubscribers) {
      this.#outputSubscribers[outputName]?.unsubscribe()
      delete this.#outputSubscribers[outputName]
      delete this.#outputListeners[outputName]
    }
  }

  diff(outputs: Record<string, OutputEmitterRef<unknown>['emit'] | undefined>) {
    return this.#valueDiffer.diff(outputs ?? {})
  }
}
