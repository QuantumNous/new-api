declare type ASTModifiers = {
    [key: string]: boolean;
};

declare type AsyncComponentFactory = () => {
    component: Promise<any>;
    loading?: any;
    error?: any;
    delay?: number;
    timeout?: number;
};

declare interface AsyncComponentOptions {
    loader: Function;
    loadingComponent?: any;
    errorComponent?: any;
    delay?: number;
    timeout?: number;
    suspensible?: boolean;
    onError?: (error: Error, retry: () => void, fail: () => void, attempts: number) => any;
}

declare type BaseTypes = string | number | boolean;

declare type Builtin = Primitive | Function | Date | Error | RegExp;

declare type CollectionTypes = IterableCollections | WeakCollections;

/* Excluded from this release type: Component */

/* Excluded from this release type: ComponentOptions */

export declare function computed<T>(getter: ComputedGetter<T>, debugOptions?: DebuggerOptions): ComputedRef<T>;

export declare function computed<T>(options: WritableComputedOptions<T>, debugOptions?: DebuggerOptions): WritableComputedRef<T>;

export declare type ComputedGetter<T> = (...args: any[]) => T;

export declare interface ComputedRef<T = any> extends WritableComputedRef<T> {
    readonly value: T;
    [ComputedRefSymbol]: true;
}

declare const ComputedRefSymbol: unique symbol;

export declare type ComputedSetter<T> = (v: T) => void;

/* Excluded from this release type: Config */

export declare function customRef<T>(factory: CustomRefFactory<T>): Ref<T>;

export declare type CustomRefFactory<T> = (track: () => void, trigger: () => void) => {
    get: () => T;
    set: (value: T) => void;
};

export declare type DebuggerEvent = {
    /* Excluded from this release type: effect */
} & DebuggerEventExtraInfo;

export declare type DebuggerEventExtraInfo = {
    target: object;
    type: TrackOpTypes | TriggerOpTypes;
    key?: any;
    newValue?: any;
    oldValue?: any;
};

export declare interface DebuggerOptions {
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
}

export declare type DeepReadonly<T> = T extends Builtin ? T : T extends Map<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends WeakMap<infer K, infer V> ? WeakMap<DeepReadonly<K>, DeepReadonly<V>> : T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends WeakSet<infer U> ? WeakSet<DeepReadonly<U>> : T extends Promise<infer U> ? Promise<DeepReadonly<U>> : T extends Ref<infer U> ? Readonly<Ref<DeepReadonly<U>>> : T extends {} ? {
    readonly [K in keyof T]: DeepReadonly<T[K]>;
} : Readonly<T>;

/* Excluded from this release type: defineAsyncComponent */

/* Excluded from this release type: defineComponent */

/**
 * Delete a property and trigger change if necessary.
 */
export declare function del<T>(array: T[], key: number): void;

export declare function del(object: object, key: string | number): void;

/* Excluded from this release type: Dep */

/* Excluded from this release type: DepTarget */

export declare class EffectScope {
    detached: boolean;
    /* Excluded from this release type: active */
    /* Excluded from this release type: effects */
    /* Excluded from this release type: cleanups */
    /* Excluded from this release type: parent */
    /* Excluded from this release type: scopes */
    /* Excluded from this release type: _vm */
    /**
     * track a child scope's index in its parent's scopes array for optimized
     * removal
     */
    private index;
    constructor(detached?: boolean);
    run<T>(fn: () => T): T | undefined;
    /* Excluded from this release type: on */
    /* Excluded from this release type: off */
    stop(fromParent?: boolean): void;
}

export declare function effectScope(detached?: boolean): EffectScope;

export declare type ErrorCapturedHook<TError = unknown> = (err: TError, instance: any, info: string) => boolean | void;

/* Excluded from this release type: getCurrentInstance */

export declare function getCurrentScope(): EffectScope | undefined;

/* Excluded from this release type: GlobalAPI */

/* Excluded from this release type: h */

declare type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

export declare function inject<T>(key: InjectionKey<T> | string): T | undefined;

export declare function inject<T>(key: InjectionKey<T> | string, defaultValue: T, treatDefaultAsFactory?: false): T;

export declare function inject<T>(key: InjectionKey<T> | string, defaultValue: T | (() => T), treatDefaultAsFactory: true): T;

export declare interface InjectionKey<T> extends Symbol {
}

declare type InjectKey = string | Symbol;

export declare function isProxy(value: unknown): boolean;

export declare function isReactive(value: unknown): boolean;

export declare function isReadonly(value: unknown): boolean;

export declare function isRef<T>(r: Ref<T> | unknown): r is Ref<T>;

export declare function isShallow(value: unknown): boolean;

declare type IterableCollections = Map<any, any> | Set<any>;

declare type MapSources<T, Immediate> = {
    [K in keyof T]: T[K] extends WatchSource<infer V> ? Immediate extends true ? V | undefined : V : T[K] extends object ? Immediate extends true ? T[K] | undefined : T[K] : never;
};

export declare function markRaw<T extends object>(value: T): T & {
    [RawSymbol]?: true;
};

/* Excluded from this release type: mergeDefaults */

declare type MultiWatchSources = (WatchSource<unknown> | object)[];

export declare function nextTick(): Promise<void>;

export declare function nextTick<T>(this: T, cb: (this: T, ...args: any[]) => any): void;

export declare function nextTick<T>(cb: (this: T, ...args: any[]) => any, ctx: T): void;

export declare const onActivated: (fn: () => void, target?: any) => void;

export declare const onBeforeMount: (fn: () => void, target?: any) => void;

export declare const onBeforeUnmount: (fn: () => void, target?: any) => void;

export declare const onBeforeUpdate: (fn: () => void, target?: any) => void;

declare type OnCleanup = (cleanupFn: () => void) => void;

export declare const onDeactivated: (fn: () => void, target?: any) => void;

export declare function onErrorCaptured<TError = Error>(hook: ErrorCapturedHook<TError>, target?: any): void;

export declare const onMounted: (fn: () => void, target?: any) => void;

export declare const onRenderTracked: (fn: (e: DebuggerEvent) => any, target?: any) => void;

export declare const onRenderTriggered: (fn: (e: DebuggerEvent) => any, target?: any) => void;

export declare function onScopeDispose(fn: () => void): void;

export declare const onServerPrefetch: (fn: () => void, target?: any) => void;

export declare const onUnmounted: (fn: () => void, target?: any) => void;

export declare const onUpdated: (fn: () => void, target?: any) => void;

declare type Primitive = string | number | boolean | bigint | symbol | undefined | null;

declare type PropOptions = {
    type?: Function | Array<Function> | null;
    default?: any;
    required?: boolean | null;
    validator?: Function | null;
};

export declare function provide<T>(key: InjectionKey<T> | string | number, value: T): void;

export declare function proxyRefs<T extends object>(objectWithRefs: T): ShallowUnwrapRef<T>;

declare const RawSymbol: unique symbol;

export declare function reactive<T extends object>(target: T): UnwrapNestedRefs<T>;

export declare const enum ReactiveFlags {
    SKIP = "__v_skip",
    IS_READONLY = "__v_isReadonly",
    IS_SHALLOW = "__v_isShallow",
    RAW = "__v_raw"
}

export declare function readonly<T extends object>(target: T): DeepReadonly<UnwrapNestedRefs<T>>;

export declare interface Ref<T = any> {
    value: T;
    /**
     * Type differentiator only.
     * We need this to be in public d.ts but don't want it to show up in IDE
     * autocomplete, so we use a private Symbol instead.
     */
    [RefSymbol]: true;
    /* Excluded from this release type: dep */
    /* Excluded from this release type: __v_isRef */
}

export declare function ref<T extends object>(value: T): [T] extends [Ref] ? T : Ref<UnwrapRef<T>>;

export declare function ref<T>(value: T): Ref<UnwrapRef<T>>;

export declare function ref<T = any>(): Ref<T | undefined>;

/* Excluded from this release type: RefFlag */

declare const RefSymbol: unique symbol;

/**
 * This is a special exported interface for other packages to declare
 * additional types that should bail out for ref unwrapping. For example
 * \@vue/runtime-dom can declare it like so in its d.ts:
 *
 * ``` ts
 * declare module 'vue' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 *
 * Note that api-extractor somehow refuses to include `declare module`
 * augmentations in its generated d.ts, so we have to manually append them
 * to the final generated d.ts in our build process.
 */
export declare interface RefUnwrapBailTypes {
    runtimeDOMBailTypes: Node | Window;
}

/* Excluded from this release type: ScopedSlotsData */

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export declare function set<T>(array: T[], key: number, value: T): T;

export declare function set<T>(object: object, key: string | number, value: T): T;

/* Excluded from this release type: SetupContext */

export declare type ShallowReactive<T> = T & {
    [ShallowReactiveMarker]?: true;
};

/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
export declare function shallowReactive<T extends object>(target: T): ShallowReactive<T>;

declare const ShallowReactiveMarker: unique symbol;

/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
export declare function shallowReadonly<T extends object>(target: T): Readonly<T>;

export declare type ShallowRef<T = any> = Ref<T> & {
    [ShallowRefMarker]?: true;
};

export declare function shallowRef<T extends object>(value: T): T extends Ref ? T : ShallowRef<T>;

export declare function shallowRef<T>(value: T): ShallowRef<T>;

export declare function shallowRef<T = any>(): ShallowRef<T | undefined>;

declare const ShallowRefMarker: unique symbol;

export declare type ShallowUnwrapRef<T> = {
    [K in keyof T]: T[K] extends Ref<infer V> ? V : T[K] extends Ref<infer V> | undefined ? unknown extends V ? undefined : V | undefined : T[K];
};

declare interface SimpleSet {
    has(key: string | number): boolean;
    add(key: string | number): any;
    clear(): void;
}

export declare function toRaw<T>(observed: T): T;

export declare type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>;

export declare function toRef<T extends object, K extends keyof T>(object: T, key: K): ToRef<T[K]>;

export declare function toRef<T extends object, K extends keyof T>(object: T, key: K, defaultValue: T[K]): ToRef<Exclude<T[K], undefined>>;

export declare type ToRefs<T = any> = {
    [K in keyof T]: ToRef<T[K]>;
};

export declare function toRefs<T extends object>(object: T): ToRefs<T>;

export declare const enum TrackOpTypes {
    GET = "get",
    TOUCH = "touch"
}

export declare const enum TriggerOpTypes {
    SET = "set",
    ADD = "add",
    DELETE = "delete",
    ARRAY_MUTATION = "array mutation"
}

export declare function triggerRef(ref: Ref): void;

export declare function unref<T>(ref: T | Ref<T>): T;

export declare type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>;

export declare type UnwrapRef<T> = T extends ShallowRef<infer V> ? V : T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>;

declare type UnwrapRefSimple<T> = T extends Function | CollectionTypes | BaseTypes | Ref | RefUnwrapBailTypes[keyof RefUnwrapBailTypes] | {
    [RawSymbol]?: true;
} ? T : T extends Array<any> ? {
    [K in keyof T]: UnwrapRefSimple<T[K]>;
} : T extends object & {
    [ShallowReactiveMarker]?: never;
} ? {
    [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>;
} : T;

/* Excluded from this release type: useAttrs */

export declare function useCssModule(name?: string): Record<string, string>;

/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
export declare function useCssVars(getter: (vm: Record<string, any>, setupProxy: Record<string, any>) => Record<string, string>): void;

/* Excluded from this release type: useListeners */

/* Excluded from this release type: useSlots */

/**
 * Note: also update dist/vue.runtime.mjs when adding new exports to this file.
 */
export declare const version: string;

/* Excluded from this release type: VNode */

/* Excluded from this release type: VNodeChildren */

/* Excluded from this release type: VNodeComponentOptions */

/* Excluded from this release type: VNodeData */

/* Excluded from this release type: VNodeDirective */

export declare function watch<T extends MultiWatchSources, Immediate extends Readonly<boolean> = false>(sources: [...T], cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>, options?: WatchOptions<Immediate>): WatchStopHandle;

export declare function watch<T extends Readonly<MultiWatchSources>, Immediate extends Readonly<boolean> = false>(source: T, cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>, options?: WatchOptions<Immediate>): WatchStopHandle;

export declare function watch<T, Immediate extends Readonly<boolean> = false>(source: WatchSource<T>, cb: WatchCallback<T, Immediate extends true ? T | undefined : T>, options?: WatchOptions<Immediate>): WatchStopHandle;

export declare function watch<T extends object, Immediate extends Readonly<boolean> = false>(source: T, cb: WatchCallback<T, Immediate extends true ? T | undefined : T>, options?: WatchOptions<Immediate>): WatchStopHandle;

export declare type WatchCallback<V = any, OV = any> = (value: V, oldValue: OV, onCleanup: OnCleanup) => any;

export declare type WatchEffect = (onCleanup: OnCleanup) => void;

export declare function watchEffect(effect: WatchEffect, options?: WatchOptionsBase): WatchStopHandle;

/* Excluded from this release type: Watcher */

/* Excluded from this release type: WatcherOptions */

export declare interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
    immediate?: Immediate;
    deep?: boolean;
}

export declare interface WatchOptionsBase extends DebuggerOptions {
    flush?: 'pre' | 'post' | 'sync';
}

export declare function watchPostEffect(effect: WatchEffect, options?: DebuggerOptions): WatchStopHandle;

export declare type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

export declare type WatchStopHandle = () => void;

export declare function watchSyncEffect(effect: WatchEffect, options?: DebuggerOptions): WatchStopHandle;

declare type WeakCollections = WeakMap<any, any> | WeakSet<any>;

export declare interface WritableComputedOptions<T> {
    get: ComputedGetter<T>;
    set: ComputedSetter<T>;
}

export declare interface WritableComputedRef<T> extends Ref<T> {
    readonly effect: any;
}

export { }
