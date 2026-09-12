import { FlexRenderComponentRef } from './flex-render-component-ref'
import { EmbeddedViewRef, TemplateRef, Type } from '@angular/core'
import type { FlexRenderContent } from '../flex-render'
import { FlexRenderComponent } from './flex-render-component'

export type FlexRenderTypedContent =
  | { kind: 'null' }
  | {
      kind: 'primitive'
      content: string | number | Record<string, any>
    }
  | { kind: 'flexRenderComponent'; content: FlexRenderComponent<unknown> }
  | { kind: 'templateRef'; content: TemplateRef<unknown> }
  | { kind: 'component'; content: Type<unknown> }

export function mapToFlexRenderTypedContent(
  content: FlexRenderContent<any>
): FlexRenderTypedContent {
  if (content === null || content === undefined) {
    return { kind: 'null' }
  }
  if (typeof content === 'string' || typeof content === 'number') {
    return { kind: 'primitive', content }
  }
  if (content instanceof FlexRenderComponent) {
    return { kind: 'flexRenderComponent', content }
  } else if (content instanceof TemplateRef) {
    return { kind: 'templateRef', content }
  } else if (content instanceof Type) {
    return { kind: 'component', content }
  } else {
    return { kind: 'primitive', content }
  }
}

export abstract class FlexRenderView<
  TView extends FlexRenderComponentRef<any> | EmbeddedViewRef<unknown> | null,
> {
  readonly view: TView
  #previousContent: FlexRenderTypedContent | undefined
  #content: FlexRenderTypedContent

  protected constructor(
    initialContent: Exclude<FlexRenderTypedContent, { kind: 'null' }>,
    view: TView
  ) {
    this.#content = initialContent
    this.view = view
  }

  get previousContent(): FlexRenderTypedContent {
    return this.#previousContent ?? { kind: 'null' }
  }

  get content() {
    return this.#content
  }

  set content(content: FlexRenderTypedContent) {
    this.#previousContent = this.#content
    this.#content = content
  }

  abstract updateProps(props: Record<string, any>): void

  abstract dirtyCheck(): void

  abstract onDestroy(callback: Function): void
}

export class FlexRenderTemplateView extends FlexRenderView<
  EmbeddedViewRef<unknown>
> {
  constructor(
    initialContent: Extract<
      FlexRenderTypedContent,
      { kind: 'primitive' | 'templateRef' }
    >,
    view: EmbeddedViewRef<unknown>
  ) {
    super(initialContent, view)
  }

  override updateProps(props: Record<string, any>) {
    this.view.markForCheck()
  }

  override dirtyCheck() {
    // Basically a no-op. When the view is created via EmbeddedViewRef, we don't need to do any manual update
    // since this type of content has a proxy as a context, then every time the root component is checked for changes,
    // the property getter will be re-evaluated.
    //
    // If in a future we need to manually mark the view as dirty, just uncomment next line
    // this.view.markForCheck()
  }

  override onDestroy(callback: Function) {
    this.view.onDestroy(callback)
  }
}

export class FlexRenderComponentView extends FlexRenderView<
  FlexRenderComponentRef<unknown>
> {
  constructor(
    initialContent: Extract<
      FlexRenderTypedContent,
      { kind: 'component' | 'flexRenderComponent' }
    >,
    view: FlexRenderComponentRef<unknown>
  ) {
    super(initialContent, view)
  }

  override updateProps(props: Record<string, any>) {
    switch (this.content.kind) {
      case 'component': {
        this.view.setInputs(props)
        break
      }
      case 'flexRenderComponent': {
        // No-op. When FlexRenderFlags.PropsReferenceChanged is set,
        // FlexRenderComponent will be updated into `dirtyCheck`.
        break
      }
    }
  }

  override dirtyCheck() {
    switch (this.content.kind) {
      case 'component': {
        // Component context is currently valuated with the cell context. Since it's reference
        // shouldn't change, we force mark the component as dirty in order to re-evaluate function invocation in view.
        // NOTE: this should behave like having a component with ChangeDetectionStrategy.Default
        this.view.markAsDirty()
        break
      }
      case 'flexRenderComponent': {
        // Given context instance will always have a different reference than the previous one,
        // so instead of recreating the entire view, we will only update the current view
        if (this.view.eqType(this.content.content)) {
          this.view.update(this.content.content)
        }
        this.view.markAsDirty()
        break
      }
    }
  }

  override onDestroy(callback: Function) {
    this.view.componentRef.onDestroy(callback)
  }
}
