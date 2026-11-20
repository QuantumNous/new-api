import type {
  Constrain,
  LooseAsyncReturnType,
  LooseReturnType,
  ValidateSerializable,
} from '@tanstack/router-core'
import type { ComponentProps, ComponentType } from 'react'

export interface ServerComponentStream {
  createReplayStream: () => ReadableStream<Uint8Array>
}

// Symbol to attach stream to component for serialization
export const SERVER_COMPONENT_STREAM = Symbol.for('tanstack.rsc.stream')

// Symbol to attach collected CSS hrefs to component
export const SERVER_COMPONENT_CSS_HREFS = Symbol.for('tanstack.rsc.cssHrefs')

// Symbol to attach collected JS modulepreload hrefs to component
export const SERVER_COMPONENT_JS_PRELOADS = Symbol.for(
  'tanstack.rsc.jsPreloads',
)

// Symbol to attach a nested selection path to the RSC data proxy
export const RSC_PROXY_PATH = Symbol.for('tanstack.rsc.path')

// Symbol to attach the root tree getter to every nested proxy
export const RSC_PROXY_GET_TREE = Symbol.for('tanstack.rsc.getTree')

// Symbol to mark a proxy as "renderable" (for renderServerComponent output)
// When true: from renderServerComponent (directly renderable)
// When false/undefined: from createCompositeComponent (needs <CompositeComponent src={...} />)
export const RENDERABLE_RSC = Symbol.for('tanstack.rsc.renderable')

// Dev-only: collected slot usage data for devtools (client-side cache)
export const RSC_SLOT_USAGES = Symbol.for('tanstack.rsc.slotUsages')

// Dev-only: stream of slot usage preview events for devtools
export const RSC_SLOT_USAGES_STREAM = Symbol.for(
  'tanstack.rsc.slotUsages.stream',
)

export type RscSlotUsageEvent = {
  slot: string
  // Raw args passed to the slot call (must be serializable by the transport)
  args?: Array<any>
}

/**
 * Type guard to check if a value is a ServerComponent (Proxy with attached stream).
 * The value can be either an object (proxy target) or a function (stub for server functions).
 */
export function isServerComponent(
  value: unknown,
): value is AnyCompositeComponent {
  if (value === null || value === undefined) return false
  if (typeof value !== 'object' && typeof value !== 'function') return false
  return (
    SERVER_COMPONENT_STREAM in value &&
    (value as any)[SERVER_COMPONENT_STREAM] !== undefined
  )
}

export type ValidateCompositeComponent<TComp> = Constrain<
  TComp,
  (
    props: ValidateCompositeComponentProps<TComp>,
  ) => ValidateCompositeComponentReturnType<TComp>
>

export type ValidateCompositeComponentProps<TComp> = unknown extends TComp
  ? TComp
  : ValidateCompositeComponentPropsObject<CompositeComponentProps<TComp>>

export type ValidateCompositeComponentPropsObject<TProps> =
  unknown extends TProps
    ? TProps
    : {
        [TKey in keyof TProps]: ValidateCompositeComponentProp<TProps[TKey]>
      }

export type CompositeComponentProps<TComp> = TComp extends (
  props: infer TProps,
) => any
  ? TProps
  : unknown

export type ValidateCompositeComponentProp<TProp> = TProp extends (
  ...args: Array<any>
) => any
  ? (...args: ValidateReactSerializable<Parameters<TProp>>) => React.ReactNode
  : TProp extends ComponentType<any>
    ? ComponentType<ValidateReactSerializable<ComponentProps<TProp>>>
    : TProp extends React.ReactNode
      ? TProp
      : React.ReactNode

export type ValidateReactSerializable<T> = ValidateSerializable<
  T,
  ReactSerializable
>

export type ReactSerializable =
  | number
  | string
  | bigint
  | boolean
  | null
  | undefined
  | React.ReactNode

export type ValidateCompositeComponentReturnType<TComp> = unknown extends TComp
  ? React.ReactNode
  : ValidateCompositeComponentResult<LooseReturnType<TComp>>

export type ValidateCompositeComponentResult<TNode> =
  ValidateServerComponentResult<TNode>

export type ValidateServerComponentResult<TNode> =
  TNode extends Promise<any>
    ? ValidateCompositeComponentPromiseResult<TNode>
    : TNode extends React.ReactNode
      ? TNode
      : TNode extends (...args: Array<any>) => any
        ? React.ReactNode
        : TNode extends object
          ? ValidateCompositeComponentObjectResult<TNode>
          : React.ReactNode

export type ValidateCompositeComponentPromiseResult<TPromise> =
  TPromise extends Promise<infer T>
    ? Promise<ValidateCompositeComponentResult<T>>
    : never

export type ValidateCompositeComponentObjectResult<TObject> = {
  [TKey in keyof TObject]: ValidateCompositeComponentResult<TObject[TKey]>
}

export type CompositeComponentResult<TComp> = CompositeComponentBuilder<
  TComp,
  LooseAsyncReturnType<TComp>
>

export type CompositeComponentBuilder<TComp, TReturn> =
  TReturn extends React.ReactNode
    ? CompositeComponent<TComp, TReturn>
    : {
        [TKey in keyof TReturn]: CompositeComponentBuilder<TComp, TReturn[TKey]>
      }

export interface CompositeComponent<in out TComp, in out TReturn> {
  '~types': {
    props: CompositeComponentProps<TComp>
    return: TReturn
  }

  [SERVER_COMPONENT_STREAM]?: ServerComponentStream

  /**
   * Root decoded tree getter.
   */
  [RSC_PROXY_GET_TREE]?: () => unknown
  /**
   * Nested selection path (eg ['content','Stats']).
   * Used by <CompositeComponent/> to render a sub-tree.
   */
  [RSC_PROXY_PATH]?: Array<string>
  /**
   * CSS hrefs collected from the RSC stream.
   * Can be used for preloading in <head> or emitting 103 Early Hints.
   */
  [SERVER_COMPONENT_CSS_HREFS]?: ReadonlySet<string>

  /**
   * JS hrefs collected from the RSC stream.
   * Emitted as modulepreload links only if the decoded tree is rendered in SSR.
   */
  [SERVER_COMPONENT_JS_PRELOADS]?: ReadonlySet<string>

  /**
   * Dev-only: async stream of slot usage preview events.
   * Used by devtools to show slot names and previewed call args without
   * buffering/draining the Flight stream.
   */
  [RSC_SLOT_USAGES_STREAM]?: ReadableStream<RscSlotUsageEvent>
}

export type ValidateRenderableServerComponent<TNode> =
  ValidateServerComponentResult<TNode>

export type RenderableServerComponentBuilder<T> = T extends React.ReactNode
  ? RenderableServerComponent<T>
  : { [TKey in keyof T]: RenderableServerComponentBuilder<T[TKey]> }

export type RenderableServerComponent<TNode extends React.ReactNode> = TNode &
  RenderableServerComponentAttributes<TNode>

export interface RenderableServerComponentAttributes<TNode> {
  '~types': {
    node: TNode
  }
  [SERVER_COMPONENT_STREAM]: ServerComponentStream
  [RENDERABLE_RSC]: true
}

declare module '@tanstack/router-core' {
  export interface SerializableExtensions {
    CompositeComponent: AnyCompositeComponent
    RenderableServerComponent: AnyRenderableServerComponent
  }
}

export type AnyCompositeComponent = CompositeComponent<any, any>

export type AnyRenderableServerComponent =
  RenderableServerComponentAttributes<any>
