import {
  ChangeDetectorRef,
  Directive,
  DoCheck,
  effect,
  type EffectRef,
  Inject,
  inject,
  Injector,
  Input,
  OnChanges,
  runInInjectionContext,
  SimpleChanges,
  TemplateRef,
  Type,
  ViewContainerRef,
} from '@angular/core'
import { FlexRenderComponentProps } from './flex-render/context'
import { FlexRenderFlags } from './flex-render/flags'
import {
  flexRenderComponent,
  FlexRenderComponent,
} from './flex-render/flex-render-component'
import { FlexRenderComponentFactory } from './flex-render/flex-render-component-ref'
import {
  FlexRenderComponentView,
  FlexRenderTemplateView,
  type FlexRenderTypedContent,
  FlexRenderView,
  mapToFlexRenderTypedContent,
} from './flex-render/view'
import { memo } from '@tanstack/table-core'

export {
  injectFlexRenderContext,
  type FlexRenderComponentProps,
} from './flex-render/context'

export type FlexRenderContent<TProps extends NonNullable<unknown>> =
  | string
  | number
  | Type<TProps>
  | FlexRenderComponent<TProps>
  | TemplateRef<{ $implicit: TProps }>
  | null
  | Record<any, any>
  | undefined

@Directive({
  selector: '[flexRender]',
  standalone: true,
  providers: [FlexRenderComponentFactory],
})
export class FlexRenderDirective<TProps extends NonNullable<unknown>>
  implements OnChanges, DoCheck
{
  readonly #flexRenderComponentFactory = inject(FlexRenderComponentFactory)
  readonly #changeDetectorRef = inject(ChangeDetectorRef)

  @Input({ required: true, alias: 'flexRender' })
  content:
    | number
    | string
    | ((props: TProps) => FlexRenderContent<TProps>)
    | null
    | undefined = undefined

  @Input({ required: true, alias: 'flexRenderProps' })
  props: TProps = {} as TProps

  @Input({ required: false, alias: 'flexRenderInjector' })
  injector: Injector = inject(Injector)

  renderFlags = FlexRenderFlags.ViewFirstRender
  renderView: FlexRenderView<any> | null = null

  readonly #latestContent = () => {
    const { content, props } = this
    return typeof content !== 'function'
      ? content
      : runInInjectionContext(this.injector, () => content(props))
  }

  #getContentValue = memo(
    () => [this.#latestContent(), this.props, this.content],
    latestContent => {
      return mapToFlexRenderTypedContent(latestContent)
    },
    { key: 'flexRenderContentValue', debug: () => false }
  )

  constructor(
    @Inject(ViewContainerRef)
    private readonly viewContainerRef: ViewContainerRef,
    @Inject(TemplateRef)
    private readonly templateRef: TemplateRef<any>
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['props']) {
      this.renderFlags |= FlexRenderFlags.PropsReferenceChanged
    }
    if (changes['content']) {
      this.renderFlags |=
        FlexRenderFlags.ContentChanged | FlexRenderFlags.ViewFirstRender
      this.update()
    }
  }

  ngDoCheck(): void {
    if (this.renderFlags & FlexRenderFlags.ViewFirstRender) {
      // On the initial render, the view is created during the `ngOnChanges` hook.
      // Since `ngDoCheck` is called immediately afterward, there's no need to check for changes in this phase.
      this.renderFlags &= ~FlexRenderFlags.ViewFirstRender
      return
    }

    this.renderFlags |= FlexRenderFlags.DirtyCheck

    const latestContent = this.#getContentValue()
    if (latestContent.kind === 'null' || !this.renderView) {
      this.renderFlags |= FlexRenderFlags.ContentChanged
    } else {
      this.renderView.content = latestContent
      const { kind: previousKind } = this.renderView.previousContent
      if (latestContent.kind !== previousKind) {
        this.renderFlags |= FlexRenderFlags.ContentChanged
      }
    }
    this.update()
  }

  update() {
    if (
      this.renderFlags &
      (FlexRenderFlags.ContentChanged | FlexRenderFlags.ViewFirstRender)
    ) {
      this.render()
      return
    }
    if (this.renderFlags & FlexRenderFlags.PropsReferenceChanged) {
      if (this.renderView) this.renderView.updateProps(this.props)
      this.renderFlags &= ~FlexRenderFlags.PropsReferenceChanged
    }
    if (
      this.renderFlags &
      (FlexRenderFlags.DirtyCheck | FlexRenderFlags.DirtySignal)
    ) {
      if (this.renderView) this.renderView.dirtyCheck()
      this.renderFlags &= ~(
        FlexRenderFlags.DirtyCheck | FlexRenderFlags.DirtySignal
      )
    }
  }

  #currentEffectRef: EffectRef | null = null

  render() {
    if (this.#shouldRecreateEntireView() && this.#currentEffectRef) {
      this.#currentEffectRef.destroy()
      this.#currentEffectRef = null
      this.renderFlags &= ~FlexRenderFlags.RenderEffectChecked
    }

    this.viewContainerRef.clear()
    this.renderFlags =
      FlexRenderFlags.Pristine |
      (this.renderFlags & FlexRenderFlags.ViewFirstRender) |
      (this.renderFlags & FlexRenderFlags.RenderEffectChecked)

    const resolvedContent = this.#getContentValue()
    if (resolvedContent.kind === 'null') {
      this.renderView = null
    } else {
      this.renderView = this.#renderViewByContent(resolvedContent)
    }

    // If the content is a function `content(props)`, we initialize an effect
    // in order to react to changes if the given definition use signals.
    if (!this.#currentEffectRef && typeof this.content === 'function') {
      this.#currentEffectRef = effect(
        () => {
          this.#latestContent()
          if (!(this.renderFlags & FlexRenderFlags.RenderEffectChecked)) {
            this.renderFlags |= FlexRenderFlags.RenderEffectChecked
            return
          }
          this.renderFlags |= FlexRenderFlags.DirtySignal
          // This will mark the view as changed,
          // so we'll try to check for updates into ngDoCheck
          this.#changeDetectorRef.markForCheck()
        },
        { injector: this.viewContainerRef.injector }
      )
    }
  }

  #shouldRecreateEntireView() {
    return (
      this.renderFlags &
      FlexRenderFlags.ContentChanged &
      FlexRenderFlags.ViewFirstRender
    )
  }

  #renderViewByContent(
    content: FlexRenderTypedContent
  ): FlexRenderView<any> | null {
    if (content.kind === 'primitive') {
      return this.#renderStringContent(content)
    } else if (content.kind === 'templateRef') {
      return this.#renderTemplateRefContent(content)
    } else if (content.kind === 'flexRenderComponent') {
      return this.#renderComponent(content)
    } else if (content.kind === 'component') {
      return this.#renderCustomComponent(content)
    } else {
      return null
    }
  }

  #renderStringContent(
    template: Extract<FlexRenderTypedContent, { kind: 'primitive' }>
  ): FlexRenderTemplateView {
    const context = () => {
      return typeof this.content === 'string' ||
        typeof this.content === 'number'
        ? this.content
        : this.content?.(this.props)
    }
    const ref = this.viewContainerRef.createEmbeddedView(this.templateRef, {
      get $implicit() {
        return context()
      },
    })
    return new FlexRenderTemplateView(template, ref)
  }

  #renderTemplateRefContent(
    template: Extract<FlexRenderTypedContent, { kind: 'templateRef' }>
  ): FlexRenderTemplateView {
    const latestContext = () => this.props
    const view = this.viewContainerRef.createEmbeddedView(template.content, {
      get $implicit() {
        return latestContext()
      },
    })
    return new FlexRenderTemplateView(template, view)
  }

  #renderComponent(
    flexRenderComponent: Extract<
      FlexRenderTypedContent,
      { kind: 'flexRenderComponent' }
    >
  ): FlexRenderComponentView {
    const { inputs, outputs, injector } = flexRenderComponent.content

    const getContext = () => this.props
    const proxy = new Proxy(this.props, {
      get: (_, key) => getContext()[key as keyof typeof _],
    })
    const componentInjector = Injector.create({
      parent: injector ?? this.injector,
      providers: [{ provide: FlexRenderComponentProps, useValue: proxy }],
    })
    const view = this.#flexRenderComponentFactory.createComponent(
      flexRenderComponent.content,
      componentInjector
    )
    return new FlexRenderComponentView(flexRenderComponent, view)
  }

  #renderCustomComponent(
    component: Extract<FlexRenderTypedContent, { kind: 'component' }>
  ): FlexRenderComponentView {
    const view = this.#flexRenderComponentFactory.createComponent(
      flexRenderComponent(component.content, {
        inputs: this.props,
        injector: this.injector,
      }),
      this.injector
    )
    return new FlexRenderComponentView(component, view)
  }
}
