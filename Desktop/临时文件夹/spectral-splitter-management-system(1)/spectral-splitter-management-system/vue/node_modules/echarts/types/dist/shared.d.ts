interface GradientObject {
    id?: number;
    type: string;
    colorStops: GradientColorStop[];
    global?: boolean;
}
interface GradientColorStop {
    offset: number;
    color: string;
}
declare class Gradient {
    id?: number;
    type: string;
    colorStops: GradientColorStop[];
    global: boolean;
    constructor(colorStops: GradientColorStop[]);
    addColorStop(offset: number, color: string): void;
}

interface RadialGradientObject extends GradientObject {
    type: 'radial';
    x: number;
    y: number;
    r: number;
}
declare class RadialGradient extends Gradient {
    type: 'radial';
    x: number;
    y: number;
    r: number;
    constructor(x: number, y: number, r: number, colorStops?: GradientColorStop[], globalCoord?: boolean);
}

interface LinearGradientObject extends GradientObject {
    type: 'linear';
    x: number;
    y: number;
    x2: number;
    y2: number;
}
declare class LinearGradient extends Gradient {
    type: 'linear';
    x: number;
    y: number;
    x2: number;
    y2: number;
    constructor(x: number, y: number, x2: number, y2: number, colorStops?: GradientColorStop[], globalCoord?: boolean);
}

declare type Dictionary<T> = {
    [key: string]: T;
};
declare type ArrayLike$1<T> = {
    [key: number]: T;
    length: number;
};
declare type ImageLike = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
declare type TextVerticalAlign = 'top' | 'middle' | 'bottom';
declare type TextAlign = 'left' | 'center' | 'right';
declare type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter' | number;
declare type FontStyle = 'normal' | 'italic' | 'oblique';
declare type BuiltinTextPosition = 'left' | 'right' | 'top' | 'bottom' | 'inside' | 'insideLeft' | 'insideRight' | 'insideTop' | 'insideBottom' | 'insideTopLeft' | 'insideTopRight' | 'insideBottomLeft' | 'insideBottomRight';
declare type ZREventProperties = {
    zrX: number;
    zrY: number;
    zrDelta: number;
    zrEventControl: 'no_globalout' | 'only_globalout';
    zrByTouch: boolean;
};
declare type ZRRawMouseEvent = MouseEvent & ZREventProperties;
declare type ZRRawTouchEvent = TouchEvent & ZREventProperties;
declare type ZRRawPointerEvent = TouchEvent & ZREventProperties;
declare type ZRRawEvent = ZRRawMouseEvent | ZRRawTouchEvent | ZRRawPointerEvent;
declare type ElementEventName = 'click' | 'dblclick' | 'mousewheel' | 'mouseout' | 'mouseover' | 'mouseup' | 'mousedown' | 'mousemove' | 'contextmenu' | 'drag' | 'dragstart' | 'dragend' | 'dragenter' | 'dragleave' | 'dragover' | 'drop' | 'globalout';
declare type ElementEventNameWithOn = 'onclick' | 'ondblclick' | 'onmousewheel' | 'onmouseout' | 'onmouseup' | 'onmousedown' | 'onmousemove' | 'oncontextmenu' | 'ondrag' | 'ondragstart' | 'ondragend' | 'ondragenter' | 'ondragleave' | 'ondragover' | 'ondrop';
declare type PropType<TObj, TProp extends keyof TObj> = TObj[TProp];
declare type FunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];
declare type MapToType<T extends Dictionary<any>, S> = {
    [P in keyof T]: T[P] extends Dictionary<any> ? MapToType<T[P], S> : S;
};
declare type KeyOfDistributive<T> = T extends unknown ? keyof T : never;
declare type WithThisType<Func extends (...args: any) => any, This> = (this: This, ...args: Parameters<Func>) => ReturnType<Func>;

declare type SVGVNodeAttrs = Record<string, string | number | undefined | boolean>;
interface SVGVNode {
    tag: string;
    attrs: SVGVNodeAttrs;
    children?: SVGVNode[];
    text?: string;
    elm?: Node;
    key: string;
}

declare type ImagePatternRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
interface PatternObjectBase {
    id?: number;
    type?: 'pattern';
    x?: number;
    y?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
}
interface ImagePatternObject extends PatternObjectBase {
    image: ImageLike | string;
    repeat?: ImagePatternRepeat;
    imageWidth?: number;
    imageHeight?: number;
}
interface SVGPatternObject extends PatternObjectBase {
    svgElement?: SVGVNode;
    svgWidth?: number;
    svgHeight?: number;
}
declare type PatternObject = ImagePatternObject | SVGPatternObject;

declare type EventCallbackSingleParam<EvtParam = any> = EvtParam extends any ? (params: EvtParam) => boolean | void : never;
declare type EventCallback<EvtParams = any[]> = EvtParams extends any[] ? (...args: EvtParams) => boolean | void : never;
declare type EventQuery = string | Object;
declare type CbThis<Ctx, Impl> = unknown extends Ctx ? Impl : Ctx;
declare type DefaultEventDefinition = Dictionary<EventCallback<any[]>>;
interface EventProcessor<EvtDef = DefaultEventDefinition> {
    normalizeQuery?: (query: EventQuery) => EventQuery;
    filter?: (eventType: keyof EvtDef, query: EventQuery) => boolean;
    afterTrigger?: (eventType: keyof EvtDef) => void;
}
declare class Eventful<EvtDef extends DefaultEventDefinition = DefaultEventDefinition> {
    private _$handlers;
    protected _$eventProcessor: EventProcessor<EvtDef>;
    constructor(eventProcessors?: EventProcessor<EvtDef>);
    on<Ctx, EvtNm extends keyof EvtDef>(event: EvtNm, handler: WithThisType<EvtDef[EvtNm], CbThis<Ctx, this>>, context?: Ctx): this;
    on<Ctx, EvtNm extends keyof EvtDef>(event: EvtNm, query: EventQuery, handler: WithThisType<EvtDef[EvtNm], CbThis<Ctx, this>>, context?: Ctx): this;
    isSilent(eventName: keyof EvtDef): boolean;
    off(eventType?: keyof EvtDef, handler?: Function): this;
    trigger<EvtNm extends keyof EvtDef>(eventType: EvtNm, ...args: Parameters<EvtDef[EvtNm]>): this;
    triggerWithContext(type: keyof EvtDef, ...args: any[]): this;
}

declare type VectorArray = number[];
declare function create(x?: number, y?: number): VectorArray;
declare function copy<T extends VectorArray>(out: T, v: VectorArray): T;
declare function clone(v: VectorArray): VectorArray;
declare function set<T extends VectorArray>(out: T, a: number, b: number): T;
declare function add<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray): T;
declare function scaleAndAdd<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray, a: number): T;
declare function sub<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray): T;
declare function len(v: VectorArray): number;
declare const length: typeof len;
declare function lenSquare(v: VectorArray): number;
declare const lengthSquare: typeof lenSquare;
declare function mul<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray): T;
declare function div<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray): T;
declare function dot(v1: VectorArray, v2: VectorArray): number;
declare function scale<T extends VectorArray>(out: T, v: VectorArray, s: number): T;
declare function normalize<T extends VectorArray>(out: T, v: VectorArray): T;
declare function distance(v1: VectorArray, v2: VectorArray): number;
declare const dist: typeof distance;
declare function distanceSquare(v1: VectorArray, v2: VectorArray): number;
declare const distSquare: typeof distanceSquare;
declare function negate<T extends VectorArray>(out: T, v: VectorArray): T;
declare function lerp<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray, t: number): T;
declare function applyTransform<T extends VectorArray>(out: T, v: VectorArray, m: MatrixArray): T;
declare function min<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray): T;
declare function max<T extends VectorArray>(out: T, v1: VectorArray, v2: VectorArray): T;

type vector_d_VectorArray = VectorArray;
declare const vector_d_create: typeof create;
declare const vector_d_copy: typeof copy;
declare const vector_d_clone: typeof clone;
declare const vector_d_set: typeof set;
declare const vector_d_add: typeof add;
declare const vector_d_scaleAndAdd: typeof scaleAndAdd;
declare const vector_d_sub: typeof sub;
declare const vector_d_len: typeof len;
declare const vector_d_length: typeof length;
declare const vector_d_lenSquare: typeof lenSquare;
declare const vector_d_lengthSquare: typeof lengthSquare;
declare const vector_d_mul: typeof mul;
declare const vector_d_div: typeof div;
declare const vector_d_dot: typeof dot;
declare const vector_d_scale: typeof scale;
declare const vector_d_normalize: typeof normalize;
declare const vector_d_distance: typeof distance;
declare const vector_d_dist: typeof dist;
declare const vector_d_distanceSquare: typeof distanceSquare;
declare const vector_d_distSquare: typeof distSquare;
declare const vector_d_negate: typeof negate;
declare const vector_d_lerp: typeof lerp;
declare const vector_d_applyTransform: typeof applyTransform;
declare const vector_d_min: typeof min;
declare const vector_d_max: typeof max;
declare namespace vector_d {
  export {
    vector_d_VectorArray as VectorArray,
    vector_d_create as create,
    vector_d_copy as copy,
    vector_d_clone as clone,
    vector_d_set as set,
    vector_d_add as add,
    vector_d_scaleAndAdd as scaleAndAdd,
    vector_d_sub as sub,
    vector_d_len as len,
    vector_d_length as length,
    vector_d_lenSquare as lenSquare,
    vector_d_lengthSquare as lengthSquare,
    vector_d_mul as mul,
    vector_d_div as div,
    vector_d_dot as dot,
    vector_d_scale as scale,
    vector_d_normalize as normalize,
    vector_d_distance as distance,
    vector_d_dist as dist,
    vector_d_distanceSquare as distanceSquare,
    vector_d_distSquare as distSquare,
    vector_d_negate as negate,
    vector_d_lerp as lerp,
    vector_d_applyTransform as applyTransform,
    vector_d_min as min,
    vector_d_max as max,
  };
}

declare type MatrixArray = number[];
declare function create$1(): MatrixArray;
declare function identity(out: MatrixArray): MatrixArray;
declare function copy$1(out: MatrixArray, m: MatrixArray): MatrixArray;
declare function mul$1(out: MatrixArray, m1: MatrixArray, m2: MatrixArray): MatrixArray;
declare function translate(out: MatrixArray, a: MatrixArray, v: VectorArray): MatrixArray;
declare function rotate(out: MatrixArray, a: MatrixArray, rad: number): MatrixArray;
declare function scale$1(out: MatrixArray, a: MatrixArray, v: VectorArray): MatrixArray;
declare function invert(out: MatrixArray, a: MatrixArray): MatrixArray | null;
declare function clone$1(a: MatrixArray): MatrixArray;

type matrix_d_MatrixArray = MatrixArray;
declare const matrix_d_identity: typeof identity;
declare const matrix_d_translate: typeof translate;
declare const matrix_d_rotate: typeof rotate;
declare const matrix_d_invert: typeof invert;
declare namespace matrix_d {
  export {
    matrix_d_MatrixArray as MatrixArray,
    create$1 as create,
    matrix_d_identity as identity,
    copy$1 as copy,
    mul$1 as mul,
    matrix_d_translate as translate,
    matrix_d_rotate as rotate,
    scale$1 as scale,
    matrix_d_invert as invert,
    clone$1 as clone,
  };
}

interface PointLike {
    x: number;
    y: number;
}
declare class Point {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    copy(other: PointLike): this;
    clone(): Point;
    set(x: number, y: number): this;
    equal(other: PointLike): boolean;
    add(other: PointLike): this;
    scale(scalar: number): void;
    scaleAndAdd(other: PointLike, scalar: number): void;
    sub(other: PointLike): this;
    dot(other: PointLike): number;
    len(): number;
    lenSquare(): number;
    normalize(): this;
    distance(other: PointLike): number;
    distanceSquare(other: Point): number;
    negate(): this;
    transform(m: MatrixArray): this;
    toArray(out: number[]): number[];
    fromArray(input: number[]): void;
    static set(p: PointLike, x: number, y: number): void;
    static copy(p: PointLike, p2: PointLike): void;
    static len(p: PointLike): number;
    static lenSquare(p: PointLike): number;
    static dot(p0: PointLike, p1: PointLike): number;
    static add(out: PointLike, p0: PointLike, p1: PointLike): void;
    static sub(out: PointLike, p0: PointLike, p1: PointLike): void;
    static scale(out: PointLike, p0: PointLike, scalar: number): void;
    static scaleAndAdd(out: PointLike, p0: PointLike, p1: PointLike, scalar: number): void;
    static lerp(out: PointLike, p0: PointLike, p1: PointLike, t: number): void;
}

declare class BoundingRect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x: number, y: number, width: number, height: number);
    union(other: BoundingRect): void;
    applyTransform(m: MatrixArray): void;
    calculateTransform(b: RectLike): MatrixArray;
    intersect(b: RectLike, mtv?: PointLike): boolean;
    contain(x: number, y: number): boolean;
    clone(): BoundingRect;
    copy(other: RectLike): void;
    plain(): RectLike;
    isFinite(): boolean;
    isZero(): boolean;
    static create(rect: RectLike): BoundingRect;
    static copy(target: RectLike, source: RectLike): void;
    static applyTransform(target: RectLike, source: RectLike, m: MatrixArray): void;
}
declare type RectLike = {
    x: number;
    y: number;
    width: number;
    height: number;
};

interface ExtendedCanvasRenderingContext2D extends CanvasRenderingContext2D {
    dpr?: number;
}
declare class PathProxy {
    dpr: number;
    data: number[] | Float32Array;
    private _version;
    private _saveData;
    private _pendingPtX;
    private _pendingPtY;
    private _pendingPtDist;
    private _ctx;
    private _xi;
    private _yi;
    private _x0;
    private _y0;
    private _len;
    private _pathSegLen;
    private _pathLen;
    private _ux;
    private _uy;
    static CMD: {
        M: number;
        L: number;
        C: number;
        Q: number;
        A: number;
        Z: number;
        R: number;
    };
    constructor(notSaveData?: boolean);
    increaseVersion(): void;
    getVersion(): number;
    setScale(sx: number, sy: number, segmentIgnoreThreshold?: number): void;
    setDPR(dpr: number): void;
    setContext(ctx: ExtendedCanvasRenderingContext2D): void;
    getContext(): ExtendedCanvasRenderingContext2D;
    beginPath(): this;
    reset(): void;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
    quadraticCurveTo(x1: number, y1: number, x2: number, y2: number): this;
    arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, anticlockwise?: boolean): this;
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): this;
    rect(x: number, y: number, w: number, h: number): this;
    closePath(): this;
    fill(ctx: CanvasRenderingContext2D): void;
    stroke(ctx: CanvasRenderingContext2D): void;
    len(): number;
    setData(data: Float32Array | number[]): void;
    appendPath(path: PathProxy | PathProxy[]): void;
    addData(cmd: number, a?: number, b?: number, c?: number, d?: number, e?: number, f?: number, g?: number, h?: number): void;
    private _drawPendingPt;
    private _expandData;
    toStatic(): void;
    getBoundingRect(): BoundingRect;
    private _calculateLength;
    rebuildPath(ctx: PathRebuilder, percent: number): void;
    clone(): PathProxy;
    private static initDefaultProps;
}
interface PathRebuilder {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    bezierCurveTo(x: number, y: number, x2: number, y2: number, x3: number, y3: number): void;
    quadraticCurveTo(x: number, y: number, x2: number, y2: number): void;
    arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, anticlockwise: boolean): void;
    ellipse(cx: number, cy: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise: boolean): void;
    rect(x: number, y: number, width: number, height: number): void;
    closePath(): void;
}

declare type easingFunc = (percent: number) => number;
declare type AnimationEasing = keyof typeof easingFuncs | easingFunc;
declare const easingFuncs: {
    linear(k: number): number;
    quadraticIn(k: number): number;
    quadraticOut(k: number): number;
    quadraticInOut(k: number): number;
    cubicIn(k: number): number;
    cubicOut(k: number): number;
    cubicInOut(k: number): number;
    quarticIn(k: number): number;
    quarticOut(k: number): number;
    quarticInOut(k: number): number;
    quinticIn(k: number): number;
    quinticOut(k: number): number;
    quinticInOut(k: number): number;
    sinusoidalIn(k: number): number;
    sinusoidalOut(k: number): number;
    sinusoidalInOut(k: number): number;
    exponentialIn(k: number): number;
    exponentialOut(k: number): number;
    exponentialInOut(k: number): number;
    circularIn(k: number): number;
    circularOut(k: number): number;
    circularInOut(k: number): number;
    elasticIn(k: number): number;
    elasticOut(k: number): number;
    elasticInOut(k: number): number;
    backIn(k: number): number;
    backOut(k: number): number;
    backInOut(k: number): number;
    bounceIn(k: number): number;
    bounceOut(k: number): number;
    bounceInOut(k: number): number;
};

interface Stage {
    update?: () => void;
}
interface AnimationOption {
    stage?: Stage;
}
declare class Animation extends Eventful {
    stage: Stage;
    private _head;
    private _tail;
    private _running;
    private _time;
    private _pausedTime;
    private _pauseStart;
    private _paused;
    constructor(opts?: AnimationOption);
    addClip(clip: Clip): void;
    addAnimator(animator: Animator<any>): void;
    removeClip(clip: Clip): void;
    removeAnimator(animator: Animator<any>): void;
    update(notTriggerFrameAndStageUpdate?: boolean): void;
    _startLoop(): void;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    clear(): void;
    isFinished(): boolean;
    animate<T>(target: T, options: {
        loop?: boolean;
    }): Animator<T>;
}

declare type OnframeCallback = (percent: number) => void;
declare type ondestroyCallback = () => void;
declare type onrestartCallback = () => void;
interface ClipProps {
    life?: number;
    delay?: number;
    loop?: boolean;
    easing?: AnimationEasing;
    onframe?: OnframeCallback;
    ondestroy?: ondestroyCallback;
    onrestart?: onrestartCallback;
}
declare class Clip {
    private _life;
    private _delay;
    private _inited;
    private _startTime;
    private _pausedTime;
    private _paused;
    animation: Animation;
    loop: boolean;
    easing: AnimationEasing;
    easingFunc: (p: number) => number;
    next: Clip;
    prev: Clip;
    onframe: OnframeCallback;
    ondestroy: ondestroyCallback;
    onrestart: onrestartCallback;
    constructor(opts: ClipProps);
    step(globalTime: number, deltaTime: number): boolean;
    pause(): void;
    resume(): void;
    setEasing(easing: AnimationEasing): void;
}

declare type ValueType = 0 | 1 | 2 | 3 | 4 | 5 | 6;
declare type Keyframe = {
    time: number;
    value: unknown;
    percent: number;
    rawValue: unknown;
    easing?: AnimationEasing;
    easingFunc?: (percent: number) => number;
    additiveValue?: unknown;
};
declare class Track {
    keyframes: Keyframe[];
    propName: string;
    valType: ValueType;
    discrete: boolean;
    _invalid: boolean;
    private _finished;
    private _needsSort;
    private _additiveTrack;
    private _additiveValue;
    private _lastFr;
    private _lastFrP;
    constructor(propName: string);
    isFinished(): boolean;
    setFinished(): void;
    needsAnimate(): boolean;
    getAdditiveTrack(): Track;
    addKeyframe(time: number, rawValue: unknown, easing?: AnimationEasing): Keyframe;
    prepare(maxTime: number, additiveTrack?: Track): void;
    step(target: any, percent: number): void;
    private _addToTarget;
}
declare type DoneCallback = () => void;
declare type AbortCallback = () => void;
declare type OnframeCallback$1<T> = (target: T, percent: number) => void;
declare class Animator<T> {
    animation?: Animation;
    targetName?: string;
    scope?: string;
    __fromStateTransition?: string;
    private _tracks;
    private _trackKeys;
    private _target;
    private _loop;
    private _delay;
    private _maxTime;
    private _force;
    private _paused;
    private _started;
    private _allowDiscrete;
    private _additiveAnimators;
    private _doneCbs;
    private _onframeCbs;
    private _abortedCbs;
    private _clip;
    constructor(target: T, loop: boolean, allowDiscreteAnimation?: boolean, additiveTo?: Animator<any>[]);
    getMaxTime(): number;
    getDelay(): number;
    getLoop(): boolean;
    getTarget(): T;
    changeTarget(target: T): void;
    when(time: number, props: Dictionary<any>, easing?: AnimationEasing): this;
    whenWithKeys(time: number, props: Dictionary<any>, propNames: string[], easing?: AnimationEasing): this;
    pause(): void;
    resume(): void;
    isPaused(): boolean;
    duration(duration: number): this;
    private _doneCallback;
    private _abortedCallback;
    private _setTracksFinished;
    private _getAdditiveTrack;
    start(easing?: AnimationEasing): this;
    stop(forwardToLast?: boolean): void;
    delay(time: number): this;
    during(cb: OnframeCallback$1<T>): this;
    done(cb: DoneCallback): this;
    aborted(cb: AbortCallback): this;
    getClip(): Clip;
    getTrack(propName: string): Track;
    getTracks(): Track[];
    stopTracks(propNames: string[], forwardToLast?: boolean): boolean;
    saveTo(target: T, trackKeys?: readonly string[], firstOrLast?: boolean): void;
    __changeFinalValue(finalProps: Dictionary<any>, trackKeys?: readonly string[]): void;
}

interface PathStyleProps extends CommonStyleProps {
    fill?: string | PatternObject | LinearGradientObject | RadialGradientObject;
    stroke?: string | PatternObject | LinearGradientObject | RadialGradientObject;
    decal?: PatternObject;
    strokePercent?: number;
    strokeNoScale?: boolean;
    fillOpacity?: number;
    strokeOpacity?: number;
    lineDash?: false | number[] | 'solid' | 'dashed' | 'dotted';
    lineDashOffset?: number;
    lineWidth?: number;
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
    miterLimit?: number;
    strokeFirst?: boolean;
}
interface PathProps extends DisplayableProps {
    strokeContainThreshold?: number;
    segmentIgnoreThreshold?: number;
    subPixelOptimize?: boolean;
    style?: PathStyleProps;
    shape?: Dictionary<any>;
    autoBatch?: boolean;
    __value?: (string | number)[] | (string | number);
    buildPath?: (ctx: PathProxy | CanvasRenderingContext2D, shapeCfg: Dictionary<any>, inBatch?: boolean) => void;
}
declare type PathKey = keyof PathProps;
declare type PathPropertyType = PropType<PathProps, PathKey>;
declare type PathStatePropNames = DisplayableStatePropNames | 'shape';
declare type PathState = Pick<PathProps, PathStatePropNames> & {
    hoverLayer?: boolean;
};
interface Path<Props extends PathProps = PathProps> {
    animate(key?: '', loop?: boolean): Animator<this>;
    animate(key: 'style', loop?: boolean): Animator<this['style']>;
    animate(key: 'shape', loop?: boolean): Animator<this['shape']>;
    getState(stateName: string): PathState;
    ensureState(stateName: string): PathState;
    states: Dictionary<PathState>;
    stateProxy: (stateName: string) => PathState;
}
declare class Path<Props extends PathProps = PathProps> extends Displayable<Props> {
    path: PathProxy;
    strokeContainThreshold: number;
    segmentIgnoreThreshold: number;
    subPixelOptimize: boolean;
    style: PathStyleProps;
    autoBatch: boolean;
    private _rectStroke;
    protected _normalState: PathState;
    protected _decalEl: Path;
    shape: Dictionary<any>;
    constructor(opts?: Props);
    update(): void;
    getDecalElement(): Path<PathProps>;
    protected _init(props?: Props): void;
    protected getDefaultStyle(): Props['style'];
    protected getDefaultShape(): {};
    protected canBeInsideText(): boolean;
    protected getInsideTextFill(): "#333" | "#ccc" | "#eee";
    protected getInsideTextStroke(textFill?: string): string;
    buildPath(ctx: PathProxy | CanvasRenderingContext2D, shapeCfg: Dictionary<any>, inBatch?: boolean): void;
    pathUpdated(): void;
    getUpdatedPathProxy(inBatch?: boolean): PathProxy;
    createPathProxy(): void;
    hasStroke(): boolean;
    hasFill(): boolean;
    getBoundingRect(): BoundingRect;
    contain(x: number, y: number): boolean;
    dirtyShape(): void;
    dirty(): void;
    animateShape(loop: boolean): Animator<this["shape"]>;
    updateDuringAnimation(targetKey: string): void;
    attrKV(key: PathKey, value: PathPropertyType): void;
    setShape(obj: Props['shape']): this;
    setShape<T extends keyof Props['shape']>(obj: T, value: Props['shape'][T]): this;
    shapeChanged(): boolean;
    createStyle(obj?: Props['style']): Props["style"];
    protected _innerSaveToNormal(toState: PathState): void;
    protected _applyStateObj(stateName: string, state: PathState, normalState: PathState, keepCurrentStates: boolean, transition: boolean, animationCfg: ElementAnimateConfig): void;
    protected _mergeStates(states: PathState[]): PathState;
    getAnimationStyleProps(): MapToType<PathProps, boolean>;
    isZeroArea(): boolean;
    static extend<Shape extends Dictionary<any>>(defaultProps: {
        type?: string;
        shape?: Shape;
        style?: PathStyleProps;
        beforeBrush?: Displayable['beforeBrush'];
        afterBrush?: Displayable['afterBrush'];
        getBoundingRect?: Displayable['getBoundingRect'];
        calculateTextPosition?: Element['calculateTextPosition'];
        buildPath(this: Path, ctx: CanvasRenderingContext2D | PathProxy, shape: Shape, inBatch?: boolean): void;
        init?(this: Path, opts: PathProps): void;
    }): {
        new (opts?: PathProps & {
            shape: Shape;
        }): Path;
    };
    protected static initDefaultProps: void;
}

declare class Transformable {
    parent: Transformable;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
    rotation: number;
    anchorX: number;
    anchorY: number;
    originX: number;
    originY: number;
    globalScaleRatio: number;
    transform: MatrixArray;
    invTransform: MatrixArray;
    getLocalTransform(m?: MatrixArray): MatrixArray;
    setPosition(arr: number[]): void;
    setScale(arr: number[]): void;
    setSkew(arr: number[]): void;
    setOrigin(arr: number[]): void;
    needLocalTransform(): boolean;
    updateTransform(): void;
    private _resolveGlobalScaleRatio;
    getComputedTransform(): MatrixArray;
    setLocalTransform(m: VectorArray): void;
    decomposeTransform(): void;
    getGlobalScale(out?: VectorArray): VectorArray;
    transformCoordToLocal(x: number, y: number): number[];
    transformCoordToGlobal(x: number, y: number): number[];
    getLineScale(): number;
    copyTransform(source: Transformable): void;
    static getLocalTransform(target: Transformable, m?: MatrixArray): MatrixArray;
    private static initDefaultProps;
}
declare const TRANSFORMABLE_PROPS: readonly ["x", "y", "originX", "originY", "anchorX", "anchorY", "rotation", "scaleX", "scaleY", "skewX", "skewY"];
declare type TransformProp = (typeof TRANSFORMABLE_PROPS)[number];

interface TSpanStyleProps extends PathStyleProps {
    x?: number;
    y?: number;
    text?: string;
    font?: string;
    fontSize?: number;
    fontWeight?: FontWeight;
    fontStyle?: FontStyle;
    fontFamily?: string;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
}
interface TSpanProps extends DisplayableProps {
    style?: TSpanStyleProps;
}
declare class TSpan extends Displayable<TSpanProps> {
    style: TSpanStyleProps;
    hasStroke(): boolean;
    hasFill(): boolean;
    createStyle(obj?: TSpanStyleProps): TSpanStyleProps;
    setBoundingRect(rect: BoundingRect): void;
    getBoundingRect(): BoundingRect;
    protected static initDefaultProps: void;
}

interface ImageStyleProps extends CommonStyleProps {
    image?: string | ImageLike;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    sx?: number;
    sy?: number;
    sWidth?: number;
    sHeight?: number;
}
interface ImageProps extends DisplayableProps {
    style?: ImageStyleProps;
    onload?: (image: ImageLike) => void;
}
declare class ZRImage extends Displayable<ImageProps> {
    style: ImageStyleProps;
    __image: ImageLike;
    __imageSrc: string;
    onload: (image: ImageLike) => void;
    createStyle(obj?: ImageStyleProps): ImageStyleProps;
    private _getSize;
    getWidth(): number;
    getHeight(): number;
    getAnimationStyleProps(): MapToType<ImageProps, boolean>;
    getBoundingRect(): BoundingRect;
}

declare class RectShape {
    r?: number | number[];
    x: number;
    y: number;
    width: number;
    height: number;
}
interface RectProps extends PathProps {
    shape?: Partial<RectShape>;
}
declare class Rect extends Path<RectProps> {
    shape: RectShape;
    constructor(opts?: RectProps);
    getDefaultShape(): RectShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: RectShape): void;
    isZeroArea(): boolean;
}

interface GroupProps extends ElementProps {
}
declare class Group extends Element<GroupProps> {
    readonly isGroup = true;
    private _children;
    constructor(opts?: GroupProps);
    childrenRef(): Element<ElementProps>[];
    children(): Element<ElementProps>[];
    childAt(idx: number): Element;
    childOfName(name: string): Element;
    childCount(): number;
    add(child: Element): Group;
    addBefore(child: Element, nextSibling: Element): this;
    replace(oldChild: Element, newChild: Element): this;
    replaceAt(child: Element, index: number): this;
    _doAdd(child: Element): void;
    remove(child: Element): this;
    removeAll(): this;
    eachChild<Context>(cb: (this: Context, el: Element, index?: number) => void, context?: Context): this;
    traverse<T>(cb: (this: T, el: Element) => boolean | void, context?: T): this;
    addSelfToZr(zr: ZRenderType): void;
    removeSelfFromZr(zr: ZRenderType): void;
    getBoundingRect(includeChildren?: Element[]): BoundingRect;
}
interface GroupLike extends Element {
    childrenRef(): Element[];
}

interface TextStylePropsPart {
    text?: string;
    fill?: string;
    stroke?: string;
    strokeNoScale?: boolean;
    opacity?: number;
    fillOpacity?: number;
    strokeOpacity?: number;
    lineWidth?: number;
    lineDash?: false | number[];
    lineDashOffset?: number;
    borderDash?: false | number[];
    borderDashOffset?: number;
    font?: string;
    textFont?: string;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    fontFamily?: string;
    fontSize?: number | string;
    align?: TextAlign;
    verticalAlign?: TextVerticalAlign;
    lineHeight?: number;
    width?: number | string;
    height?: number;
    tag?: string;
    textShadowColor?: string;
    textShadowBlur?: number;
    textShadowOffsetX?: number;
    textShadowOffsetY?: number;
    backgroundColor?: string | {
        image: ImageLike | string;
    };
    padding?: number | number[];
    margin?: number;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number | number[];
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
}
interface TextStyleProps extends TextStylePropsPart {
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    rich?: Dictionary<TextStylePropsPart>;
    overflow?: 'break' | 'breakAll' | 'truncate' | 'none';
    lineOverflow?: 'truncate';
    ellipsis?: string;
    placeholder?: string;
    truncateMinChar?: number;
}
interface TextProps extends DisplayableProps {
    style?: TextStyleProps;
    zlevel?: number;
    z?: number;
    z2?: number;
    culling?: boolean;
    cursor?: string;
}
declare type TextState = Pick<TextProps, DisplayableStatePropNames> & ElementCommonState;
declare type DefaultTextStyle = Pick<TextStyleProps, 'fill' | 'stroke' | 'align' | 'verticalAlign'> & {
    autoStroke?: boolean;
};
interface ZRText {
    animate(key?: '', loop?: boolean): Animator<this>;
    animate(key: 'style', loop?: boolean): Animator<this['style']>;
    getState(stateName: string): TextState;
    ensureState(stateName: string): TextState;
    states: Dictionary<TextState>;
    stateProxy: (stateName: string) => TextState;
}
declare class ZRText extends Displayable<TextProps> implements GroupLike {
    type: string;
    style: TextStyleProps;
    overlap: 'hidden' | 'show' | 'blur';
    innerTransformable: Transformable;
    private _children;
    private _childCursor;
    private _defaultStyle;
    constructor(opts?: TextProps);
    childrenRef(): (ZRImage | Rect | TSpan)[];
    update(): void;
    updateTransform(): void;
    getLocalTransform(m?: MatrixArray): MatrixArray;
    getComputedTransform(): MatrixArray;
    private _updateSubTexts;
    addSelfToZr(zr: ZRenderType): void;
    removeSelfFromZr(zr: ZRenderType): void;
    getBoundingRect(): BoundingRect;
    setDefaultTextStyle(defaultTextStyle: DefaultTextStyle): void;
    setTextContent(textContent: never): void;
    protected _mergeStyle(targetStyle: TextStyleProps, sourceStyle: TextStyleProps): TextStyleProps;
    private _mergeRich;
    getAnimationStyleProps(): MapToType<TextProps, boolean>;
    private _getOrCreateChild;
    private _updatePlainTexts;
    private _updateRichTexts;
    private _placeToken;
    private _renderBackground;
    static makeFont(style: TextStylePropsPart): string;
}

interface TextPositionCalculationResult {
    x: number;
    y: number;
    align: TextAlign;
    verticalAlign: TextVerticalAlign;
}

declare class PolylineShape {
    points: VectorArray[];
    percent?: number;
    smooth?: number;
    smoothConstraint?: VectorArray[];
}
interface PolylineProps extends PathProps {
    shape?: Partial<PolylineShape>;
}
declare class Polyline extends Path<PolylineProps> {
    shape: PolylineShape;
    constructor(opts?: PolylineProps);
    getDefaultStyle(): {
        stroke: string;
        fill: string;
    };
    getDefaultShape(): PolylineShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: PolylineShape): void;
}

interface ElementAnimateConfig {
    duration?: number;
    delay?: number;
    easing?: AnimationEasing;
    during?: (percent: number) => void;
    done?: Function;
    aborted?: Function;
    scope?: string;
    force?: boolean;
    additive?: boolean;
    setToFinal?: boolean;
}
interface ElementTextConfig {
    position?: BuiltinTextPosition | (number | string)[];
    rotation?: number;
    layoutRect?: RectLike;
    offset?: number[];
    origin?: (number | string)[] | 'center';
    distance?: number;
    local?: boolean;
    insideFill?: string;
    insideStroke?: string;
    outsideFill?: string;
    outsideStroke?: string;
    inside?: boolean;
}
interface ElementTextGuideLineConfig {
    anchor?: Point;
    showAbove?: boolean;
    candidates?: ('left' | 'top' | 'right' | 'bottom')[];
}
interface ElementEvent {
    type: ElementEventName;
    event: ZRRawEvent;
    target: Element;
    topTarget: Element;
    cancelBubble: boolean;
    offsetX: number;
    offsetY: number;
    gestureEvent: string;
    pinchX: number;
    pinchY: number;
    pinchScale: number;
    wheelDelta: number;
    zrByTouch: boolean;
    which: number;
    stop: (this: ElementEvent) => void;
}
declare type ElementEventCallback<Ctx, Impl> = (this: CbThis$1<Ctx, Impl>, e: ElementEvent) => boolean | void;
declare type CbThis$1<Ctx, Impl> = unknown extends Ctx ? Impl : Ctx;
interface ElementEventHandlerProps {
    onclick: ElementEventCallback<unknown, unknown>;
    ondblclick: ElementEventCallback<unknown, unknown>;
    onmouseover: ElementEventCallback<unknown, unknown>;
    onmouseout: ElementEventCallback<unknown, unknown>;
    onmousemove: ElementEventCallback<unknown, unknown>;
    onmousewheel: ElementEventCallback<unknown, unknown>;
    onmousedown: ElementEventCallback<unknown, unknown>;
    onmouseup: ElementEventCallback<unknown, unknown>;
    oncontextmenu: ElementEventCallback<unknown, unknown>;
    ondrag: ElementEventCallback<unknown, unknown>;
    ondragstart: ElementEventCallback<unknown, unknown>;
    ondragend: ElementEventCallback<unknown, unknown>;
    ondragenter: ElementEventCallback<unknown, unknown>;
    ondragleave: ElementEventCallback<unknown, unknown>;
    ondragover: ElementEventCallback<unknown, unknown>;
    ondrop: ElementEventCallback<unknown, unknown>;
}
interface ElementProps extends Partial<ElementEventHandlerProps>, Partial<Pick<Transformable, TransformProp>> {
    name?: string;
    ignore?: boolean;
    isGroup?: boolean;
    draggable?: boolean | 'horizontal' | 'vertical';
    silent?: boolean;
    ignoreClip?: boolean;
    globalScaleRatio?: number;
    textConfig?: ElementTextConfig;
    textContent?: ZRText;
    clipPath?: Path;
    drift?: Element['drift'];
    extra?: Dictionary<unknown>;
    anid?: string;
}
declare const PRIMARY_STATES_KEYS: ["x" | "y" | "originX" | "originY" | "anchorX" | "anchorY" | "rotation" | "scaleX" | "scaleY" | "skewX" | "skewY", "ignore"];
declare type ElementStatePropNames = (typeof PRIMARY_STATES_KEYS)[number] | 'textConfig';
declare type ElementState = Pick<ElementProps, ElementStatePropNames> & ElementCommonState;
declare type ElementCommonState = {
    hoverLayer?: boolean;
};
declare type ElementCalculateTextPosition = (out: TextPositionCalculationResult, style: ElementTextConfig, rect: RectLike) => TextPositionCalculationResult;
interface Element<Props extends ElementProps = ElementProps> extends Transformable, Eventful<{
    [key in ElementEventName]: (e: ElementEvent) => void | boolean;
} & {
    [key in string]: (...args: any) => void | boolean;
}>, ElementEventHandlerProps {
}
declare class Element<Props extends ElementProps = ElementProps> {
    id: number;
    type: string;
    name: string;
    ignore: boolean;
    silent: boolean;
    isGroup: boolean;
    draggable: boolean | 'horizontal' | 'vertical';
    dragging: boolean;
    parent: Group;
    animators: Animator<any>[];
    ignoreClip: boolean;
    __hostTarget: Element;
    __zr: ZRenderType;
    __dirty: number;
    __isRendered: boolean;
    __inHover: boolean;
    private _clipPath?;
    private _textContent?;
    private _textGuide?;
    textConfig?: ElementTextConfig;
    textGuideLineConfig?: ElementTextGuideLineConfig;
    anid: string;
    extra: Dictionary<unknown>;
    currentStates?: string[];
    prevStates?: string[];
    states: Dictionary<ElementState>;
    stateTransition: ElementAnimateConfig;
    stateProxy?: (stateName: string, targetStates?: string[]) => ElementState;
    protected _normalState: ElementState;
    private _innerTextDefaultStyle;
    constructor(props?: Props);
    protected _init(props?: Props): void;
    drift(dx: number, dy: number, e?: ElementEvent): void;
    beforeUpdate(): void;
    afterUpdate(): void;
    update(): void;
    updateInnerText(forceUpdate?: boolean): void;
    protected canBeInsideText(): boolean;
    protected getInsideTextFill(): string | undefined;
    protected getInsideTextStroke(textFill: string): string | undefined;
    protected getOutsideFill(): string | undefined;
    protected getOutsideStroke(textFill: string): string;
    traverse<Context>(cb: (this: Context, el: Element<Props>) => void, context?: Context): void;
    protected attrKV(key: string, value: unknown): void;
    hide(): void;
    show(): void;
    attr(keyOrObj: Props): this;
    attr<T extends keyof Props>(keyOrObj: T, value: Props[T]): this;
    saveCurrentToNormalState(toState: ElementState): void;
    protected _innerSaveToNormal(toState: ElementState): void;
    protected _savePrimaryToNormal(toState: Dictionary<any>, normalState: Dictionary<any>, primaryKeys: readonly string[]): void;
    hasState(): boolean;
    getState(name: string): ElementState;
    ensureState(name: string): ElementState;
    clearStates(noAnimation?: boolean): void;
    useState(stateName: string, keepCurrentStates?: boolean, noAnimation?: boolean, forceUseHoverLayer?: boolean): ElementState;
    useStates(states: string[], noAnimation?: boolean, forceUseHoverLayer?: boolean): void;
    private _updateAnimationTargets;
    removeState(state: string): void;
    replaceState(oldState: string, newState: string, forceAdd: boolean): void;
    toggleState(state: string, enable: boolean): void;
    protected _mergeStates(states: ElementState[]): ElementState;
    protected _applyStateObj(stateName: string, state: ElementState, normalState: ElementState, keepCurrentStates: boolean, transition: boolean, animationCfg: ElementAnimateConfig): void;
    private _attachComponent;
    private _detachComponent;
    getClipPath(): Path<PathProps>;
    setClipPath(clipPath: Path): void;
    removeClipPath(): void;
    getTextContent(): ZRText;
    setTextContent(textEl: ZRText): void;
    setTextConfig(cfg: ElementTextConfig): void;
    removeTextConfig(): void;
    removeTextContent(): void;
    getTextGuideLine(): Polyline;
    setTextGuideLine(guideLine: Polyline): void;
    removeTextGuideLine(): void;
    markRedraw(): void;
    dirty(): void;
    private _toggleHoverLayerFlag;
    addSelfToZr(zr: ZRenderType): void;
    removeSelfFromZr(zr: ZRenderType): void;
    animate(key?: string, loop?: boolean, allowDiscreteAnimation?: boolean): Animator<any>;
    addAnimator(animator: Animator<any>, key: string): void;
    updateDuringAnimation(key: string): void;
    stopAnimation(scope?: string, forwardToLast?: boolean): this;
    animateTo(target: Props, cfg?: ElementAnimateConfig, animationProps?: MapToType<Props, boolean>): void;
    animateFrom(target: Props, cfg: ElementAnimateConfig, animationProps?: MapToType<Props, boolean>): void;
    protected _transitionState(stateName: string, target: Props, cfg?: ElementAnimateConfig, animationProps?: MapToType<Props, boolean>): void;
    getBoundingRect(): BoundingRect;
    getPaintRect(): BoundingRect;
    calculateTextPosition: ElementCalculateTextPosition;
    protected static initDefaultProps: void;
}

interface CommonStyleProps {
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowColor?: string;
    opacity?: number;
    blend?: string;
}
interface DisplayableProps extends ElementProps {
    style?: Dictionary<any>;
    zlevel?: number;
    z?: number;
    z2?: number;
    culling?: boolean;
    cursor?: string;
    rectHover?: boolean;
    progressive?: boolean;
    incremental?: boolean;
    batch?: boolean;
    invisible?: boolean;
}
declare type DisplayableKey = keyof DisplayableProps;
declare type DisplayablePropertyType = PropType<DisplayableProps, DisplayableKey>;
declare type DisplayableStatePropNames = ElementStatePropNames | 'style' | 'z' | 'z2' | 'invisible';
declare type DisplayableState = Pick<DisplayableProps, DisplayableStatePropNames> & ElementCommonState;
interface Displayable<Props extends DisplayableProps = DisplayableProps> {
    animate(key?: '', loop?: boolean): Animator<this>;
    animate(key: 'style', loop?: boolean): Animator<this['style']>;
    getState(stateName: string): DisplayableState;
    ensureState(stateName: string): DisplayableState;
    states: Dictionary<DisplayableState>;
    stateProxy: (stateName: string) => DisplayableState;
}
declare class Displayable<Props extends DisplayableProps = DisplayableProps> extends Element<Props> {
    invisible: boolean;
    z: number;
    z2: number;
    zlevel: number;
    culling: boolean;
    cursor: string;
    rectHover: boolean;
    incremental: boolean;
    style: Dictionary<any>;
    protected _normalState: DisplayableState;
    protected _rect: BoundingRect;
    protected _paintRect: BoundingRect;
    protected _prevPaintRect: BoundingRect;
    dirtyRectTolerance: number;
    useHoverLayer?: boolean;
    __hoverStyle?: CommonStyleProps;
    __clipPaths?: Path[];
    __canvasFillGradient: CanvasGradient;
    __canvasStrokeGradient: CanvasGradient;
    __canvasFillPattern: CanvasPattern;
    __canvasStrokePattern: CanvasPattern;
    __svgEl: SVGElement;
    constructor(props?: Props);
    protected _init(props?: Props): void;
    beforeBrush(): void;
    afterBrush(): void;
    innerBeforeBrush(): void;
    innerAfterBrush(): void;
    shouldBePainted(viewWidth: number, viewHeight: number, considerClipPath: boolean, considerAncestors: boolean): boolean;
    contain(x: number, y: number): boolean;
    traverse<Context>(cb: (this: Context, el: this) => void, context?: Context): void;
    rectContain(x: number, y: number): boolean;
    getPaintRect(): BoundingRect;
    setPrevPaintRect(paintRect: BoundingRect): void;
    getPrevPaintRect(): BoundingRect;
    animateStyle(loop: boolean): Animator<this["style"]>;
    updateDuringAnimation(targetKey: string): void;
    attrKV(key: DisplayableKey, value: DisplayablePropertyType): void;
    setStyle(obj: Props['style']): this;
    setStyle<T extends keyof Props['style']>(obj: T, value: Props['style'][T]): this;
    dirtyStyle(notRedraw?: boolean): void;
    dirty(): void;
    styleChanged(): boolean;
    styleUpdated(): void;
    createStyle(obj?: Props['style']): Props["style"];
    useStyle(obj: Props['style']): void;
    isStyleObject(obj: Props['style']): any;
    protected _innerSaveToNormal(toState: DisplayableState): void;
    protected _applyStateObj(stateName: string, state: DisplayableState, normalState: DisplayableState, keepCurrentStates: boolean, transition: boolean, animationCfg: ElementAnimateConfig): void;
    protected _mergeStates(states: DisplayableState[]): DisplayableState;
    protected _mergeStyle(targetStyle: CommonStyleProps, sourceStyle: CommonStyleProps): CommonStyleProps;
    getAnimationStyleProps(): MapToType<DisplayableProps, boolean>;
    protected static initDefaultProps: void;
}

interface PainterBase {
    type: string;
    root?: HTMLElement;
    ssrOnly?: boolean;
    resize(width?: number | string, height?: number | string): void;
    refresh(): void;
    clear(): void;
    renderToString?(): string;
    getType: () => string;
    getWidth(): number;
    getHeight(): number;
    dispose(): void;
    getViewportRoot: () => HTMLElement;
    getViewportRootOffset: () => {
        offsetLeft: number;
        offsetTop: number;
    };
    refreshHover(): void;
    configLayer(zlevel: number, config: Dictionary<any>): void;
    setBackgroundColor(backgroundColor: string | GradientObject | PatternObject): void;
}

interface HandlerProxyInterface extends Eventful {
    handler: Handler;
    dispose: () => void;
    setCursor: (cursorStyle?: string) => void;
}

declare function shapeCompareFunc(a: Displayable, b: Displayable): number;
declare class Storage {
    private _roots;
    private _displayList;
    private _displayListLen;
    traverse<T>(cb: (this: T, el: Element) => void, context?: T): void;
    getDisplayList(update?: boolean, includeIgnore?: boolean): Displayable[];
    updateDisplayList(includeIgnore?: boolean): void;
    private _updateAndAddDisplayable;
    addRoot(el: Element): void;
    delRoot(el: Element | Element[]): void;
    delAllRoots(): void;
    getRoots(): Element<ElementProps>[];
    dispose(): void;
    displayableSortFunc: typeof shapeCompareFunc;
}

declare class HoveredResult {
    x: number;
    y: number;
    target: Displayable;
    topTarget: Displayable;
    constructor(x?: number, y?: number);
}
declare type HandlerName = 'click' | 'dblclick' | 'mousewheel' | 'mouseout' | 'mouseup' | 'mousedown' | 'mousemove' | 'contextmenu';
declare class Handler extends Eventful {
    storage: Storage;
    painter: PainterBase;
    painterRoot: HTMLElement;
    proxy: HandlerProxyInterface;
    private _hovered;
    private _gestureMgr;
    private _draggingMgr;
    _downEl: Element;
    _upEl: Element;
    _downPoint: [number, number];
    constructor(storage: Storage, painter: PainterBase, proxy: HandlerProxyInterface, painterRoot: HTMLElement);
    setHandlerProxy(proxy: HandlerProxyInterface): void;
    mousemove(event: ZRRawEvent): void;
    mouseout(event: ZRRawEvent): void;
    resize(): void;
    dispatch(eventName: HandlerName, eventArgs?: any): void;
    dispose(): void;
    setCursorStyle(cursorStyle: string): void;
    dispatchToElement(targetInfo: {
        target?: Element;
        topTarget?: Element;
    }, eventName: ElementEventName, event: ZRRawEvent): void;
    findHover(x: number, y: number, exclude?: Displayable): HoveredResult;
    processGesture(event: ZRRawEvent, stage?: 'start' | 'end' | 'change'): void;
    click: (event: ZRRawEvent) => void;
    mousedown: (event: ZRRawEvent) => void;
    mouseup: (event: ZRRawEvent) => void;
    mousewheel: (event: ZRRawEvent) => void;
    dblclick: (event: ZRRawEvent) => void;
    contextmenu: (event: ZRRawEvent) => void;
}

interface LayerConfig {
    clearColor?: string | GradientObject | ImagePatternObject;
    motionBlur?: boolean;
    lastFrameAlpha?: number;
}

/*!
* ZRender, a high performance 2d drawing library.
*
* Copyright (c) 2013, Baidu Inc.
* All rights reserved.
*
* LICENSE
* https://github.com/ecomfe/zrender/blob/master/LICENSE.txt
*/

declare type PainterBaseCtor = {
    new (dom: HTMLElement, storage: Storage, ...args: any[]): PainterBase;
};
declare class ZRender {
    dom?: HTMLElement;
    id: number;
    storage: Storage;
    painter: PainterBase;
    handler: Handler;
    animation: Animation;
    private _sleepAfterStill;
    private _stillFrameAccum;
    private _needsRefresh;
    private _needsRefreshHover;
    private _darkMode;
    private _backgroundColor;
    constructor(id: number, dom?: HTMLElement, opts?: ZRenderInitOpt);
    add(el: Element): void;
    remove(el: Element): void;
    configLayer(zLevel: number, config: LayerConfig): void;
    setBackgroundColor(backgroundColor: string | GradientObject | PatternObject): void;
    getBackgroundColor(): string | GradientObject | PatternObject;
    setDarkMode(darkMode: boolean): void;
    isDarkMode(): boolean;
    refreshImmediately(fromInside?: boolean): void;
    refresh(): void;
    flush(): void;
    private _flush;
    setSleepAfterStill(stillFramesCount: number): void;
    wakeUp(): void;
    refreshHover(): void;
    refreshHoverImmediately(): void;
    resize(opts?: {
        width?: number | string;
        height?: number | string;
    }): void;
    clearAnimation(): void;
    getWidth(): number;
    getHeight(): number;
    setCursorStyle(cursorStyle: string): void;
    findHover(x: number, y: number): {
        target: Displayable;
        topTarget: Displayable;
    };
    on<Ctx>(eventName: ElementEventName, eventHandler: ElementEventCallback<Ctx, ZRenderType>, context?: Ctx): this;
    on<Ctx>(eventName: string, eventHandler: WithThisType<EventCallback<any[]>, unknown extends Ctx ? ZRenderType : Ctx>, context?: Ctx): this;
    off(eventName?: string, eventHandler?: EventCallback): void;
    trigger(eventName: string, event?: unknown): void;
    clear(): void;
    dispose(): void;
}
interface ZRenderInitOpt {
    renderer?: string;
    devicePixelRatio?: number;
    width?: number | string;
    height?: number | string;
    useDirtyRect?: boolean;
    ssr?: boolean;
}
declare function init(dom?: HTMLElement | null, opts?: ZRenderInitOpt): ZRender;
declare function dispose(zr: ZRender): void;
declare function disposeAll(): void;
declare function getInstance(id: number): ZRender;
declare function registerPainter(name: string, Ctor: PainterBaseCtor): void;
declare const version = "5.3.2";
interface ZRenderType extends ZRender {
}

type zrender_d_ZRenderInitOpt = ZRenderInitOpt;
declare const zrender_d_init: typeof init;
declare const zrender_d_dispose: typeof dispose;
declare const zrender_d_disposeAll: typeof disposeAll;
declare const zrender_d_getInstance: typeof getInstance;
declare const zrender_d_registerPainter: typeof registerPainter;
declare const zrender_d_version: typeof version;
type zrender_d_ZRenderType = ZRenderType;
declare namespace zrender_d {
  export {
    zrender_d_ZRenderInitOpt as ZRenderInitOpt,
    zrender_d_init as init,
    zrender_d_dispose as dispose,
    zrender_d_disposeAll as disposeAll,
    zrender_d_getInstance as getInstance,
    zrender_d_registerPainter as registerPainter,
    zrender_d_version as version,
    zrender_d_ZRenderType as ZRenderType,
  };
}

declare const nativeSlice: (start?: number, end?: number) => any[];
declare function guid(): number;
declare function logError(...args: any[]): void;
declare function clone$2<T extends any>(source: T): T;
declare function merge<T extends Dictionary<any>, S extends Dictionary<any>>(target: T, source: S, overwrite?: boolean): T & S;
declare function merge<T extends any, S extends any>(target: T, source: S, overwrite?: boolean): T | S;
declare function mergeAll(targetAndSources: any[], overwrite?: boolean): any;
declare function extend<T extends Dictionary<any>, S extends Dictionary<any>>(target: T, source: S): T & S;
declare function defaults<T extends Dictionary<any>, S extends Dictionary<any>>(target: T, source: S, overlay?: boolean): T & S;
declare const createCanvas: () => HTMLCanvasElement;
declare function indexOf<T>(array: T[] | readonly T[] | ArrayLike$1<T>, value: T): number;
declare function inherits(clazz: Function, baseClazz: Function): void;
declare function mixin<T, S>(target: T | Function, source: S | Function, override?: boolean): void;
declare function isArrayLike(data: any): data is ArrayLike$1<any>;
declare function each<I extends Dictionary<any> | any[] | readonly any[] | ArrayLike$1<any>, Context>(arr: I, cb: (this: Context, value: I extends (infer T)[] | readonly (infer T)[] | ArrayLike$1<infer T> ? T : I extends Dictionary<any> ? I extends Record<infer K, infer T> ? T : unknown : unknown, index?: I extends any[] | readonly any[] | ArrayLike$1<any> ? number : keyof I & string, arr?: I) => void, context?: Context): void;
declare function map<T, R, Context>(arr: readonly T[], cb: (this: Context, val: T, index?: number, arr?: readonly T[]) => R, context?: Context): R[];
declare function reduce<T, S, Context>(arr: readonly T[], cb: (this: Context, previousValue: S, currentValue: T, currentIndex?: number, arr?: readonly T[]) => S, memo?: S, context?: Context): S;
declare function filter<T, Context>(arr: readonly T[], cb: (this: Context, value: T, index: number, arr: readonly T[]) => boolean, context?: Context): T[];
declare function find<T, Context>(arr: readonly T[], cb: (this: Context, value: T, index?: number, arr?: readonly T[]) => boolean, context?: Context): T;
declare function keys<T extends object>(obj: T): (KeyOfDistributive<T> & string)[];
declare type Bind1<F, Ctx> = F extends (this: Ctx, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Bind2<F, Ctx, T1> = F extends (this: Ctx, a: T1, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Bind3<F, Ctx, T1, T2> = F extends (this: Ctx, a: T1, b: T2, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Bind4<F, Ctx, T1, T2, T3> = F extends (this: Ctx, a: T1, b: T2, c: T3, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Bind5<F, Ctx, T1, T2, T3, T4> = F extends (this: Ctx, a: T1, b: T2, c: T3, d: T4, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type BindFunc<Ctx> = (this: Ctx, ...arg: any[]) => any;
interface FunctionBind {
    <F extends BindFunc<Ctx>, Ctx>(func: F, ctx: Ctx): Bind1<F, Ctx>;
    <F extends BindFunc<Ctx>, Ctx, T1 extends Parameters<F>[0]>(func: F, ctx: Ctx, a: T1): Bind2<F, Ctx, T1>;
    <F extends BindFunc<Ctx>, Ctx, T1 extends Parameters<F>[0], T2 extends Parameters<F>[1]>(func: F, ctx: Ctx, a: T1, b: T2): Bind3<F, Ctx, T1, T2>;
    <F extends BindFunc<Ctx>, Ctx, T1 extends Parameters<F>[0], T2 extends Parameters<F>[1], T3 extends Parameters<F>[2]>(func: F, ctx: Ctx, a: T1, b: T2, c: T3): Bind4<F, Ctx, T1, T2, T3>;
    <F extends BindFunc<Ctx>, Ctx, T1 extends Parameters<F>[0], T2 extends Parameters<F>[1], T3 extends Parameters<F>[2], T4 extends Parameters<F>[3]>(func: F, ctx: Ctx, a: T1, b: T2, c: T3, d: T4): Bind5<F, Ctx, T1, T2, T3, T4>;
}
declare const bind: FunctionBind;
declare type Curry1<F, T1> = F extends (a: T1, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Curry2<F, T1, T2> = F extends (a: T1, b: T2, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Curry3<F, T1, T2, T3> = F extends (a: T1, b: T2, c: T3, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type Curry4<F, T1, T2, T3, T4> = F extends (a: T1, b: T2, c: T3, d: T4, ...args: infer A) => infer R ? (...args: A) => R : unknown;
declare type CurryFunc = (...arg: any[]) => any;
declare function curry<F extends CurryFunc, T1 extends Parameters<F>[0]>(func: F, a: T1): Curry1<F, T1>;
declare function curry<F extends CurryFunc, T1 extends Parameters<F>[0], T2 extends Parameters<F>[1]>(func: F, a: T1, b: T2): Curry2<F, T1, T2>;
declare function curry<F extends CurryFunc, T1 extends Parameters<F>[0], T2 extends Parameters<F>[1], T3 extends Parameters<F>[2]>(func: F, a: T1, b: T2, c: T3): Curry3<F, T1, T2, T3>;
declare function curry<F extends CurryFunc, T1 extends Parameters<F>[0], T2 extends Parameters<F>[1], T3 extends Parameters<F>[2], T4 extends Parameters<F>[3]>(func: F, a: T1, b: T2, c: T3, d: T4): Curry4<F, T1, T2, T3, T4>;

declare function isArray(value: any): value is any[];
declare function isFunction(value: any): value is Function;
declare function isString(value: any): value is string;
declare function isStringSafe(value: any): value is string;
declare function isNumber(value: any): value is number;
declare function isObject<T = unknown>(value: T): value is (object & T);
declare function isBuiltInObject(value: any): boolean;
declare function isTypedArray(value: any): boolean;
declare function isDom(value: any): value is HTMLElement;
declare function isGradientObject(value: any): value is GradientObject;
declare function isImagePatternObject(value: any): value is ImagePatternObject;
declare function isRegExp(value: unknown): value is RegExp;
declare function eqNaN(value: any): boolean;
declare function retrieve<T>(...args: T[]): T;
declare function retrieve2<T, R>(value0: T, value1: R): T | R;
declare function retrieve3<T, R, W>(value0: T, value1: R, value2: W): T | R | W;
declare type SliceParams = Parameters<typeof nativeSlice>;
declare function slice<T>(arr: ArrayLike$1<T>, ...args: SliceParams): T[];
declare function normalizeCssArray(val: number | number[]): number[];
declare function assert(condition: any, message?: string): void;
declare function trim(str: string): string;
declare function setAsPrimitive(obj: any): void;
declare function isPrimitive(obj: any): boolean;
declare class HashMap<T, KEY extends string | number = string | number> {
    data: {
        [key in KEY]: T;
    };
    constructor(obj?: HashMap<T, KEY> | {
        [key in KEY]?: T;
    } | KEY[]);
    get(key: KEY): T;
    set(key: KEY, value: T): T;
    each<Context>(cb: (this: Context, value?: T, key?: KEY) => void, context?: Context): void;
    keys(): KEY[];
    removeKey(key: KEY): void;
}
declare function createHashMap<T, KEY extends string | number = string | number>(obj?: HashMap<T, KEY> | {
    [key in KEY]?: T;
} | KEY[]): HashMap<T, KEY>;
declare function concatArray<T, R>(a: ArrayLike$1<T>, b: ArrayLike$1<R>): ArrayLike$1<T | R>;
declare function createObject<T>(proto?: object, properties?: T): T;
declare function disableUserSelect(dom: HTMLElement): void;
declare function hasOwn(own: object, prop: string): boolean;
declare function noop(): void;
declare const RADIAN_TO_DEGREE: number;

declare const util_d_curry: typeof curry;
declare const util_d_guid: typeof guid;
declare const util_d_logError: typeof logError;
declare const util_d_merge: typeof merge;
declare const util_d_mergeAll: typeof mergeAll;
declare const util_d_extend: typeof extend;
declare const util_d_defaults: typeof defaults;
declare const util_d_createCanvas: typeof createCanvas;
declare const util_d_indexOf: typeof indexOf;
declare const util_d_inherits: typeof inherits;
declare const util_d_mixin: typeof mixin;
declare const util_d_isArrayLike: typeof isArrayLike;
declare const util_d_each: typeof each;
declare const util_d_map: typeof map;
declare const util_d_reduce: typeof reduce;
declare const util_d_filter: typeof filter;
declare const util_d_find: typeof find;
declare const util_d_keys: typeof keys;
type util_d_Bind1<F, Ctx> = Bind1<F, Ctx>;
type util_d_Bind2<F, Ctx, T1> = Bind2<F, Ctx, T1>;
type util_d_Bind3<F, Ctx, T1, T2> = Bind3<F, Ctx, T1, T2>;
type util_d_Bind4<F, Ctx, T1, T2, T3> = Bind4<F, Ctx, T1, T2, T3>;
type util_d_Bind5<F, Ctx, T1, T2, T3, T4> = Bind5<F, Ctx, T1, T2, T3, T4>;
declare const util_d_bind: typeof bind;
type util_d_Curry1<F, T1> = Curry1<F, T1>;
type util_d_Curry2<F, T1, T2> = Curry2<F, T1, T2>;
type util_d_Curry3<F, T1, T2, T3> = Curry3<F, T1, T2, T3>;
type util_d_Curry4<F, T1, T2, T3, T4> = Curry4<F, T1, T2, T3, T4>;
declare const util_d_isArray: typeof isArray;
declare const util_d_isFunction: typeof isFunction;
declare const util_d_isString: typeof isString;
declare const util_d_isStringSafe: typeof isStringSafe;
declare const util_d_isNumber: typeof isNumber;
declare const util_d_isObject: typeof isObject;
declare const util_d_isBuiltInObject: typeof isBuiltInObject;
declare const util_d_isTypedArray: typeof isTypedArray;
declare const util_d_isDom: typeof isDom;
declare const util_d_isGradientObject: typeof isGradientObject;
declare const util_d_isImagePatternObject: typeof isImagePatternObject;
declare const util_d_isRegExp: typeof isRegExp;
declare const util_d_eqNaN: typeof eqNaN;
declare const util_d_retrieve: typeof retrieve;
declare const util_d_retrieve2: typeof retrieve2;
declare const util_d_retrieve3: typeof retrieve3;
declare const util_d_slice: typeof slice;
declare const util_d_normalizeCssArray: typeof normalizeCssArray;
declare const util_d_assert: typeof assert;
declare const util_d_trim: typeof trim;
declare const util_d_setAsPrimitive: typeof setAsPrimitive;
declare const util_d_isPrimitive: typeof isPrimitive;
type util_d_HashMap<T, KEY extends string | number = string | number> = HashMap<T, KEY>;
declare const util_d_HashMap: typeof HashMap;
declare const util_d_createHashMap: typeof createHashMap;
declare const util_d_concatArray: typeof concatArray;
declare const util_d_createObject: typeof createObject;
declare const util_d_disableUserSelect: typeof disableUserSelect;
declare const util_d_hasOwn: typeof hasOwn;
declare const util_d_noop: typeof noop;
declare const util_d_RADIAN_TO_DEGREE: typeof RADIAN_TO_DEGREE;
declare namespace util_d {
  export {
    util_d_curry as curry,
    util_d_guid as guid,
    util_d_logError as logError,
    clone$2 as clone,
    util_d_merge as merge,
    util_d_mergeAll as mergeAll,
    util_d_extend as extend,
    util_d_defaults as defaults,
    util_d_createCanvas as createCanvas,
    util_d_indexOf as indexOf,
    util_d_inherits as inherits,
    util_d_mixin as mixin,
    util_d_isArrayLike as isArrayLike,
    util_d_each as each,
    util_d_map as map,
    util_d_reduce as reduce,
    util_d_filter as filter,
    util_d_find as find,
    util_d_keys as keys,
    util_d_Bind1 as Bind1,
    util_d_Bind2 as Bind2,
    util_d_Bind3 as Bind3,
    util_d_Bind4 as Bind4,
    util_d_Bind5 as Bind5,
    util_d_bind as bind,
    util_d_Curry1 as Curry1,
    util_d_Curry2 as Curry2,
    util_d_Curry3 as Curry3,
    util_d_Curry4 as Curry4,
    util_d_isArray as isArray,
    util_d_isFunction as isFunction,
    util_d_isString as isString,
    util_d_isStringSafe as isStringSafe,
    util_d_isNumber as isNumber,
    util_d_isObject as isObject,
    util_d_isBuiltInObject as isBuiltInObject,
    util_d_isTypedArray as isTypedArray,
    util_d_isDom as isDom,
    util_d_isGradientObject as isGradientObject,
    util_d_isImagePatternObject as isImagePatternObject,
    util_d_isRegExp as isRegExp,
    util_d_eqNaN as eqNaN,
    util_d_retrieve as retrieve,
    util_d_retrieve2 as retrieve2,
    util_d_retrieve3 as retrieve3,
    util_d_slice as slice,
    util_d_normalizeCssArray as normalizeCssArray,
    util_d_assert as assert,
    util_d_trim as trim,
    util_d_setAsPrimitive as setAsPrimitive,
    util_d_isPrimitive as isPrimitive,
    util_d_HashMap as HashMap,
    util_d_createHashMap as createHashMap,
    util_d_concatArray as concatArray,
    util_d_createObject as createObject,
    util_d_disableUserSelect as disableUserSelect,
    util_d_hasOwn as hasOwn,
    util_d_noop as noop,
    util_d_RADIAN_TO_DEGREE as RADIAN_TO_DEGREE,
  };
}

interface InnerTruncateOption {
    maxIteration?: number;
    minChar?: number;
    placeholder?: string;
    maxIterations?: number;
}
declare function truncateText(text: string, containerWidth: number, font: string, ellipsis: string, options: InnerTruncateOption): string;

declare type SVGPathOption = Omit<PathProps, 'shape' | 'buildPath'>;
declare class SVGPath extends Path {
    applyTransform(m: MatrixArray): void;
}
declare function extendFromString(str: string, defaultOpts?: SVGPathOption): typeof SVGPath;
declare function mergePath(pathEls: Path[], opts: PathProps): Path<PathProps>;

declare class CircleShape {
    cx: number;
    cy: number;
    r: number;
}
interface CircleProps extends PathProps {
    shape?: Partial<CircleShape>;
}
declare class Circle extends Path<CircleProps> {
    shape: CircleShape;
    constructor(opts?: CircleProps);
    getDefaultShape(): CircleShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: CircleShape): void;
}

declare class EllipseShape {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
}
interface EllipseProps extends PathProps {
    shape?: Partial<EllipseShape>;
}
declare class Ellipse extends Path<EllipseProps> {
    shape: EllipseShape;
    constructor(opts?: EllipseProps);
    getDefaultShape(): EllipseShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: EllipseShape): void;
}

declare class SectorShape {
    cx: number;
    cy: number;
    r0: number;
    r: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
    cornerRadius: number | number[];
}
interface SectorProps extends PathProps {
    shape?: Partial<SectorShape>;
}
declare class Sector extends Path<SectorProps> {
    shape: SectorShape;
    constructor(opts?: SectorProps);
    getDefaultShape(): SectorShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: SectorShape): void;
    isZeroArea(): boolean;
}

declare class RingShape {
    cx: number;
    cy: number;
    r: number;
    r0: number;
}
interface RingProps extends PathProps {
    shape?: Partial<RingShape>;
}
declare class Ring extends Path<RingProps> {
    shape: RingShape;
    constructor(opts?: RingProps);
    getDefaultShape(): RingShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: RingShape): void;
}

declare class PolygonShape {
    points: VectorArray[];
    smooth?: number;
    smoothConstraint?: VectorArray[];
}
interface PolygonProps extends PathProps {
    shape?: Partial<PolygonShape>;
}
declare class Polygon extends Path<PolygonProps> {
    shape: PolygonShape;
    constructor(opts?: PolygonProps);
    getDefaultShape(): PolygonShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: PolygonShape): void;
}

declare class LineShape {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    percent: number;
}
interface LineProps extends PathProps {
    shape?: Partial<LineShape>;
}
declare class Line extends Path<LineProps> {
    shape: LineShape;
    constructor(opts?: LineProps);
    getDefaultStyle(): {
        stroke: string;
        fill: string;
    };
    getDefaultShape(): LineShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: LineShape): void;
    pointAt(p: number): VectorArray;
}

declare class BezierCurveShape {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    cpx1: number;
    cpy1: number;
    cpx2?: number;
    cpy2?: number;
    percent: number;
}
interface BezierCurveProps extends PathProps {
    shape?: Partial<BezierCurveShape>;
}
declare class BezierCurve extends Path<BezierCurveProps> {
    shape: BezierCurveShape;
    constructor(opts?: BezierCurveProps);
    getDefaultStyle(): {
        stroke: string;
        fill: string;
    };
    getDefaultShape(): BezierCurveShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: BezierCurveShape): void;
    pointAt(t: number): number[];
    tangentAt(t: number): number[];
}

declare class ArcShape {
    cx: number;
    cy: number;
    r: number;
    startAngle: number;
    endAngle: number;
    clockwise?: boolean;
}
interface ArcProps extends PathProps {
    shape?: Partial<ArcShape>;
}
declare class Arc extends Path<ArcProps> {
    shape: ArcShape;
    constructor(opts?: ArcProps);
    getDefaultStyle(): {
        stroke: string;
        fill: string;
    };
    getDefaultShape(): ArcShape;
    buildPath(ctx: CanvasRenderingContext2D, shape: ArcShape): void;
}

interface CompoundPathShape {
    paths: Path[];
}
declare class CompoundPath extends Path {
    type: string;
    shape: CompoundPathShape;
    private _updatePathDirty;
    beforeBrush(): void;
    buildPath(ctx: PathProxy | CanvasRenderingContext2D, shape: CompoundPathShape): void;
    afterBrush(): void;
    getBoundingRect(): BoundingRect;
}

declare class IncrementalDisplayable extends Displayable {
    notClear: boolean;
    incremental: boolean;
    private _displayables;
    private _temporaryDisplayables;
    private _cursor;
    traverse<T>(cb: (this: T, el: this) => void, context: T): void;
    useStyle(): void;
    getCursor(): number;
    innerAfterBrush(): void;
    clearDisplaybles(): void;
    clearTemporalDisplayables(): void;
    addDisplayable(displayable: Displayable, notPersistent?: boolean): void;
    addDisplayables(displayables: Displayable[], notPersistent?: boolean): void;
    getDisplayables(): Displayable[];
    getTemporalDisplayables(): Displayable[];
    eachPendingDisplayable(cb: (displayable: Displayable) => void): void;
    update(): void;
    getBoundingRect(): BoundingRect;
    contain(x: number, y: number): boolean;
}

declare type Constructor = new (...args: any) => any;
interface ClassManager {
    registerClass: (clz: Constructor) => Constructor;
    getClass: (componentMainType: ComponentMainType, subType?: ComponentSubType, throwWhenNotFound?: boolean) => Constructor;
    getClassesByMainType: (componentType: ComponentMainType) => Constructor[];
    hasClass: (componentType: ComponentFullType) => boolean;
    getAllClassMainTypes: () => ComponentMainType[];
    hasSubTypes: (componentType: ComponentFullType) => boolean;
}

interface SubTypeDefaulter {
    (option: ComponentOption): ComponentSubType;
}
interface SubTypeDefaulterManager {
    registerSubTypeDefaulter: (componentType: string, defaulter: SubTypeDefaulter) => void;
    determineSubType: (componentType: string, option: ComponentOption) => string;
}

declare type DiffKeyGetter<CTX = unknown> = (this: DataDiffer<CTX>, value: unknown, index: number) => string;
declare type DiffCallbackAdd = (newIndex: number) => void;
declare type DiffCallbackUpdate = (newIndex: number, oldIndex: number) => void;
declare type DiffCallbackRemove = (oldIndex: number) => void;
declare type DiffCallbackUpdateManyToOne = (newIndex: number, oldIndex: number[]) => void;
declare type DiffCallbackUpdateOneToMany = (newIndex: number[], oldIndex: number) => void;
declare type DiffCallbackUpdateManyToMany = (newIndex: number[], oldIndex: number[]) => void;
declare type DataDiffMode = 'oneToOne' | 'multiple';
declare class DataDiffer<CTX = unknown> {
    private _old;
    private _new;
    private _oldKeyGetter;
    private _newKeyGetter;
    private _add;
    private _update;
    private _updateManyToOne;
    private _updateOneToMany;
    private _updateManyToMany;
    private _remove;
    private _diffModeMultiple;
    readonly context: CTX;
    /**
     * @param context Can be visited by this.context in callback.
     */
    constructor(oldArr: ArrayLike$1<unknown>, newArr: ArrayLike$1<unknown>, oldKeyGetter?: DiffKeyGetter<CTX>, newKeyGetter?: DiffKeyGetter<CTX>, context?: CTX, diffMode?: DataDiffMode);
    /**
     * Callback function when add a data
     */
    add(func: DiffCallbackAdd): this;
    /**
     * Callback function when update a data
     */
    update(func: DiffCallbackUpdate): this;
    /**
     * Callback function when update a data and only work in `cbMode: 'byKey'`.
     */
    updateManyToOne(func: DiffCallbackUpdateManyToOne): this;
    /**
     * Callback function when update a data and only work in `cbMode: 'byKey'`.
     */
    updateOneToMany(func: DiffCallbackUpdateOneToMany): this;
    /**
     * Callback function when update a data and only work in `cbMode: 'byKey'`.
     */
    updateManyToMany(func: DiffCallbackUpdateManyToMany): this;
    /**
     * Callback function when remove a data
     */
    remove(func: DiffCallbackRemove): this;
    execute(): void;
    private _executeOneToOne;
    /**
     * For example, consider the case:
     * oldData: [o0, o1, o2, o3, o4, o5, o6, o7],
     * newData: [n0, n1, n2, n3, n4, n5, n6, n7, n8],
     * Where:
     *     o0, o1, n0 has key 'a' (many to one)
     *     o5, n4, n5, n6 has key 'b' (one to many)
     *     o2, n1 has key 'c' (one to one)
     *     n2, n3 has key 'd' (add)
     *     o3, o4 has key 'e' (remove)
     *     o6, o7, n7, n8 has key 'f' (many to many, treated as add and remove)
     * Then:
     *     (The order of the following directives are not ensured.)
     *     this._updateManyToOne(n0, [o0, o1]);
     *     this._updateOneToMany([n4, n5, n6], o5);
     *     this._update(n1, o2);
     *     this._remove(o3);
     *     this._remove(o4);
     *     this._remove(o6);
     *     this._remove(o7);
     *     this._add(n2);
     *     this._add(n3);
     *     this._add(n7);
     *     this._add(n8);
     */
    private _executeMultiple;
    private _performRestAdd;
    private _initIndexMap;
}

declare type PipedDataTransformOption = DataTransformOption[];
declare type DataTransformType = string;
declare type DataTransformConfig = unknown;
interface DataTransformOption {
    type: DataTransformType;
    config?: DataTransformConfig;
    print?: boolean;
}
interface ExternalDataTransform<TO extends DataTransformOption = DataTransformOption> {
    type: string;
    __isBuiltIn?: boolean;
    transform: (param: ExternalDataTransformParam<TO>) => ExternalDataTransformResultItem | ExternalDataTransformResultItem[];
}
interface ExternalDataTransformParam<TO extends DataTransformOption = DataTransformOption> {
    upstream: ExternalSource;
    upstreamList: ExternalSource[];
    config: TO['config'];
}
interface ExternalDataTransformResultItem {
    /**
     * If `data` is null/undefined, inherit upstream data.
     */
    data: OptionSourceDataArrayRows | OptionSourceDataObjectRows;
    /**
     * A `transform` can optionally return a dimensions definition.
     * The rule:
     * If this `transform result` have different dimensions from the upstream, it should return
     * a new dimension definition. For example, this transform inherit the upstream data totally
     * but add a extra dimension.
     * Otherwise, do not need to return that dimension definition. echarts will inherit dimension
     * definition from the upstream.
     */
    dimensions?: DimensionDefinitionLoose[];
}
declare type DataTransformDataItem = ExternalDataTransformResultItem['data'][number];
interface ExternalDimensionDefinition extends Partial<DimensionDefinition> {
    index: DimensionIndex;
}
/**
 * TODO: disable writable.
 * This structure will be exposed to users.
 */
declare class ExternalSource {
    /**
     * [Caveat]
     * This instance is to be exposed to users.
     * (1) DO NOT mount private members on this instance directly.
     * If we have to use private members, we can make them in closure or use `makeInner`.
     * (2) "soruce header count" is not provided to transform, because it's complicated to manage
     * header and dimensions definition in each transfrom. Source header are all normalized to
     * dimensions definitions in transforms and their downstreams.
     */
    sourceFormat: SourceFormat;
    getRawData(): Source['data'];
    getRawDataItem(dataIndex: number): DataTransformDataItem;
    cloneRawData(): Source['data'];
    /**
     * @return If dimension not found, return null/undefined.
     */
    getDimensionInfo(dim: DimensionLoose): ExternalDimensionDefinition;
    /**
     * dimensions defined if and only if either:
     * (a) dataset.dimensions are declared.
     * (b) dataset data include dimensions definitions in data (detected or via specified `sourceHeader`).
     * If dimensions are defined, `dimensionInfoAll` is corresponding to
     * the defined dimensions.
     * Otherwise, `dimensionInfoAll` is determined by data columns.
     * @return Always return an array (even empty array).
     */
    cloneAllDimensionInfo(): ExternalDimensionDefinition[];
    count(): number;
    /**
     * Only support by dimension index.
     * No need to support by dimension name in transform function,
     * becuase transform function is not case-specific, no need to use name literally.
     */
    retrieveValue(dataIndex: number, dimIndex: DimensionIndex): OptionDataValue;
    retrieveValueFromItem(dataItem: DataTransformDataItem, dimIndex: DimensionIndex): OptionDataValue;
    convertValue(rawVal: unknown, dimInfo: ExternalDimensionDefinition): ParsedValue;
}
declare function registerExternalTransform(externalTransform: ExternalDataTransform): void;

interface PaletteMixin<T extends PaletteOptionMixin = PaletteOptionMixin> extends Pick<Model<T>, 'get'> {
}
declare class PaletteMixin<T extends PaletteOptionMixin = PaletteOptionMixin> {
    getColorFromPalette(this: PaletteMixin<T>, name: string, scope?: any, requestNum?: number): ZRColor;
    clearColorPalette(this: PaletteMixin<T>): void;
}

interface ComponentView {
    /**
     * Implement it if needed.
     */
    updateTransform?(model: ComponentModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void | {
        update: true;
    };
    /**
     * Pass only when return `true`.
     * Implement it if needed.
     */
    filterForExposedEvent(eventType: string, query: EventQueryItem, targetEl: Element, packedEvent: ECActionEvent | ECElementEvent): boolean;
    /**
     * Find dispatchers for highlight/downplay by name.
     * If this methods provided, hover link (within the same name) is enabled in component.
     * That is, in component, a name can correspond to multiple dispatchers.
     * Those dispatchers can have no common ancestor.
     * The highlight/downplay state change will be applied on the
     * dispatchers and their descendents.
     *
     * @return Must return an array but not null/undefined.
     */
    findHighDownDispatchers?(name: string): Element[];
    focusBlurEnabled?: boolean;
}
declare class ComponentView {
    readonly group: ViewRootGroup;
    readonly uid: string;
    __model: ComponentModel;
    __alive: boolean;
    __id: string;
    constructor();
    init(ecModel: GlobalModel, api: ExtensionAPI): void;
    render(model: ComponentModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    dispose(ecModel: GlobalModel, api: ExtensionAPI): void;
    updateView(model: ComponentModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    updateLayout(model: ComponentModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    updateVisual(model: ComponentModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Hook for toggle blur target series.
     * Can be used in marker for blur or leave blur the markers
     */
    toggleBlurSeries(seriesModels: SeriesModel[], isBlur: boolean, ecModel: GlobalModel): void;
    /**
     * Traverse the new rendered elements.
     *
     * It will traverse the new added element in progressive rendering.
     * And traverse all in normal rendering.
     */
    eachRendered(cb: (el: Element) => boolean | void): void;
    static registerClass: ClassManager['registerClass'];
}

interface TaskContext {
    outputData?: SeriesData;
    data?: SeriesData;
    payload?: Payload;
    model?: SeriesModel;
}
declare type TaskResetCallback<Ctx extends TaskContext> = (this: Task<Ctx>, context: Ctx) => TaskResetCallbackReturn<Ctx>;
declare type TaskResetCallbackReturn<Ctx extends TaskContext> = void | (TaskProgressCallback<Ctx> | TaskProgressCallback<Ctx>[]) | {
    forceFirstProgress?: boolean;
    progress: TaskProgressCallback<Ctx> | TaskProgressCallback<Ctx>[];
};
declare type TaskProgressCallback<Ctx extends TaskContext> = (this: Task<Ctx>, params: TaskProgressParams, context: Ctx) => void;
declare type TaskProgressParams = {
    start: number;
    end: number;
    count: number;
    next?: TaskDataIteratorNext;
};
declare type TaskPlanCallback<Ctx extends TaskContext> = (this: Task<Ctx>, context: Ctx) => TaskPlanCallbackReturn;
declare type TaskPlanCallbackReturn = 'reset' | false | null | undefined;
declare type TaskCountCallback<Ctx extends TaskContext> = (this: Task<Ctx>, context: Ctx) => number;
declare type TaskOnDirtyCallback<Ctx extends TaskContext> = (this: Task<Ctx>, context: Ctx) => void;
declare type TaskDataIteratorNext = () => number;
declare type TaskDefineParam<Ctx extends TaskContext> = {
    reset?: TaskResetCallback<Ctx>;
    plan?: TaskPlanCallback<Ctx>;
    count?: TaskCountCallback<Ctx>;
    onDirty?: TaskOnDirtyCallback<Ctx>;
};
declare type PerformArgs = {
    step?: number;
    skip?: boolean;
    modBy?: number;
    modDataCount?: number;
};
declare class Task<Ctx extends TaskContext> {
    private _reset;
    private _plan;
    private _count;
    private _onDirty;
    private _progress;
    private _callingProgress;
    private _dirty;
    private _modBy;
    private _modDataCount;
    private _upstream;
    private _downstream;
    private _dueEnd;
    private _outputDueEnd;
    private _settedOutputEnd;
    private _dueIndex;
    private _disposed;
    __pipeline: Pipeline;
    __idxInPipeline: number;
    __block: boolean;
    context: Ctx;
    constructor(define: TaskDefineParam<Ctx>);
    /**
     * @param step Specified step.
     * @param skip Skip customer perform call.
     * @param modBy Sampling window size.
     * @param modDataCount Sampling count.
     * @return whether unfinished.
     */
    perform(performArgs?: PerformArgs): boolean;
    dirty(): void;
    private _doProgress;
    private _doReset;
    unfinished(): boolean;
    /**
     * @param downTask The downstream task.
     * @return The downstream task.
     */
    pipe(downTask: Task<Ctx>): void;
    dispose(): void;
    getUpstream(): Task<Ctx>;
    getDownstream(): Task<Ctx>;
    setOutputEnd(end: number): void;
}

declare type GeneralTask = Task<TaskContext>;
declare type SeriesTask = Task<SeriesTaskContext>;
declare type Pipeline = {
    id: string;
    head: GeneralTask;
    tail: GeneralTask;
    threshold: number;
    progressiveEnabled: boolean;
    blockIndex: number;
    step: number;
    count: number;
    currentTask?: GeneralTask;
    context?: PipelineContext;
};
declare type PipelineContext = {
    progressiveRender: boolean;
    modDataCount: number;
    large: boolean;
};
declare type PerformStageTaskOpt = {
    block?: boolean;
    setDirty?: boolean;
    visualType?: StageHandlerInternal['visualType'];
    dirtyMap?: HashMap<any>;
};
interface SeriesTaskContext extends TaskContext {
    model?: SeriesModel;
    data?: SeriesData;
    view?: ChartView;
    ecModel?: GlobalModel;
    api?: ExtensionAPI;
    useClearVisual?: boolean;
    plan?: StageHandlerPlan;
    reset?: StageHandlerReset;
    scheduler?: Scheduler;
    payload?: Payload;
    resetDefines?: StageHandlerProgressExecutor[];
}
interface OverallTaskContext extends TaskContext {
    ecModel: GlobalModel;
    api: ExtensionAPI;
    overallReset: StageHandlerOverallReset;
    scheduler: Scheduler;
    payload?: Payload;
}
declare class Scheduler {
    readonly ecInstance: EChartsType;
    readonly api: ExtensionAPI;
    unfinished: boolean;
    private _dataProcessorHandlers;
    private _visualHandlers;
    private _allHandlers;
    private _stageTaskMap;
    private _pipelineMap;
    constructor(ecInstance: EChartsType, api: ExtensionAPI, dataProcessorHandlers: StageHandlerInternal[], visualHandlers: StageHandlerInternal[]);
    restoreData(ecModel: GlobalModel, payload: Payload): void;
    getPerformArgs(task: GeneralTask, isBlock?: boolean): {
        step: number;
        modBy: number;
        modDataCount: number;
    };
    getPipeline(pipelineId: string): Pipeline;
    /**
     * Current, progressive rendering starts from visual and layout.
     * Always detect render mode in the same stage, avoiding that incorrect
     * detection caused by data filtering.
     * Caution:
     * `updateStreamModes` use `seriesModel.getData()`.
     */
    updateStreamModes(seriesModel: SeriesModel<SeriesOption & SeriesLargeOptionMixin>, view: ChartView): void;
    restorePipelines(ecModel: GlobalModel): void;
    prepareStageTasks(): void;
    prepareView(view: ChartView, model: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI): void;
    performDataProcessorTasks(ecModel: GlobalModel, payload?: Payload): void;
    performVisualTasks(ecModel: GlobalModel, payload?: Payload, opt?: PerformStageTaskOpt): void;
    private _performStageTasks;
    performSeriesTasks(ecModel: GlobalModel): void;
    plan(): void;
    updatePayload(task: Task<SeriesTaskContext | OverallTaskContext>, payload: Payload | 'remain'): void;
    private _createSeriesStageTask;
    private _createOverallStageTask;
    private _pipe;
    static wrapStageHandler(stageHandler: StageHandler | StageHandlerOverallReset, visualType: StageHandlerInternal['visualType']): StageHandlerInternal;
}

interface ChartView {
    /**
     * Rendering preparation in progressive mode.
     * Implement it if needed.
     */
    incrementalPrepareRender(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Render in progressive mode.
     * Implement it if needed.
     * @param params See taskParams in `stream/task.js`
     */
    incrementalRender(params: StageHandlerProgressParams, seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Update transform directly.
     * Implement it if needed.
     */
    updateTransform(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void | {
        update: true;
    };
    /**
     * The view contains the given point.
     * Implement it if needed.
     */
    containPoint(point: number[], seriesModel: SeriesModel): boolean;
    /**
     * Pass only when return `true`.
     * Implement it if needed.
     */
    filterForExposedEvent(eventType: string, query: EventQueryItem, targetEl: Element, packedEvent: ECActionEvent | ECElementEvent): boolean;
}
declare class ChartView {
    type: string;
    readonly group: ViewRootGroup;
    readonly uid: string;
    readonly renderTask: SeriesTask;
    /**
     * Ignore label line update in global stage. Will handle it in chart itself.
     * Used in pie / funnel
     */
    ignoreLabelLineUpdate: boolean;
    __alive: boolean;
    __model: SeriesModel;
    __id: string;
    static protoInitialize: void;
    constructor();
    init(ecModel: GlobalModel, api: ExtensionAPI): void;
    render(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Highlight series or specified data item.
     */
    highlight(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Downplay series or specified data item.
     */
    downplay(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Remove self.
     */
    remove(ecModel: GlobalModel, api: ExtensionAPI): void;
    /**
     * Dispose self.
     */
    dispose(ecModel: GlobalModel, api: ExtensionAPI): void;
    updateView(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    updateLayout(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    updateVisual(seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload: Payload): void;
    /**
     * Traverse the new rendered elements.
     *
     * It will traverse the new added element in progressive rendering.
     * And traverse all in normal rendering.
     */
    eachRendered(cb: (el: Element) => boolean | void): void;
    static markUpdateMethod(payload: Payload, methodName: keyof ChartView): void;
    static registerClass: ClassManager['registerClass'];
}

declare const availableMethods: (keyof EChartsType)[];
interface ExtensionAPI extends Pick<EChartsType, (typeof availableMethods)[number]> {
}
declare abstract class ExtensionAPI {
    constructor(ecInstance: EChartsType);
    abstract getCoordinateSystems(): CoordinateSystemMaster[];
    abstract getComponentByElement(el: Element): ComponentModel;
    abstract enterEmphasis(el: Element, highlightDigit?: number): void;
    abstract leaveEmphasis(el: Element, highlightDigit?: number): void;
    abstract enterSelect(el: Element): void;
    abstract leaveSelect(el: Element): void;
    abstract enterBlur(el: Element): void;
    abstract leaveBlur(el: Element): void;
    abstract getViewOfComponentModel(componentModel: ComponentModel): ComponentView;
    abstract getViewOfSeriesModel(seriesModel: SeriesModel): ChartView;
    abstract getModel(): GlobalModel;
}

declare const AXIS_TYPES: {
    readonly value: 1;
    readonly category: 1;
    readonly time: 1;
    readonly log: 1;
};
declare type OptionAxisType = keyof typeof AXIS_TYPES;
interface AxisBaseOptionCommon extends ComponentOption, AnimationOptionMixin {
    type?: OptionAxisType;
    show?: boolean;
    inverse?: boolean;
    name?: string;
    nameLocation?: 'start' | 'middle' | 'end';
    nameRotate?: number;
    nameTruncate?: {
        maxWidth?: number;
        ellipsis?: string;
        placeholder?: string;
    };
    nameTextStyle?: AxisNameTextStyleOption;
    nameGap?: number;
    silent?: boolean;
    triggerEvent?: boolean;
    tooltip?: {
        show?: boolean;
    };
    axisLabel?: AxisLabelBaseOption;
    axisPointer?: CommonAxisPointerOption;
    axisLine?: AxisLineOption;
    axisTick?: AxisTickOption;
    minorTick?: MinorTickOption;
    splitLine?: SplitLineOption;
    minorSplitLine?: MinorSplitLineOption;
    splitArea?: SplitAreaOption;
    /**
     * Min value of the axis. can be:
     * + ScaleDataValue
     * + 'dataMin': use the min value in data.
     * + null/undefined: auto decide min value (consider pretty look and boundaryGap).
     */
    min?: ScaleDataValue | 'dataMin' | ((extent: {
        min: number;
        max: number;
    }) => ScaleDataValue);
    /**
     * Max value of the axis. can be:
     * + ScaleDataValue
     * + 'dataMax': use the max value in data.
     * + null/undefined: auto decide max value (consider pretty look and boundaryGap).
     */
    max?: ScaleDataValue | 'dataMax' | ((extent: {
        min: number;
        max: number;
    }) => ScaleDataValue);
}
interface NumericAxisBaseOptionCommon extends AxisBaseOptionCommon {
    boundaryGap?: [number | string, number | string];
    /**
     * AxisTick and axisLabel and splitLine are caculated based on splitNumber.
     */
    splitNumber?: number;
    /**
     * Interval specifies the span of the ticks is mandatorily.
     */
    interval?: number;
    /**
     * Specify min interval when auto calculate tick interval.
     */
    minInterval?: number;
    /**
     * Specify max interval when auto calculate tick interval.
     */
    maxInterval?: number;
    /**
     * If align ticks to the first axis that is not use alignTicks
     * If all axes has alignTicks: true. The first one will be applied.
     *
     * Will be ignored if interval is set.
     */
    alignTicks?: boolean;
}
interface CategoryAxisBaseOption extends AxisBaseOptionCommon {
    type?: 'category';
    boundaryGap?: boolean;
    axisLabel?: AxisLabelOption<'category'> & {
        interval?: 'auto' | number | ((index: number, value: string) => boolean);
    };
    data?: (OrdinalRawValue | {
        value: OrdinalRawValue;
        textStyle?: TextCommonOption;
    })[];
    deduplication?: boolean;
    axisTick?: AxisBaseOptionCommon['axisTick'] & {
        alignWithLabel?: boolean;
        interval?: 'auto' | number | ((index: number, value: string) => boolean);
    };
}
interface ValueAxisBaseOption extends NumericAxisBaseOptionCommon {
    type?: 'value';
    axisLabel?: AxisLabelOption<'value'>;
    /**
     * Optional value can be:
     * + `false`: always include value 0.
     * + `false`: always include value 0.
     */
    scale?: boolean;
}
interface LogAxisBaseOption extends NumericAxisBaseOptionCommon {
    type?: 'log';
    axisLabel?: AxisLabelOption<'log'>;
    logBase?: number;
}
interface TimeAxisBaseOption extends NumericAxisBaseOptionCommon {
    type?: 'time';
    axisLabel?: AxisLabelOption<'time'>;
}
interface AxisNameTextStyleOption extends TextCommonOption {
    rich?: Dictionary<TextCommonOption>;
}
interface AxisLineOption {
    show?: boolean | 'auto';
    onZero?: boolean;
    onZeroAxisIndex?: number;
    symbol?: string | [string, string];
    symbolSize?: number[];
    symbolOffset?: string | number | (string | number)[];
    lineStyle?: LineStyleOption;
}
interface AxisTickOption {
    show?: boolean | 'auto';
    inside?: boolean;
    length?: number;
    lineStyle?: LineStyleOption;
}
declare type AxisLabelValueFormatter = (value: number, index: number) => string;
declare type AxisLabelCategoryFormatter = (value: string, index: number) => string;
declare type TimeAxisLabelUnitFormatter = AxisLabelValueFormatter | string[] | string;
declare type TimeAxisLabelFormatterOption = string | ((value: number, index: number, extra: {
    level: number;
}) => string) | {
    year?: TimeAxisLabelUnitFormatter;
    month?: TimeAxisLabelUnitFormatter;
    week?: TimeAxisLabelUnitFormatter;
    day?: TimeAxisLabelUnitFormatter;
    hour?: TimeAxisLabelUnitFormatter;
    minute?: TimeAxisLabelUnitFormatter;
    second?: TimeAxisLabelUnitFormatter;
    millisecond?: TimeAxisLabelUnitFormatter;
    inherit?: boolean;
};
declare type LabelFormatters = {
    value: AxisLabelValueFormatter | string;
    log: AxisLabelValueFormatter | string;
    category: AxisLabelCategoryFormatter | string;
    time: TimeAxisLabelFormatterOption;
};
interface AxisLabelBaseOption extends Omit<TextCommonOption, 'color'> {
    show?: boolean;
    inside?: boolean;
    rotate?: number;
    showMinLabel?: boolean;
    showMaxLabel?: boolean;
    margin?: number;
    rich?: Dictionary<TextCommonOption>;
    /**
     * If hide overlapping labels.
     */
    hideOverlap?: boolean;
    color?: ColorString | ((value?: string | number, index?: number) => ColorString);
}
interface AxisLabelOption<TType extends OptionAxisType> extends AxisLabelBaseOption {
    formatter?: LabelFormatters[TType];
}
interface MinorTickOption {
    show?: boolean;
    splitNumber?: number;
    length?: number;
    lineStyle?: LineStyleOption;
}
interface SplitLineOption {
    show?: boolean;
    interval?: 'auto' | number | ((index: number, value: string) => boolean);
    lineStyle?: LineStyleOption<ZRColor | ZRColor[]>;
}
interface MinorSplitLineOption {
    show?: boolean;
    lineStyle?: LineStyleOption;
}
interface SplitAreaOption {
    show?: boolean;
    interval?: 'auto' | number | ((index: number, value: string) => boolean);
    areaStyle?: AreaStyleOption<ZRColor[]>;
}
declare type AxisBaseOption = ValueAxisBaseOption | LogAxisBaseOption | CategoryAxisBaseOption | TimeAxisBaseOption | AxisBaseOptionCommon;

interface AxisModelCommonMixin<Opt extends AxisBaseOption> extends Pick<Model<Opt>, 'option'> {
    axis: Axis;
}
declare class AxisModelCommonMixin<Opt extends AxisBaseOption> {
    getNeedCrossZero(): boolean;
    /**
     * Should be implemented by each axis model if necessary.
     * @return coordinate system model
     */
    getCoordSysModel(): CoordinateSystemHostModel;
}

declare class OrdinalMeta {
    readonly categories: OrdinalRawValue[];
    private _needCollect;
    private _deduplication;
    private _map;
    readonly uid: number;
    constructor(opt: {
        categories?: OrdinalRawValue[];
        needCollect?: boolean;
        deduplication?: boolean;
    });
    static createByAxisModel(axisModel: Model): OrdinalMeta;
    getOrdinal(category: OrdinalRawValue): OrdinalNumber;
    /**
     * @return The ordinal. If not found, return NaN.
     */
    parseAndCollect(category: OrdinalRawValue | OrdinalNumber): OrdinalNumber;
    private _getOrCreateMap;
}

declare function registerImpl(name: string, impl: any): void;

declare const extensionRegisters: {
    registerPreprocessor: typeof registerPreprocessor;
    registerProcessor: typeof registerProcessor;
    registerPostInit: typeof registerPostInit;
    registerPostUpdate: typeof registerPostUpdate;
    registerUpdateLifecycle: typeof registerUpdateLifecycle;
    registerAction: typeof registerAction;
    registerCoordinateSystem: typeof registerCoordinateSystem;
    registerLayout: typeof registerLayout;
    registerVisual: typeof registerVisual;
    registerTransform: typeof registerExternalTransform;
    registerLoading: typeof registerLoading;
    registerMap: typeof registerMap;
    registerImpl: typeof registerImpl;
    PRIORITY: {
        PROCESSOR: {
            FILTER: number;
            SERIES_FILTER: number;
            STATISTIC: number;
        };
        VISUAL: {
            LAYOUT: number;
            PROGRESSIVE_LAYOUT: number;
            GLOBAL: number;
            CHART: number;
            POST_CHART_LAYOUT: number;
            COMPONENT: number;
            BRUSH: number;
            CHART_ITEM: number;
            ARIA: number;
            DECAL: number;
        };
    };
    ComponentModel: typeof ComponentModel;
    ComponentView: typeof ComponentView;
    SeriesModel: typeof SeriesModel;
    ChartView: typeof ChartView;
    registerComponentModel(ComponentModelClass: Constructor): void;
    registerComponentView(ComponentViewClass: typeof ComponentView): void;
    registerSeriesModel(SeriesModelClass: Constructor): void;
    registerChartView(ChartViewClass: typeof ChartView): void;
    registerSubTypeDefaulter(componentType: string, defaulter: SubTypeDefaulter): void;
    registerPainter(painterType: string, PainterCtor: Parameters<typeof registerPainter>[1]): void;
};
declare type EChartsExtensionInstallRegisters = typeof extensionRegisters;
declare type EChartsExtensionInstaller = (ec: EChartsExtensionInstallRegisters) => void;
interface EChartsExtension {
    install: EChartsExtensionInstaller;
}
declare function use(ext: EChartsExtensionInstaller | EChartsExtension | (EChartsExtensionInstaller | EChartsExtension)[]): void;

interface AxisModelExtendedInCreator {
    getCategories(rawData?: boolean): OrdinalRawValue[] | CategoryAxisBaseOption['data'];
    getOrdinalMeta(): OrdinalMeta;
}

/**
 * Base Axis Model for xAxis, yAxis, angleAxis, radiusAxis. singleAxis
 */

interface AxisBaseModel<T extends AxisBaseOptionCommon = AxisBaseOptionCommon> extends ComponentModel<T>, AxisModelCommonMixin<T>, AxisModelExtendedInCreator {
    axis: Axis;
}

declare function createAxisLabels(axis: Axis): {
    labels: {
        level?: number;
        formattedLabel: string;
        rawLabel: string;
        tickValue: number;
    }[];
    labelCategoryInterval?: number;
};
/**
 * Calculate interval for category axis ticks and labels.
 * To get precise result, at least one of `getRotate` and `isHorizontal`
 * should be implemented in axis.
 */
declare function calculateCategoryInterval(axis: Axis): number;

interface ScaleRawExtentResult {
    readonly min: number;
    readonly max: number;
    readonly minFixed: boolean;
    readonly maxFixed: boolean;
    readonly isBlank: boolean;
}
declare class ScaleRawExtentInfo {
    private _needCrossZero;
    private _isOrdinal;
    private _axisDataLen;
    private _boundaryGapInner;
    private _modelMinRaw;
    private _modelMaxRaw;
    private _modelMinNum;
    private _modelMaxNum;
    private _dataMin;
    private _dataMax;
    private _determinedMin;
    private _determinedMax;
    readonly frozen: boolean;
    constructor(scale: Scale, model: AxisBaseModel, originalExtent: number[]);
    /**
     * Parameters depending on ouside (like model, user callback)
     * are prepared and fixed here.
     */
    private _prepareParams;
    /**
     * Calculate extent by prepared parameters.
     * This method has no external dependency and can be called duplicatedly,
     * getting the same result.
     * If parameters changed, should call this method to recalcuate.
     */
    calculate(): ScaleRawExtentResult;
    modifyDataMinMax(minMaxName: 'min' | 'max', val: number): void;
    setDeterminedMinMax(minMaxName: 'min' | 'max', val: number): void;
    freeze(): void;
}

declare abstract class Scale<SETTING extends Dictionary<unknown> = Dictionary<unknown>> {
    type: string;
    private _setting;
    protected _extent: [number, number];
    private _isBlank;
    readonly rawExtentInfo: ScaleRawExtentInfo;
    constructor(setting?: SETTING);
    getSetting<KEY extends keyof SETTING>(name: KEY): SETTING[KEY];
    /**
     * Parse input val to valid inner number.
     * Notice: This would be a trap here, If the implementation
     * of this method depends on extent, and this method is used
     * before extent set (like in dataZoom), it would be wrong.
     * Nevertheless, parse does not depend on extent generally.
     */
    abstract parse(val: OptionDataValue): number;
    /**
     * Whether contain the given value.
     */
    abstract contain(val: ScaleDataValue): boolean;
    /**
     * Normalize value to linear [0, 1], return 0.5 if extent span is 0.
     */
    abstract normalize(val: ScaleDataValue): number;
    /**
     * Scale normalized value to extent.
     */
    abstract scale(val: number): number;
    /**
     * Set extent from data
     */
    unionExtent(other: [number, number]): void;
    /**
     * Set extent from data
     */
    unionExtentFromData(data: SeriesData, dim: DimensionName | DimensionLoose): void;
    /**
     * Get extent
     *
     * Extent is always in increase order.
     */
    getExtent(): [number, number];
    /**
     * Set extent
     */
    setExtent(start: number, end: number): void;
    /**
     * If value is in extent range
     */
    isInExtentRange(value: number): boolean;
    /**
     * When axis extent depends on data and no data exists,
     * axis ticks should not be drawn, which is named 'blank'.
     */
    isBlank(): boolean;
    /**
     * When axis extent depends on data and no data exists,
     * axis ticks should not be drawn, which is named 'blank'.
     */
    setBlank(isBlank: boolean): void;
    /**
     * Update interval and extent of intervals for nice ticks
     *
     * @param splitNumber Approximated tick numbers. Optional.
     *        The implementation of `niceTicks` should decide tick numbers
     *        whether `splitNumber` is given.
     * @param minInterval Optional.
     * @param maxInterval Optional.
     */
    abstract calcNiceTicks(splitNumber?: number, minInterval?: number, maxInterval?: number): void;
    abstract calcNiceExtent(opt?: {
        splitNumber?: number;
        fixMin?: boolean;
        fixMax?: boolean;
        minInterval?: number;
        maxInterval?: number;
    }): void;
    /**
     * @return label of the tick.
     */
    abstract getLabel(tick: ScaleTick): string;
    abstract getTicks(): ScaleTick[];
    abstract getMinorTicks(splitNumber: number): number[][];
    static registerClass: ClassManager['registerClass'];
    static getClass: ClassManager['getClass'];
}

interface TickCoord {
    coord: number;
    tickValue?: ScaleTick['value'];
}
/**
 * Base class of Axis.
 */
declare class Axis {
    /**
     * Axis type
     *  - 'category'
     *  - 'value'
     *  - 'time'
     *  - 'log'
     */
    type: OptionAxisType;
    readonly dim: DimensionName;
    scale: Scale;
    private _extent;
    model: AxisBaseModel;
    onBand: CategoryAxisBaseOption['boundaryGap'];
    inverse: AxisBaseOption['inverse'];
    constructor(dim: DimensionName, scale: Scale, extent: [number, number]);
    /**
     * If axis extent contain given coord
     */
    contain(coord: number): boolean;
    /**
     * If axis extent contain given data
     */
    containData(data: ScaleDataValue): boolean;
    /**
     * Get coord extent.
     */
    getExtent(): [number, number];
    /**
     * Get precision used for formatting
     */
    getPixelPrecision(dataExtent?: [number, number]): number;
    /**
     * Set coord extent
     */
    setExtent(start: number, end: number): void;
    /**
     * Convert data to coord. Data is the rank if it has an ordinal scale
     */
    dataToCoord(data: ScaleDataValue, clamp?: boolean): number;
    /**
     * Convert coord to data. Data is the rank if it has an ordinal scale
     */
    coordToData(coord: number, clamp?: boolean): number;
    /**
     * Convert pixel point to data in axis
     */
    pointToData(point: number[], clamp?: boolean): number;
    /**
     * Different from `zrUtil.map(axis.getTicks(), axis.dataToCoord, axis)`,
     * `axis.getTicksCoords` considers `onBand`, which is used by
     * `boundaryGap:true` of category axis and splitLine and splitArea.
     * @param opt.tickModel default: axis.model.getModel('axisTick')
     * @param opt.clamp If `true`, the first and the last
     *        tick must be at the axis end points. Otherwise, clip ticks
     *        that outside the axis extent.
     */
    getTicksCoords(opt?: {
        tickModel?: Model;
        clamp?: boolean;
    }): TickCoord[];
    getMinorTicksCoords(): TickCoord[][];
    getViewLabels(): ReturnType<typeof createAxisLabels>['labels'];
    getLabelModel(): Model<AxisBaseOption['axisLabel']>;
    /**
     * Notice here we only get the default tick model. For splitLine
     * or splitArea, we should pass the splitLineModel or splitAreaModel
     * manually when calling `getTicksCoords`.
     * In GL, this method may be overrided to:
     * `axisModel.getModel('axisTick', grid3DModel.getModel('axisTick'));`
     */
    getTickModel(): Model;
    /**
     * Get width of band
     */
    getBandWidth(): number;
    /**
     * Get axis rotate, by degree.
     */
    getRotate: () => number;
    /**
     * Only be called in category axis.
     * Can be overrided, consider other axes like in 3D.
     * @return Auto interval for cateogry axis tick and label
     */
    calculateCategoryInterval(): ReturnType<typeof calculateCategoryInterval>;
}

interface BaseBarSeriesOption<StateOption, ExtraStateOption = DefaultStatesMixin> extends SeriesOption<StateOption, ExtraStateOption>, SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin {
    /**
     * Min height of bar
     */
    barMinHeight?: number;
    /**
     * Min angle of bar. Avaiable on polar coordinate system
     */
    barMinAngle?: number;
    /**
     * Max width of bar. Default to be 1 on cartesian coordinate system. Otherwise it's null
     */
    barMaxWidth?: number;
    barMinWidth?: number;
    /**
     * Bar width. Will be calculated automatically.
     * Can be pixel width or percent string.
     */
    barWidth?: number | string;
    /**
     * Gap between each bar inside category. Default to be 30%. Can be an aboslute pixel value
     */
    barGap?: string | number;
    /**
     * Gap between each category. Default to be 20%. can be an absolute pixel value.
     */
    barCategoryGap?: string | number;
    large?: boolean;
    largeThreshold?: number;
}

interface LayoutRect extends BoundingRect {
    margin: number[];
}
/**
 * Parse position info.
 */
declare function getLayoutRect(positionInfo: BoxLayoutOptionMixin & {
    aspect?: number;
}, containerRect: {
    width: number;
    height: number;
}, margin?: number | number[]): LayoutRect;

interface GridOption extends ComponentOption, BoxLayoutOptionMixin, ShadowOptionMixin {
    mainType?: 'grid';
    show?: boolean;
    containLabel?: boolean;
    backgroundColor?: ZRColor;
    borderWidth?: number;
    borderColor?: ZRColor;
    tooltip?: any;
}

declare type CartesianAxisPosition = 'top' | 'bottom' | 'left' | 'right';
declare type CartesianAxisOption = AxisBaseOption & {
    gridIndex?: number;
    gridId?: string;
    position?: CartesianAxisPosition;
    offset?: number;
    categorySortInfo?: OrdinalSortInfo;
};
declare type XAXisOption = CartesianAxisOption & {
    mainType?: 'xAxis';
};
declare type YAXisOption = CartesianAxisOption & {
    mainType?: 'yAxis';
};

declare type AngleAxisOption = AxisBaseOption & {
    mainType?: 'angleAxis';
    /**
     * Index of host polar component
     */
    polarIndex?: number;
    /**
     * Id of host polar component
     */
    polarId?: string;
    startAngle?: number;
    clockwise?: boolean;
    axisLabel?: AxisBaseOption['axisLabel'];
};
declare type RadiusAxisOption = AxisBaseOption & {
    mainType?: 'radiusAxis';
    /**
     * Index of host polar component
     */
    polarIndex?: number;
    /**
     * Id of host polar component
     */
    polarId?: string;
};

interface PolarOption extends ComponentOption, CircleLayoutOptionMixin {
    mainType?: 'polar';
}

/**
 * BrushController not only used in "brush component",
 * but also used in "tooltip DataZoom", and other possible
 * futher brush behavior related scenarios.
 * So `BrushController` should not depends on "brush component model".
 */
declare type BrushType = 'polygon' | 'rect' | 'lineX' | 'lineY';
/**
 * Only for drawing (after enabledBrush).
 * 'line', 'rect', 'polygon' or false
 * If passing false/null/undefined, disable brush.
 * If passing 'auto', determined by panel.defaultBrushType
 */
declare type BrushTypeUncertain = BrushType | false | 'auto';
declare type BrushMode = 'single' | 'multiple';
declare type BrushDimensionMinMax = number[];
declare type BrushAreaRange = BrushDimensionMinMax | BrushDimensionMinMax[];
interface BrushCoverConfig {
    brushType: BrushType;
    id?: string;
    range?: BrushAreaRange;
    panelId?: string;
    brushMode?: BrushMode;
    brushStyle?: Pick<PathStyleProps, BrushStyleKey>;
    transformable?: boolean;
    removeOnClick?: boolean;
    z?: number;
}
declare type BrushStyleKey = 'fill' | 'stroke' | 'lineWidth' | 'opacity' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY' | 'shadowColor';

declare type GeoSVGSourceInput = string | Document | SVGElement;
declare type GeoJSONSourceInput = string | GeoJSON | GeoJSONCompressed;
interface NameMap {
    [regionName: string]: string;
}
interface GeoSpecialAreas {
    [areaName: string]: {
        left: number;
        top: number;
        width?: number;
        height?: number;
    };
}
interface GeoJSON extends GeoJSONFeatureCollection<GeoJSONGeometry> {
}
interface GeoJSONCompressed extends GeoJSONFeatureCollection<GeoJSONGeometryCompressed> {
    UTF8Encoding?: boolean;
    UTF8Scale?: number;
}
interface GeoJSONFeatureCollection<G> {
    type: 'FeatureCollection';
    features: GeoJSONFeature<G>[];
}
interface GeoJSONFeature<G = GeoJSONGeometry> {
    type: 'Feature';
    id?: string | number;
    properties: {
        name?: string;
        cp?: number[];
        [key: string]: any;
    };
    geometry: G;
}
declare type GeoJSONGeometry = GeoJSONGeometryPoint | GeoJSONGeometryMultiPoint | GeoJSONGeometryLineString | GeoJSONGeometryMultiLineString | GeoJSONGeometryPolygon | GeoJSONGeometryMultiPolygon;
declare type GeoJSONGeometryCompressed = GeoJSONGeometryPolygonCompressed | GeoJSONGeometryMultiPolygonCompressed | GeoJSONGeometryLineStringCompressed | GeoJSONGeometryMultiLineStringCompressed;
interface GeoJSONGeometryPoint {
    type: 'Point';
    coordinates: number[];
}
interface GeoJSONGeometryMultiPoint {
    type: 'MultiPoint';
    coordinates: number[][];
}
interface GeoJSONGeometryLineString {
    type: 'LineString';
    coordinates: number[][];
}
interface GeoJSONGeometryLineStringCompressed {
    type: 'LineString';
    coordinates: string;
    encodeOffsets: number[];
}
interface GeoJSONGeometryMultiLineString {
    type: 'MultiLineString';
    coordinates: number[][][];
}
interface GeoJSONGeometryMultiLineStringCompressed {
    type: 'MultiLineString';
    coordinates: string[];
    encodeOffsets: number[][];
}
interface GeoJSONGeometryPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}
interface GeoJSONGeometryPolygonCompressed {
    type: 'Polygon';
    coordinates: string[];
    encodeOffsets: number[][];
}
interface GeoJSONGeometryMultiPolygon {
    type: 'MultiPolygon';
    coordinates: number[][][][];
}
interface GeoJSONGeometryMultiPolygonCompressed {
    type: 'MultiPolygon';
    coordinates: string[][];
    encodeOffsets: number[][][];
}
interface GeoResource {
    readonly type: 'geoJSON' | 'geoSVG';
    load(nameMap: NameMap, nameProperty: string): {
        boundingRect: BoundingRect;
        regions: Region[];
        regionsMap: HashMap<Region>;
    };
}
/**
 * Geo stream interface compatitable with d3-geo
 * See the API detail in https://github.com/d3/d3-geo#streams
 */
interface ProjectionStream {
    point(x: number, y: number): void;
    lineStart(): void;
    lineEnd(): void;
    polygonStart(): void;
    polygonEnd(): void;
    /**
     * Not supported yet.
     */
    sphere(): void;
}
interface GeoProjection {
    project(point: number[]): number[];
    unproject(point: number[]): number[];
    /**
     * Projection stream compatitable to d3-geo projection stream.
     *
     * When rotate projection is used. It may have antimeridian artifacts.
     * So we need to introduce the fule projection stream to do antimeridian clipping.
     *
     * project will be ignored if projectStream is given.
     */
    stream?(outStream: ProjectionStream): ProjectionStream;
}

declare abstract class Region {
    readonly name: string;
    readonly type: 'geoJSON' | 'geoSVG';
    protected _center: number[];
    protected _rect: BoundingRect;
    constructor(name: string);
    setCenter(center: number[]): void;
    /**
     * Get center point in data unit. That is,
     * for GeoJSONRegion, the unit is lat/lng,
     * for GeoSVGRegion, the unit is SVG local coord.
     */
    getCenter(): number[];
    abstract calcCenter(): number[];
}
declare class GeoJSONPolygonGeometry {
    readonly type = "polygon";
    exterior: number[][];
    interiors?: number[][][];
    constructor(exterior: number[][], interiors: number[][][]);
}
declare class GeoJSONLineStringGeometry {
    readonly type = "linestring";
    points: number[][][];
    constructor(points: number[][][]);
}
declare class GeoJSONRegion extends Region {
    readonly type = "geoJSON";
    readonly geometries: (GeoJSONPolygonGeometry | GeoJSONLineStringGeometry)[];
    properties: GeoJSON['features'][0]['properties'];
    constructor(name: string, geometries: GeoJSONRegion['geometries'], cp: GeoJSON['features'][0]['properties']['cp']);
    calcCenter(): number[];
    getBoundingRect(projection?: GeoProjection): BoundingRect;
    contain(coord: number[]): boolean;
    /**
     * Transform the raw coords to target bounding.
     * @param x
     * @param y
     * @param width
     * @param height
     */
    transformTo(x: number, y: number, width: number, height: number): void;
    cloneShallow(name: string): GeoJSONRegion;
}

declare type ECSymbol = Path & {
    __isEmptyBrush?: boolean;
    setColor: (color: ZRColor, innerColor?: ZRColor) => void;
    getColor: () => ZRColor;
};
/**
 * Create a symbol element with given symbol configuration: shape, x, y, width, height, color
 */
declare function createSymbol(symbolType: string, x: number, y: number, w: number, h: number, color?: ZRColor, keepAspect?: boolean): ECSymbol;

declare type ItemStyleKeys = 'fill' | 'stroke' | 'decal' | 'lineWidth' | 'opacity' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY' | 'shadowColor' | 'lineDash' | 'lineDashOffset' | 'lineCap' | 'lineJoin' | 'miterLimit';
declare type ItemStyleProps = Pick<PathStyleProps, ItemStyleKeys>;
declare class ItemStyleMixin {
    getItemStyle(this: Model, excludes?: readonly (keyof ItemStyleOption)[], includes?: readonly (keyof ItemStyleOption)[]): ItemStyleProps;
}

declare type LineStyleKeys = 'lineWidth' | 'stroke' | 'opacity' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY' | 'shadowColor' | 'lineDash' | 'lineDashOffset' | 'lineCap' | 'lineJoin' | 'miterLimit';
declare type LineStyleProps = Pick<PathStyleProps, LineStyleKeys>;
declare class LineStyleMixin {
    getLineStyle(this: Model, excludes?: readonly (keyof LineStyleOption)[]): LineStyleProps;
}

declare type SelectorType = 'all' | 'inverse';
interface LegendSelectorButtonOption {
    type?: SelectorType;
    title?: string;
}
/**
 * T: the type to be extended
 * ET: extended type for keys of T
 * ST: special type for T to be extended
 */
declare type ExtendPropertyType<T, ET, ST extends {
    [key in keyof T]: any;
}> = {
    [key in keyof T]: key extends keyof ST ? T[key] | ET | ST[key] : T[key] | ET;
};
interface LegendItemStyleOption extends ExtendPropertyType<ItemStyleOption, 'inherit', {
    borderWidth: 'auto';
}> {
}
interface LegendLineStyleOption extends ExtendPropertyType<LineStyleOption, 'inherit', {
    width: 'auto';
}> {
    inactiveColor?: ColorString;
    inactiveWidth?: number;
}
interface LegendStyleOption {
    /**
     * Icon of the legend items.
     * @default 'roundRect'
     */
    icon?: string;
    /**
     * Color when legend item is not selected
     */
    inactiveColor?: ColorString;
    /**
     * Border color when legend item is not selected
     */
    inactiveBorderColor?: ColorString;
    /**
     * Border color when legend item is not selected
     */
    inactiveBorderWidth?: number | 'auto';
    /**
     * Legend label formatter
     */
    formatter?: string | ((name: string) => string);
    itemStyle?: LegendItemStyleOption;
    lineStyle?: LegendLineStyleOption;
    textStyle?: LabelOption;
    symbolRotate?: number | 'inherit';
    /**
     * @deprecated
     */
    symbolKeepAspect?: boolean;
}
interface DataItem extends LegendStyleOption {
    name?: string;
    icon?: string;
    textStyle?: LabelOption;
    tooltip?: unknown;
}
interface LegendTooltipFormatterParams {
    componentType: 'legend';
    legendIndex: number;
    name: string;
    $vars: ['name'];
}
interface LegendIconParams {
    itemWidth: number;
    itemHeight: number;
    /**
     * symbolType is from legend.icon, legend.data.icon, or series visual
     */
    icon: string;
    iconRotate: number | 'inherit';
    symbolKeepAspect: boolean;
    itemStyle: PathStyleProps;
    lineStyle: LineStyleProps;
}
interface LegendOption extends ComponentOption, LegendStyleOption, BoxLayoutOptionMixin, BorderOptionMixin {
    mainType?: 'legend';
    show?: boolean;
    orient?: LayoutOrient;
    align?: 'auto' | 'left' | 'right';
    backgroundColor?: ColorString;
    /**
     * Border radius of background rect
     * @default 0
     */
    borderRadius?: number | number[];
    /**
     * Padding between legend item and border.
     * Support to be a single number or an array.
     * @default 5
     */
    padding?: number | number[];
    /**
     * Gap between each legend item.
     * @default 10
     */
    itemGap?: number;
    /**
     * Width of legend symbol
     */
    itemWidth?: number;
    /**
     * Height of legend symbol
     */
    itemHeight?: number;
    selectedMode?: boolean | 'single' | 'multiple';
    /**
     * selected map of each item. Default to be selected if item is not in the map
     */
    selected?: Dictionary<boolean>;
    /**
     * Buttons for all select or inverse select.
     * @example
     *  selector: [{type: 'all or inverse', title: xxx}]
     *  selector: true
     *  selector: ['all', 'inverse']
     */
    selector?: (LegendSelectorButtonOption | SelectorType)[] | boolean;
    selectorLabel?: LabelOption;
    emphasis?: {
        selectorLabel?: LabelOption;
    };
    /**
     * Position of selector buttons.
     */
    selectorPosition?: 'auto' | 'start' | 'end';
    /**
     * Gap between each selector button
     */
    selectorItemGap?: number;
    /**
     * Gap between selector buttons group and legend main items.
     */
    selectorButtonGap?: number;
    data?: (string | DataItem)[];
    /**
     * Tooltip option
     */
    tooltip?: CommonTooltipOption<LegendTooltipFormatterParams>;
}

interface MapStateOption<TCbParams = never> {
    itemStyle?: GeoItemStyleOption<TCbParams>;
    label?: SeriesLabelOption;
}
interface MapDataItemOption extends MapStateOption, StatesOptionMixin<MapStateOption, StatesMixinBase>, OptionDataItemObject<OptionDataValueNumeric> {
    cursor?: string;
}
declare type MapValueCalculationType = 'sum' | 'average' | 'min' | 'max';
interface MapSeriesOption extends SeriesOption<MapStateOption<CallbackDataParams>, StatesMixinBase>, MapStateOption<CallbackDataParams>, GeoCommonOptionMixin, SeriesOnGeoOptionMixin, BoxLayoutOptionMixin, SeriesEncodeOptionMixin {
    type?: 'map';
    coordinateSystem?: string;
    silent?: boolean;
    markLine?: any;
    markPoint?: any;
    markArea?: any;
    mapValueCalculation?: MapValueCalculationType;
    showLegendSymbol?: boolean;
    geoCoord?: Dictionary<number[]>;
    data?: (OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption)[];
    nameProperty?: string;
}

interface GeoItemStyleOption<TCbParams = never> extends ItemStyleOption<TCbParams> {
    areaColor?: ZRColor;
}
interface GeoLabelOption extends LabelOption {
    formatter?: string | ((params: GeoLabelFormatterDataParams) => string);
}
interface GeoStateOption {
    itemStyle?: GeoItemStyleOption;
    label?: GeoLabelOption;
}
interface GeoLabelFormatterDataParams {
    name: string;
    status: DisplayState;
}
interface RegoinOption extends GeoStateOption, StatesOptionMixin<GeoStateOption, StatesMixinBase> {
    name?: string;
    selected?: boolean;
    tooltip?: CommonTooltipOption<GeoTooltipFormatterParams>;
}
interface GeoTooltipFormatterParams {
    componentType: 'geo';
    geoIndex: number;
    name: string;
    $vars: ['name'];
}
interface GeoCommonOptionMixin extends RoamOptionMixin {
    map: string;
    aspectScale?: number;
    layoutCenter?: (number | string)[];
    layoutSize?: number | string;
    boundingCoords?: number[][];
    nameMap?: NameMap;
    nameProperty?: string;
    /**
     * Use raw projection by default
     * Only available for GeoJSON source.
     *
     * NOTE: `center` needs to be the projected coord if projection is used.
     */
    projection?: GeoProjection;
}
interface GeoOption extends ComponentOption, BoxLayoutOptionMixin, AnimationOptionMixin, GeoCommonOptionMixin, StatesOptionMixin<GeoStateOption, StatesMixinBase>, GeoStateOption {
    mainType?: 'geo';
    show?: boolean;
    silent?: boolean;
    regions?: RegoinOption[];
    stateAnimation?: AnimationOptionMixin;
    selectedMode?: 'single' | 'multiple' | boolean;
    selectedMap?: Dictionary<boolean>;
    tooltip?: CommonTooltipOption<GeoTooltipFormatterParams>;
}

/**
 * The input to define brush areas.
 * (1) Can be created by user when calling dispatchAction.
 * (2) Can be created by `BrushController`
 * for brush behavior. area params are picked from `cover.__brushOptoin`.
 * In `BrushController`, "covers" are create or updated for each "area".
 */
interface BrushAreaParam extends ModelFinderObject {
    brushType: BrushCoverConfig['brushType'];
    id?: BrushCoverConfig['id'];
    range?: BrushCoverConfig['range'];
    panelId?: BrushCoverConfig['panelId'];
    coordRange?: BrushAreaRange;
    coordRanges?: BrushAreaRange[];
    __rangeOffset?: {
        offset: BrushDimensionMinMax[] | BrushDimensionMinMax;
        xyMinMax: BrushDimensionMinMax[];
    };
}
/**
 * Generated by `brushModel.setAreas`, which merges
 * `area: BrushAreaParam` and `brushModel.option: BrushOption`.
 * See `generateBrushOption`.
 */
interface BrushAreaParamInternal extends BrushAreaParam {
    brushMode: BrushMode;
    brushStyle: BrushCoverConfig['brushStyle'];
    transformable: BrushCoverConfig['transformable'];
    removeOnClick: BrushCoverConfig['removeOnClick'];
    z: BrushCoverConfig['z'];
    __rangeOffset?: {
        offset: BrushDimensionMinMax | BrushDimensionMinMax[];
        xyMinMax: BrushDimensionMinMax[];
    };
}
declare type BrushToolboxIconType = BrushType | 'keep' | 'clear';
interface BrushOption extends ComponentOption, ModelFinderObject {
    mainType?: 'brush';
    toolbox?: BrushToolboxIconType[];
    brushLink?: number[] | 'all' | 'none';
    throttleType?: 'fixRate' | 'debounce';
    throttleDelay?: number;
    inBrush?: VisualOptionFixed;
    outOfBrush?: VisualOptionFixed;
    brushType?: BrushTypeUncertain;
    brushStyle?: {
        borderWidth?: number;
        color?: ZRColor;
        borderColor?: ZRColor;
    };
    transformable?: boolean;
    brushMode?: BrushMode;
    removeOnClick?: boolean;
}

interface BrushSelectableArea extends BrushAreaParamInternal {
    boundingRect: BoundingRect;
    selectors: BrushCommonSelectorsForSeries;
}
/**
 * This methods are corresponding to `BrushSelectorOnBrushType`,
 * but `area: BrushSelectableArea` is binded to each method.
 */
interface BrushCommonSelectorsForSeries {
    point(itemLayout: number[]): boolean;
    rect(itemLayout: RectLike): boolean;
}

declare type PolarBarLabelPosition = SeriesLabelOption['position'] | 'start' | 'insideStart' | 'middle' | 'end' | 'insideEnd';
declare type BarSeriesLabelOption = Omit<SeriesLabelOption, 'position'> & {
    position?: PolarBarLabelPosition | 'outside';
};
interface BarStateOption<TCbParams = never> {
    itemStyle?: BarItemStyleOption<TCbParams>;
    label?: BarSeriesLabelOption;
}
interface BarStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface BarItemStyleOption<TCbParams = never> extends ItemStyleOption<TCbParams> {
    borderRadius?: number | number[];
}
interface BarDataItemOption extends BarStateOption, StatesOptionMixin<BarStateOption, BarStatesMixin>, OptionDataItemObject<OptionDataValue> {
    cursor?: string;
}
interface BarSeriesOption extends BaseBarSeriesOption<BarStateOption<CallbackDataParams>, BarStatesMixin>, BarStateOption<CallbackDataParams>, SeriesStackOptionMixin, SeriesSamplingOptionMixin, SeriesEncodeOptionMixin {
    type?: 'bar';
    coordinateSystem?: 'cartesian2d' | 'polar';
    clip?: boolean;
    /**
     * If use caps on two sides of bars
     * Only available on tangential polar bar
     */
    roundCap?: boolean;
    showBackground?: boolean;
    backgroundStyle?: ItemStyleOption & {
        borderRadius?: number | number[];
    };
    data?: (BarDataItemOption | OptionDataValue | OptionDataValue[])[];
    realtimeSort?: boolean;
}

/**
 * {
 *  [coordSysId]: {
 *      [stackId]: {bandWidth, offset, width}
 *  }
 * }
 */
declare type BarWidthAndOffset = Dictionary<Dictionary<{
    bandWidth: number;
    offset: number;
    offsetCenter: number;
    width: number;
}>>;
interface BarGridLayoutOptionForCustomSeries {
    count: number;
    barWidth?: number | string;
    barMaxWidth?: number | string;
    barMinWidth?: number | string;
    barGap?: number | string;
    barCategoryGap?: number | string;
}
declare type BarGridLayoutResult = BarWidthAndOffset[string][string][];

interface TransitionOptionMixin<T = Record<string, any>> {
    transition?: (keyof T & string) | ((keyof T & string)[]) | 'all';
    enterFrom?: T;
    leaveTo?: T;
    enterAnimation?: AnimationOption$1;
    updateAnimation?: AnimationOption$1;
    leaveAnimation?: AnimationOption$1;
}
interface TransitionBaseDuringAPI {
    setTransform(key: TransformProp, val: number): this;
    getTransform(key: TransformProp): number;
    setExtra(key: string, val: unknown): this;
    getExtra(key: string): unknown;
}
interface TransitionDuringAPI<StyleOpt extends any = any, ShapeOpt extends any = any> extends TransitionBaseDuringAPI {
    setShape<T extends keyof ShapeOpt>(key: T, val: ShapeOpt[T]): this;
    getShape<T extends keyof ShapeOpt>(key: T): ShapeOpt[T];
    setStyle<T extends keyof StyleOpt>(key: T, val: StyleOpt[T]): this;
    getStyle<T extends keyof StyleOpt>(key: T): StyleOpt[T];
}

declare type AnimationKeyframe<T extends Record<string, any>> = T & {
    easing?: AnimationEasing;
    percent?: number;
};
interface ElementKeyframeAnimationOption<Props extends Record<string, any>> extends AnimationOption$1 {
    loop?: boolean;
    keyframes?: AnimationKeyframe<Props>[];
}

declare type CustomExtraElementInfo = Dictionary<unknown>;
declare const STYLE_VISUAL_TYPE: {
    readonly color: "fill";
    readonly borderColor: "stroke";
};
declare type StyleVisualProps = keyof typeof STYLE_VISUAL_TYPE;
declare const NON_STYLE_VISUAL_PROPS: {
    readonly symbol: 1;
    readonly symbolSize: 1;
    readonly symbolKeepAspect: 1;
    readonly legendIcon: 1;
    readonly visualMeta: 1;
    readonly liftZ: 1;
    readonly decal: 1;
};
declare type NonStyleVisualProps = keyof typeof NON_STYLE_VISUAL_PROPS;
declare type ShapeMorphingOption = {
    /**
     * If do shape morphing animation when type is changed.
     * Only available on path.
     */
    morph?: boolean;
};
interface CustomBaseElementOption extends Partial<Pick<Element, TransformProp | 'silent' | 'ignore' | 'textConfig'>> {
    type: string;
    id?: string;
    name?: string;
    info?: CustomExtraElementInfo;
    textContent?: CustomTextOption | false;
    clipPath?: CustomBaseZRPathOption | false;
    extra?: Dictionary<unknown> & TransitionOptionMixin;
    during?(params: TransitionBaseDuringAPI): void;
    enterAnimation?: AnimationOption$1;
    updateAnimation?: AnimationOption$1;
    leaveAnimation?: AnimationOption$1;
}
interface CustomDisplayableOption extends CustomBaseElementOption, Partial<Pick<Displayable, 'zlevel' | 'z' | 'z2' | 'invisible'>> {
    style?: ZRStyleProps;
    during?(params: TransitionDuringAPI): void;
    /**
     * @deprecated
     */
    styleEmphasis?: ZRStyleProps | false;
    emphasis?: CustomDisplayableOptionOnState;
    blur?: CustomDisplayableOptionOnState;
    select?: CustomDisplayableOptionOnState;
}
interface CustomDisplayableOptionOnState extends Partial<Pick<Displayable, TransformProp | 'textConfig' | 'z2'>> {
    style?: ZRStyleProps | false;
}
interface CustomGroupOption extends CustomBaseElementOption, TransitionOptionMixin<GroupProps> {
    type: 'group';
    width?: number;
    height?: number;
    diffChildrenByName?: boolean;
    children: CustomElementOption[];
    $mergeChildren?: false | 'byName' | 'byIndex';
    keyframeAnimation?: ElementKeyframeAnimationOption<GroupProps> | ElementKeyframeAnimationOption<GroupProps>[];
}
interface CustomBaseZRPathOption<T extends PathProps['shape'] = PathProps['shape']> extends CustomDisplayableOption, ShapeMorphingOption, TransitionOptionMixin<PathProps & {
    shape: T;
}> {
    autoBatch?: boolean;
    shape?: T & TransitionOptionMixin<T>;
    style?: PathProps['style'] & TransitionOptionMixin<PathStyleProps>;
    during?(params: TransitionDuringAPI<PathStyleProps, T>): void;
    keyframeAnimation?: ElementKeyframeAnimationOption<PathProps & {
        shape: T;
    }> | ElementKeyframeAnimationOption<PathProps & {
        shape: T;
    }>[];
}
interface BuiltinShapes {
    circle: Partial<Circle['shape']>;
    rect: Partial<Rect['shape']>;
    sector: Partial<Sector['shape']>;
    polygon: Partial<Polygon['shape']>;
    polyline: Partial<Polyline['shape']>;
    line: Partial<Line['shape']>;
    arc: Partial<Arc['shape']>;
    bezierCurve: Partial<BezierCurve['shape']>;
    ring: Partial<Ring['shape']>;
    ellipse: Partial<Ellipse['shape']>;
    compoundPath: Partial<CompoundPath['shape']>;
}
interface CustomSVGPathShapeOption {
    pathData?: string;
    d?: string;
    layout?: 'center' | 'cover';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
interface CustomSVGPathOption extends CustomBaseZRPathOption<CustomSVGPathShapeOption> {
    type: 'path';
}
interface CustomBuitinPathOption<T extends keyof BuiltinShapes> extends CustomBaseZRPathOption<BuiltinShapes[T]> {
    type: T;
}
declare type CreateCustomBuitinPathOption<T extends keyof BuiltinShapes> = T extends any ? CustomBuitinPathOption<T> : never;
declare type CustomPathOption = CreateCustomBuitinPathOption<keyof BuiltinShapes> | CustomSVGPathOption;
interface CustomImageOptionOnState extends CustomDisplayableOptionOnState {
    style?: ImageStyleProps;
}
interface CustomImageOption extends CustomDisplayableOption, TransitionOptionMixin<ImageProps> {
    type: 'image';
    style?: ImageStyleProps & TransitionOptionMixin<ImageStyleProps>;
    emphasis?: CustomImageOptionOnState;
    blur?: CustomImageOptionOnState;
    select?: CustomImageOptionOnState;
    keyframeAnimation?: ElementKeyframeAnimationOption<ImageProps> | ElementKeyframeAnimationOption<ImageProps>[];
}
interface CustomTextOptionOnState extends CustomDisplayableOptionOnState {
    style?: TextStyleProps;
}
interface CustomTextOption extends CustomDisplayableOption, TransitionOptionMixin<TextProps> {
    type: 'text';
    style?: TextStyleProps & TransitionOptionMixin<TextStyleProps>;
    emphasis?: CustomTextOptionOnState;
    blur?: CustomTextOptionOnState;
    select?: CustomTextOptionOnState;
    keyframeAnimation?: ElementKeyframeAnimationOption<TextProps> | ElementKeyframeAnimationOption<TextProps>[];
}
declare type CustomElementOption = CustomPathOption | CustomImageOption | CustomTextOption | CustomGroupOption;
declare type CustomRootElementOption = CustomElementOption & {
    focus?: 'none' | 'self' | 'series' | ArrayLike<number>;
    blurScope?: BlurScope;
    emphasisDisabled?: boolean;
};
interface CustomSeriesRenderItemAPI extends CustomSeriesRenderItemCoordinateSystemAPI {
    getWidth(): number;
    getHeight(): number;
    getZr(): ZRenderType;
    getDevicePixelRatio(): number;
    value(dim: DimensionLoose, dataIndexInside?: number): ParsedValue;
    ordinalRawValue(dim: DimensionLoose, dataIndexInside?: number): ParsedValue | OrdinalRawValue;
    /**
     * @deprecated
     */
    style(userProps?: ZRStyleProps, dataIndexInside?: number): ZRStyleProps;
    /**
     * @deprecated
     */
    styleEmphasis(userProps?: ZRStyleProps, dataIndexInside?: number): ZRStyleProps;
    visual<VT extends NonStyleVisualProps | StyleVisualProps>(visualType: VT, dataIndexInside?: number): VT extends NonStyleVisualProps ? DefaultDataVisual[VT] : VT extends StyleVisualProps ? PathStyleProps[typeof STYLE_VISUAL_TYPE[VT]] : void;
    barLayout(opt: BarGridLayoutOptionForCustomSeries): BarGridLayoutResult;
    currentSeriesIndices(): number[];
    font(opt: Pick<TextCommonOption, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>): string;
}
interface CustomSeriesRenderItemParamsCoordSys {
    type: string;
}
interface CustomSeriesRenderItemCoordinateSystemAPI {
    coord(data: OptionDataValue | OptionDataValue[], clamp?: boolean): number[];
    size?(dataSize: OptionDataValue | OptionDataValue[], dataItem?: OptionDataValue | OptionDataValue[]): number | number[];
}
declare type WrapEncodeDefRet = Dictionary<number[]>;
interface CustomSeriesRenderItemParams {
    context: Dictionary<unknown>;
    dataIndex: number;
    seriesId: string;
    seriesName: string;
    seriesIndex: number;
    coordSys: CustomSeriesRenderItemParamsCoordSys;
    encode: WrapEncodeDefRet;
    dataIndexInside: number;
    dataInsideLength: number;
    actionType?: string;
}
declare type CustomSeriesRenderItemReturn = CustomRootElementOption | undefined | null;
declare type CustomSeriesRenderItem = (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => CustomSeriesRenderItemReturn;
interface CustomSeriesOption extends SeriesOption<unknown>, // don't support StateOption in custom series.
SeriesEncodeOptionMixin, SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin, SeriesOnSingleOptionMixin, SeriesOnGeoOptionMixin, SeriesOnCalendarOptionMixin {
    type?: 'custom';
    coordinateSystem?: string | 'none';
    renderItem?: CustomSeriesRenderItem;
    /**
     * @deprecated
     */
    itemStyle?: ItemStyleOption;
    /**
     * @deprecated
     */
    label?: LabelOption;
    /**
     * @deprecated
     */
    emphasis?: {
        /**
         * @deprecated
         */
        itemStyle?: ItemStyleOption;
        /**
         * @deprecated
         */
        label?: LabelOption;
    };
    clip?: boolean;
}
declare type PrepareCustomInfo = (coordSys: CoordinateSystem) => {
    coordSys: CustomSeriesRenderItemParamsCoordSys;
    api: CustomSeriesRenderItemCoordinateSystemAPI;
};

interface CoordinateSystemCreator {
    create: (ecModel: GlobalModel, api: ExtensionAPI) => CoordinateSystemMaster[];
    dimensions?: DimensionName[];
    getDimensionsInfo?: () => DimensionDefinitionLoose[];
}
/**
 * The instance get from `CoordinateSystemManger` is `CoordinateSystemMaster`.
 */
interface CoordinateSystemMaster {
    dimensions: DimensionName[];
    model?: ComponentModel;
    update?: (ecModel: GlobalModel, api: ExtensionAPI) => void;
    convertToPixel?(ecModel: GlobalModel, finder: ParsedModelFinder, value: ScaleDataValue | ScaleDataValue[]): number | number[];
    convertFromPixel?(ecModel: GlobalModel, finder: ParsedModelFinder, pixelValue: number | number[]): number | number[];
    containPoint(point: number[]): boolean;
    getAxes?: () => Axis[];
    axisPointerEnabled?: boolean;
    getTooltipAxes?: (dim: DimensionName | 'auto') => {
        baseAxes: Axis[];
        otherAxes: Axis[];
    };
    /**
     * Get layout rect or coordinate system
     */
    getRect?: () => RectLike;
}
/**
 * For example: cartesian is CoordinateSystem.
 * series.coordinateSystem is CoordinateSystem.
 */
interface CoordinateSystem {
    type: string;
    /**
     * Master of coordinate system. For example:
     * Grid is master of cartesian.
     */
    master?: CoordinateSystemMaster;
    dimensions: DimensionName[];
    model?: ComponentModel;
    /**
     * @param data
     * @param reserved Defined by the coordinate system itself
     * @param out
     * @return {Array.<number>} point Point in global pixel coordinate system.
     */
    dataToPoint(data: ScaleDataValue | ScaleDataValue[], reserved?: any, out?: number[]): number[];
    /**
     * Some coord sys (like Parallel) might do not have `pointToData`,
     * or the meaning of this kind of features is not clear yet.
     * @param point point Point in global pixel coordinate system.
     * @param clamp Clamp range
     * @return data
     */
    pointToData?(point: number[], clamp?: boolean): number | number[];
    containPoint(point: number[]): boolean;
    getAxis?: (dim?: DimensionName) => Axis;
    getBaseAxis?: () => Axis;
    getOtherAxis?: (baseAxis: Axis) => Axis;
    clampData?: (data: ScaleDataValue[], out?: number[]) => number[];
    getRoamTransform?: () => MatrixArray;
    getArea?: () => CoordinateSystemClipArea;
    getBoundingRect?: () => BoundingRect;
    getAxesByScale?: (scaleType: string) => Axis[];
    prepareCustoms?: PrepareCustomInfo;
}
/**
 * Like GridModel, PolarModel, ...
 */
interface CoordinateSystemHostModel extends ComponentModel {
    coordinateSystem?: CoordinateSystemMaster;
}
/**
 * Clip area will be returned by getArea of CoordinateSystem.
 * It is used to clip the graphic elements with the contain methods.
 */
interface CoordinateSystemClipArea {
    contain(x: number, y: number): boolean;
}

/**
 * LegendVisualProvider is an bridge that pick encoded color from data and
 * provide to the legend component.
 */
declare class LegendVisualProvider {
    private _getDataWithEncodedVisual;
    private _getRawData;
    constructor(getDataWithEncodedVisual: () => SeriesData, getRawData: () => SeriesData);
    getAllNames(): string[];
    containName(name: string): boolean;
    indexOfName(name: string): number;
    getItemVisual(dataIndex: number, key: string): any;
}

declare function makeStyleMapper(properties: readonly string[][], ignoreParent?: boolean): (model: Model, excludes?: readonly string[], includes?: readonly string[]) => PathStyleProps;

declare const SERIES_UNIVERSAL_TRANSITION_PROP = "__universalTransitionEnabled";
interface SeriesModel {
    /**
     * Convinient for override in extended class.
     * Implement it if needed.
     */
    preventIncremental(): boolean;
    /**
     * See tooltip.
     * Implement it if needed.
     * @return Point of tooltip. null/undefined can be returned.
     */
    getTooltipPosition(dataIndex: number): number[];
    /**
     * Get data indices for show tooltip content. See tooltip.
     * Implement it if needed.
     */
    getAxisTooltipData(dim: DimensionName[], value: ScaleDataValue, baseAxis: Axis): {
        dataIndices: number[];
        nestestValue: any;
    };
    /**
     * Get position for marker
     */
    getMarkerPosition(value: ScaleDataValue[]): number[];
    /**
     * Get legend icon symbol according to each series type
     */
    getLegendIcon(opt: LegendIconParams): ECSymbol | Group;
    /**
     * See `component/brush/selector.js`
     * Defined the brush selector for this series.
     */
    brushSelector(dataIndex: number, data: SeriesData, selectors: BrushCommonSelectorsForSeries, area: BrushSelectableArea): boolean;
    enableAriaDecal(): void;
}
declare class SeriesModel<Opt extends SeriesOption = SeriesOption> extends ComponentModel<Opt> {
    type: string;
    defaultOption: SeriesOption;
    seriesIndex: number;
    coordinateSystem: CoordinateSystem;
    dataTask: SeriesTask;
    pipelineContext: PipelineContext;
    legendVisualProvider: LegendVisualProvider;
    visualStyleAccessPath: string;
    visualDrawType: 'fill' | 'stroke';
    visualStyleMapper: ReturnType<typeof makeStyleMapper>;
    ignoreStyleOnData: boolean;
    hasSymbolVisual: boolean;
    defaultSymbol: string;
    legendIcon: string;
    [SERIES_UNIVERSAL_TRANSITION_PROP]: boolean;
    private _selectedDataIndicesMap;
    readonly preventUsingHoverLayer: boolean;
    static protoInitialize: void;
    init(option: Opt, parentModel: Model, ecModel: GlobalModel): void;
    /**
     * Util for merge default and theme to option
     */
    mergeDefaultAndTheme(option: Opt, ecModel: GlobalModel): void;
    mergeOption(newSeriesOption: Opt, ecModel: GlobalModel): void;
    fillDataTextStyle(data: ArrayLike<any>): void;
    /**
     * Init a data structure from data related option in series
     * Must be overriden.
     */
    getInitialData(option: Opt, ecModel: GlobalModel): SeriesData;
    /**
     * Append data to list
     */
    appendData(params: {
        data: ArrayLike<any>;
    }): void;
    /**
     * Consider some method like `filter`, `map` need make new data,
     * We should make sure that `seriesModel.getData()` get correct
     * data in the stream procedure. So we fetch data from upstream
     * each time `task.perform` called.
     */
    getData(dataType?: SeriesDataType): SeriesData<this>;
    getAllData(): ({
        data: SeriesData;
        type?: SeriesDataType;
    })[];
    setData(data: SeriesData): void;
    getEncode(): HashMap<OptionEncodeValue, string>;
    getSourceManager(): SourceManager;
    getSource(): Source;
    /**
     * Get data before processed
     */
    getRawData(): SeriesData;
    getColorBy(): ColorBy;
    isColorBySeries(): boolean;
    /**
     * Get base axis if has coordinate system and has axis.
     * By default use coordSys.getBaseAxis();
     * Can be overrided for some chart.
     * @return {type} description
     */
    getBaseAxis(): Axis;
    /**
     * Default tooltip formatter
     *
     * @param dataIndex
     * @param multipleSeries
     * @param dataType
     * @param renderMode valid values: 'html'(by default) and 'richText'.
     *        'html' is used for rendering tooltip in extra DOM form, and the result
     *        string is used as DOM HTML content.
     *        'richText' is used for rendering tooltip in rich text form, for those where
     *        DOM operation is not supported.
     * @return formatted tooltip with `html` and `markers`
     *        Notice: The override method can also return string
     */
    formatTooltip(dataIndex: number, multipleSeries?: boolean, dataType?: SeriesDataType): ReturnType<DataFormatMixin['formatTooltip']>;
    isAnimationEnabled(): boolean;
    restoreData(): void;
    getColorFromPalette(name: string, scope: any, requestColorNum?: number): ZRColor;
    /**
     * Use `data.mapDimensionsAll(coordDim)` instead.
     * @deprecated
     */
    coordDimToDataDim(coordDim: DimensionName): DimensionName[];
    /**
     * Get progressive rendering count each step
     */
    getProgressive(): number | false;
    /**
     * Get progressive rendering count each step
     */
    getProgressiveThreshold(): number;
    select(innerDataIndices: number[], dataType?: SeriesDataType): void;
    unselect(innerDataIndices: number[], dataType?: SeriesDataType): void;
    toggleSelect(innerDataIndices: number[], dataType?: SeriesDataType): void;
    getSelectedDataIndices(): number[];
    isSelected(dataIndex: number, dataType?: SeriesDataType): boolean;
    isUniversalTransitionEnabled(): boolean;
    private _innerSelect;
    private _initSelectedMapFromData;
    static registerClass(clz: Constructor): Constructor;
}
interface SeriesModel<Opt extends SeriesOption = SeriesOption> extends DataFormatMixin, PaletteMixin<Opt>, DataHost {
    /**
     * Get dimension to render shadow in dataZoom component
     */
    getShadowDim?(): string;
}

/**
 * Multi dimensional data store
 */
declare const dataCtors: {
    readonly float: ArrayConstructor | Float64ArrayConstructor;
    readonly int: ArrayConstructor | Int32ArrayConstructor;
    readonly ordinal: ArrayConstructor;
    readonly number: ArrayConstructor;
    readonly time: ArrayConstructor | Float64ArrayConstructor;
};
declare type DataStoreDimensionType = keyof typeof dataCtors;
declare type EachCb = (...args: any) => void;
declare type FilterCb = (...args: any) => boolean;
declare type MapCb = (...args: any) => ParsedValue | ParsedValue[];
declare type DimValueGetter = (this: DataStore, dataItem: any, property: string, dataIndex: number, dimIndex: DimensionIndex) => ParsedValue;
interface DataStoreDimensionDefine {
    /**
     * Default to be float.
     */
    type?: DataStoreDimensionType;
    /**
     * Only used in SOURCE_FORMAT_OBJECT_ROWS and SOURCE_FORMAT_KEYED_COLUMNS to retrieve value
     * by "object property".
     * For example, in `[{bb: 124, aa: 543}, ...]`, "aa" and "bb" is "object property".
     *
     * Deliberately name it as "property" rather than "name" to prevent it from been used in
     * SOURCE_FORMAT_ARRAY_ROWS, becuase if it comes from series, it probably
     * can not be shared by different series.
     */
    property?: string;
    /**
     * When using category axis.
     * Category strings will be collected and stored in ordinalMeta.categories.
     * And store will store the index of categories.
     */
    ordinalMeta?: OrdinalMeta;
    /**
     * Offset for ordinal parsing and collect
     */
    ordinalOffset?: number;
}
/**
 * Basically, DataStore API keep immutable.
 */
declare class DataStore {
    private _chunks;
    private _provider;
    private _rawExtent;
    private _extent;
    private _indices;
    private _count;
    private _rawCount;
    private _dimensions;
    private _dimValueGetter;
    private _calcDimNameToIdx;
    defaultDimValueGetter: DimValueGetter;
    /**
     * Initialize from data
     */
    initData(provider: DataProvider, inputDimensions: DataStoreDimensionDefine[], dimValueGetter?: DimValueGetter): void;
    getProvider(): DataProvider;
    /**
     * Caution: even when a `source` instance owned by a series, the created data store
     * may still be shared by different sereis (the source hash does not use all `source`
     * props, see `sourceManager`). In this case, the `source` props that are not used in
     * hash (like `source.dimensionDefine`) probably only belongs to a certain series and
     * thus should not be fetch here.
     */
    getSource(): Source;
    /**
     * @caution Only used in dataStack.
     */
    ensureCalculationDimension(dimName: DimensionName, type: DataStoreDimensionType): DimensionIndex;
    collectOrdinalMeta(dimIdx: number, ordinalMeta: OrdinalMeta): void;
    getOrdinalMeta(dimIdx: number): OrdinalMeta;
    getDimensionProperty(dimIndex: DimensionIndex): DataStoreDimensionDefine['property'];
    /**
     * Caution: Can be only called on raw data (before `this._indices` created).
     */
    appendData(data: ArrayLike<any>): number[];
    appendValues(values: any[][], minFillLen?: number): {
        start: number;
        end: number;
    };
    private _initDataFromProvider;
    count(): number;
    /**
     * Get value. Return NaN if idx is out of range.
     */
    get(dim: DimensionIndex, idx: number): ParsedValue;
    getValues(idx: number): ParsedValue[];
    getValues(dimensions: readonly DimensionIndex[], idx?: number): ParsedValue[];
    /**
     * @param dim concrete dim
     */
    getByRawIndex(dim: DimensionIndex, rawIdx: number): ParsedValue;
    /**
     * Get sum of data in one dimension
     */
    getSum(dim: DimensionIndex): number;
    /**
     * Get median of data in one dimension
     */
    getMedian(dim: DimensionIndex): number;
    /**
     * Retreive the index with given raw data index
     */
    indexOfRawIndex(rawIndex: number): number;
    /**
     * Retreive the index of nearest value
     * @param dim
     * @param value
     * @param [maxDistance=Infinity]
     * @return If and only if multiple indices has
     *         the same value, they are put to the result.
     */
    indicesOfNearest(dim: DimensionIndex, value: number, maxDistance?: number): number[];
    getIndices(): ArrayLike<number>;
    /**
     * Data filter.
     */
    filter(dims: DimensionIndex[], cb: FilterCb): DataStore;
    /**
     * Select data in range. (For optimization of filter)
     * (Manually inline code, support 5 million data filtering in data zoom.)
     */
    selectRange(range: {
        [dimIdx: number]: [number, number];
    }): DataStore;
    /**
     * Data mapping to a new List with given dimensions
     */
    map(dims: DimensionIndex[], cb: MapCb): DataStore;
    /**
     * @caution Danger!! Only used in dataStack.
     */
    modify(dims: DimensionIndex[], cb: MapCb): void;
    private _updateDims;
    /**
     * Large data down sampling using largest-triangle-three-buckets
     * @param {string} valueDimension
     * @param {number} targetCount
     */
    lttbDownSample(valueDimension: DimensionIndex, rate: number): DataStore;
    /**
     * Large data down sampling on given dimension
     * @param sampleIndex Sample index for name and id
     */
    downSample(dimension: DimensionIndex, rate: number, sampleValue: (frameValues: ArrayLike<ParsedValue>) => ParsedValueNumeric, sampleIndex: (frameValues: ArrayLike<ParsedValue>, value: ParsedValueNumeric) => number): DataStore;
    /**
     * Data iteration
     * @param ctx default this
     * @example
     *  list.each('x', function (x, idx) {});
     *  list.each(['x', 'y'], function (x, y, idx) {});
     *  list.each(function (idx) {})
     */
    each(dims: DimensionIndex[], cb: EachCb): void;
    /**
     * Get extent of data in one dimension
     */
    getDataExtent(dim: DimensionIndex): [number, number];
    /**
     * Get raw data index.
     * Do not initialize.
     * Default `getRawIndex`. And it can be changed.
     */
    getRawIndex: (idx: number) => number;
    /**
     * Get raw data item
     */
    getRawDataItem(idx: number): OptionDataItem;
    /**
     * Clone shallow.
     *
     * @param clonedDims Determine which dims to clone. Will share the data if not specified.
     */
    clone(clonedDims?: DimensionIndex[], ignoreIndices?: boolean): DataStore;
    private _copyCommonProps;
    private _cloneIndices;
    private _getRawIdxIdentity;
    private _getRawIdx;
    private _updateGetRawIdx;
    private static internalField;
}

declare class SeriesDimensionDefine {
    /**
     * Dimension type. The enumerable values are the key of
     * Optional.
     */
    type?: DimensionType;
    /**
     * Dimension name.
     * Mandatory.
     */
    name: string;
    /**
     * The origin name in dimsDef, see source helper.
     * If displayName given, the tooltip will displayed vertically.
     * Optional.
     */
    displayName?: string;
    tooltip?: boolean;
    /**
     * This dimension maps to the the dimension in dataStore by `storeDimIndex`.
     * Notice the facts:
     * 1. When there are too many dimensions in data store, seriesData only save the
     * used store dimensions.
     * 2. We use dimensionIndex but not name to reference store dimension
     * becuause the dataset dimension definition might has no name specified by users,
     * or names in sereis dimension definition might be different from dataset.
     */
    storeDimIndex?: number;
    /**
     * Which coordSys dimension this dimension mapped to.
     * A `coordDim` can be a "coordSysDim" that the coordSys required
     * (for example, an item in `coordSysDims` of `model/referHelper#CoordSysInfo`),
     * or an generated "extra coord name" if does not mapped to any "coordSysDim"
     * (That is determined by whether `isExtraCoord` is `true`).
     * Mandatory.
     */
    coordDim?: string;
    /**
     * The index of this dimension in `series.encode[coordDim]`.
     * Mandatory.
     */
    coordDimIndex?: number;
    /**
     * The format of `otherDims` is:
     * ```js
     * {
     *     tooltip?: number
     *     label?: number
     *     itemName?: number
     *     seriesName?: number
     * }
     * ```
     *
     * A `series.encode` can specified these fields:
     * ```js
     * encode: {
     *     // "3, 1, 5" is the index of data dimension.
     *     tooltip: [3, 1, 5],
     *     label: [0, 3],
     *     ...
     * }
     * ```
     * `otherDims` is the parse result of the `series.encode` above, like:
     * ```js
     * // Suppose the index of this data dimension is `3`.
     * this.otherDims = {
     *     // `3` is at the index `0` of the `encode.tooltip`
     *     tooltip: 0,
     *     // `3` is at the index `1` of the `encode.label`
     *     label: 1
     * };
     * ```
     *
     * This prop should never be `null`/`undefined` after initialized.
     */
    otherDims?: DataVisualDimensions;
    /**
     * Be `true` if this dimension is not mapped to any "coordSysDim" that the
     * "coordSys" required.
     * Mandatory.
     */
    isExtraCoord?: boolean;
    /**
     * If this dimension if for calculated value like stacking
     */
    isCalculationCoord?: boolean;
    defaultTooltip?: boolean;
    ordinalMeta?: OrdinalMeta;
    /**
     * Whether to create inverted indices.
     */
    createInvertedIndices?: boolean;
    /**
     * @param opt All of the fields will be shallow copied.
     */
    constructor(opt?: object | SeriesDimensionDefine);
}

/**
 * Represents the dimension requirement of a series.
 *
 * NOTICE:
 * When there are too many dimensions in dataset and many series, only the used dimensions
 * (i.e., used by coord sys and declared in `series.encode`) are add to `dimensionDefineList`.
 * But users may query data by other unused dimension names.
 * In this case, users can only query data if and only if they have defined dimension names
 * via ec option, so we provide `getDimensionIndexFromSource`, which only query them from
 * `source` dimensions.
 */
declare class SeriesDataSchema {
    /**
     * When there are too many dimensions, `dimensionDefineList` might only contain
     * used dimensions.
     *
     * CAUTION:
     * Should have been sorted by `storeDimIndex` asc.
     *
     * PENDING:
     * The item can still be modified outsite.
     * But MUST NOT add/remove item of this array.
     */
    readonly dimensions: SeriesDimensionDefine[];
    readonly source: Source;
    private _fullDimCount;
    private _dimNameMap;
    private _dimOmitted;
    constructor(opt: {
        source: Source;
        dimensions: SeriesDimensionDefine[];
        fullDimensionCount: number;
        dimensionOmitted: boolean;
    });
    isDimensionOmitted(): boolean;
    private _updateDimOmitted;
    /**
     * @caution Can only be used when `dimensionOmitted: true`.
     *
     * Get index by user defined dimension name (i.e., not internal generate name).
     * That is, get index from `dimensionsDefine`.
     * If no `dimensionsDefine`, or no name get, return -1.
     */
    getSourceDimensionIndex(dimName: DimensionName): DimensionIndex;
    /**
     * @caution Can only be used when `dimensionOmitted: true`.
     *
     * Notice: may return `null`/`undefined` if user not specify dimension names.
     */
    getSourceDimension(dimIndex: DimensionIndex): DimensionDefinition;
    makeStoreSchema(): {
        dimensions: DataStoreDimensionDefine[];
        hash: string;
    };
    makeOutputDimensionNames(): DimensionName[];
    appendCalculationDimension(dimDef: SeriesDimensionDefine): void;
}

/**
 * [REQUIREMENT_MEMO]:
 * (0) `metaRawOption` means `dimensions`/`sourceHeader`/`seriesLayoutBy` in raw option.
 * (1) Keep support the feature: `metaRawOption` can be specified both on `series` and
 * `root-dataset`. Them on `series` has higher priority.
 * (2) Do not support to set `metaRawOption` on a `non-root-dataset`, because it might
 * confuse users: whether those props indicate how to visit the upstream source or visit
 * the transform result source, and some transforms has nothing to do with these props,
 * and some transforms might have multiple upstream.
 * (3) Transforms should specify `metaRawOption` in each output, just like they can be
 * declared in `root-dataset`.
 * (4) At present only support visit source in `SERIES_LAYOUT_BY_COLUMN` in transforms.
 * That is for reducing complexity in transfroms.
 * PENDING: Whether to provide transposition transform?
 *
 * [IMPLEMENTAION_MEMO]:
 * "sourceVisitConfig" are calculated from `metaRawOption` and `data`.
 * They will not be calculated until `source` is about to be visited (to prevent from
 * duplicate calcuation). `source` is visited only in series and input to transforms.
 *
 * [DIMENSION_INHERIT_RULE]:
 * By default the dimensions are inherited from ancestors, unless a transform return
 * a new dimensions definition.
 * Consider the case:
 * ```js
 * dataset: [{
 *     source: [ ['Product', 'Sales', 'Prise'], ['Cookies', 321, 44.21], ...]
 * }, {
 *     transform: { type: 'filter', ... }
 * }]
 * dataset: [{
 *     dimension: ['Product', 'Sales', 'Prise'],
 *     source: [ ['Cookies', 321, 44.21], ...]
 * }, {
 *     transform: { type: 'filter', ... }
 * }]
 * ```
 * The two types of option should have the same behavior after transform.
 *
 *
 * [SCENARIO]:
 * (1) Provide source data directly:
 * ```js
 * series: {
 *     encode: {...},
 *     dimensions: [...]
 *     seriesLayoutBy: 'row',
 *     data: [[...]]
 * }
 * ```
 * (2) Series refer to dataset.
 * ```js
 * series: [{
 *     encode: {...}
 *     // Ignore datasetIndex means `datasetIndex: 0`
 *     // and the dimensions defination in dataset is used
 * }, {
 *     encode: {...},
 *     seriesLayoutBy: 'column',
 *     datasetIndex: 1
 * }]
 * ```
 * (3) dataset transform
 * ```js
 * dataset: [{
 *     source: [...]
 * }, {
 *     source: [...]
 * }, {
 *     // By default from 0.
 *     transform: { type: 'filter', config: {...} }
 * }, {
 *     // Piped.
 *     transform: [
 *         { type: 'filter', config: {...} },
 *         { type: 'sort', config: {...} }
 *     ]
 * }, {
 *     id: 'regressionData',
 *     fromDatasetIndex: 1,
 *     // Third-party transform
 *     transform: { type: 'ecStat:regression', config: {...} }
 * }, {
 *     // retrieve the extra result.
 *     id: 'regressionFormula',
 *     fromDatasetId: 'regressionData',
 *     fromTransformResult: 1
 * }]
 * ```
 */
declare class SourceManager {
    private _sourceHost;
    private _sourceList;
    private _storeList;
    private _upstreamSignList;
    private _versionSignBase;
    private _dirty;
    constructor(sourceHost: DatasetModel | SeriesModel);
    /**
     * Mark dirty.
     */
    dirty(): void;
    private _setLocalSource;
    /**
     * For detecting whether the upstream source is dirty, so that
     * the local cached source (in `_sourceList`) should be discarded.
     */
    private _getVersionSign;
    /**
     * Always return a source instance. Otherwise throw error.
     */
    prepareSource(): void;
    private _createSource;
    private _applyTransform;
    private _isDirty;
    /**
     * @param sourceIndex By defualt 0, means "main source".
     *                    Most cases there is only one source.
     */
    getSource(sourceIndex?: number): Source;
    /**
     *
     * Get a data store which can be shared across series.
     * Only available for series.
     *
     * @param seriesDimRequest Dimensions that are generated in series.
     *        Should have been sorted by `storeDimIndex` asc.
     */
    getSharedDataStore(seriesDimRequest: SeriesDataSchema): DataStore;
    private _innerGetDataStore;
    /**
     * PEDING: Is it fast enough?
     * If no upstream, return empty array.
     */
    private _getUpstreamSourceManagers;
    private _getSourceMetaRawOption;
}

/**
 * This module is imported by echarts directly.
 *
 * Notice:
 * Always keep this file exists for backward compatibility.
 * Because before 4.1.0, dataset is an optional component,
 * some users may import this module manually.
 */

interface DatasetOption extends Pick<ComponentOption, 'type' | 'id' | 'name'>, Pick<SeriesEncodeOptionMixin, 'dimensions'> {
    mainType?: 'dataset';
    seriesLayoutBy?: SeriesLayoutBy;
    sourceHeader?: OptionSourceHeader;
    source?: OptionSourceData;
    fromDatasetIndex?: number;
    fromDatasetId?: string;
    transform?: DataTransformOption | PipedDataTransformOption;
    fromTransformResult?: number;
}
declare class DatasetModel<Opts extends DatasetOption = DatasetOption> extends ComponentModel<Opts> {
    type: string;
    static type: string;
    static defaultOption: DatasetOption;
    private _sourceManager;
    init(option: Opts, parentModel: Model, ecModel: GlobalModel): void;
    mergeOption(newOption: Opts, ecModel: GlobalModel): void;
    optionUpdated(): void;
    getSourceManager(): SourceManager;
}
declare function install(registers: EChartsExtensionInstallRegisters): void;

/**
 * [sourceFormat]
 *
 * + "original":
 * This format is only used in series.data, where
 * itemStyle can be specified in data item.
 *
 * + "arrayRows":
 * [
 *     ['product', 'score', 'amount'],
 *     ['Matcha Latte', 89.3, 95.8],
 *     ['Milk Tea', 92.1, 89.4],
 *     ['Cheese Cocoa', 94.4, 91.2],
 *     ['Walnut Brownie', 85.4, 76.9]
 * ]
 *
 * + "objectRows":
 * [
 *     {product: 'Matcha Latte', score: 89.3, amount: 95.8},
 *     {product: 'Milk Tea', score: 92.1, amount: 89.4},
 *     {product: 'Cheese Cocoa', score: 94.4, amount: 91.2},
 *     {product: 'Walnut Brownie', score: 85.4, amount: 76.9}
 * ]
 *
 * + "keyedColumns":
 * {
 *     'product': ['Matcha Latte', 'Milk Tea', 'Cheese Cocoa', 'Walnut Brownie'],
 *     'count': [823, 235, 1042, 988],
 *     'score': [95.8, 81.4, 91.2, 76.9]
 * }
 *
 * + "typedArray"
 *
 * + "unknown"
 */
interface SourceMetaRawOption {
    seriesLayoutBy: SeriesLayoutBy;
    sourceHeader: OptionSourceHeader;
    dimensions: DimensionDefinitionLoose[];
}
interface Source extends SourceImpl {
}
declare class SourceImpl {
    /**
     * Not null/undefined.
     */
    readonly data: OptionSourceData;
    /**
     * See also "detectSourceFormat".
     * Not null/undefined.
     */
    readonly sourceFormat: SourceFormat;
    /**
     * 'row' or 'column'
     * Not null/undefined.
     */
    readonly seriesLayoutBy: SeriesLayoutBy;
    /**
     * dimensions definition from:
     * (1) standalone defined in option prop `dimensions: [...]`
     * (2) detected from option data. See `determineSourceDimensions`.
     * If can not be detected (e.g., there is only pure data `[[11, 33], ...]`
     * `dimensionsDefine` will be null/undefined.
     */
    readonly dimensionsDefine: DimensionDefinition[];
    /**
     * Only make sense in `SOURCE_FORMAT_ARRAY_ROWS`.
     * That is the same as `sourceHeader: number`,
     * which means from which line the real data start.
     * Not null/undefined, uint.
     */
    readonly startIndex: number;
    /**
     * Dimension count detected from data. Only works when `dimensionDefine`
     * does not exists.
     * Can be null/undefined (when unknown), uint.
     */
    readonly dimensionsDetectedCount: number;
    /**
     * Raw props from user option.
     */
    readonly metaRawOption: SourceMetaRawOption;
    constructor(fields: {
        data: OptionSourceData;
        sourceFormat: SourceFormat;
        seriesLayoutBy?: SeriesLayoutBy;
        dimensionsDefine?: DimensionDefinition[];
        startIndex?: number;
        dimensionsDetectedCount?: number;
        metaRawOption?: SourceMetaRawOption;
        encodeDefine?: HashMap<OptionEncodeValue, DimensionName>;
    });
}

interface DataProvider {
    /**
     * true: all of the value are in primitive type (in type `OptionDataValue`).
     * false: Not sure whether any of them is non primitive type (in type `OptionDataItemObject`).
     *     Like `data: [ { value: xx, itemStyle: {...} }, ...]`
     *     At present it only happen in `SOURCE_FORMAT_ORIGINAL`.
     */
    pure?: boolean;
    /**
     * If data is persistent and will not be released after use.
     */
    persistent?: boolean;
    getSource(): Source;
    count(): number;
    getItem(idx: number, out?: OptionDataItem): OptionDataItem;
    fillStorage?(start: number, end: number, out: ArrayLike$1<ParsedValue>[], extent: number[][]): void;
    appendData?(newData: ArrayLike$1<OptionDataItem>): void;
    clean?(): void;
}

declare type DimensionSummaryEncode = {
    defaultedLabel: DimensionName[];
    defaultedTooltip: DimensionName[];
    [coordOrVisualDimName: string]: DimensionName[];
};
declare type DimensionSummary = {
    encode: DimensionSummaryEncode;
    userOutput: DimensionUserOuput;
    dataDimsOnCoord: DimensionName[];
    dataDimIndicesOnCoord: DimensionIndex[];
    encodeFirstDimNotExtra: {
        [coordDim: string]: DimensionName;
    };
};
declare type DimensionUserOuputEncode = {
    [coordOrVisualDimName: string]: DimensionIndex[];
};
declare class DimensionUserOuput {
    private _encode;
    private _cachedDimNames;
    private _schema?;
    constructor(encode: DimensionUserOuputEncode, dimRequest?: SeriesDataSchema);
    get(): {
        fullDimensions: DimensionName[];
        encode: DimensionUserOuputEncode;
    };
    /**
     * Get all data store dimension names.
     * Theoretically a series data store is defined both by series and used dataset (if any).
     * If some dimensions are omitted for performance reason in `this.dimensions`,
     * the dimension name may not be auto-generated if user does not specify a dimension name.
     * In this case, the dimension name is `null`/`undefined`.
     */
    private _getFullDimensionNames;
}

declare class Graph {
    type: 'graph';
    readonly nodes: GraphNode[];
    readonly edges: GraphEdge[];
    data: SeriesData;
    edgeData: SeriesData;
    /**
     * Whether directed graph.
     */
    private _directed;
    private _nodesMap;
    /**
     * @type {Object.<string, module:echarts/data/Graph.Edge>}
     * @private
     */
    private _edgesMap;
    constructor(directed?: boolean);
    /**
     * If is directed graph
     */
    isDirected(): boolean;
    /**
     * Add a new node
     */
    addNode(id: string | number, dataIndex?: number): GraphNode;
    /**
     * Get node by data index
     */
    getNodeByIndex(dataIndex: number): GraphNode;
    /**
     * Get node by id
     */
    getNodeById(id: string): GraphNode;
    /**
     * Add a new edge
     */
    addEdge(n1: GraphNode | number | string, n2: GraphNode | number | string, dataIndex?: number): GraphEdge;
    /**
     * Get edge by data index
     */
    getEdgeByIndex(dataIndex: number): GraphEdge;
    /**
     * Get edge by two linked nodes
     */
    getEdge(n1: string | GraphNode, n2: string | GraphNode): GraphEdge;
    /**
     * Iterate all nodes
     */
    eachNode<Ctx>(cb: (this: Ctx, node: GraphNode, idx: number) => void, context?: Ctx): void;
    /**
     * Iterate all edges
     */
    eachEdge<Ctx>(cb: (this: Ctx, edge: GraphEdge, idx: number) => void, context?: Ctx): void;
    /**
     * Breadth first traverse
     * Return true to stop traversing
     */
    breadthFirstTraverse<Ctx>(cb: (this: Ctx, node: GraphNode, fromNode: GraphNode) => boolean | void, startNode: GraphNode | string, direction: 'none' | 'in' | 'out', context?: Ctx): void;
    update(): void;
    /**
     * @return {module:echarts/data/Graph}
     */
    clone(): Graph;
}
interface GraphDataProxyMixin {
    getValue(dimension?: DimensionLoose): ParsedValue;
    setVisual(key: string | Dictionary<any>, value?: any): void;
    getVisual(key: string): any;
    setLayout(layout: any, merge?: boolean): void;
    getLayout(): any;
    getGraphicEl(): Element;
    getRawIndex(): number;
}
declare class GraphEdge {
    /**
     * The first node. If directed graph, it represents the source node.
     */
    node1: GraphNode;
    /**
     * The second node. If directed graph, it represents the target node.
     */
    node2: GraphNode;
    dataIndex: number;
    hostGraph: Graph;
    constructor(n1: GraphNode, n2: GraphNode, dataIndex?: number);
    getModel<T = unknown>(): Model<T>;
    getModel<T = unknown, S extends keyof T = keyof T>(path: S): Model<T[S]>;
    getAdjacentDataIndices(): {
        node: number[];
        edge: number[];
    };
}
interface GraphEdge extends GraphDataProxyMixin {
}
declare class GraphNode {
    id: string;
    inEdges: GraphEdge[];
    outEdges: GraphEdge[];
    edges: GraphEdge[];
    hostGraph: Graph;
    dataIndex: number;
    __visited: boolean;
    constructor(id?: string, dataIndex?: number);
    /**
     * @return {number}
     */
    degree(): number;
    /**
     * @return {number}
     */
    inDegree(): number;
    /**
    * @return {number}
    */
    outDegree(): number;
    getModel<T = unknown>(): Model<T>;
    getModel<T = unknown, S extends keyof T = keyof T>(path: S): Model<T[S]>;
    getAdjacentDataIndices(): {
        node: number[];
        edge: number[];
    };
}
interface GraphNode extends GraphDataProxyMixin {
}

declare type TreeTraverseOrder = 'preorder' | 'postorder';
declare type TreeTraverseCallback<Ctx> = (this: Ctx, node: TreeNode) => boolean | void;
declare type TreeTraverseOption = {
    order?: TreeTraverseOrder;
    attr?: 'children' | 'viewChildren';
};
interface TreeNodeOption extends Pick<OptionDataItemObject<OptionDataValue>, 'name' | 'value'> {
    children?: TreeNodeOption[];
}
declare class TreeNode {
    name: string;
    depth: number;
    height: number;
    parentNode: TreeNode;
    /**
     * Reference to list item.
     * Do not persistent dataIndex outside,
     * besause it may be changed by list.
     * If dataIndex -1,
     * this node is logical deleted (filtered) in list.
     */
    dataIndex: number;
    children: TreeNode[];
    viewChildren: TreeNode[];
    isExpand: boolean;
    readonly hostTree: Tree<Model>;
    constructor(name: string, hostTree: Tree<Model>);
    /**
     * The node is removed.
     */
    isRemoved(): boolean;
    /**
     * Travel this subtree (include this node).
     * Usage:
     *    node.eachNode(function () { ... }); // preorder
     *    node.eachNode('preorder', function () { ... }); // preorder
     *    node.eachNode('postorder', function () { ... }); // postorder
     *    node.eachNode(
     *        {order: 'postorder', attr: 'viewChildren'},
     *        function () { ... }
     *    ); // postorder
     *
     * @param options If string, means order.
     * @param options.order 'preorder' or 'postorder'
     * @param options.attr 'children' or 'viewChildren'
     * @param cb If in preorder and return false,
     *                      its subtree will not be visited.
     */
    eachNode<Ctx>(options: TreeTraverseOrder, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void;
    eachNode<Ctx>(options: TreeTraverseOption, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void;
    eachNode<Ctx>(cb: TreeTraverseCallback<Ctx>, context?: Ctx): void;
    /**
     * Update depth and height of this subtree.
     */
    updateDepthAndHeight(depth: number): void;
    getNodeById(id: string): TreeNode;
    contains(node: TreeNode): boolean;
    /**
     * @param includeSelf Default false.
     * @return order: [root, child, grandchild, ...]
     */
    getAncestors(includeSelf?: boolean): TreeNode[];
    getAncestorsIndices(): number[];
    getDescendantIndices(): number[];
    getValue(dimension?: DimensionLoose): ParsedValue;
    setLayout(layout: any, merge?: boolean): void;
    /**
     * @return {Object} layout
     */
    getLayout(): any;
    getModel<T = unknown>(): Model<T>;
    getLevelModel(): Model;
    /**
     * @example
     *  setItemVisual('color', color);
     *  setItemVisual({
     *      'color': color
     *  });
     */
    setVisual(key: string, value: any): void;
    setVisual(obj: Dictionary<any>): void;
    /**
     * Get item visual
     * FIXME: make return type better
     */
    getVisual(key: string): unknown;
    getRawIndex(): number;
    getId(): string;
    /**
     * index in parent's children
     */
    getChildIndex(): number;
    /**
     * if this is an ancestor of another node
     *
     * @param node another node
     * @return if is ancestor
     */
    isAncestorOf(node: TreeNode): boolean;
    /**
     * if this is an descendant of another node
     *
     * @param node another node
     * @return if is descendant
     */
    isDescendantOf(node: TreeNode): boolean;
}
declare class Tree<HostModel extends Model = Model, LevelOption = any> {
    type: 'tree';
    root: TreeNode;
    data: SeriesData;
    hostModel: HostModel;
    levelModels: Model<LevelOption>[];
    private _nodes;
    constructor(hostModel: HostModel);
    /**
     * Travel this subtree (include this node).
     * Usage:
     *    node.eachNode(function () { ... }); // preorder
     *    node.eachNode('preorder', function () { ... }); // preorder
     *    node.eachNode('postorder', function () { ... }); // postorder
     *    node.eachNode(
     *        {order: 'postorder', attr: 'viewChildren'},
     *        function () { ... }
     *    ); // postorder
     *
     * @param options If string, means order.
     * @param options.order 'preorder' or 'postorder'
     * @param options.attr 'children' or 'viewChildren'
     * @param cb
     * @param context
     */
    eachNode<Ctx>(options: TreeTraverseOrder, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void;
    eachNode<Ctx>(options: TreeTraverseOption, cb: TreeTraverseCallback<Ctx>, context?: Ctx): void;
    eachNode<Ctx>(cb: TreeTraverseCallback<Ctx>, context?: Ctx): void;
    getNodeByDataIndex(dataIndex: number): TreeNode;
    getNodeById(name: string): TreeNode;
    /**
     * Update item available by list,
     * when list has been performed options like 'filterSelf' or 'map'.
     */
    update(): void;
    /**
     * Clear all layouts
     */
    clearLayouts(): void;
    /**
     * data node format:
     * {
     *     name: ...
     *     value: ...
     *     children: [
     *         {
     *             name: ...
     *             value: ...
     *             children: ...
     *         },
     *         ...
     *     ]
     * }
     */
    static createTree<T extends TreeNodeOption, HostModel extends Model>(dataRoot: T, hostModel: HostModel, beforeLink?: (data: SeriesData) => void): Tree<HostModel, any>;
}

declare type VisualOptionBase = {
    [key in BuiltinVisualProperty]?: any;
};
declare type LabelFormatter = (min: OptionDataValue, max?: OptionDataValue) => string;
interface VisualMapOption<T extends VisualOptionBase = VisualOptionBase> extends ComponentOption, BoxLayoutOptionMixin, BorderOptionMixin {
    mainType?: 'visualMap';
    show?: boolean;
    align?: string;
    realtime?: boolean;
    /**
     * 'all' or null/undefined: all series.
     * A number or an array of number: the specified series.
     * set min: 0, max: 200, only for campatible with ec2.
     * In fact min max should not have default value.
     */
    seriesIndex?: 'all' | number[] | number;
    /**
     * min value, must specified if pieces is not specified.
     */
    min?: number;
    /**
     * max value, must specified if pieces is not specified.
     */
    max?: number;
    /**
     * Dimension to be encoded
     */
    dimension?: number;
    /**
     * Visual configuration for the data in selection
     */
    inRange?: T;
    /**
     * Visual configuration for the out of selection
     */
    outOfRange?: T;
    controller?: {
        inRange?: T;
        outOfRange?: T;
    };
    target?: {
        inRange?: T;
        outOfRange?: T;
    };
    /**
     * Width of the display item
     */
    itemWidth?: number;
    /**
     * Height of the display item
     */
    itemHeight?: number;
    inverse?: boolean;
    orient?: 'horizontal' | 'vertical';
    backgroundColor?: ZRColor;
    contentColor?: ZRColor;
    inactiveColor?: ZRColor;
    /**
     * Padding of the component. Can be an array similar to CSS
     */
    padding?: number[] | number;
    /**
     * Gap between text and item
     */
    textGap?: number;
    precision?: number;
    /**
     * @deprecated
     * Option from version 2
     */
    color?: ColorString[];
    formatter?: string | LabelFormatter;
    /**
     * Text on the both end. Such as ['High', 'Low']
     */
    text?: string[];
    textStyle?: LabelOption;
    categories?: unknown;
}
interface VisualMeta {
    stops: {
        value: number;
        color: ColorString;
    }[];
    outerColors: ColorString[];
    dimension?: DimensionIndex;
}

declare type ItrParamDims = DimensionLoose | Array<DimensionLoose>;
declare type CtxOrList<Ctx> = unknown extends Ctx ? SeriesData : Ctx;
declare type EachCb0<Ctx> = (this: CtxOrList<Ctx>, idx: number) => void;
declare type EachCb1<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, idx: number) => void;
declare type EachCb2<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, y: ParsedValue, idx: number) => void;
declare type EachCb$1<Ctx> = (this: CtxOrList<Ctx>, ...args: any) => void;
declare type FilterCb0<Ctx> = (this: CtxOrList<Ctx>, idx: number) => boolean;
declare type FilterCb1<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, idx: number) => boolean;
declare type FilterCb2<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, y: ParsedValue, idx: number) => boolean;
declare type FilterCb$1<Ctx> = (this: CtxOrList<Ctx>, ...args: any) => boolean;
declare type MapArrayCb0<Ctx> = (this: CtxOrList<Ctx>, idx: number) => any;
declare type MapArrayCb1<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, idx: number) => any;
declare type MapArrayCb2<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, y: ParsedValue, idx: number) => any;
declare type MapArrayCb<Ctx> = (this: CtxOrList<Ctx>, ...args: any) => any;
declare type MapCb1<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, idx: number) => ParsedValue | ParsedValue[];
declare type MapCb2<Ctx> = (this: CtxOrList<Ctx>, x: ParsedValue, y: ParsedValue, idx: number) => ParsedValue | ParsedValue[];
declare type SeriesDimensionDefineLoose = string | object | SeriesDimensionDefine;
declare type SeriesDimensionLoose = DimensionLoose;
declare type SeriesDimensionName = DimensionName;
interface DefaultDataVisual {
    style: PathStyleProps;
    drawType: 'fill' | 'stroke';
    symbol?: string;
    symbolSize?: number | number[];
    symbolRotate?: number;
    symbolKeepAspect?: boolean;
    symbolOffset?: string | number | (string | number)[];
    liftZ?: number;
    legendIcon?: string;
    legendLineStyle?: LineStyleProps;
    visualMeta?: VisualMeta[];
    colorFromPalette?: boolean;
    decal?: DecalObject;
}
interface DataCalculationInfo<SERIES_MODEL> {
    stackedDimension: DimensionName;
    stackedByDimension: DimensionName;
    isStackedByIndex: boolean;
    stackedOverDimension: DimensionName;
    stackResultDimension: DimensionName;
    stackedOnSeries?: SERIES_MODEL;
}
declare class SeriesData<HostModel extends Model = Model, Visual extends DefaultDataVisual = DefaultDataVisual> {
    readonly type = "list";
    /**
     * Name of dimensions list of SeriesData.
     *
     * @caution Carefully use the index of this array.
     * Becuase when DataStore is an extra high dimension(>30) dataset. We will only pick
     * the used dimensions from DataStore to avoid performance issue.
     */
    readonly dimensions: SeriesDimensionName[];
    private _dimInfos;
    private _dimOmitted;
    private _schema?;
    /**
     * @pending
     * Actually we do not really need to convert dimensionIndex to dimensionName
     * and do not need `_dimIdxToName` if we do everything internally based on dimension
     * index rather than dimension name.
     */
    private _dimIdxToName?;
    readonly hostModel: HostModel;
    /**
     * @readonly
     */
    dataType: SeriesDataType;
    /**
     * @readonly
     * Host graph if List is used to store graph nodes / edges.
     */
    graph?: Graph;
    /**
     * @readonly
     * Host tree if List is used to store tree ndoes.
     */
    tree?: Tree;
    private _store;
    private _nameList;
    private _idList;
    private _visual;
    private _layout;
    private _itemVisuals;
    private _itemLayouts;
    private _graphicEls;
    private _approximateExtent;
    private _dimSummary;
    private _invertedIndicesMap;
    private _calculationInfo;
    userOutput: DimensionSummary['userOutput'];
    hasItemOption: boolean;
    private _nameRepeatCount;
    private _nameDimIdx;
    private _idDimIdx;
    private __wrappedMethods;
    TRANSFERABLE_METHODS: readonly ["cloneShallow", "downSample", "lttbDownSample", "map"];
    CHANGABLE_METHODS: readonly ["filterSelf", "selectRange"];
    DOWNSAMPLE_METHODS: readonly ["downSample", "lttbDownSample"];
    /**
     * @param dimensionsInput.dimensions
     *        For example, ['someDimName', {name: 'someDimName', type: 'someDimType'}, ...].
     *        Dimensions should be concrete names like x, y, z, lng, lat, angle, radius
     */
    constructor(dimensionsInput: SeriesDataSchema | SeriesDimensionDefineLoose[], hostModel: HostModel);
    /**
     *
     * Get concrete dimension name by dimension name or dimension index.
     * If input a dimension name, do not validate whether the dimension name exits.
     *
     * @caution
     * @param dim Must make sure the dimension is `SeriesDimensionLoose`.
     * Because only those dimensions will have auto-generated dimension names if not
     * have a user-specified name, and other dimensions will get a return of null/undefined.
     *
     * @notice Becuause of this reason, should better use `getDimensionIndex` instead, for examples:
     * ```js
     * const val = data.getStore().get(data.getDimensionIndex(dim), dataIdx);
     * ```
     *
     * @return Concrete dim name.
     */
    getDimension(dim: SeriesDimensionLoose): DimensionName;
    /**
     * Get dimension index in data store. Return -1 if not found.
     * Can be used to index value from getRawValue.
     */
    getDimensionIndex(dim: DimensionLoose): DimensionIndex;
    /**
     * The meanings of the input parameter `dim`:
     *
     * + If dim is a number (e.g., `1`), it means the index of the dimension.
     *   For example, `getDimension(0)` will return 'x' or 'lng' or 'radius'.
     * + If dim is a number-like string (e.g., `"1"`):
     *     + If there is the same concrete dim name defined in `series.dimensions` or `dataset.dimensions`,
     *        it means that concrete name.
     *     + If not, it will be converted to a number, which means the index of the dimension.
     *        (why? because of the backward compatbility. We have been tolerating number-like string in
     *        dimension setting, although now it seems that it is not a good idea.)
     *     For example, `visualMap[i].dimension: "1"` is the same meaning as `visualMap[i].dimension: 1`,
     *     if no dimension name is defined as `"1"`.
     * + If dim is a not-number-like string, it means the concrete dim name.
     *   For example, it can be be default name `"x"`, `"y"`, `"z"`, `"lng"`, `"lat"`, `"angle"`, `"radius"`,
     *   or customized in `dimensions` property of option like `"age"`.
     *
     * @return recogonized `DimensionIndex`. Otherwise return null/undefined (means that dim is `DimensionName`).
     */
    private _recognizeDimIndex;
    private _getStoreDimIndex;
    /**
     * Get type and calculation info of particular dimension
     * @param dim
     *        Dimension can be concrete names like x, y, z, lng, lat, angle, radius
     *        Or a ordinal number. For example getDimensionInfo(0) will return 'x' or 'lng' or 'radius'
     */
    getDimensionInfo(dim: SeriesDimensionLoose): SeriesDimensionDefine;
    /**
     * If `dimName` if from outside of `SeriesData`,
     * use this method other than visit `this._dimInfos` directly.
     */
    private _getDimInfo;
    private _initGetDimensionInfo;
    /**
     * concrete dimension name list on coord.
     */
    getDimensionsOnCoord(): SeriesDimensionName[];
    /**
     * @param coordDim
     * @param idx A coordDim may map to more than one data dim.
     *        If not specified, return the first dim not extra.
     * @return concrete data dim. If not found, return null/undefined
     */
    mapDimension(coordDim: SeriesDimensionName): SeriesDimensionName;
    mapDimension(coordDim: SeriesDimensionName, idx: number): SeriesDimensionName;
    mapDimensionsAll(coordDim: SeriesDimensionName): SeriesDimensionName[];
    getStore(): DataStore;
    /**
     * Initialize from data
     * @param data source or data or data store.
     * @param nameList The name of a datum is used on data diff and
     *        default label/tooltip.
     *        A name can be specified in encode.itemName,
     *        or dataItem.name (only for series option data),
     *        or provided in nameList from outside.
     */
    initData(data: Source | OptionSourceData | DataStore | DataProvider, nameList?: string[], dimValueGetter?: DimValueGetter): void;
    /**
     * Caution: Can be only called on raw data (before `this._indices` created).
     */
    appendData(data: ArrayLike$1<any>): void;
    /**
     * Caution: Can be only called on raw data (before `this._indices` created).
     * This method does not modify `rawData` (`dataProvider`), but only
     * add values to store.
     *
     * The final count will be increased by `Math.max(values.length, names.length)`.
     *
     * @param values That is the SourceType: 'arrayRows', like
     *        [
     *            [12, 33, 44],
     *            [NaN, 43, 1],
     *            ['-', 'asdf', 0]
     *        ]
     *        Each item is exaclty cooresponding to a dimension.
     */
    appendValues(values: any[][], names?: string[]): void;
    private _updateOrdinalMeta;
    private _shouldMakeIdFromName;
    private _doInit;
    /**
     * PENDING: In fact currently this function is only used to short-circuit
     * the calling of `scale.unionExtentFromData` when data have been filtered by modules
     * like "dataZoom". `scale.unionExtentFromData` is used to calculate data extent for series on
     * an axis, but if a "axis related data filter module" is used, the extent of the axis have
     * been fixed and no need to calling `scale.unionExtentFromData` actually.
     * But if we add "custom data filter" in future, which is not "axis related", this method may
     * be still needed.
     *
     * Optimize for the scenario that data is filtered by a given extent.
     * Consider that if data amount is more than hundreds of thousand,
     * extent calculation will cost more than 10ms and the cache will
     * be erased because of the filtering.
     */
    getApproximateExtent(dim: SeriesDimensionLoose): [number, number];
    /**
     * Calculate extent on a filtered data might be time consuming.
     * Approximate extent is only used for: calculte extent of filtered data outside.
     */
    setApproximateExtent(extent: [number, number], dim: SeriesDimensionLoose): void;
    getCalculationInfo<CALC_INFO_KEY extends keyof DataCalculationInfo<HostModel>>(key: CALC_INFO_KEY): DataCalculationInfo<HostModel>[CALC_INFO_KEY];
    /**
     * @param key or k-v object
     */
    setCalculationInfo(key: DataCalculationInfo<HostModel>): void;
    setCalculationInfo<CALC_INFO_KEY extends keyof DataCalculationInfo<HostModel>>(key: CALC_INFO_KEY, value: DataCalculationInfo<HostModel>[CALC_INFO_KEY]): void;
    /**
     * @return Never be null/undefined. `number` will be converted to string. Becuase:
     * In most cases, name is used in display, where returning a string is more convenient.
     * In other cases, name is used in query (see `indexOfName`), where we can keep the
     * rule that name `2` equals to name `'2'`.
     */
    getName(idx: number): string;
    private _getCategory;
    /**
     * @return Never null/undefined. `number` will be converted to string. Becuase:
     * In all cases having encountered at present, id is used in making diff comparison, which
     * are usually based on hash map. We can keep the rule that the internal id are always string
     * (treat `2` is the same as `'2'`) to make the related logic simple.
     */
    getId(idx: number): string;
    count(): number;
    /**
     * Get value. Return NaN if idx is out of range.
     *
     * @notice Should better to use `data.getStore().get(dimIndex, dataIdx)` instead.
     */
    get(dim: SeriesDimensionName, idx: number): ParsedValue;
    /**
     * @notice Should better to use `data.getStore().getByRawIndex(dimIndex, dataIdx)` instead.
     */
    getByRawIndex(dim: SeriesDimensionName, rawIdx: number): ParsedValue;
    getIndices(): globalThis.ArrayLike<number>;
    getDataExtent(dim: DimensionLoose): [number, number];
    getSum(dim: DimensionLoose): number;
    getMedian(dim: DimensionLoose): number;
    /**
     * Get value for multi dimensions.
     * @param dimensions If ignored, using all dimensions.
     */
    getValues(idx: number): ParsedValue[];
    getValues(dimensions: readonly DimensionName[], idx: number): ParsedValue[];
    /**
     * If value is NaN. Inlcuding '-'
     * Only check the coord dimensions.
     */
    hasValue(idx: number): boolean;
    /**
     * Retreive the index with given name
     */
    indexOfName(name: string): number;
    getRawIndex(idx: number): number;
    indexOfRawIndex(rawIndex: number): number;
    /**
     * Only support the dimension which inverted index created.
     * Do not support other cases until required.
     * @param dim concrete dim
     * @param value ordinal index
     * @return rawIndex
     */
    rawIndexOf(dim: SeriesDimensionName, value: OrdinalNumber): number;
    /**
     * Retreive the index of nearest value
     * @param dim
     * @param value
     * @param [maxDistance=Infinity]
     * @return If and only if multiple indices has
     *         the same value, they are put to the result.
     */
    indicesOfNearest(dim: DimensionLoose, value: number, maxDistance?: number): number[];
    /**
     * Data iteration
     * @param ctx default this
     * @example
     *  list.each('x', function (x, idx) {});
     *  list.each(['x', 'y'], function (x, y, idx) {});
     *  list.each(function (idx) {})
     */
    each<Ctx>(cb: EachCb0<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): void;
    each<Ctx>(dims: DimensionLoose, cb: EachCb1<Ctx>, ctx?: Ctx): void;
    each<Ctx>(dims: [DimensionLoose], cb: EachCb1<Ctx>, ctx?: Ctx): void;
    each<Ctx>(dims: [DimensionLoose, DimensionLoose], cb: EachCb2<Ctx>, ctx?: Ctx): void;
    each<Ctx>(dims: ItrParamDims, cb: EachCb$1<Ctx>, ctx?: Ctx): void;
    /**
     * Data filter
     */
    filterSelf<Ctx>(cb: FilterCb0<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): this;
    filterSelf<Ctx>(dims: DimensionLoose, cb: FilterCb1<Ctx>, ctx?: Ctx): this;
    filterSelf<Ctx>(dims: [DimensionLoose], cb: FilterCb1<Ctx>, ctx?: Ctx): this;
    filterSelf<Ctx>(dims: [DimensionLoose, DimensionLoose], cb: FilterCb2<Ctx>, ctx?: Ctx): this;
    filterSelf<Ctx>(dims: ItrParamDims, cb: FilterCb$1<Ctx>, ctx?: Ctx): this;
    /**
     * Select data in range. (For optimization of filter)
     * (Manually inline code, support 5 million data filtering in data zoom.)
     */
    selectRange(range: Record<string, [number, number]>): SeriesData;
    /**
     * Data mapping to a plain array
     */
    mapArray<Ctx, Cb extends MapArrayCb0<Ctx>>(cb: Cb, ctx?: Ctx, ctxCompat?: Ctx): ReturnType<Cb>[];
    mapArray<Ctx, Cb extends MapArrayCb1<Ctx>>(dims: DimensionLoose, cb: Cb, ctx?: Ctx, ctxCompat?: Ctx): ReturnType<Cb>[];
    mapArray<Ctx, Cb extends MapArrayCb1<Ctx>>(dims: [DimensionLoose], cb: Cb, ctx?: Ctx, ctxCompat?: Ctx): ReturnType<Cb>[];
    mapArray<Ctx, Cb extends MapArrayCb2<Ctx>>(dims: [DimensionLoose, DimensionLoose], cb: Cb, ctx?: Ctx, ctxCompat?: Ctx): ReturnType<Cb>[];
    mapArray<Ctx, Cb extends MapArrayCb<Ctx>>(dims: ItrParamDims, cb: Cb, ctx?: Ctx, ctxCompat?: Ctx): ReturnType<Cb>[];
    /**
     * Data mapping to a new List with given dimensions
     */
    map<Ctx>(dims: DimensionLoose, cb: MapCb1<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): SeriesData<HostModel>;
    map<Ctx>(dims: [DimensionLoose], cb: MapCb1<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): SeriesData<HostModel>;
    map<Ctx>(dims: [DimensionLoose, DimensionLoose], cb: MapCb2<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): SeriesData<HostModel>;
    /**
     * !!Danger: used on stack dimension only.
     */
    modify<Ctx>(dims: DimensionLoose, cb: MapCb1<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): void;
    modify<Ctx>(dims: [DimensionLoose], cb: MapCb1<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): void;
    modify<Ctx>(dims: [DimensionLoose, DimensionLoose], cb: MapCb2<Ctx>, ctx?: Ctx, ctxCompat?: Ctx): void;
    /**
     * Large data down sampling on given dimension
     * @param sampleIndex Sample index for name and id
     */
    downSample(dimension: DimensionLoose, rate: number, sampleValue: (frameValues: ArrayLike$1<ParsedValue>) => ParsedValueNumeric, sampleIndex: (frameValues: ArrayLike$1<ParsedValue>, value: ParsedValueNumeric) => number): SeriesData<HostModel>;
    /**
     * Large data down sampling using largest-triangle-three-buckets
     * @param {string} valueDimension
     * @param {number} targetCount
     */
    lttbDownSample(valueDimension: DimensionLoose, rate: number): SeriesData<HostModel>;
    getRawDataItem(idx: number): OptionDataItem;
    /**
     * Get model of one data item.
     */
    getItemModel<ItemOpts extends unknown = unknown>(idx: number): Model<ItemOpts>;
    /**
     * Create a data differ
     */
    diff(otherList: SeriesData): DataDiffer;
    /**
     * Get visual property.
     */
    getVisual<K extends keyof Visual>(key: K): Visual[K];
    /**
     * Set visual property
     *
     * @example
     *  setVisual('color', color);
     *  setVisual({
     *      'color': color
     *  });
     */
    setVisual<K extends keyof Visual>(key: K, val: Visual[K]): void;
    setVisual(kvObj: Partial<Visual>): void;
    /**
     * Get visual property of single data item
     */
    getItemVisual<K extends keyof Visual>(idx: number, key: K): Visual[K];
    /**
     * If exists visual property of single data item
     */
    hasItemVisual(): boolean;
    /**
     * Make sure itemVisual property is unique
     */
    ensureUniqueItemVisual<K extends keyof Visual>(idx: number, key: K): Visual[K];
    /**
     * Set visual property of single data item
     *
     * @param {number} idx
     * @param {string|Object} key
     * @param {*} [value]
     *
     * @example
     *  setItemVisual(0, 'color', color);
     *  setItemVisual(0, {
     *      'color': color
     *  });
     */
    setItemVisual<K extends keyof Visual>(idx: number, key: K, value: Visual[K]): void;
    setItemVisual(idx: number, kvObject: Partial<Visual>): void;
    /**
     * Clear itemVisuals and list visual.
     */
    clearAllVisual(): void;
    /**
     * Set layout property.
     */
    setLayout(key: string, val: any): void;
    setLayout(kvObj: Dictionary<any>): void;
    /**
     * Get layout property.
     */
    getLayout(key: string): any;
    /**
     * Get layout of single data item
     */
    getItemLayout(idx: number): any;
    /**
     * Set layout of single data item
     */
    setItemLayout<M = false>(idx: number, layout: (M extends true ? Dictionary<any> : any), merge?: M): void;
    /**
     * Clear all layout of single data item
     */
    clearItemLayouts(): void;
    /**
     * Set graphic element relative to data. It can be set as null
     */
    setItemGraphicEl(idx: number, el: Element): void;
    getItemGraphicEl(idx: number): Element;
    eachItemGraphicEl<Ctx = unknown>(cb: (this: Ctx, el: Element, idx: number) => void, context?: Ctx): void;
    /**
     * Shallow clone a new list except visual and layout properties, and graph elements.
     * New list only change the indices.
     */
    cloneShallow(list?: SeriesData<HostModel>): SeriesData<HostModel>;
    /**
     * Wrap some method to add more feature
     */
    wrapMethod(methodName: FunctionPropertyNames<SeriesData>, injectFunction: (...args: any) => any): void;
    private static internalField;
}
interface SeriesData {
    getLinkedData(dataType?: SeriesDataType): SeriesData;
    getLinkedDataAll(): {
        data: SeriesData;
        type?: SeriesDataType;
    }[];
}

/**
 * If string, e.g., 'geo', means {geoIndex: 0}.
 * If Object, could contain some of these properties below:
 * {
 *     seriesIndex, seriesId, seriesName,
 *     geoIndex, geoId, geoName,
 *     bmapIndex, bmapId, bmapName,
 *     xAxisIndex, xAxisId, xAxisName,
 *     yAxisIndex, yAxisId, yAxisName,
 *     gridIndex, gridId, gridName,
 *     ... (can be extended)
 * }
 * Each properties can be number|string|Array.<number>|Array.<string>
 * For example, a finder could be
 * {
 *     seriesIndex: 3,
 *     geoId: ['aa', 'cc'],
 *     gridName: ['xx', 'rr']
 * }
 * xxxIndex can be set as 'all' (means all xxx) or 'none' (means not specify)
 * If nothing or null/undefined specified, return nothing.
 * If both `abcIndex`, `abcId`, `abcName` specified, only one work.
 * The priority is: index > id > name, the same with `ecModel.queryComponents`.
 */
declare type ModelFinderIndexQuery = number | number[] | 'all' | 'none' | false;
declare type ModelFinderIdQuery = OptionId | OptionId[];
declare type ModelFinderNameQuery = OptionId | OptionId[];
declare type ModelFinder = string | ModelFinderObject;
declare type ModelFinderObject = {
    seriesIndex?: ModelFinderIndexQuery;
    seriesId?: ModelFinderIdQuery;
    seriesName?: ModelFinderNameQuery;
    geoIndex?: ModelFinderIndexQuery;
    geoId?: ModelFinderIdQuery;
    geoName?: ModelFinderNameQuery;
    bmapIndex?: ModelFinderIndexQuery;
    bmapId?: ModelFinderIdQuery;
    bmapName?: ModelFinderNameQuery;
    xAxisIndex?: ModelFinderIndexQuery;
    xAxisId?: ModelFinderIdQuery;
    xAxisName?: ModelFinderNameQuery;
    yAxisIndex?: ModelFinderIndexQuery;
    yAxisId?: ModelFinderIdQuery;
    yAxisName?: ModelFinderNameQuery;
    gridIndex?: ModelFinderIndexQuery;
    gridId?: ModelFinderIdQuery;
    gridName?: ModelFinderNameQuery;
    dataIndex?: number;
    dataIndexInside?: number;
};
/**
 * {
 *     seriesModels: [seriesModel1, seriesModel2],
 *     seriesModel: seriesModel1, // The first model
 *     geoModels: [geoModel1, geoModel2],
 *     geoModel: geoModel1, // The first model
 *     ...
 * }
 */
declare type ParsedModelFinder = {
    [key: string]: ComponentModel | ComponentModel[] | undefined;
};
declare type QueryReferringOpt = {
    useDefault?: boolean;
    enableAll?: boolean;
    enableNone?: boolean;
};

declare class ComponentModel<Opt extends ComponentOption = ComponentOption> extends Model<Opt> {
    /**
     * @readonly
     */
    type: ComponentFullType;
    /**
     * @readonly
     */
    id: string;
    /**
     * Because simplified concept is probably better, series.name (or component.name)
     * has been having too many resposibilities:
     * (1) Generating id (which requires name in option should not be modified).
     * (2) As an index to mapping series when merging option or calling API (a name
     * can refer to more then one components, which is convinient is some case).
     * (3) Display.
     * @readOnly But injected
     */
    name: string;
    /**
     * @readOnly
     */
    mainType: ComponentMainType;
    /**
     * @readOnly
     */
    subType: ComponentSubType;
    /**
     * @readOnly
     */
    componentIndex: number;
    /**
     * @readOnly
     */
    protected defaultOption: ComponentOption;
    /**
     * @readOnly
     */
    ecModel: GlobalModel;
    /**
     * @readOnly
     */
    static dependencies: string[];
    readonly uid: string;
    /**
     * Support merge layout params.
     * Only support 'box' now (left/right/top/bottom/width/height).
     */
    static layoutMode: ComponentLayoutMode | ComponentLayoutMode['type'];
    /**
     * Prevent from auto set z, zlevel, z2 by the framework.
     */
    preventAutoZ: boolean;
    __viewId: string;
    __requireNewView: boolean;
    static protoInitialize: void;
    constructor(option: Opt, parentModel: Model, ecModel: GlobalModel);
    init(option: Opt, parentModel: Model, ecModel: GlobalModel): void;
    mergeDefaultAndTheme(option: Opt, ecModel: GlobalModel): void;
    mergeOption(option: Opt, ecModel: GlobalModel): void;
    /**
     * Called immediately after `init` or `mergeOption` of this instance called.
     */
    optionUpdated(newCptOption: Opt, isInit: boolean): void;
    /**
     * [How to declare defaultOption]:
     *
     * (A) If using class declaration in typescript (since echarts 5):
     * ```ts
     * import {ComponentOption} from '../model/option.js';
     * export interface XxxOption extends ComponentOption {
     *     aaa: number
     * }
     * export class XxxModel extends Component {
     *     static type = 'xxx';
     *     static defaultOption: XxxOption = {
     *         aaa: 123
     *     }
     * }
     * Component.registerClass(XxxModel);
     * ```
     * ```ts
     * import {inheritDefaultOption} from '../util/component.js';
     * import {XxxModel, XxxOption} from './XxxModel.js';
     * export interface XxxSubOption extends XxxOption {
     *     bbb: number
     * }
     * class XxxSubModel extends XxxModel {
     *     static defaultOption: XxxSubOption = inheritDefaultOption(XxxModel.defaultOption, {
     *         bbb: 456
     *     })
     *     fn() {
     *         let opt = this.getDefaultOption();
     *         // opt is {aaa: 123, bbb: 456}
     *     }
     * }
     * ```
     *
     * (B) If using class extend (previous approach in echarts 3 & 4):
     * ```js
     * let XxxComponent = Component.extend({
     *     defaultOption: {
     *         xx: 123
     *     }
     * })
     * ```
     * ```js
     * let XxxSubComponent = XxxComponent.extend({
     *     defaultOption: {
     *         yy: 456
     *     },
     *     fn: function () {
     *         let opt = this.getDefaultOption();
     *         // opt is {xx: 123, yy: 456}
     *     }
     * })
     * ```
     */
    getDefaultOption(): Opt;
    /**
     * Notice: always force to input param `useDefault` in case that forget to consider it.
     * The same behavior as `modelUtil.parseFinder`.
     *
     * @param useDefault In many cases like series refer axis and axis refer grid,
     *        If axis index / axis id not specified, use the first target as default.
     *        In other cases like dataZoom refer axis, if not specified, measn no refer.
     */
    getReferringComponents(mainType: ComponentMainType, opt: QueryReferringOpt): {
        models: ComponentModel[];
        specified: boolean;
    };
    getBoxLayoutParams(): {
        left: string | number;
        top: string | number;
        right: string | number;
        bottom: string | number;
        width: string | number;
        height: string | number;
    };
    /**
     * Get key for zlevel.
     * If developers don't configure zlevel. We will assign zlevel to series based on the key.
     * For example, lines with trail effect and progressive series will in an individual zlevel.
     */
    getZLevelKey(): string;
    setZLevel(zlevel: number): void;
    static registerClass: ClassManager['registerClass'];
    static hasClass: ClassManager['hasClass'];
    static registerSubTypeDefaulter: SubTypeDefaulterManager['registerSubTypeDefaulter'];
}

declare type AnimateOrSetPropsOption = {
    dataIndex?: number;
    cb?: () => void;
    during?: (percent: number) => void;
    removeOpt?: AnimationOption$1;
    isFrom?: boolean;
};
/**
 * Update graphic element properties with or without animation according to the
 * configuration in series.
 *
 * Caution: this method will stop previous animation.
 * So do not use this method to one element twice before
 * animation starts, unless you know what you are doing.
 * @example
 *     graphic.updateProps(el, {
 *         position: [100, 100]
 *     }, seriesModel, dataIndex, function () { console.log('Animation done!'); });
 *     // Or
 *     graphic.updateProps(el, {
 *         position: [100, 100]
 *     }, seriesModel, function () { console.log('Animation done!'); });
 */
declare function updateProps<Props>(el: Element<Props>, props: Props, animatableModel?: Model<AnimationOptionMixin>, dataIndex?: AnimateOrSetPropsOption['dataIndex'] | AnimateOrSetPropsOption['cb'] | AnimateOrSetPropsOption, cb?: AnimateOrSetPropsOption['cb'] | AnimateOrSetPropsOption['during'], during?: AnimateOrSetPropsOption['during']): void;

/**
 * Init graphic element properties with or without animation according to the
 * configuration in series.
 *
 * Caution: this method will stop previous animation.
 * So do not use this method to one element twice before
 * animation starts, unless you know what you are doing.
 */
declare function initProps<Props>(el: Element<Props>, props: Props, animatableModel?: Model<AnimationOptionMixin>, dataIndex?: AnimateOrSetPropsOption['dataIndex'] | AnimateOrSetPropsOption['cb'] | AnimateOrSetPropsOption, cb?: AnimateOrSetPropsOption['cb'] | AnimateOrSetPropsOption['during'], during?: AnimateOrSetPropsOption['during']): void;

declare type ExtendShapeOpt = Parameters<typeof Path.extend>[0];
declare type ExtendShapeReturn = ReturnType<typeof Path.extend>;
/**
 * Extend shape with parameters
 */
declare function extendShape(opts: ExtendShapeOpt): ExtendShapeReturn;
declare const extendPathFromString: typeof extendFromString;
declare type SVGPathOption$1 = Parameters<typeof extendPathFromString>[1];
declare type SVGPathCtor = ReturnType<typeof extendPathFromString>;
declare type SVGPath$1 = InstanceType<SVGPathCtor>;
/**
 * Extend path
 */
declare function extendPath(pathData: string, opts: SVGPathOption$1): SVGPathCtor;
/**
 * Register a user defined shape.
 * The shape class can be fetched by `getShapeClass`
 * This method will overwrite the registered shapes, including
 * the registered built-in shapes, if using the same `name`.
 * The shape can be used in `custom series` and
 * `graphic component` by declaring `{type: name}`.
 *
 * @param name
 * @param ShapeClass Can be generated by `extendShape`.
 */
declare function registerShape(name: string, ShapeClass: {
    new (): Path;
}): void;
/**
 * Find shape class registered by `registerShape`. Usually used in
 * fetching user defined shape.
 *
 * [Caution]:
 * (1) This method **MUST NOT be used inside echarts !!!**, unless it is prepared
 * to use user registered shapes.
 * Because the built-in shape (see `getBuiltInShape`) will be registered by
 * `registerShape` by default. That enables users to get both built-in
 * shapes as well as the shapes belonging to themsleves. But users can overwrite
 * the built-in shapes by using names like 'circle', 'rect' via calling
 * `registerShape`. So the echarts inner featrues should not fetch shapes from here
 * in case that it is overwritten by users, except that some features, like
 * `custom series`, `graphic component`, do it deliberately.
 *
 * (2) In the features like `custom series`, `graphic component`, the user input
 * `{tpye: 'xxx'}` does not only specify shapes but also specify other graphic
 * elements like `'group'`, `'text'`, `'image'` or event `'path'`. Those names
 * are reserved names, that is, if some user register a shape named `'image'`,
 * the shape will not be used. If we intending to add some more reserved names
 * in feature, that might bring break changes (disable some existing user shape
 * names). But that case probably rearly happen. So we dont make more mechanism
 * to resolve this issue here.
 *
 * @param name
 * @return The shape class. If not found, return nothing.
 */
declare function getShapeClass(name: string): {
    new (): Path;
};
/**
 * Create a path element from path data string
 * @param pathData
 * @param opts
 * @param rect
 * @param layout 'center' or 'cover' default to be cover
 */
declare function makePath(pathData: string, opts: SVGPathOption$1, rect: ZRRectLike, layout?: 'center' | 'cover'): SVGPath$1;
/**
 * Create a image element from image url
 * @param imageUrl image url
 * @param opts options
 * @param rect constrain rect
 * @param layout 'center' or 'cover'. Default to be 'cover'
 */
declare function makeImage(imageUrl: string, rect: ZRRectLike, layout?: 'center' | 'cover'): ZRImage;
declare const mergePath$1: typeof mergePath;
/**
 * Resize a path to fit the rect
 * @param path
 * @param rect
 */
declare function resizePath(path: SVGPath$1, rect: ZRRectLike): void;
/**
 * Get transform matrix of target (param target),
 * in coordinate of its ancestor (param ancestor)
 *
 * @param target
 * @param [ancestor]
 */
declare function getTransform(target: Transformable, ancestor?: Transformable): MatrixArray;
declare function clipPointsByRect(points: VectorArray[], rect: ZRRectLike): number[][];
/**
 * Return a new clipped rect. If rect size are negative, return undefined.
 */
declare function clipRectByRect(targetRect: ZRRectLike, rect: ZRRectLike): ZRRectLike;
declare function createIcon(iconStr: string, // Support 'image://' or 'path://' or direct svg path.
opt?: Omit<DisplayableProps, 'style'>, rect?: ZRRectLike): SVGPath$1 | ZRImage;

declare type TextStyleProps$1 = ZRText['style'];
declare function getTextRect(text: TextStyleProps$1['text'], font?: TextStyleProps$1['font'], align?: TextStyleProps$1['align'], verticalAlign?: TextStyleProps$1['verticalAlign'], padding?: TextStyleProps$1['padding'], rich?: TextStyleProps$1['rich'], truncate?: boolean, lineHeight?: number): BoundingRect;

/**
 * Add a comma each three digit.
 */
declare function addCommas(x: string | number): string;
declare function toCamelCase(str: string, upperCaseFirst?: boolean): string;
declare const normalizeCssArray$1: typeof normalizeCssArray;
declare function encodeHTML(source: string): string;
interface TplFormatterParam extends Dictionary<any> {
    $vars: string[];
}
/**
 * Template formatter
 * @param {Array.<Object>|Object} paramsList
 */
declare function formatTpl(tpl: string, paramsList: TplFormatterParam | TplFormatterParam[], encode?: boolean): string;
interface RichTextTooltipMarker {
    renderMode: TooltipRenderMode;
    content: string;
    style: Dictionary<unknown>;
}
declare type TooltipMarker = string | RichTextTooltipMarker;
declare type TooltipMarkerType = 'item' | 'subItem';
interface GetTooltipMarkerOpt {
    color?: ColorString;
    extraCssText?: string;
    type?: TooltipMarkerType;
    renderMode?: TooltipRenderMode;
    markerId?: string;
}
declare function getTooltipMarker(color: ColorString, extraCssText?: string): TooltipMarker;
declare function getTooltipMarker(opt: GetTooltipMarkerOpt): TooltipMarker;
/**
 * @deprecated Use `time/format` instead.
 * ISO Date format
 * @param {string} tpl
 * @param {number} value
 * @param {boolean} [isUTC=false] Default in local time.
 *           see `module:echarts/scale/Time`
 *           and `module:echarts/util/number#parseDate`.
 * @inner
 */
declare function formatTime(tpl: string, value: unknown, isUTC?: boolean): string;
/**
 * Capital first
 * @param {string} str
 * @return {string}
 */
declare function capitalFirst(str: string): string;

interface MapperParamAxisInfo {
    axisIndex: number;
    axisName: string;
    axisId: string;
    axisDim: string;
}
interface AxisPointerLink {
    xAxisIndex?: number[] | 'all';
    yAxisIndex?: number[] | 'all';
    xAxisId?: string[];
    yAxisId?: string[];
    xAxisName?: string[] | string;
    yAxisName?: string[] | string;
    radiusAxisIndex?: number[] | 'all';
    angleAxisIndex?: number[] | 'all';
    radiusAxisId?: string[];
    angleAxisId?: string[];
    radiusAxisName?: string[] | string;
    angleAxisName?: string[] | string;
    singleAxisIndex?: number[] | 'all';
    singleAxisId?: string[];
    singleAxisName?: string[] | string;
    mapper?(sourceVal: ScaleDataValue, sourceAxisInfo: MapperParamAxisInfo, targetAxisInfo: MapperParamAxisInfo): CommonAxisPointerOption['value'];
}
interface AxisPointerOption extends ComponentOption, Omit<CommonAxisPointerOption, 'type'> {
    mainType?: 'axisPointer';
    type?: 'line' | 'shadow' | 'cross' | 'none';
    link?: AxisPointerLink[];
}

declare type TopLevelFormatterParams = CallbackDataParams | CallbackDataParams[];
interface TooltipOption extends CommonTooltipOption<TopLevelFormatterParams>, ComponentOption {
    mainType?: 'tooltip';
    axisPointer?: AxisPointerOption & {
        axis?: 'auto' | 'x' | 'y' | 'angle' | 'radius';
        crossStyle?: LineStyleOption & {
            textStyle?: LabelOption;
        };
    };
    /**
     * If show popup content
     */
    showContent?: boolean;
    /**
     * Trigger only works on coordinate system.
     */
    trigger?: 'item' | 'axis' | 'none';
    displayMode?: 'single' | 'multipleByCoordSys';
    /**
     * 'auto': use html by default, and use non-html if `document` is not defined
     * 'html': use html for tooltip
     * 'richText': use canvas, svg, and etc. for tooltip
     */
    renderMode?: 'auto' | TooltipRenderMode;
    /**
     * If append popup dom to document.body
     * Only available when renderMode is html
     */
    appendToBody?: boolean;
    /**
     * specified class name of tooltip dom
     * Only available when renderMode is html
     */
    className?: string;
    order?: TooltipOrderMode;
}

/**
 * This is an abstract layer to insulate the upper usage of tooltip content
 * from the different backends according to different `renderMode` ('html' or 'richText').
 * With the help of the abstract layer, it does not need to consider how to create and
 * assemble html or richText snippets when making tooltip content.
 *
 * @usage
 *
 * ```ts
 * class XxxSeriesModel {
 *     formatTooltip(
 *         dataIndex: number,
 *         multipleSeries: boolean,
 *         dataType: string
 *     ) {
 *         ...
 *         return createTooltipMarkup('section', {
 *             header: header,
 *             blocks: [
 *                 createTooltipMarkup('nameValue', {
 *                     name: name,
 *                     value: value,
 *                     noValue: value == null
 *                 })
 *             ]
 *         });
 *     }
 * }
 * ```
 */
declare type TooltipMarkupBlockFragment = TooltipMarkupSection | TooltipMarkupNameValueBlock;
interface TooltipMarkupBlock {
    sortParam?: unknown;
}
interface TooltipMarkupSection extends TooltipMarkupBlock {
    type: 'section';
    header?: unknown;
    noHeader?: boolean;
    blocks?: TooltipMarkupBlockFragment[];
    sortBlocks?: boolean;
    valueFormatter?: CommonTooltipOption<unknown>['valueFormatter'];
}
interface TooltipMarkupNameValueBlock extends TooltipMarkupBlock {
    type: 'nameValue';
    markerType?: TooltipMarkerType;
    markerColor?: ColorString;
    name?: string;
    value?: unknown | unknown[];
    valueType?: DimensionType | DimensionType[];
    noName?: boolean;
    noValue?: boolean;
    valueFormatter?: CommonTooltipOption<unknown>['valueFormatter'];
}

interface DataFormatMixin extends DataHost {
    ecModel: GlobalModel;
    mainType: ComponentMainType;
    subType: ComponentSubType;
    componentIndex: number;
    id: string;
    name: string;
    animatedValue: OptionDataValue[];
}
declare class DataFormatMixin {
    /**
     * Get params for formatter
     */
    getDataParams(dataIndex: number, dataType?: SeriesDataType): CallbackDataParams;
    /**
     * Format label
     * @param dataIndex
     * @param status 'normal' by default
     * @param dataType
     * @param labelDimIndex Only used in some chart that
     *        use formatter in different dimensions, like radar.
     * @param formatter Formatter given outside.
     * @return return null/undefined if no formatter
     */
    getFormattedLabel(dataIndex: number, status?: DisplayState, dataType?: SeriesDataType, labelDimIndex?: number, formatter?: string | ((params: object) => string), extendParams?: {
        interpolatedValue: InterpolatableValue;
    }): string;
    /**
     * Get raw value in option
     */
    getRawValue(idx: number, dataType?: SeriesDataType): unknown;
    /**
     * Should be implemented.
     * @param {number} dataIndex
     * @param {boolean} [multipleSeries=false]
     * @param {string} [dataType]
     */
    formatTooltip(dataIndex: number, multipleSeries?: boolean, dataType?: string): TooltipFormatResult;
}
declare type TooltipFormatResult = string | TooltipMarkupBlockFragment;

/**
 * [Notice]:
 * Consider custom bundle on demand, chart specified
 * or component specified types and constants should
 * not put here. Only common types and constants can
 * be put in this file.
 */

declare type RendererType = 'canvas' | 'svg';
declare type LayoutOrient = 'vertical' | 'horizontal';
declare type HorizontalAlign = 'left' | 'center' | 'right';
declare type VerticalAlign = 'top' | 'middle' | 'bottom';
declare type ColorString = string;
declare type ZRColor = ColorString | LinearGradientObject | RadialGradientObject | PatternObject;
declare type ZRLineType = 'solid' | 'dotted' | 'dashed' | number | number[];
declare type ZRFontStyle = 'normal' | 'italic' | 'oblique';
declare type ZRFontWeight = 'normal' | 'bold' | 'bolder' | 'lighter' | number;
declare type ZREasing = AnimationEasing;
declare type ZRTextAlign = TextAlign;
declare type ZRTextVerticalAlign = TextVerticalAlign;
declare type ZRRectLike = RectLike;
declare type ZRStyleProps = PathStyleProps | ImageStyleProps | TSpanStyleProps | TextStyleProps;
declare type ZRElementEventName = ElementEventName | 'globalout';
declare type ComponentFullType = string;
declare type ComponentMainType = keyof ECUnitOption & string;
declare type ComponentSubType = Exclude<ComponentOption['type'], undefined>;
interface DataHost {
    getData(dataType?: SeriesDataType): SeriesData;
}
interface DataModel extends Model<unknown>, DataHost, DataFormatMixin {
}
interface PayloadItem {
    excludeSeriesId?: OptionId | OptionId[];
    animation?: PayloadAnimationPart;
    [other: string]: any;
}
interface Payload extends PayloadItem {
    type: string;
    escapeConnect?: boolean;
    batch?: PayloadItem[];
}
interface PayloadAnimationPart {
    duration?: number;
    easing?: AnimationEasing;
    delay?: number;
}
interface ViewRootGroup extends Group {
    __ecComponentInfo?: {
        mainType: string;
        index: number;
    };
}
interface ECElementEvent extends ECEventData, CallbackDataParams {
    type: ZRElementEventName;
    event?: ElementEvent;
}
/**
 * The echarts event type to user.
 * Also known as packedEvent.
 */
interface ECActionEvent extends ECEventData {
    type: string;
    componentType?: string;
    componentIndex?: number;
    seriesIndex?: number;
    escapeConnect?: boolean;
    batch?: ECEventData;
}
interface ECEventData {
    [key: string]: any;
}
interface EventQueryItem {
    [key: string]: any;
}
interface ActionInfo {
    type: string;
    event?: string;
    update?: string;
}
interface ActionHandler {
    (payload: Payload, ecModel: GlobalModel, api: ExtensionAPI): void | ECEventData;
}
interface OptionPreprocessor {
    (option: ECUnitOption, isTheme: boolean): void;
}
interface PostUpdater {
    (ecModel: GlobalModel, api: ExtensionAPI): void;
}
interface StageHandlerReset {
    (seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload?: Payload): StageHandlerProgressExecutor | StageHandlerProgressExecutor[] | void;
}
interface StageHandlerOverallReset {
    (ecModel: GlobalModel, api: ExtensionAPI, payload?: Payload): void;
}
interface StageHandler {
    /**
     * Indicate that the task will be piped all series
     * (`performRawSeries` indicate whether includes filtered series).
     */
    createOnAllSeries?: boolean;
    /**
     * Indicate that the task will be only piped in the pipeline of this type of series.
     * (`performRawSeries` indicate whether includes filtered series).
     */
    seriesType?: string;
    /**
     * Indicate that the task will be only piped in the pipeline of the returned series.
     */
    getTargetSeries?: (ecModel: GlobalModel, api: ExtensionAPI) => HashMap<SeriesModel>;
    /**
     * If `true`, filtered series will also be "performed".
     */
    performRawSeries?: boolean;
    /**
     * Called only when this task in a pipeline.
     */
    plan?: StageHandlerPlan;
    /**
     * If `overallReset` specified, an "overall task" will be created.
     * "overall task" does not belong to a certain pipeline.
     * They always be "performed" in certain phase (depends on when they declared).
     * They has "stub"s to connect with pipelines (one stub for one pipeline),
     * delivering info like "dirty" and "output end".
     */
    overallReset?: StageHandlerOverallReset;
    /**
     * Called only when this task in a pipeline, and "dirty".
     */
    reset?: StageHandlerReset;
}
interface StageHandlerInternal extends StageHandler {
    uid: string;
    visualType?: 'layout' | 'visual';
    __prio: number;
    __raw: StageHandler | StageHandlerOverallReset;
    isVisual?: boolean;
    isLayout?: boolean;
}
declare type StageHandlerProgressParams = TaskProgressParams;
interface StageHandlerProgressExecutor {
    dataEach?: (data: SeriesData, idx: number) => void;
    progress?: (params: StageHandlerProgressParams, data: SeriesData) => void;
}
declare type StageHandlerPlanReturn = TaskPlanCallbackReturn;
interface StageHandlerPlan {
    (seriesModel: SeriesModel, ecModel: GlobalModel, api: ExtensionAPI, payload?: Payload): StageHandlerPlanReturn;
}
interface LoadingEffectCreator {
    (api: ExtensionAPI, cfg: object): LoadingEffect;
}
interface LoadingEffect extends Element {
    resize: () => void;
}
/**
 * 'html' is used for rendering tooltip in extra DOM form, and the result
 * string is used as DOM HTML content.
 * 'richText' is used for rendering tooltip in rich text form, for those where
 * DOM operation is not supported.
 */
declare type TooltipRenderMode = 'html' | 'richText';
declare type TooltipOrderMode = 'valueAsc' | 'valueDesc' | 'seriesAsc' | 'seriesDesc';
declare type OrdinalRawValue = string | number;
declare type OrdinalNumber = number;
/**
 * @usage For example,
 * ```js
 * { ordinalNumbers: [2, 5, 3, 4] }
 * ```
 * means that ordinal 2 should be diplayed on tick 0,
 * ordinal 5 should be displayed on tick 1, ...
 */
declare type OrdinalSortInfo = {
    ordinalNumbers: OrdinalNumber[];
};
/**
 * `OptionDataValue` is the primitive value in `series.data` or `dataset.source`.
 * `OptionDataValue` are parsed (see `src/data/helper/dataValueHelper.parseDataValue`)
 * into `ParsedValue` and stored into `data/SeriesData` storage.
 * Note:
 * (1) The term "parse" does not mean `src/scale/Scale['parse']`.
 * (2) If a category dimension is not mapped to any axis, its raw value will NOT be
 * parsed to `OrdinalNumber` but keep the original `OrdinalRawValue` in `src/data/SeriesData` storage.
 */
declare type ParsedValue = ParsedValueNumeric | OrdinalRawValue;
declare type ParsedValueNumeric = number | OrdinalNumber;
/**
 * `ScaleDataValue` means that the user input primitive value to `src/scale/Scale`.
 * (For example, used in `axis.min`, `axis.max`, `convertToPixel`).
 * Note:
 * `ScaleDataValue` is a little different from `OptionDataValue`, because it will not go through
 * `src/data/helper/dataValueHelper.parseDataValue`, but go through `src/scale/Scale['parse']`.
 */
declare type ScaleDataValue = ParsedValueNumeric | OrdinalRawValue | Date;
interface ScaleTick {
    level?: number;
    value: number;
}
declare type DimensionIndex = number;
declare type DimensionIndexLoose = DimensionIndex | string;
declare type DimensionName = string;
declare type DimensionLoose = DimensionName | DimensionIndexLoose;
declare type DimensionType = DataStoreDimensionType;
interface DataVisualDimensions {
    tooltip?: DimensionIndex | false;
    label?: DimensionIndex;
    itemName?: DimensionIndex;
    itemId?: DimensionIndex;
    itemGroupId?: DimensionIndex;
    seriesName?: DimensionIndex;
}
declare type DimensionDefinition = {
    type?: DataStoreDimensionType;
    name?: DimensionName;
    displayName?: string;
};
declare type DimensionDefinitionLoose = DimensionDefinition['name'] | DimensionDefinition;
declare const SOURCE_FORMAT_ORIGINAL: "original";
declare const SOURCE_FORMAT_ARRAY_ROWS: "arrayRows";
declare const SOURCE_FORMAT_OBJECT_ROWS: "objectRows";
declare const SOURCE_FORMAT_KEYED_COLUMNS: "keyedColumns";
declare const SOURCE_FORMAT_TYPED_ARRAY: "typedArray";
declare const SOURCE_FORMAT_UNKNOWN: "unknown";
declare type SourceFormat = typeof SOURCE_FORMAT_ORIGINAL | typeof SOURCE_FORMAT_ARRAY_ROWS | typeof SOURCE_FORMAT_OBJECT_ROWS | typeof SOURCE_FORMAT_KEYED_COLUMNS | typeof SOURCE_FORMAT_TYPED_ARRAY | typeof SOURCE_FORMAT_UNKNOWN;
declare const SERIES_LAYOUT_BY_COLUMN: "column";
declare const SERIES_LAYOUT_BY_ROW: "row";
declare type SeriesLayoutBy = typeof SERIES_LAYOUT_BY_COLUMN | typeof SERIES_LAYOUT_BY_ROW;
declare type OptionSourceHeader = boolean | 'auto' | number;
declare type SeriesDataType = 'main' | 'node' | 'edge';
/**
 * [ECUnitOption]:
 * An object that contains definitions of components
 * and other properties. For example:
 *
 * ```ts
 * let option: ECUnitOption = {
 *
 *     // Single `title` component:
 *     title: {...},
 *
 *     // Two `visualMap` components:
 *     visualMap: [{...}, {...}],
 *
 *     // Two `series.bar` components
 *     // and one `series.pie` component:
 *     series: [
 *         {type: 'bar', data: [...]},
 *         {type: 'bar', data: [...]},
 *         {type: 'pie', data: [...]}
 *     ],
 *
 *     // A property:
 *     backgroundColor: '#421ae4'
 *
 *     // A property object:
 *     textStyle: {
 *         color: 'red',
 *         fontSize: 20
 *     }
 * };
 * ```
 */
declare type ECUnitOption = {
    baseOption?: unknown;
    options?: unknown;
    media?: unknown;
    timeline?: ComponentOption | ComponentOption[];
    backgroundColor?: ZRColor;
    darkMode?: boolean | 'auto';
    textStyle?: Pick<LabelOption, 'color' | 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>;
    useUTC?: boolean;
    [key: string]: ComponentOption | ComponentOption[] | Dictionary<unknown> | unknown;
    stateAnimation?: AnimationOption$1;
} & AnimationOptionMixin & ColorPaletteOptionMixin;
/**
 * [ECOption]:
 * An object input to echarts.setOption(option).
 * May be an 'option: ECUnitOption',
 * or may be an object contains multi-options. For example:
 *
 * ```ts
 * let option: ECOption = {
 *     baseOption: {
 *         title: {...},
 *         legend: {...},
 *         series: [
 *             {data: [...]},
 *             {data: [...]},
 *             ...
 *         ]
 *     },
 *     timeline: {...},
 *     options: [
 *         {title: {...}, series: {data: [...]}},
 *         {title: {...}, series: {data: [...]}},
 *         ...
 *     ],
 *     media: [
 *         {
 *             query: {maxWidth: 320},
 *             option: {series: {x: 20}, visualMap: {show: false}}
 *         },
 *         {
 *             query: {minWidth: 320, maxWidth: 720},
 *             option: {series: {x: 500}, visualMap: {show: true}}
 *         },
 *         {
 *             option: {series: {x: 1200}, visualMap: {show: true}}
 *         }
 *     ]
 * };
 * ```
 */
interface ECBasicOption extends ECUnitOption {
    baseOption?: ECUnitOption;
    timeline?: ComponentOption | ComponentOption[];
    options?: ECUnitOption[];
    media?: MediaUnit[];
}
declare type OptionSourceData<VAL extends OptionDataValue = OptionDataValue, ORIITEM extends OptionDataItemOriginal<VAL> = OptionDataItemOriginal<VAL>> = OptionSourceDataOriginal<VAL, ORIITEM> | OptionSourceDataObjectRows<VAL> | OptionSourceDataArrayRows<VAL> | OptionSourceDataKeyedColumns<VAL> | OptionSourceDataTypedArray;
declare type OptionDataItemOriginal<VAL extends OptionDataValue = OptionDataValue> = VAL | VAL[] | OptionDataItemObject<VAL>;
declare type OptionSourceDataOriginal<VAL extends OptionDataValue = OptionDataValue, ORIITEM extends OptionDataItemOriginal<VAL> = OptionDataItemOriginal<VAL>> = ArrayLike<ORIITEM>;
declare type OptionSourceDataObjectRows<VAL extends OptionDataValue = OptionDataValue> = Array<Dictionary<VAL>>;
declare type OptionSourceDataArrayRows<VAL extends OptionDataValue = OptionDataValue> = Array<Array<VAL>>;
declare type OptionSourceDataKeyedColumns<VAL extends OptionDataValue = OptionDataValue> = Dictionary<ArrayLike<VAL>>;
declare type OptionSourceDataTypedArray = ArrayLike<number>;
declare type OptionDataItem = OptionDataValue | Dictionary<OptionDataValue> | OptionDataValue[] | OptionDataItemObject<OptionDataValue>;
declare type OptionDataItemObject<T> = {
    id?: OptionId;
    name?: OptionName;
    groupId?: OptionId;
    value?: T[] | T;
    selected?: boolean;
};
declare type OptionId = string | number;
declare type OptionName = string | number;
interface GraphEdgeItemObject<VAL extends OptionDataValue> extends OptionDataItemObject<VAL> {
    /**
     * Name or index of source node.
     */
    source?: string | number;
    /**
     * Name or index of target node.
     */
    target?: string | number;
}
declare type OptionDataValue = string | number | Date;
declare type OptionDataValueNumeric = number | '-';
declare type OptionDataValueDate = Date | string | number;
declare type ModelOption = any;
declare type ThemeOption = Dictionary<any>;
declare type DisplayState = 'normal' | 'emphasis' | 'blur' | 'select';
interface OptionEncodeVisualDimensions {
    tooltip?: OptionEncodeValue;
    label?: OptionEncodeValue;
    itemName?: OptionEncodeValue;
    itemId?: OptionEncodeValue;
    seriesName?: OptionEncodeValue;
    itemGroupId?: OptionEncodeValue;
}
interface OptionEncode extends OptionEncodeVisualDimensions {
    [coordDim: string]: OptionEncodeValue | undefined;
}
declare type OptionEncodeValue = DimensionLoose | DimensionLoose[];
declare type EncodeDefaulter = (source: Source, dimCount: number) => OptionEncode;
interface CallbackDataParams {
    componentType: string;
    componentSubType: string;
    componentIndex: number;
    seriesType?: string;
    seriesIndex?: number;
    seriesId?: string;
    seriesName?: string;
    name: string;
    dataIndex: number;
    data: OptionDataItem;
    dataType?: SeriesDataType;
    value: OptionDataItem | OptionDataValue;
    color?: ZRColor;
    borderColor?: string;
    dimensionNames?: DimensionName[];
    encode?: DimensionUserOuputEncode;
    marker?: TooltipMarker;
    status?: DisplayState;
    dimensionIndex?: number;
    percent?: number;
    $vars: string[];
}
declare type InterpolatableValue = ParsedValue | ParsedValue[];
declare type DecalDashArrayX = number | (number | number[])[];
declare type DecalDashArrayY = number | number[];
interface DecalObject {
    symbol?: string | string[];
    symbolSize?: number;
    symbolKeepAspect?: boolean;
    color?: string;
    backgroundColor?: string;
    dashArrayX?: DecalDashArrayX;
    dashArrayY?: DecalDashArrayY;
    rotation?: number;
    maxTileWidth?: number;
    maxTileHeight?: number;
}
interface MediaQuery {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    minAspectRatio?: number;
    maxAspectRatio?: number;
}
declare type MediaUnit = {
    query?: MediaQuery;
    option: ECUnitOption;
};
declare type ComponentLayoutMode = {
    type?: 'box';
    ignoreSize?: boolean | boolean[];
};
/******************* Mixins for Common Option Properties   ********************** */
declare type PaletteOptionMixin = ColorPaletteOptionMixin;
interface ColorPaletteOptionMixin {
    color?: ZRColor | ZRColor[];
    colorLayer?: ZRColor[][];
}
/**
 * Mixin of option set to control the box layout of each component.
 */
interface BoxLayoutOptionMixin {
    width?: number | string;
    height?: number | string;
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
}
interface CircleLayoutOptionMixin {
    center?: (number | string)[];
    radius?: (number | string)[] | number | string;
}
interface ShadowOptionMixin {
    shadowBlur?: number;
    shadowColor?: ColorString;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
}
interface BorderOptionMixin {
    borderColor?: ZRColor;
    borderWidth?: number;
    borderType?: ZRLineType;
    borderCap?: CanvasLineCap;
    borderJoin?: CanvasLineJoin;
    borderDashOffset?: number;
    borderMiterLimit?: number;
}
declare type ColorBy = 'series' | 'data';
interface SunburstColorByMixin {
    colorBy?: ColorBy;
}
declare type AnimationDelayCallbackParam = {
    count: number;
    index: number;
};
declare type AnimationDurationCallback = (idx: number) => number;
declare type AnimationDelayCallback = (idx: number, params?: AnimationDelayCallbackParam) => number;
interface AnimationOption$1 {
    duration?: number;
    easing?: AnimationEasing;
    delay?: number;
}
/**
 * Mixin of option set to control the animation of series.
 */
interface AnimationOptionMixin {
    /**
     * If enable animation
     */
    animation?: boolean;
    /**
     * Disable animation when the number of elements exceeds the threshold
     */
    animationThreshold?: number;
    /**
     * Duration of initialize animation.
     * Can be a callback to specify duration of each element
     */
    animationDuration?: number | AnimationDurationCallback;
    /**
     * Easing of initialize animation
     */
    animationEasing?: AnimationEasing;
    /**
     * Delay of initialize animation
     * Can be a callback to specify duration of each element
     */
    animationDelay?: number | AnimationDelayCallback;
    /**
     * Delay of data update animation.
     * Can be a callback to specify duration of each element
     */
    animationDurationUpdate?: number | AnimationDurationCallback;
    /**
     * Easing of data update animation.
     */
    animationEasingUpdate?: AnimationEasing;
    /**
     * Delay of data update animation.
     * Can be a callback to specify duration of each element
     */
    animationDelayUpdate?: number | AnimationDelayCallback;
}
interface RoamOptionMixin {
    /**
     * If enable roam. can be specified 'scale' or 'move'
     */
    roam?: boolean | 'pan' | 'move' | 'zoom' | 'scale';
    /**
     * Current center position.
     */
    center?: (number | string)[];
    /**
     * Current zoom level. Default is 1
     */
    zoom?: number;
    scaleLimit?: {
        min?: number;
        max?: number;
    };
}
declare type SymbolSizeCallback<T> = (rawValue: any, params: T) => number | number[];
declare type SymbolCallback<T> = (rawValue: any, params: T) => string;
declare type SymbolRotateCallback<T> = (rawValue: any, params: T) => number;
declare type SymbolOffsetCallback<T> = (rawValue: any, params: T) => string | number | (string | number)[];
/**
 * Mixin of option set to control the element symbol.
 * Include type of symbol, and size of symbol.
 */
interface SymbolOptionMixin<T = never> {
    /**
     * type of symbol, like `cirlce`, `rect`, or custom path and image.
     */
    symbol?: string | (T extends never ? never : SymbolCallback<T>);
    /**
     * Size of symbol.
     */
    symbolSize?: number | number[] | (T extends never ? never : SymbolSizeCallback<T>);
    symbolRotate?: number | (T extends never ? never : SymbolRotateCallback<T>);
    symbolKeepAspect?: boolean;
    symbolOffset?: string | number | (string | number)[] | (T extends never ? never : SymbolOffsetCallback<T>);
}
/**
 * ItemStyleOption is a most common used set to config element styles.
 * It includes both fill and stroke style.
 */
interface ItemStyleOption<TCbParams = never> extends ShadowOptionMixin, BorderOptionMixin {
    color?: ZRColor | (TCbParams extends never ? never : ((params: TCbParams) => ZRColor));
    opacity?: number;
    decal?: DecalObject | 'none';
}
/**
 * ItemStyleOption is a option set to control styles on lines.
 * Used in the components or series like `line`, `axis`
 * It includes stroke style.
 */
interface LineStyleOption<Clr = ZRColor> extends ShadowOptionMixin {
    width?: number;
    color?: Clr;
    opacity?: number;
    type?: ZRLineType;
    cap?: CanvasLineCap;
    join?: CanvasLineJoin;
    dashOffset?: number;
    miterLimit?: number;
}
/**
 * ItemStyleOption is a option set to control styles on an area, like polygon, rectangle.
 * It only include fill style.
 */
interface AreaStyleOption<Clr = ZRColor> extends ShadowOptionMixin {
    color?: Clr;
    opacity?: number;
}
interface VisualOptionUnit {
    symbol?: string;
    symbolSize?: number;
    color?: ColorString;
    colorAlpha?: number;
    opacity?: number;
    colorLightness?: number;
    colorSaturation?: number;
    colorHue?: number;
    decal?: DecalObject;
    liftZ?: number;
}
declare type VisualOptionFixed = VisualOptionUnit;
/**
 * Option about visual properties used in piecewise mapping
 * Used in each piece.
 */
declare type VisualOptionPiecewise = VisualOptionUnit;
/**
 * All visual properties can be encoded.
 */
declare type BuiltinVisualProperty = keyof VisualOptionUnit;
interface TextCommonOption extends ShadowOptionMixin {
    color?: string;
    fontStyle?: ZRFontStyle;
    fontWeight?: ZRFontWeight;
    fontFamily?: string;
    fontSize?: number | string;
    align?: HorizontalAlign;
    verticalAlign?: VerticalAlign;
    baseline?: VerticalAlign;
    opacity?: number;
    lineHeight?: number;
    backgroundColor?: ColorString | {
        image: ImageLike | string;
    };
    borderColor?: string;
    borderWidth?: number;
    borderType?: ZRLineType;
    borderDashOffset?: number;
    borderRadius?: number | number[];
    padding?: number | number[];
    width?: number | string;
    height?: number;
    textBorderColor?: string;
    textBorderWidth?: number;
    textBorderType?: ZRLineType;
    textBorderDashOffset?: number;
    textShadowBlur?: number;
    textShadowColor?: string;
    textShadowOffsetX?: number;
    textShadowOffsetY?: number;
    tag?: string;
}
interface LabelFormatterCallback<T = CallbackDataParams> {
    (params: T): string;
}
/**
 * LabelOption is an option set to control the style of labels.
 * Include color, background, shadow, truncate, rotation, distance, etc..
 */
interface LabelOption extends TextCommonOption {
    /**
     * If show label
     */
    show?: boolean;
    position?: ElementTextConfig['position'];
    distance?: number;
    rotate?: number;
    offset?: number[];
    /**
     * Min margin between labels. Used when label has layout.
     */
    minMargin?: number;
    overflow?: TextStyleProps['overflow'];
    silent?: boolean;
    precision?: number | 'auto';
    valueAnimation?: boolean;
    rich?: Dictionary<TextCommonOption>;
}
interface SeriesLabelOption extends LabelOption {
    formatter?: string | LabelFormatterCallback<CallbackDataParams>;
}
/**
 * Option for labels on line, like markLine, lines
 */
interface LineLabelOption extends Omit<LabelOption, 'distance' | 'position'> {
    position?: 'start' | 'middle' | 'end' | 'insideStart' | 'insideStartTop' | 'insideStartBottom' | 'insideMiddle' | 'insideMiddleTop' | 'insideMiddleBottom' | 'insideEnd' | 'insideEndTop' | 'insideEndBottom' | 'insideMiddleBottom';
    /**
     * Distance can be an array.
     * Which will specify horizontal and vertical distance respectively
     */
    distance?: number | number[];
}
interface LabelLineOption {
    show?: boolean;
    /**
     * If displayed above other elements
     */
    showAbove?: boolean;
    length?: number;
    length2?: number;
    smooth?: boolean | number;
    minTurnAngle?: number;
    lineStyle?: LineStyleOption;
}
interface SeriesLineLabelOption extends LineLabelOption {
    formatter?: string | LabelFormatterCallback<CallbackDataParams>;
}
interface LabelLayoutOptionCallbackParams {
    /**
     * Index of data which the label represents.
     * It can be null if label does't represent any data.
     */
    dataIndex?: number;
    /**
     * Type of data which the label represents.
     * It can be null if label does't represent any data.
     */
    dataType?: SeriesDataType;
    seriesIndex: number;
    text: string;
    align: ZRTextAlign;
    verticalAlign: ZRTextVerticalAlign;
    rect: RectLike;
    labelRect: RectLike;
    labelLinePoints?: number[][];
}
interface LabelLayoutOption {
    /**
     * If move the overlapped label. If label is still overlapped after moved.
     * It will determine if to hide this label with `hideOverlap` policy.
     *
     * shiftX/Y will keep the order on x/y
     * shuffleX/y will move the label around the original position randomly.
     */
    moveOverlap?: 'shiftX' | 'shiftY' | 'shuffleX' | 'shuffleY';
    /**
     * If hide the overlapped label. It will be handled after move.
     * @default 'none'
     */
    hideOverlap?: boolean;
    /**
     * If label is draggable.
     */
    draggable?: boolean;
    /**
     * Can be absolute px number or percent string.
     */
    x?: number | string;
    y?: number | string;
    /**
     * offset on x based on the original position.
     */
    dx?: number;
    /**
     * offset on y based on the original position.
     */
    dy?: number;
    rotate?: number;
    align?: ZRTextAlign;
    verticalAlign?: ZRTextVerticalAlign;
    width?: number;
    height?: number;
    fontSize?: number;
    labelLinePoints?: number[][];
}
declare type LabelLayoutOptionCallback = (params: LabelLayoutOptionCallbackParams) => LabelLayoutOption;
interface TooltipFormatterCallback<T> {
    /**
     * For sync callback
     * params will be an array on axis trigger.
     */
    (params: T, asyncTicket: string): string | HTMLElement | HTMLElement[];
    /**
     * For async callback.
     * Returned html string will be a placeholder when callback is not invoked.
     */
    (params: T, asyncTicket: string, callback: (cbTicket: string, htmlOrDomNodes: string | HTMLElement | HTMLElement[]) => void): string | HTMLElement | HTMLElement[];
}
declare type TooltipBuiltinPosition = 'inside' | 'top' | 'left' | 'right' | 'bottom';
declare type TooltipBoxLayoutOption = Pick<BoxLayoutOptionMixin, 'top' | 'left' | 'right' | 'bottom'>;
declare type TooltipPositionCallbackParams = CallbackDataParams | CallbackDataParams[];
/**
 * Position relative to the hoverred element. Only available when trigger is item.
 */
interface TooltipPositionCallback {
    (point: [number, number], 
    /**
     * params will be an array on axis trigger.
     */
    params: TooltipPositionCallbackParams, 
    /**
     * Will be HTMLDivElement when renderMode is html
     * Otherwise it's graphic.Text
     */
    el: HTMLDivElement | ZRText | null, 
    /**
     * Rect of hover elements. Will be null if not hovered
     */
    rect: RectLike | null, size: {
        /**
         * Size of popup content
         */
        contentSize: [number, number];
        /**
         * Size of the chart view
         */
        viewSize: [number, number];
    }): Array<number | string> | TooltipBuiltinPosition | TooltipBoxLayoutOption;
}
/**
 * Common tooltip option
 * Can be configured on series, graphic elements
 */
interface CommonTooltipOption<FormatterParams> {
    show?: boolean;
    /**
     * When to trigger
     */
    triggerOn?: 'mousemove' | 'click' | 'none' | 'mousemove|click';
    /**
     * Whether to not hide popup content automatically
     */
    alwaysShowContent?: boolean;
    formatter?: string | TooltipFormatterCallback<FormatterParams>;
    /**
     * Formatter of value.
     *
     * Will be ignored if tooltip.formatter is specified.
     */
    valueFormatter?: (value: OptionDataValue | OptionDataValue[]) => string;
    /**
     * Absolution pixel [x, y] array. Or relative percent string [x, y] array.
     * If trigger is 'item'. position can be set to 'inside' / 'top' / 'left' / 'right' / 'bottom',
     * which is relative to the hovered element.
     *
     * Support to be a callback
     */
    position?: (number | string)[] | TooltipBuiltinPosition | TooltipPositionCallback | TooltipBoxLayoutOption;
    confine?: boolean;
    /**
     * Consider triggered from axisPointer handle, verticalAlign should be 'middle'
     */
    align?: HorizontalAlign;
    verticalAlign?: VerticalAlign;
    /**
     * Delay of show. milesecond.
     */
    showDelay?: number;
    /**
     * Delay of hide. milesecond.
     */
    hideDelay?: number;
    transitionDuration?: number;
    /**
     * Whether mouse is allowed to enter the floating layer of tooltip
     * If you need to interact in the tooltip like with links or buttons, it can be set as true.
     */
    enterable?: boolean;
    backgroundColor?: ColorString;
    borderColor?: ColorString;
    borderRadius?: number;
    borderWidth?: number;
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    /**
     * Padding between tooltip content and tooltip border.
     */
    padding?: number | number[];
    /**
     * Available when renderMode is 'html'
     */
    extraCssText?: string;
    textStyle?: Pick<LabelOption, 'color' | 'fontStyle' | 'fontWeight' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'width' | 'height' | 'textBorderColor' | 'textBorderWidth' | 'textShadowColor' | 'textShadowBlur' | 'textShadowOffsetX' | 'textShadowOffsetY' | 'align'> & {
        decoration?: string;
    };
}
declare type ComponentItemTooltipOption<T> = CommonTooltipOption<T> & {
    content?: string;
    formatterParams?: ComponentItemTooltipLabelFormatterParams;
};
declare type ComponentItemTooltipLabelFormatterParams = {
    componentType: string;
    name: string;
    $vars: string[];
} & {
    [key in string]: unknown;
};
/**
 * Tooltip option configured on each series
 */
declare type SeriesTooltipOption = CommonTooltipOption<CallbackDataParams> & {
    trigger?: 'item' | 'axis' | boolean | 'none';
};
declare type LabelFormatterParams = {
    value: ScaleDataValue;
    axisDimension: string;
    axisIndex: number;
    seriesData: CallbackDataParams[];
};
/**
 * Common axis option. can be configured on each axis
 */
interface CommonAxisPointerOption {
    show?: boolean | 'auto';
    z?: number;
    zlevel?: number;
    triggerOn?: 'click' | 'mousemove' | 'none' | 'mousemove|click';
    type?: 'line' | 'shadow' | 'none';
    snap?: boolean;
    triggerTooltip?: boolean;
    /**
     * current value. When using axisPointer.handle, value can be set to define the initail position of axisPointer.
     */
    value?: ScaleDataValue;
    status?: 'show' | 'hide';
    label?: LabelOption & {
        precision?: 'auto' | number;
        margin?: number;
        /**
         * String template include variable {value} or callback function
         */
        formatter?: string | ((params: LabelFormatterParams) => string);
    };
    animation?: boolean | 'auto';
    animationDurationUpdate?: number;
    animationEasingUpdate?: ZREasing;
    /**
     * Available when type is 'line'
     */
    lineStyle?: LineStyleOption;
    /**
     * Available when type is 'shadow'
     */
    shadowStyle?: AreaStyleOption;
    handle?: {
        show?: boolean;
        icon?: string;
        /**
         * The size of the handle
         */
        size?: number | number[];
        /**
         * Distance from handle center to axis.
         */
        margin?: number;
        color?: ColorString;
        /**
         * Throttle for mobile performance
         */
        throttle?: number;
    } & ShadowOptionMixin;
    seriesDataIndices?: {
        seriesIndex: number;
        dataIndex: number;
        dataIndexInside: number;
    }[];
}
interface ComponentOption {
    mainType?: string;
    type?: string;
    id?: OptionId;
    name?: OptionName;
    z?: number;
    zlevel?: number;
}
declare type BlurScope = 'coordinateSystem' | 'series' | 'global';
/**
 * can be array of data indices.
 * Or may be an dictionary if have different types of data like in graph.
 */
declare type InnerFocus = DefaultEmphasisFocus | ArrayLike<number> | Dictionary<ArrayLike<number>>;
interface DefaultStatesMixin {
    emphasis?: any;
    select?: any;
    blur?: any;
}
declare type DefaultEmphasisFocus = 'none' | 'self' | 'series';
interface DefaultStatesMixinEmphasis {
    /**
     * self: Focus self and blur all others.
     * series: Focus series and blur all other series.
     */
    focus?: DefaultEmphasisFocus;
}
interface StatesMixinBase {
    emphasis?: unknown;
    select?: unknown;
    blur?: unknown;
}
interface StatesOptionMixin<StateOption, StatesMixin extends StatesMixinBase> {
    /**
     * Emphasis states
     */
    emphasis?: StateOption & StatesMixin['emphasis'] & {
        /**
         * Scope of blurred element when focus.
         *
         * coordinateSystem: blur others in the same coordinateSystem
         * series: blur others in the same series
         * global: blur all others
         *
         * Default to be coordinate system.
         */
        blurScope?: BlurScope;
        /**
         * If emphasis state is disabled.
         */
        disabled?: boolean;
    };
    /**
     * Select states
     */
    select?: StateOption & StatesMixin['select'] & {
        disabled?: boolean;
    };
    /**
     * Blur states.
     */
    blur?: StateOption & StatesMixin['blur'];
}
interface UniversalTransitionOption {
    enabled?: boolean;
    /**
     * Animation delay of each divided element
     */
    delay?: (index: number, count: number) => number;
    /**
     * How to divide the shape in combine and split animation.
     */
    divideShape?: 'clone' | 'split';
    /**
     * Series will have transition between if they have same seriesKey.
     * Usually it is a string. It can also be an array,
     * which means it can be transition from or to multiple series with each key in this array item.
     *
     * Note:
     * If two series have both array seriesKey. They will be compared after concated to a string(which is order independent)
     * Transition between string key has higher priority.
     *
     * Default to use series id.
     */
    seriesKey?: string | string[];
}
interface SeriesOption<StateOption = unknown, StatesMixin extends StatesMixinBase = DefaultStatesMixin> extends ComponentOption, AnimationOptionMixin, ColorPaletteOptionMixin, StatesOptionMixin<StateOption, StatesMixin> {
    mainType?: 'series';
    silent?: boolean;
    blendMode?: string;
    /**
     * Cursor when mouse on the elements
     */
    cursor?: string;
    /**
     * groupId of data. can be used for doing drilldown / up animation
     * It will be ignored if:
     *  - groupId is specified in each data
     *  - encode.itemGroupId is given.
     */
    dataGroupId?: OptionId;
    data?: unknown;
    colorBy?: ColorBy;
    legendHoverLink?: boolean;
    /**
     * Configurations about progressive rendering
     */
    progressive?: number | false;
    progressiveThreshold?: number;
    progressiveChunkMode?: 'mod';
    /**
     * Not available on every series
     */
    coordinateSystem?: string;
    hoverLayerThreshold?: number;
    /**
     * When dataset is used, seriesLayoutBy specifies whether the column or the row of dataset is mapped to the series
     * namely, the series is "layout" on columns or rows
     * @default 'column'
     */
    seriesLayoutBy?: 'column' | 'row';
    labelLine?: LabelLineOption;
    /**
     * Overall label layout option in label layout stage.
     */
    labelLayout?: LabelLayoutOption | LabelLayoutOptionCallback;
    /**
     * Animation config for state transition.
     */
    stateAnimation?: AnimationOption$1;
    /**
     * If enabled universal transition cross series.
     * @example
     *  universalTransition: true
     *  universalTransition: { enabled: true }
     */
    universalTransition?: boolean | UniversalTransitionOption;
    /**
     * Map of selected data
     * key is name or index of data.
     */
    selectedMap?: Dictionary<boolean> | 'all';
    selectedMode?: 'single' | 'multiple' | 'series' | boolean;
}
interface SeriesOnCartesianOptionMixin {
    xAxisIndex?: number;
    yAxisIndex?: number;
    xAxisId?: string;
    yAxisId?: string;
}
interface SeriesOnPolarOptionMixin {
    polarIndex?: number;
    polarId?: string;
}
interface SeriesOnSingleOptionMixin {
    singleAxisIndex?: number;
    singleAxisId?: string;
}
interface SeriesOnGeoOptionMixin {
    geoIndex?: number;
    geoId?: string;
}
interface SeriesOnCalendarOptionMixin {
    calendarIndex?: number;
    calendarId?: string;
}
interface SeriesLargeOptionMixin {
    large?: boolean;
    largeThreshold?: number;
}
interface SeriesStackOptionMixin {
    stack?: string;
    stackStrategy?: 'samesign' | 'all' | 'positive' | 'negative';
}
declare type SamplingFunc = (frame: ArrayLike<number>) => number;
interface SeriesSamplingOptionMixin {
    sampling?: 'none' | 'average' | 'min' | 'max' | 'sum' | 'lttb' | SamplingFunc;
}
interface SeriesEncodeOptionMixin {
    datasetIndex?: number;
    datasetId?: string | number;
    seriesLayoutBy?: SeriesLayoutBy;
    sourceHeader?: OptionSourceHeader;
    dimensions?: DimensionDefinitionLoose[];
    encode?: OptionEncode;
}
interface AriaLabelOption {
    enabled?: boolean;
    description?: string;
    general?: {
        withTitle?: string;
        withoutTitle?: string;
    };
    series?: {
        maxCount?: number;
        single?: {
            prefix?: string;
            withName?: string;
            withoutName?: string;
        };
        multiple?: {
            prefix?: string;
            withName?: string;
            withoutName?: string;
            separator?: {
                middle?: string;
                end?: string;
            };
        };
    };
    data?: {
        maxCount?: number;
        allData?: string;
        partialData?: string;
        withName?: string;
        withoutName?: string;
        separator?: {
            middle?: string;
            end?: string;
        };
    };
}
interface AriaOption extends AriaLabelOption {
    mainType?: 'aria';
    enabled?: boolean;
    label?: AriaLabelOption;
    decal?: {
        show?: boolean;
        decals?: DecalObject | DecalObject[];
    };
}

declare type AreaStyleProps = Pick<PathStyleProps, 'fill' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY' | 'opacity' | 'shadowColor'>;
declare class AreaStyleMixin {
    getAreaStyle(this: Model, excludes?: readonly (keyof AreaStyleOption)[], includes?: readonly (keyof AreaStyleOption)[]): AreaStyleProps;
}

declare type LabelFontOption = Pick<LabelOption, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>;
declare type LabelRectRelatedOption = Pick<LabelOption, 'align' | 'verticalAlign' | 'padding' | 'lineHeight' | 'baseline' | 'rich' | 'width' | 'height' | 'overflow'> & LabelFontOption;
declare class TextStyleMixin {
    /**
     * Get color property or get color from option.textStyle.color
     */
    getTextColor(this: Model, isEmphasis?: boolean): ColorString;
    /**
     * Create font string from fontStyle, fontWeight, fontSize, fontFamily
     * @return {string}
     */
    getFont(this: Model<LabelFontOption>): string;
    getTextRect(this: Model<LabelRectRelatedOption> & TextStyleMixin, text: string): BoundingRect;
}

interface Model<Opt = ModelOption> extends LineStyleMixin, ItemStyleMixin, TextStyleMixin, AreaStyleMixin {
}
declare class Model<Opt = ModelOption> {
    parentModel: Model;
    ecModel: GlobalModel;
    option: Opt;
    constructor(option?: Opt, parentModel?: Model, ecModel?: GlobalModel);
    init(option: Opt, parentModel?: Model, ecModel?: GlobalModel, ...rest: any): void;
    /**
     * Merge the input option to me.
     */
    mergeOption(option: Opt, ecModel?: GlobalModel): void;
    get<R extends keyof Opt>(path: R, ignoreParent?: boolean): Opt[R];
    get<R extends keyof Opt>(path: readonly [R], ignoreParent?: boolean): Opt[R];
    get<R extends keyof Opt, S extends keyof Opt[R]>(path: readonly [R, S], ignoreParent?: boolean): Opt[R][S];
    get<R extends keyof Opt, S extends keyof Opt[R], T extends keyof Opt[R][S]>(path: readonly [R, S, T], ignoreParent?: boolean): Opt[R][S][T];
    getShallow<R extends keyof Opt>(key: R, ignoreParent?: boolean): Opt[R];
    getModel<R extends keyof Opt>(path: R, parentModel?: Model): Model<Opt[R]>;
    getModel<R extends keyof Opt>(path: readonly [R], parentModel?: Model): Model<Opt[R]>;
    getModel<R extends keyof Opt, S extends keyof Opt[R]>(path: readonly [R, S], parentModel?: Model): Model<Opt[R][S]>;
    getModel<Ra extends keyof Opt, Rb extends keyof Opt, S extends keyof Opt[Rb]>(path: readonly [Ra] | readonly [Rb, S], parentModel?: Model): Model<Opt[Ra]> | Model<Opt[Rb][S]>;
    getModel<R extends keyof Opt, S extends keyof Opt[R], T extends keyof Opt[R][S]>(path: readonly [R, S, T], parentModel?: Model): Model<Opt[R][S][T]>;
    /**
     * If model has option
     */
    isEmpty(): boolean;
    restoreData(): void;
    clone(): Model<Opt>;
    parsePath(path: string | readonly string[]): readonly string[];
    resolveParentPath(path: readonly string[]): string[];
    isAnimationEnabled(): boolean;
    private _doGet;
}

/**
 * ECharts option manager
 */

/**
 * TERM EXPLANATIONS:
 * See `ECOption` and `ECUnitOption` in `src/util/types.ts`.
 */
declare class OptionManager {
    private _api;
    private _timelineOptions;
    private _mediaList;
    private _mediaDefault;
    /**
     * -1, means default.
     * empty means no media.
     */
    private _currentMediaIndices;
    private _optionBackup;
    private _newBaseOption;
    constructor(api: ExtensionAPI);
    setOption(rawOption: ECBasicOption, optionPreprocessorFuncs: OptionPreprocessor[], opt: InnerSetOptionOpts): void;
    mountOption(isRecreate: boolean): ECUnitOption;
    getTimelineOption(ecModel: GlobalModel): ECUnitOption;
    getMediaOption(ecModel: GlobalModel): ECUnitOption[];
}

declare const _default: {
    time: {
        month: string[];
        monthAbbr: string[];
        dayOfWeek: string[];
        dayOfWeekAbbr: string[];
    };
    legend: {
        selector: {
            all: string;
            inverse: string;
        };
    };
    toolbox: {
        brush: {
            title: {
                rect: string;
                polygon: string;
                lineX: string;
                lineY: string;
                keep: string;
                clear: string;
            };
        };
        dataView: {
            title: string;
            lang: string[];
        };
        dataZoom: {
            title: {
                zoom: string;
                back: string;
            };
        };
        magicType: {
            title: {
                line: string;
                bar: string;
                stack: string;
                tiled: string;
            };
        };
        restore: {
            title: string;
        };
        saveAsImage: {
            title: string;
            lang: string[];
        };
    };
    series: {
        typeNames: {
            pie: string;
            bar: string;
            line: string;
            scatter: string;
            effectScatter: string;
            radar: string;
            tree: string;
            treemap: string;
            boxplot: string;
            candlestick: string;
            k: string;
            heatmap: string;
            map: string;
            parallel: string;
            lines: string;
            graph: string;
            sankey: string;
            funnel: string;
            gauge: string;
            pictorialBar: string;
            themeRiver: string;
            sunburst: string;
        };
    };
    aria: {
        general: {
            withTitle: string;
            withoutTitle: string;
        };
        series: {
            single: {
                prefix: string;
                withName: string;
                withoutName: string;
            };
            multiple: {
                prefix: string;
                withName: string;
                withoutName: string;
                separator: {
                    middle: string;
                    end: string;
                };
            };
        };
        data: {
            allData: string;
            partialData: string;
            withName: string;
            withoutName: string;
            separator: {
                middle: string;
                end: string;
            };
        };
    };
};

declare type LocaleOption = typeof _default;
declare function registerLocale(locale: string, localeObj: LocaleOption): void;

/**
 * Caution: If the mechanism should be changed some day, these cases
 * should be considered:
 *
 * (1) In `merge option` mode, if using the same option to call `setOption`
 * many times, the result should be the same (try our best to ensure that).
 * (2) In `merge option` mode, if a component has no id/name specified, it
 * will be merged by index, and the result sequence of the components is
 * consistent to the original sequence.
 * (3) In `replaceMerge` mode, keep the result sequence of the components is
 * consistent to the original sequence, even though there might result in "hole".
 * (4) `reset` feature (in toolbox). Find detailed info in comments about
 * `mergeOption` in module:echarts/model/OptionManager.
 */

interface GlobalModelSetOptionOpts {
    replaceMerge: ComponentMainType | ComponentMainType[];
}
interface InnerSetOptionOpts {
    replaceMergeMainTypeMap: HashMap<boolean, string>;
}
/**
 * @param condition.mainType Mandatory.
 * @param condition.subType Optional.
 * @param condition.query like {xxxIndex, xxxId, xxxName},
 *        where xxx is mainType.
 *        If query attribute is null/undefined or has no index/id/name,
 *        do not filtering by query conditions, which is convenient for
 *        no-payload situations or when target of action is global.
 * @param condition.filter parameter: component, return boolean.
 */
interface QueryConditionKindA {
    mainType: ComponentMainType;
    subType?: ComponentSubType;
    query?: {
        [k: string]: number | number[] | string | string[];
    };
    filter?: (cmpt: ComponentModel) => boolean;
}
/**
 * If none of index and id and name used, return all components with mainType.
 * @param condition.mainType
 * @param condition.subType If ignore, only query by mainType
 * @param condition.index Either input index or id or name.
 * @param condition.id Either input index or id or name.
 * @param condition.name Either input index or id or name.
 */
interface QueryConditionKindB {
    mainType: ComponentMainType;
    subType?: ComponentSubType;
    index?: number | number[];
    id?: OptionId | OptionId[];
    name?: OptionName | OptionName[];
}
interface EachComponentAllCallback {
    (mainType: string, model: ComponentModel, componentIndex: number): void;
}
interface EachComponentInMainTypeCallback {
    (model: ComponentModel, componentIndex: number): void;
}
declare class GlobalModel extends Model<ECUnitOption> {
    option: ECUnitOption;
    private _theme;
    private _locale;
    private _optionManager;
    private _componentsMap;
    /**
     * `_componentsMap` might have "hole" becuase of remove.
     * So save components count for a certain mainType here.
     */
    private _componentsCount;
    /**
     * Mapping between filtered series list and raw series list.
     * key: filtered series indices, value: raw series indices.
     * Items of `_seriesIndices` never be null/empty/-1.
     * If series has been removed by `replaceMerge`, those series
     * also won't be in `_seriesIndices`, just like be filtered.
     */
    private _seriesIndices;
    /**
     * Key: seriesIndex.
     * Keep consistent with `_seriesIndices`.
     */
    private _seriesIndicesMap;
    /**
     * Model for store update payload
     */
    private _payload;
    scheduler: Scheduler;
    ssr: boolean;
    init(option: ECBasicOption, parentModel: Model, ecModel: GlobalModel, theme: object, locale: object, optionManager: OptionManager): void;
    setOption(option: ECBasicOption, opts: GlobalModelSetOptionOpts, optionPreprocessorFuncs: OptionPreprocessor[]): void;
    /**
     * @param type null/undefined: reset all.
     *        'recreate': force recreate all.
     *        'timeline': only reset timeline option
     *        'media': only reset media query option
     * @return Whether option changed.
     */
    resetOption(type: 'recreate' | 'timeline' | 'media', opt?: Pick<GlobalModelSetOptionOpts, 'replaceMerge'>): boolean;
    private _resetOption;
    mergeOption(option: ECUnitOption): void;
    private _mergeOption;
    /**
     * Get option for output (cloned option and inner info removed)
     */
    getOption(): ECUnitOption;
    getTheme(): Model;
    getLocaleModel(): Model<LocaleOption>;
    setUpdatePayload(payload: Payload): void;
    getUpdatePayload(): Payload;
    /**
     * @param idx If not specified, return the first one.
     */
    getComponent(mainType: ComponentMainType, idx?: number): ComponentModel;
    /**
     * @return Never be null/undefined.
     */
    queryComponents(condition: QueryConditionKindB): ComponentModel[];
    /**
     * The interface is different from queryComponents,
     * which is convenient for inner usage.
     *
     * @usage
     * let result = findComponents(
     *     {mainType: 'dataZoom', query: {dataZoomId: 'abc'}}
     * );
     * let result = findComponents(
     *     {mainType: 'series', subType: 'pie', query: {seriesName: 'uio'}}
     * );
     * let result = findComponents(
     *     {mainType: 'series',
     *     filter: function (model, index) {...}}
     * );
     * // result like [component0, componnet1, ...]
     */
    findComponents(condition: QueryConditionKindA): ComponentModel[];
    /**
     * Travel components (before filtered).
     *
     * @usage
     * eachComponent('legend', function (legendModel, index) {
     *     ...
     * });
     * eachComponent(function (componentType, model, index) {
     *     // componentType does not include subType
     *     // (componentType is 'a' but not 'a.b')
     * });
     * eachComponent(
     *     {mainType: 'dataZoom', query: {dataZoomId: 'abc'}},
     *     function (model, index) {...}
     * );
     * eachComponent(
     *     {mainType: 'series', subType: 'pie', query: {seriesName: 'uio'}},
     *     function (model, index) {...}
     * );
     */
    eachComponent<T>(cb: EachComponentAllCallback, context?: T): void;
    eachComponent<T>(mainType: string, cb: EachComponentInMainTypeCallback, context?: T): void;
    eachComponent<T>(mainType: QueryConditionKindA, cb: EachComponentInMainTypeCallback, context?: T): void;
    /**
     * Get series list before filtered by name.
     */
    getSeriesByName(name: OptionName): SeriesModel[];
    /**
     * Get series list before filtered by index.
     */
    getSeriesByIndex(seriesIndex: number): SeriesModel;
    /**
     * Get series list before filtered by type.
     * FIXME: rename to getRawSeriesByType?
     */
    getSeriesByType(subType: ComponentSubType): SeriesModel[];
    /**
     * Get all series before filtered.
     */
    getSeries(): SeriesModel[];
    /**
     * Count series before filtered.
     */
    getSeriesCount(): number;
    /**
     * After filtering, series may be different
     * frome raw series.
     */
    eachSeries<T>(cb: (this: T, series: SeriesModel, rawSeriesIndex: number) => void, context?: T): void;
    /**
     * Iterate raw series before filtered.
     *
     * @param {Function} cb
     * @param {*} context
     */
    eachRawSeries<T>(cb: (this: T, series: SeriesModel, rawSeriesIndex: number) => void, context?: T): void;
    /**
     * After filtering, series may be different.
     * frome raw series.
     */
    eachSeriesByType<T>(subType: ComponentSubType, cb: (this: T, series: SeriesModel, rawSeriesIndex: number) => void, context?: T): void;
    /**
     * Iterate raw series before filtered of given type.
     */
    eachRawSeriesByType<T>(subType: ComponentSubType, cb: (this: T, series: SeriesModel, rawSeriesIndex: number) => void, context?: T): void;
    isSeriesFiltered(seriesModel: SeriesModel): boolean;
    getCurrentSeriesIndices(): number[];
    filterSeries<T>(cb: (this: T, series: SeriesModel, rawSeriesIndex: number) => boolean, context?: T): void;
    restoreData(payload?: Payload): void;
    private static internalField;
}
interface GlobalModel extends PaletteMixin<ECUnitOption> {
}

interface UpdateLifecycleTransitionSeriesFinder {
    seriesIndex?: ModelFinderIndexQuery;
    seriesId?: ModelFinderIdQuery;
    dimension: DimensionLoose;
}
interface UpdateLifecycleTransitionItem {
    from?: UpdateLifecycleTransitionSeriesFinder | UpdateLifecycleTransitionSeriesFinder[];
    to: UpdateLifecycleTransitionSeriesFinder | UpdateLifecycleTransitionSeriesFinder[];
}
declare type UpdateLifecycleTransitionOpt = UpdateLifecycleTransitionItem | UpdateLifecycleTransitionItem[];
interface UpdateLifecycleParams {
    updatedSeries?: SeriesModel[];
    /**
     * If this update is from setOption and option is changed.
     */
    optionChanged?: boolean;
    seriesTransition?: UpdateLifecycleTransitionOpt;
}
interface LifecycleEvents {
    'afterinit': [EChartsType];
    'series:beforeupdate': [GlobalModel, ExtensionAPI, UpdateLifecycleParams];
    'series:layoutlabels': [GlobalModel, ExtensionAPI, UpdateLifecycleParams];
    'series:transition': [GlobalModel, ExtensionAPI, UpdateLifecycleParams];
    'series:afterupdate': [GlobalModel, ExtensionAPI, UpdateLifecycleParams];
    'afterupdate': [GlobalModel, ExtensionAPI];
}

declare class GeoJSONResource implements GeoResource {
    readonly type = "geoJSON";
    private _geoJSON;
    private _specialAreas;
    private _mapName;
    private _parsedMap;
    constructor(mapName: string, geoJSON: GeoJSONSourceInput, specialAreas: GeoSpecialAreas);
    /**
     * @param nameMap can be null/undefined
     * @param nameProperty can be null/undefined
     */
    load(nameMap: NameMap, nameProperty: string): {
        regions: GeoJSONRegion[];
        boundingRect: BoundingRect;
        regionsMap: HashMap<GeoJSONRegion, string | number>;
    };
    private _parseToRegions;
    /**
     * Only for exporting to users.
     * **MUST NOT** used internally.
     */
    getMapForUser(): {
        geoJson: GeoJSON | GeoJSONCompressed;
        geoJSON: GeoJSON | GeoJSONCompressed;
        specialAreas: GeoSpecialAreas;
    };
}

declare type MapInput = GeoJSONMapInput | SVGMapInput;
interface GeoJSONMapInput {
    geoJSON: GeoJSONSourceInput;
    specialAreas: GeoSpecialAreas;
}
interface SVGMapInput {
    svg: GeoSVGSourceInput;
}
declare const _default$1: {
    /**
     * Compatible with previous `echarts.registerMap`.
     *
     * @usage
     * ```js
     *
     * echarts.registerMap('USA', geoJson, specialAreas);
     *
     * echarts.registerMap('USA', {
     *     geoJson: geoJson,
     *     specialAreas: {...}
     * });
     * echarts.registerMap('USA', {
     *     geoJSON: geoJson,
     *     specialAreas: {...}
     * });
     *
     * echarts.registerMap('airport', {
     *     svg: svg
     * }
     * ```
     *
     * Note:
     * Do not support that register multiple geoJSON or SVG
     * one map name. Because different geoJSON and SVG have
     * different unit. It's not easy to make sure how those
     * units are mapping/normalize.
     * If intending to use multiple geoJSON or SVG, we can
     * use multiple geo coordinate system.
     */
    registerMap: (mapName: string, rawDef: MapInput | GeoJSONSourceInput, rawSpecialAreas?: GeoSpecialAreas) => void;
    getGeoResource(mapName: string): GeoResource;
    /**
     * Only for exporting to users.
     * **MUST NOT** used internally.
     */
    getMapForUser: (mapName: string) => ReturnType<GeoJSONResource['getMapForUser']>;
    load: (mapName: string, nameMap: NameMap, nameProperty: string) => ReturnType<GeoResource['load']>;
};

declare type ModelFinder$1 = ModelFinder;
declare const version$1 = "5.3.3";
declare const dependencies: {
    zrender: string;
};
declare const PRIORITY: {
    PROCESSOR: {
        FILTER: number;
        SERIES_FILTER: number;
        STATISTIC: number;
    };
    VISUAL: {
        LAYOUT: number;
        PROGRESSIVE_LAYOUT: number;
        GLOBAL: number;
        CHART: number;
        POST_CHART_LAYOUT: number;
        COMPONENT: number;
        BRUSH: number;
        CHART_ITEM: number;
        ARIA: number;
        DECAL: number;
    };
};
declare const IN_MAIN_PROCESS_KEY: "__flagInMainProcess";
declare const PENDING_UPDATE: "__pendingUpdate";
declare const STATUS_NEEDS_UPDATE_KEY: "__needsUpdateStatus";
declare const CONNECT_STATUS_KEY: "__connectUpdateStatus";
declare type SetOptionTransitionOpt = UpdateLifecycleTransitionOpt;
declare type SetOptionTransitionOptItem = UpdateLifecycleTransitionItem;
interface SetOptionOpts {
    notMerge?: boolean;
    lazyUpdate?: boolean;
    silent?: boolean;
    replaceMerge?: GlobalModelSetOptionOpts['replaceMerge'];
    transition?: SetOptionTransitionOpt;
}
interface ResizeOpts {
    width?: number | 'auto';
    height?: number | 'auto';
    animation?: AnimationOption$1;
    silent?: boolean;
}
interface PostIniter {
    (chart: EChartsType): void;
}
declare type RenderedEventParam = {
    elapsedTime: number;
};
declare type ECEventDefinition = {
    [key in ZRElementEventName]: EventCallbackSingleParam<ECElementEvent>;
} & {
    rendered: EventCallbackSingleParam<RenderedEventParam>;
    finished: () => void | boolean;
} & {
    [key: string]: (...args: unknown[]) => void | boolean;
};
declare type EChartsInitOpts = {
    locale?: string | LocaleOption;
    renderer?: RendererType;
    devicePixelRatio?: number;
    useDirtyRect?: boolean;
    ssr?: boolean;
    width?: number;
    height?: number;
};
declare class ECharts extends Eventful<ECEventDefinition> {
    /**
     * @readonly
     */
    id: string;
    /**
     * Group id
     * @readonly
     */
    group: string;
    private _ssr;
    private _zr;
    private _dom;
    private _model;
    private _throttledZrFlush;
    private _theme;
    private _locale;
    private _chartsViews;
    private _chartsMap;
    private _componentsViews;
    private _componentsMap;
    private _coordSysMgr;
    private _api;
    private _scheduler;
    private _messageCenter;
    private _pendingActions;
    protected _$eventProcessor: never;
    private _disposed;
    private _loadingFX;
    private [PENDING_UPDATE];
    private [IN_MAIN_PROCESS_KEY];
    private [CONNECT_STATUS_KEY];
    private [STATUS_NEEDS_UPDATE_KEY];
    constructor(dom: HTMLElement, theme?: string | ThemeOption, opts?: EChartsInitOpts);
    private _onframe;
    getDom(): HTMLElement;
    getId(): string;
    getZr(): ZRenderType;
    isSSR(): boolean;
    /**
     * Usage:
     * chart.setOption(option, notMerge, lazyUpdate);
     * chart.setOption(option, {
     *     notMerge: ...,
     *     lazyUpdate: ...,
     *     silent: ...
     * });
     *
     * @param opts opts or notMerge.
     * @param opts.notMerge Default `false`.
     * @param opts.lazyUpdate Default `false`. Useful when setOption frequently.
     * @param opts.silent Default `false`.
     * @param opts.replaceMerge Default undefined.
     */
    setOption<Opt extends ECBasicOption>(option: Opt, notMerge?: boolean, lazyUpdate?: boolean): void;
    setOption<Opt extends ECBasicOption>(option: Opt, opts?: SetOptionOpts): void;
    /**
     * @deprecated
     */
    private setTheme;
    private getModel;
    getOption(): ECBasicOption;
    getWidth(): number;
    getHeight(): number;
    getDevicePixelRatio(): number;
    /**
     * Get canvas which has all thing rendered
     * @deprecated Use renderToCanvas instead.
     */
    getRenderedCanvas(opts?: any): HTMLCanvasElement;
    renderToCanvas(opts?: {
        backgroundColor?: ZRColor;
        pixelRatio?: number;
    }): HTMLCanvasElement;
    renderToSVGString(opts?: {
        useViewBox?: boolean;
    }): string;
    /**
     * Get svg data url
     */
    getSvgDataURL(): string;
    getDataURL(opts?: {
        type?: 'png' | 'jpeg' | 'svg';
        pixelRatio?: number;
        backgroundColor?: ZRColor;
        excludeComponents?: ComponentMainType[];
    }): string;
    getConnectedDataURL(opts?: {
        type?: 'png' | 'jpeg' | 'svg';
        pixelRatio?: number;
        backgroundColor?: ZRColor;
        connectedBackgroundColor?: ZRColor;
        excludeComponents?: string[];
    }): string;
    /**
     * Convert from logical coordinate system to pixel coordinate system.
     * See CoordinateSystem#convertToPixel.
     */
    convertToPixel(finder: ModelFinder$1, value: ScaleDataValue): number;
    convertToPixel(finder: ModelFinder$1, value: ScaleDataValue[]): number[];
    /**
     * Convert from pixel coordinate system to logical coordinate system.
     * See CoordinateSystem#convertFromPixel.
     */
    convertFromPixel(finder: ModelFinder$1, value: number): number;
    convertFromPixel(finder: ModelFinder$1, value: number[]): number[];
    /**
     * Is the specified coordinate systems or components contain the given pixel point.
     * @param {Array|number} value
     * @return {boolean} result
     */
    containPixel(finder: ModelFinder$1, value: number[]): boolean;
    /**
     * Get visual from series or data.
     * @param finder
     *        If string, e.g., 'series', means {seriesIndex: 0}.
     *        If Object, could contain some of these properties below:
     *        {
     *            seriesIndex / seriesId / seriesName,
     *            dataIndex / dataIndexInside
     *        }
     *        If dataIndex is not specified, series visual will be fetched,
     *        but not data item visual.
     *        If all of seriesIndex, seriesId, seriesName are not specified,
     *        visual will be fetched from first series.
     * @param visualType 'color', 'symbol', 'symbolSize'
     */
    getVisual(finder: ModelFinder$1, visualType: string): string | number | number[] | PatternObject | LinearGradientObject | RadialGradientObject;
    /**
     * Get view of corresponding component model
     */
    private getViewOfComponentModel;
    /**
     * Get view of corresponding series model
     */
    private getViewOfSeriesModel;
    private _initEvents;
    isDisposed(): boolean;
    clear(): void;
    dispose(): void;
    /**
     * Resize the chart
     */
    resize(opts?: ResizeOpts): void;
    /**
     * Show loading effect
     * @param name 'default' by default
     * @param cfg cfg of registered loading effect
     */
    showLoading(cfg?: object): void;
    showLoading(name?: string, cfg?: object): void;
    /**
     * Hide loading effect
     */
    hideLoading(): void;
    makeActionFromEvent(eventObj: ECActionEvent): Payload;
    /**
     * @param opt If pass boolean, means opt.silent
     * @param opt.silent Default `false`. Whether trigger events.
     * @param opt.flush Default `undefined`.
     *        true: Flush immediately, and then pixel in canvas can be fetched
     *            immediately. Caution: it might affect performance.
     *        false: Not flush.
     *        undefined: Auto decide whether perform flush.
     */
    dispatchAction(payload: Payload, opt?: boolean | {
        silent?: boolean;
        flush?: boolean | undefined;
    }): void;
    updateLabelLayout(): void;
    appendData(params: {
        seriesIndex: number;
        data: any;
    }): void;
    private static internalField;
}
/**
 * @param opts.devicePixelRatio Use window.devicePixelRatio by default
 * @param opts.renderer Can choose 'canvas' or 'svg' to render the chart.
 * @param opts.width Use clientWidth of the input `dom` by default.
 *        Can be 'auto' (the same as null/undefined)
 * @param opts.height Use clientHeight of the input `dom` by default.
 *        Can be 'auto' (the same as null/undefined)
 * @param opts.locale Specify the locale.
 * @param opts.useDirtyRect Enable dirty rectangle rendering or not.
 */
declare function init$1(dom: HTMLElement, theme?: string | object, opts?: EChartsInitOpts): EChartsType;
/**
 * @usage
 * (A)
 * ```js
 * let chart1 = echarts.init(dom1);
 * let chart2 = echarts.init(dom2);
 * chart1.group = 'xxx';
 * chart2.group = 'xxx';
 * echarts.connect('xxx');
 * ```
 * (B)
 * ```js
 * let chart1 = echarts.init(dom1);
 * let chart2 = echarts.init(dom2);
 * echarts.connect('xxx', [chart1, chart2]);
 * ```
 */
declare function connect(groupId: string | EChartsType[]): string;
/**
 * @deprecated
 */
declare function disConnect(groupId: string): void;
/**
 * Alias and backword compat
 */
declare const disconnect: typeof disConnect;
/**
 * Dispose a chart instance
 */
declare function dispose$1(chart: EChartsType | HTMLElement | string): void;
declare function getInstanceByDom(dom: HTMLElement): EChartsType | undefined;
declare function getInstanceById(key: string): EChartsType | undefined;
/**
 * Register theme
 */
declare function registerTheme(name: string, theme: ThemeOption): void;
/**
 * Register option preprocessor
 */
declare function registerPreprocessor(preprocessorFunc: OptionPreprocessor): void;
declare function registerProcessor(priority: number | StageHandler | StageHandlerOverallReset, processor?: StageHandler | StageHandlerOverallReset): void;
/**
 * Register postIniter
 * @param {Function} postInitFunc
 */
declare function registerPostInit(postInitFunc: PostIniter): void;
/**
 * Register postUpdater
 * @param {Function} postUpdateFunc
 */
declare function registerPostUpdate(postUpdateFunc: PostUpdater): void;
declare function registerUpdateLifecycle<T extends keyof LifecycleEvents>(name: T, cb: (...args: LifecycleEvents[T]) => void): void;
/**
 * @usage
 * registerAction('someAction', 'someEvent', function () { ... });
 * registerAction('someAction', function () { ... });
 * registerAction(
 *     {type: 'someAction', event: 'someEvent', update: 'updateView'},
 *     function () { ... }
 * );
 *
 * @param {(string|Object)} actionInfo
 * @param {string} actionInfo.type
 * @param {string} [actionInfo.event]
 * @param {string} [actionInfo.update]
 * @param {string} [eventName]
 * @param {Function} action
 */
declare function registerAction(type: string, eventName: string, action: ActionHandler): void;
declare function registerAction(type: string, action: ActionHandler): void;
declare function registerAction(actionInfo: ActionInfo, action: ActionHandler): void;
declare function registerCoordinateSystem(type: string, coordSysCreator: CoordinateSystemCreator): void;
/**
 * Get dimensions of specified coordinate system.
 * @param {string} type
 * @return {Array.<string|Object>}
 */
declare function getCoordinateSystemDimensions(type: string): DimensionDefinitionLoose[];

/**
 * Layout is a special stage of visual encoding
 * Most visual encoding like color are common for different chart
 * But each chart has it's own layout algorithm
 */
declare function registerLayout(priority: number, layoutTask: StageHandler | StageHandlerOverallReset): void;
declare function registerLayout(layoutTask: StageHandler | StageHandlerOverallReset): void;
declare function registerVisual(priority: number, layoutTask: StageHandler | StageHandlerOverallReset): void;
declare function registerVisual(layoutTask: StageHandler | StageHandlerOverallReset): void;

declare function registerLoading(name: string, loadingFx: LoadingEffectCreator): void;
/**
 * ZRender need a canvas context to do measureText.
 * But in node environment canvas may be created by node-canvas.
 * So we need to specify how to create a canvas instead of using document.createElement('canvas')
 *
 *
 * @deprecated use setPlatformAPI({ createCanvas }) instead.
 *
 * @example
 *     let Canvas = require('canvas');
 *     let echarts = require('echarts');
 *     echarts.setCanvasCreator(function () {
 *         // Small size is enough.
 *         return new Canvas(32, 32);
 *     });
 */
declare function setCanvasCreator(creator: () => HTMLCanvasElement): void;
declare type RegisterMapParams = Parameters<typeof _default$1.registerMap>;
/**
 * The parameters and usage: see `geoSourceManager.registerMap`.
 * Compatible with previous `echarts.registerMap`.
 */
declare function registerMap(mapName: RegisterMapParams[0], geoJson: RegisterMapParams[1], specialAreas?: RegisterMapParams[2]): void;
declare function getMap(mapName: string): any;
declare const registerTransform: typeof registerExternalTransform;
declare const dataTool: {};
interface EChartsType extends ECharts {
}

declare function parse(colorStr: string, rgbaArr?: number[]): number[];
declare function lift(color: string, level: number): string;
declare function toHex(color: string): string;
declare function fastLerp(normalizedValue: number, colors: number[][], out?: number[]): number[];
declare const fastMapToColor: typeof fastLerp;
declare type LerpFullOutput = {
    color: string;
    leftIndex: number;
    rightIndex: number;
    value: number;
};
declare function lerp$1(normalizedValue: number, colors: string[], fullOutput: boolean): LerpFullOutput;
declare function lerp$1(normalizedValue: number, colors: string[]): string;
declare const mapToColor: typeof lerp$1;
declare function modifyHSL(color: string, h?: number, s?: number, l?: number): string;
declare function modifyAlpha(color: string, alpha?: number): string;
declare function stringify(arrColor: number[], type: string): string;
declare function lum(color: string, backgroundLum: number): number;
declare function random(): string;

declare const color_d_parse: typeof parse;
declare const color_d_lift: typeof lift;
declare const color_d_toHex: typeof toHex;
declare const color_d_fastLerp: typeof fastLerp;
declare const color_d_fastMapToColor: typeof fastMapToColor;
declare const color_d_mapToColor: typeof mapToColor;
declare const color_d_modifyHSL: typeof modifyHSL;
declare const color_d_modifyAlpha: typeof modifyAlpha;
declare const color_d_stringify: typeof stringify;
declare const color_d_lum: typeof lum;
declare const color_d_random: typeof random;
declare namespace color_d {
  export {
    color_d_parse as parse,
    color_d_lift as lift,
    color_d_toHex as toHex,
    color_d_fastLerp as fastLerp,
    color_d_fastMapToColor as fastMapToColor,
    lerp$1 as lerp,
    color_d_mapToColor as mapToColor,
    color_d_modifyHSL as modifyHSL,
    color_d_modifyAlpha as modifyAlpha,
    color_d_stringify as stringify,
    color_d_lum as lum,
    color_d_random as random,
  };
}

declare type ThrottleFunction = (this: unknown, ...args: unknown[]) => void;
interface ThrottleController {
    clear(): void;
    debounceNextCall(debounceDelay: number): void;
}
/**
 * @public
 * @param {(Function)} fn
 * @param {number} [delay=0] Unit: ms.
 * @param {boolean} [debounce=false]
 *        true: If call interval less than `delay`, only the last call works.
 *        false: If call interval less than `delay, call works on fixed rate.
 * @return {(Function)} throttled fn.
 */
declare function throttle<T extends ThrottleFunction>(fn: T, delay?: number, debounce?: boolean): T & ThrottleController;

declare type EnableDataStackDimensionsInput = {
    schema: SeriesDataSchema;
    store?: DataStore;
};
declare type EnableDataStackDimensionsInputLegacy = (SeriesDimensionDefine | string)[];
/**
 * Note that it is too complicated to support 3d stack by value
 * (have to create two-dimension inverted index), so in 3d case
 * we just support that stacked by index.
 *
 * @param seriesModel
 * @param dimensionsInput The same as the input of <module:echarts/data/SeriesData>.
 *        The input will be modified.
 * @param opt
 * @param opt.stackedCoordDimension Specify a coord dimension if needed.
 * @param opt.byIndex=false
 * @return calculationInfo
 * {
 *     stackedDimension: string
 *     stackedByDimension: string
 *     isStackedByIndex: boolean
 *     stackedOverDimension: string
 *     stackResultDimension: string
 * }
 */
declare function enableDataStack(seriesModel: SeriesModel<SeriesOption & SeriesStackOptionMixin>, dimensionsInput: EnableDataStackDimensionsInput | EnableDataStackDimensionsInputLegacy, opt?: {
    stackedCoordDimension?: string;
    byIndex?: boolean;
}): Pick<DataCalculationInfo<unknown>, 'stackedDimension' | 'stackedByDimension' | 'isStackedByIndex' | 'stackedOverDimension' | 'stackResultDimension'>;
declare function isDimensionStacked(data: SeriesData, stackedDim: string): boolean;
declare function getStackedDimension(data: SeriesData, targetDim: string): DimensionName;

/**
 * ECData stored on graphic element
 */
interface ECData {
    dataIndex?: number;
    dataModel?: DataModel;
    eventData?: ECEventData;
    seriesIndex?: number;
    dataType?: SeriesDataType;
    focus?: InnerFocus;
    blurScope?: BlurScope;
    componentMainType?: ComponentMainType;
    componentIndex?: number;
    componentHighDownName?: string;
    tooltipConfig?: {
        name: string;
        option: ComponentItemTooltipOption<unknown>;
    };
}
declare const getECData: (hostObj: Element<ElementProps>) => ECData;

interface CoordDimensionDefinition extends DimensionDefinition {
    dimsDef?: (DimensionName | {
        name: DimensionName;
        defaultTooltip?: boolean;
    })[];
    otherDims?: DataVisualDimensions;
    ordinalMeta?: OrdinalMeta;
    coordDim?: DimensionName;
    coordDimIndex?: DimensionIndex;
}
declare type CoordDimensionDefinitionLoose = CoordDimensionDefinition['name'] | CoordDimensionDefinition;
declare type PrepareSeriesDataSchemaParams = {
    coordDimensions?: CoordDimensionDefinitionLoose[];
    /**
     * Will use `source.dimensionsDefine` if not given.
     */
    dimensionsDefine?: DimensionDefinitionLoose[];
    /**
     * Will use `source.encodeDefine` if not given.
     */
    encodeDefine?: HashMap<OptionEncodeValue, DimensionName> | OptionEncode;
    dimensionsCount?: number;
    /**
     * Make default encode if user not specified.
     */
    encodeDefaulter?: EncodeDefaulter;
    generateCoord?: string;
    generateCoordCount?: number;
    /**
     * If be able to omit unused dimension
     * Used to improve the performance on high dimension data.
     */
    canOmitUnusedDimensions?: boolean;
};
/**
 * For outside usage compat (like echarts-gl are using it).
 */
declare function createDimensions(source: Source | OptionSourceData, opt?: PrepareSeriesDataSchemaParams): SeriesDimensionDefine[];

/**
 * Enable the function that mouseover will trigger the emphasis state.
 *
 * NOTE:
 * This function should be used on the element with dataIndex, seriesIndex.
 *
 */
declare function enableHoverEmphasis(el: Element, focus?: InnerFocus, blurScope?: BlurScope): void;

/**
 * Create a muti dimension List structure from seriesModel.
 */
declare function createList(seriesModel: SeriesModel): SeriesData<Model<any>, DefaultDataVisual>;

declare const dataStack: {
    isDimensionStacked: typeof isDimensionStacked;
    enableDataStack: typeof enableDataStack;
    getStackedDimension: typeof getStackedDimension;
};

/**
 * Create scale
 * @param {Array.<number>} dataExtent
 * @param {Object|module:echarts/Model} option If `optoin.type`
 *        is secified, it can only be `'value'` currently.
 */
declare function createScale(dataExtent: number[], option: object | AxisBaseModel): Scale<Dictionary<unknown>>;
/**
 * Mixin common methods to axis model,
 *
 * Inlcude methods
 * `getFormattedLabels() => Array.<string>`
 * `getCategories() => Array.<string>`
 * `getMin(origin: boolean) => number`
 * `getMax(origin: boolean) => number`
 * `getNeedCrossZero() => boolean`
 */
declare function mixinAxisModelCommonMethods(Model: Model): void;

declare function createTextStyle(textStyleModel: Model<TextCommonOption>, opts?: {
    state?: DisplayState;
}): TextStyleProps;

declare const helper_d_getLayoutRect: typeof getLayoutRect;
declare const helper_d_getECData: typeof getECData;
declare const helper_d_createList: typeof createList;
declare const helper_d_dataStack: typeof dataStack;
declare const helper_d_createScale: typeof createScale;
declare const helper_d_mixinAxisModelCommonMethods: typeof mixinAxisModelCommonMethods;
declare const helper_d_createTextStyle: typeof createTextStyle;
declare const helper_d_createDimensions: typeof createDimensions;
declare const helper_d_createSymbol: typeof createSymbol;
declare const helper_d_enableHoverEmphasis: typeof enableHoverEmphasis;
declare namespace helper_d {
  export {
    helper_d_getLayoutRect as getLayoutRect,
    helper_d_getECData as getECData,
    helper_d_createList as createList,
    helper_d_dataStack as dataStack,
    helper_d_createScale as createScale,
    helper_d_mixinAxisModelCommonMethods as mixinAxisModelCommonMethods,
    helper_d_createTextStyle as createTextStyle,
    helper_d_createDimensions as createDimensions,
    helper_d_createSymbol as createSymbol,
    helper_d_enableHoverEmphasis as enableHoverEmphasis,
  };
}

interface Platform {
    createCanvas(): HTMLCanvasElement;
    measureText(text: string, font?: string): {
        width: number;
    };
    loadImage(src: string, onload: () => void | HTMLImageElement['onload'], onerror: () => void | HTMLImageElement['onerror']): HTMLImageElement;
}
declare function setPlatformAPI(newPlatformApis: Partial<Platform>): void;

declare function parseGeoJSON(geoJson: GeoJSON | GeoJSONCompressed, nameProperty: string): GeoJSONRegion[];

/**
 * Linear mapping a value from domain to range
 * @param  val
 * @param  domain Domain extent domain[0] can be bigger than domain[1]
 * @param  range  Range extent range[0] can be bigger than range[1]
 * @param  clamp Default to be false
 */
declare function linearMap(val: number, domain: number[], range: number[], clamp?: boolean): number;
/**
 * (1) Fix rounding error of float numbers.
 * (2) Support return string to avoid scientific notation like '3.5e-7'.
 */
declare function round(x: number | string, precision?: number): number;
declare function round(x: number | string, precision: number, returnStr: false): number;
declare function round(x: number | string, precision: number, returnStr: true): string;
/**
 * Inplacd asc sort arr.
 * The input arr will be modified.
 */
declare function asc<T extends number[]>(arr: T): T;
/**
 * Get precision.
 */
declare function getPrecision(val: string | number): number;
/**
 * Get precision with slow but safe method
 */
declare function getPrecisionSafe(val: string | number): number;
/**
 * Minimal dicernible data precisioin according to a single pixel.
 */
declare function getPixelPrecision(dataExtent: [number, number], pixelExtent: [number, number]): number;
/**
 * Get a data of given precision, assuring the sum of percentages
 * in valueList is 1.
 * The largest remainer method is used.
 * https://en.wikipedia.org/wiki/Largest_remainder_method
 *
 * @param valueList a list of all data
 * @param idx index of the data to be processed in valueList
 * @param precision integer number showing digits of precision
 * @return percent ranging from 0 to 100
 */
declare function getPercentWithPrecision(valueList: number[], idx: number, precision: number): number;
declare const MAX_SAFE_INTEGER = 9007199254740991;
/**
 * To 0 - 2 * PI, considering negative radian.
 */
declare function remRadian(radian: number): number;
/**
 * @param {type} radian
 * @return {boolean}
 */
declare function isRadianAroundZero(val: number): boolean;
/**
 * @param value valid type: number | string | Date, otherwise return `new Date(NaN)`
 *   These values can be accepted:
 *   + An instance of Date, represent a time in its own time zone.
 *   + Or string in a subset of ISO 8601, only including:
 *     + only year, month, date: '2012-03', '2012-03-01', '2012-03-01 05', '2012-03-01 05:06',
 *     + separated with T or space: '2012-03-01T12:22:33.123', '2012-03-01 12:22:33.123',
 *     + time zone: '2012-03-01T12:22:33Z', '2012-03-01T12:22:33+8000', '2012-03-01T12:22:33-05:00',
 *     all of which will be treated as local time if time zone is not specified
 *     (see <https://momentjs.com/>).
 *   + Or other string format, including (all of which will be treated as loacal time):
 *     '2012', '2012-3-1', '2012/3/1', '2012/03/01',
 *     '2009/6/12 2:00', '2009/6/12 2:05:08', '2009/6/12 2:05:08.123'
 *   + a timestamp, which represent a time in UTC.
 * @return date Never be null/undefined. If invalid, return `new Date(NaN)`.
 */
declare function parseDate(value: unknown): Date;
/**
 * Quantity of a number. e.g. 0.1, 1, 10, 100
 *
 * @param val
 * @return
 */
declare function quantity(val: number): number;
/**
 * Exponent of the quantity of a number
 * e.g., 1234 equals to 1.234*10^3, so quantityExponent(1234) is 3
 *
 * @param val non-negative value
 * @return
 */
declare function quantityExponent(val: number): number;
/**
 * find a “nice” number approximately equal to x. Round the number if round = true,
 * take ceiling if round = false. The primary observation is that the “nicest”
 * numbers in decimal are 1, 2, and 5, and all power-of-ten multiples of these numbers.
 *
 * See "Nice Numbers for Graph Labels" of Graphic Gems.
 *
 * @param  val Non-negative value.
 * @param  round
 * @return Niced number
 */
declare function nice(val: number, round?: boolean): number;
/**
 * This code was copied from "d3.js"
 * <https://github.com/d3/d3/blob/9cc9a875e636a1dcf36cc1e07bdf77e1ad6e2c74/src/arrays/quantile.js>.
 * See the license statement at the head of this file.
 * @param ascArr
 */
declare function quantile(ascArr: number[], p: number): number;
declare type IntervalItem = {
    interval: [number, number];
    close: [0 | 1, 0 | 1];
};
/**
 * Order intervals asc, and split them when overlap.
 * expect(numberUtil.reformIntervals([
 *     {interval: [18, 62], close: [1, 1]},
 *     {interval: [-Infinity, -70], close: [0, 0]},
 *     {interval: [-70, -26], close: [1, 1]},
 *     {interval: [-26, 18], close: [1, 1]},
 *     {interval: [62, 150], close: [1, 1]},
 *     {interval: [106, 150], close: [1, 1]},
 *     {interval: [150, Infinity], close: [0, 0]}
 * ])).toEqual([
 *     {interval: [-Infinity, -70], close: [0, 0]},
 *     {interval: [-70, -26], close: [1, 1]},
 *     {interval: [-26, 18], close: [0, 1]},
 *     {interval: [18, 62], close: [0, 1]},
 *     {interval: [62, 150], close: [0, 1]},
 *     {interval: [150, Infinity], close: [0, 0]}
 * ]);
 * @param list, where `close` mean open or close
 *        of the interval, and Infinity can be used.
 * @return The origin list, which has been reformed.
 */
declare function reformIntervals(list: IntervalItem[]): IntervalItem[];
/**
 * [Numberic is defined as]:
 *     `parseFloat(val) == val`
 * For example:
 * numeric:
 *     typeof number except NaN, '-123', '123', '2e3', '-2e3', '011', 'Infinity', Infinity,
 *     and they rounded by white-spaces or line-terminal like ' -123 \n ' (see es spec)
 * not-numeric:
 *     null, undefined, [], {}, true, false, 'NaN', NaN, '123ab',
 *     empty string, string with only white-spaces or line-terminal (see es spec),
 *     0x12, '0x12', '-0x12', 012, '012', '-012',
 *     non-string, ...
 *
 * @test See full test cases in `test/ut/spec/util/number.js`.
 * @return Must be a typeof number. If not numeric, return NaN.
 */
declare function numericToNumber(val: unknown): number;
/**
 * Definition of "numeric": see `numericToNumber`.
 */
declare function isNumeric(val: unknown): val is number;

declare const number_d_linearMap: typeof linearMap;
declare const number_d_round: typeof round;
declare const number_d_asc: typeof asc;
declare const number_d_getPrecision: typeof getPrecision;
declare const number_d_getPrecisionSafe: typeof getPrecisionSafe;
declare const number_d_getPixelPrecision: typeof getPixelPrecision;
declare const number_d_getPercentWithPrecision: typeof getPercentWithPrecision;
declare const number_d_MAX_SAFE_INTEGER: typeof MAX_SAFE_INTEGER;
declare const number_d_remRadian: typeof remRadian;
declare const number_d_isRadianAroundZero: typeof isRadianAroundZero;
declare const number_d_parseDate: typeof parseDate;
declare const number_d_quantity: typeof quantity;
declare const number_d_quantityExponent: typeof quantityExponent;
declare const number_d_nice: typeof nice;
declare const number_d_quantile: typeof quantile;
declare const number_d_reformIntervals: typeof reformIntervals;
declare const number_d_isNumeric: typeof isNumeric;
declare const number_d_numericToNumber: typeof numericToNumber;
declare namespace number_d {
  export {
    number_d_linearMap as linearMap,
    number_d_round as round,
    number_d_asc as asc,
    number_d_getPrecision as getPrecision,
    number_d_getPrecisionSafe as getPrecisionSafe,
    number_d_getPixelPrecision as getPixelPrecision,
    number_d_getPercentWithPrecision as getPercentWithPrecision,
    number_d_MAX_SAFE_INTEGER as MAX_SAFE_INTEGER,
    number_d_remRadian as remRadian,
    number_d_isRadianAroundZero as isRadianAroundZero,
    number_d_parseDate as parseDate,
    number_d_quantity as quantity,
    number_d_quantityExponent as quantityExponent,
    number_d_nice as nice,
    number_d_quantile as quantile,
    number_d_reformIntervals as reformIntervals,
    number_d_isNumeric as isNumeric,
    number_d_numericToNumber as numericToNumber,
  };
}

declare function format(time: unknown, template: string, isUTC: boolean, lang?: string | Model<LocaleOption>): string;

declare const time_d_format: typeof format;
declare namespace time_d {
  export {
    parseDate as parse,
    time_d_format as format,
  };
}

declare const graphic_d_extendShape: typeof extendShape;
declare const graphic_d_extendPath: typeof extendPath;
declare const graphic_d_makePath: typeof makePath;
declare const graphic_d_makeImage: typeof makeImage;
declare const graphic_d_resizePath: typeof resizePath;
declare const graphic_d_createIcon: typeof createIcon;
declare const graphic_d_updateProps: typeof updateProps;
declare const graphic_d_initProps: typeof initProps;
declare const graphic_d_getTransform: typeof getTransform;
declare const graphic_d_clipPointsByRect: typeof clipPointsByRect;
declare const graphic_d_clipRectByRect: typeof clipRectByRect;
declare const graphic_d_registerShape: typeof registerShape;
declare const graphic_d_getShapeClass: typeof getShapeClass;
type graphic_d_Group = Group;
declare const graphic_d_Group: typeof Group;
type graphic_d_Circle = Circle;
declare const graphic_d_Circle: typeof Circle;
type graphic_d_Ellipse = Ellipse;
declare const graphic_d_Ellipse: typeof Ellipse;
type graphic_d_Sector = Sector;
declare const graphic_d_Sector: typeof Sector;
type graphic_d_Ring = Ring;
declare const graphic_d_Ring: typeof Ring;
type graphic_d_Polygon = Polygon;
declare const graphic_d_Polygon: typeof Polygon;
type graphic_d_Polyline = Polyline;
declare const graphic_d_Polyline: typeof Polyline;
type graphic_d_Rect = Rect;
declare const graphic_d_Rect: typeof Rect;
type graphic_d_Line = Line;
declare const graphic_d_Line: typeof Line;
type graphic_d_BezierCurve = BezierCurve;
declare const graphic_d_BezierCurve: typeof BezierCurve;
type graphic_d_Arc = Arc;
declare const graphic_d_Arc: typeof Arc;
type graphic_d_IncrementalDisplayable = IncrementalDisplayable;
declare const graphic_d_IncrementalDisplayable: typeof IncrementalDisplayable;
type graphic_d_CompoundPath = CompoundPath;
declare const graphic_d_CompoundPath: typeof CompoundPath;
type graphic_d_LinearGradient = LinearGradient;
declare const graphic_d_LinearGradient: typeof LinearGradient;
type graphic_d_RadialGradient = RadialGradient;
declare const graphic_d_RadialGradient: typeof RadialGradient;
type graphic_d_BoundingRect = BoundingRect;
declare const graphic_d_BoundingRect: typeof BoundingRect;
declare namespace graphic_d {
  export {
    graphic_d_extendShape as extendShape,
    graphic_d_extendPath as extendPath,
    graphic_d_makePath as makePath,
    graphic_d_makeImage as makeImage,
    mergePath$1 as mergePath,
    graphic_d_resizePath as resizePath,
    graphic_d_createIcon as createIcon,
    graphic_d_updateProps as updateProps,
    graphic_d_initProps as initProps,
    graphic_d_getTransform as getTransform,
    graphic_d_clipPointsByRect as clipPointsByRect,
    graphic_d_clipRectByRect as clipRectByRect,
    graphic_d_registerShape as registerShape,
    graphic_d_getShapeClass as getShapeClass,
    graphic_d_Group as Group,
    ZRImage as Image,
    ZRText as Text,
    graphic_d_Circle as Circle,
    graphic_d_Ellipse as Ellipse,
    graphic_d_Sector as Sector,
    graphic_d_Ring as Ring,
    graphic_d_Polygon as Polygon,
    graphic_d_Polyline as Polyline,
    graphic_d_Rect as Rect,
    graphic_d_Line as Line,
    graphic_d_BezierCurve as BezierCurve,
    graphic_d_Arc as Arc,
    graphic_d_IncrementalDisplayable as IncrementalDisplayable,
    graphic_d_CompoundPath as CompoundPath,
    graphic_d_LinearGradient as LinearGradient,
    graphic_d_RadialGradient as RadialGradient,
    graphic_d_BoundingRect as BoundingRect,
  };
}

declare const format_d_addCommas: typeof addCommas;
declare const format_d_toCamelCase: typeof toCamelCase;
declare const format_d_encodeHTML: typeof encodeHTML;
declare const format_d_formatTpl: typeof formatTpl;
declare const format_d_getTooltipMarker: typeof getTooltipMarker;
declare const format_d_formatTime: typeof formatTime;
declare const format_d_capitalFirst: typeof capitalFirst;
declare const format_d_truncateText: typeof truncateText;
declare const format_d_getTextRect: typeof getTextRect;
declare namespace format_d {
  export {
    format_d_addCommas as addCommas,
    format_d_toCamelCase as toCamelCase,
    normalizeCssArray$1 as normalizeCssArray,
    format_d_encodeHTML as encodeHTML,
    format_d_formatTpl as formatTpl,
    format_d_getTooltipMarker as getTooltipMarker,
    format_d_formatTime as formatTime,
    format_d_capitalFirst as capitalFirst,
    format_d_truncateText as truncateText,
    format_d_getTextRect as getTextRect,
  };
}

declare const util_d$1_map: typeof map;
declare const util_d$1_each: typeof each;
declare const util_d$1_indexOf: typeof indexOf;
declare const util_d$1_inherits: typeof inherits;
declare const util_d$1_reduce: typeof reduce;
declare const util_d$1_filter: typeof filter;
declare const util_d$1_bind: typeof bind;
declare const util_d$1_curry: typeof curry;
declare const util_d$1_isArray: typeof isArray;
declare const util_d$1_isString: typeof isString;
declare const util_d$1_isObject: typeof isObject;
declare const util_d$1_isFunction: typeof isFunction;
declare const util_d$1_extend: typeof extend;
declare const util_d$1_defaults: typeof defaults;
declare const util_d$1_merge: typeof merge;
declare namespace util_d$1 {
  export {
    util_d$1_map as map,
    util_d$1_each as each,
    util_d$1_indexOf as indexOf,
    util_d$1_inherits as inherits,
    util_d$1_reduce as reduce,
    util_d$1_filter as filter,
    util_d$1_bind as bind,
    util_d$1_curry as curry,
    util_d$1_isArray as isArray,
    util_d$1_isString as isString,
    util_d$1_isObject as isObject,
    util_d$1_isFunction as isFunction,
    util_d$1_extend as extend,
    util_d$1_defaults as defaults,
    clone$2 as clone,
    util_d$1_merge as merge,
  };
}

declare class Browser {
    firefox: boolean;
    ie: boolean;
    edge: boolean;
    newEdge: boolean;
    weChat: boolean;
    version: string | number;
}
declare class Env {
    browser: Browser;
    node: boolean;
    wxa: boolean;
    worker: boolean;
    svgSupported: boolean;
    touchEventsSupported: boolean;
    pointerEventsSupported: boolean;
    domSupported: boolean;
    transformSupported: boolean;
    transform3dSupported: boolean;
    hasGlobalWindow: boolean;
}
declare const env: Env;

declare function brushSingle(ctx: CanvasRenderingContext2D, el: Displayable): void;

declare function extendComponentModel(proto: object): ComponentModel;
declare function extendComponentView(proto: object): ChartView;
declare function extendSeriesModel(proto: object): SeriesModel;
declare function extendChartView(proto: object): ChartView;

declare type ParallelLayoutDirection = 'horizontal' | 'vertical';
interface ParallelCoordinateSystemOption extends ComponentOption, BoxLayoutOptionMixin {
    mainType?: 'parallel';
    layout?: ParallelLayoutDirection;
    axisExpandable?: boolean;
    axisExpandCenter?: number;
    axisExpandCount?: number;
    axisExpandWidth?: number;
    axisExpandTriggerOn?: 'click' | 'mousemove';
    axisExpandRate?: number;
    axisExpandDebounce?: number;
    axisExpandSlideTriggerArea?: [number, number, number];
    axisExpandWindow?: number[];
    parallelAxisDefault?: ParallelAxisOption;
}

declare type ParallelAxisOption = AxisBaseOption & {
    /**
     * 0, 1, 2, ...
     */
    dim?: number | number[];
    parallelIndex?: number;
    areaSelectStyle?: {
        width?: number;
        borderWidth?: number;
        borderColor?: ZRColor;
        color?: ZRColor;
        opacity?: number;
    };
    realtime?: boolean;
};

declare type Dependencies = {
    grid: XAXisOption | YAXisOption | AxisPointerOption;
    polar: AngleAxisOption | RadiusAxisOption;
    parallel: ParallelAxisOption;
};
declare type DependenciesKeys = keyof Dependencies & string;
declare type Arrayable<T> = T | T[];
declare type GetMainType<OptionUnion extends ComponentOption> = Exclude<OptionUnion['mainType'], undefined>;
declare type ExtractComponentOption<OptionUnion, ExtractMainType> = OptionUnion extends {
    mainType?: ExtractMainType;
} ? OptionUnion : never;
declare type GetDependency<DependencyOption extends ComponentOption> = {
    [key in GetMainType<DependencyOption>]?: Arrayable<ExtractComponentOption<DependencyOption, key>>;
};
declare type GetDependencies<MainType extends string> = GetDependency<Dependencies[Extract<MainType, DependenciesKeys>]>;
declare type ComposeUnitOption<OptionUnion extends ComponentOption> = CheckMainType<GetMainType<OptionUnion>> & Omit<ECBasicOption, 'baseOption' | 'options'> & {
    [key in GetMainType<OptionUnion>]?: Arrayable<ExtractComponentOption<OptionUnion, key>>;
} & GetDependencies<GetMainType<OptionUnion>>;
declare type CheckMainType<OptionUnionMainType extends string> = string extends OptionUnionMainType ? never : {};
declare type ComposeOption<OptionUnion extends ComponentOption> = ComposeUnitOption<OptionUnion> & {
    baseOption?: ComposeUnitOption<OptionUnion>;
    options?: ComposeUnitOption<OptionUnion>[];
};

declare function install$1(registers: EChartsExtensionInstallRegisters): void;

declare function install$2(registers: EChartsExtensionInstallRegisters): void;

declare function install$3(registers: EChartsExtensionInstallRegisters): void;

declare function install$4(registers: EChartsExtensionInstallRegisters): void;

declare function install$5(registers: EChartsExtensionInstallRegisters): void;

declare function install$6(registers: EChartsExtensionInstallRegisters): void;

declare function install$7(registers: EChartsExtensionInstallRegisters): void;

declare function install$8(registers: EChartsExtensionInstallRegisters): void;

declare function install$9(registers: EChartsExtensionInstallRegisters): void;

declare function install$a(registers: EChartsExtensionInstallRegisters): void;

declare function install$b(registers: EChartsExtensionInstallRegisters): void;

declare function install$c(registers: EChartsExtensionInstallRegisters): void;

declare function install$d(registers: EChartsExtensionInstallRegisters): void;

declare function install$e(registers: EChartsExtensionInstallRegisters): void;

declare function install$f(registers: EChartsExtensionInstallRegisters): void;

declare function install$g(registers: EChartsExtensionInstallRegisters): void;

declare function install$h(registers: EChartsExtensionInstallRegisters): void;

declare function install$i(registers: EChartsExtensionInstallRegisters): void;

declare function install$j(registers: EChartsExtensionInstallRegisters): void;

declare function install$k(registers: EChartsExtensionInstallRegisters): void;

declare function install$l(registers: EChartsExtensionInstallRegisters): void;

declare function install$m(registers: EChartsExtensionInstallRegisters): void;

interface RadarIndicatorOption {
    name?: string;
    /**
     * @deprecated Use `name` instead.
     */
    text?: string;
    min?: number;
    max?: number;
    color?: ColorString;
    axisType?: 'value' | 'log';
}
interface RadarOption extends ComponentOption, CircleLayoutOptionMixin {
    mainType?: 'radar';
    startAngle?: number;
    shape?: 'polygon' | 'circle';
    axisLine?: AxisBaseOption['axisLine'];
    axisTick?: AxisBaseOption['axisTick'];
    axisLabel?: AxisBaseOption['axisLabel'];
    splitLine?: AxisBaseOption['splitLine'];
    splitArea?: AxisBaseOption['splitArea'];
    axisName?: {
        show?: boolean;
        formatter?: string | ((name?: string, indicatorOpt?: InnerIndicatorAxisOption) => string);
    } & LabelOption;
    axisNameGap?: number;
    triggerEvent?: boolean;
    scale?: boolean;
    splitNumber?: number;
    boundaryGap?: CategoryAxisBaseOption['boundaryGap'] | ValueAxisBaseOption['boundaryGap'];
    indicator?: RadarIndicatorOption[];
}
declare type InnerIndicatorAxisOption = AxisBaseOption & {
    showName?: boolean;
};

declare type SingleAxisPosition = 'top' | 'bottom' | 'left' | 'right';
declare type SingleAxisOption = AxisBaseOption & BoxLayoutOptionMixin & {
    mainType?: 'singleAxis';
    position?: SingleAxisPosition;
    orient?: LayoutOrient;
};

interface CalendarMonthLabelFormatterCallbackParams {
    nameMap: string;
    yyyy: string;
    yy: string;
    /**
     * Month string. With 0 prefix.
     */
    MM: string;
    /**
     * Month number
     */
    M: number;
}
interface CalendarYearLabelFormatterCallbackParams {
    nameMap: string;
    /**
     * Start year
     */
    start: string;
    /**
     * End year
     */
    end: string;
}
interface CalendarOption extends ComponentOption, BoxLayoutOptionMixin {
    mainType?: 'calendar';
    cellSize?: number | 'auto' | (number | 'auto')[];
    orient?: LayoutOrient;
    splitLine?: {
        show?: boolean;
        lineStyle?: LineStyleOption;
    };
    itemStyle?: ItemStyleOption;
    /**
     * // one year
     * range: 2017
     * // one month
     * range: '2017-02'
     * //  a range
     * range: ['2017-01-02', '2017-02-23']
     * // note: they will be identified as ['2017-01-01', '2017-02-01']
     * range: ['2017-01', '2017-02']
     */
    range?: OptionDataValueDate | (OptionDataValueDate)[];
    dayLabel?: Omit<LabelOption, 'position'> & {
        /**
         * First day of week.
         */
        firstDay?: number;
        /**
         * Margin between day label and axis line.
         * Can be percent string of cell size.
         */
        margin?: number | string;
        /**
         * Position of week, at the beginning or end of the range.
         */
        position?: 'start' | 'end';
        /**
         * Week text content
         *
         * defaults to auto-detected locale by the browser or the specified locale by `echarts.init` function.
         * It supports any registered locale name (case-sensitive) or customized array.
         * index 0 always means Sunday.
         */
        nameMap?: string | string[];
    };
    monthLabel?: Omit<LabelOption, 'position'> & {
        /**
         * Margin between month label and axis line.
         */
        margin?: number;
        /**
         * Position of month label, at the beginning or end of the range.
         */
        position?: 'start' | 'end';
        /**
         * Month text content
         *
         * defaults to auto-detected locale by the browser or the specified locale by `echarts.init` function.
         * It supports any registered locale name (case-sensitive) or customized array.
         * index 0 always means Jan.
         */
        nameMap?: string | string[];
        formatter?: string | ((params: CalendarMonthLabelFormatterCallbackParams) => string);
    };
    yearLabel?: Omit<LabelOption, 'position'> & {
        /**
         * Margin between year label and axis line.
         */
        margin?: number;
        /**
         * Position of year label, at the beginning or end of the range.
         */
        position?: 'top' | 'bottom' | 'left' | 'right';
        formatter?: string | ((params: CalendarYearLabelFormatterCallbackParams) => string);
    };
}

declare type IconStyle = ItemStyleOption & {
    textFill?: LabelOption['color'];
    textBackgroundColor?: LabelOption['backgroundColor'];
    textPosition?: LabelOption['position'];
    textAlign?: LabelOption['align'];
    textBorderRadius?: LabelOption['borderRadius'];
    textPadding?: LabelOption['padding'];
};
interface ToolboxFeatureOption {
    show?: boolean;
    title?: string | Partial<Dictionary<string>>;
    icon?: string | Partial<Dictionary<string>>;
    iconStyle?: IconStyle;
    emphasis?: {
        iconStyle?: IconStyle;
    };
    iconStatus?: Partial<Dictionary<DisplayState>>;
    onclick?: () => void;
}

interface ToolboxTooltipFormatterParams {
    componentType: 'toolbox';
    name: string;
    title: string;
    $vars: ['name', 'title'];
}
interface ToolboxOption extends ComponentOption, BoxLayoutOptionMixin, BorderOptionMixin {
    mainType?: 'toolbox';
    show?: boolean;
    orient?: LayoutOrient;
    backgroundColor?: ZRColor;
    borderRadius?: number | number[];
    padding?: number | number[];
    itemSize?: number;
    itemGap?: number;
    showTitle?: boolean;
    iconStyle?: ItemStyleOption;
    emphasis?: {
        iconStyle?: ItemStyleOption;
    };
    textStyle?: LabelOption;
    tooltip?: CommonTooltipOption<ToolboxTooltipFormatterParams>;
    /**
     * Write all supported features in the final export option.
     */
    feature?: Partial<Dictionary<ToolboxFeatureOption>>;
}

interface TitleOption extends ComponentOption, BoxLayoutOptionMixin, BorderOptionMixin {
    mainType?: 'title';
    show?: boolean;
    text?: string;
    /**
     * Link to url
     */
    link?: string;
    target?: 'self' | 'blank';
    subtext?: string;
    sublink?: string;
    subtarget?: 'self' | 'blank';
    textAlign?: ZRTextAlign;
    textVerticalAlign?: ZRTextVerticalAlign;
    /**
     * @deprecated Use textVerticalAlign instead
     */
    textBaseline?: ZRTextVerticalAlign;
    backgroundColor?: ZRColor;
    /**
     * Padding between text and border.
     * Support to be a single number or an array.
     */
    padding?: number | number[];
    /**
     * Gap between text and subtext
     */
    itemGap?: number;
    textStyle?: LabelOption;
    subtextStyle?: LabelOption;
    /**
     * If trigger mouse or touch event
     */
    triggerEvent?: boolean;
    /**
     * Radius of background border.
     */
    borderRadius?: number | number[];
}
declare function install$n(registers: EChartsExtensionInstallRegisters): void;

interface TimelineControlStyle extends ItemStyleOption {
    show?: boolean;
    showPlayBtn?: boolean;
    showPrevBtn?: boolean;
    showNextBtn?: boolean;
    itemSize?: number;
    itemGap?: number;
    position?: 'left' | 'right' | 'top' | 'bottom';
    playIcon?: string;
    stopIcon?: string;
    prevIcon?: string;
    nextIcon?: string;
    playBtnSize?: number | string;
    stopBtnSize?: number | string;
    nextBtnSize?: number | string;
    prevBtnSize?: number | string;
}
interface TimelineCheckpointStyle extends ItemStyleOption, SymbolOptionMixin {
    animation?: boolean;
    animationDuration?: number;
    animationEasing?: ZREasing;
}
interface TimelineLineStyleOption extends LineStyleOption {
    show?: boolean;
}
interface TimelineLabelOption extends Omit<LabelOption, 'position'> {
    show?: boolean;
    position?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | number;
    interval?: 'auto' | number;
    formatter?: string | ((value: string | number, index: number) => string);
}
interface TimelineDataItemOption extends SymbolOptionMixin {
    value?: OptionDataValue;
    itemStyle?: ItemStyleOption;
    label?: TimelineLabelOption;
    checkpointStyle?: TimelineCheckpointStyle;
    emphasis?: {
        itemStyle?: ItemStyleOption;
        label?: TimelineLabelOption;
        checkpointStyle?: TimelineCheckpointStyle;
    };
    progress?: {
        lineStyle?: TimelineLineStyleOption;
        itemStyle?: ItemStyleOption;
        label?: TimelineLabelOption;
    };
    tooltip?: boolean;
}
interface TimelineOption extends ComponentOption, BoxLayoutOptionMixin, SymbolOptionMixin {
    mainType?: 'timeline';
    backgroundColor?: ZRColor;
    borderColor?: ColorString;
    borderWidth?: number;
    tooltip?: CommonTooltipOption<CallbackDataParams> & {
        trigger?: 'item';
    };
    show?: boolean;
    axisType?: 'category' | 'time' | 'value';
    currentIndex?: number;
    autoPlay?: boolean;
    rewind?: boolean;
    loop?: boolean;
    playInterval?: number;
    realtime?: boolean;
    controlPosition?: 'left' | 'right' | 'top' | 'bottom';
    padding?: number | number[];
    orient?: LayoutOrient;
    inverse?: boolean;
    replaceMerge?: GlobalModelSetOptionOpts['replaceMerge'];
    lineStyle?: TimelineLineStyleOption;
    itemStyle?: ItemStyleOption;
    checkpointStyle?: TimelineCheckpointStyle;
    controlStyle?: TimelineControlStyle;
    label?: TimelineLabelOption;
    emphasis?: {
        lineStyle?: TimelineLineStyleOption;
        itemStyle?: ItemStyleOption;
        checkpointStyle?: TimelineCheckpointStyle;
        controlStyle?: TimelineControlStyle;
        label?: TimelineLabelOption;
    };
    progress?: {
        lineStyle?: TimelineLineStyleOption;
        itemStyle?: ItemStyleOption;
        label?: TimelineLabelOption;
    };
    data?: (OptionDataValue | TimelineDataItemOption)[];
}

interface SliderTimelineOption extends TimelineOption {
}

interface ScrollableLegendOption extends LegendOption {
    scrollDataIndex?: number;
    /**
     * Gap between each page button
     */
    pageButtonItemGap?: number;
    /**
     * Gap between page buttons group and legend items.
     */
    pageButtonGap?: number;
    pageButtonPosition?: 'start' | 'end';
    pageFormatter?: string | ((param: {
        current: number;
        total: number;
    }) => string);
    pageIcons?: {
        horizontal?: string[];
        vertical?: string[];
    };
    pageIconColor?: ZRColor;
    pageIconInactiveColor?: ZRColor;
    pageIconSize?: number;
    pageTextStyle?: LabelOption;
    animationDurationUpdate?: number;
}

interface DataZoomOption extends ComponentOption {
    mainType?: 'dataZoom';
    /**
     * Default auto by axisIndex
     */
    orient?: LayoutOrient;
    /**
     * Default the first horizontal category axis.
     */
    xAxisIndex?: number | number[];
    xAxisId?: string | string[];
    /**
     * Default the first vertical category axis.
     */
    yAxisIndex?: number | number[];
    yAxisId?: string | string[];
    radiusAxisIndex?: number | number[];
    radiusAxisId?: string | string[];
    angleAxisIndex?: number | number[];
    angleAxisId?: string | string[];
    singleAxisIndex?: number | number[];
    singleAxisId?: string | string[];
    /**
     * Possible values: 'filter' or 'empty' or 'weakFilter'.
     * 'filter': data items which are out of window will be removed. This option is
     *         applicable when filtering outliers. For each data item, it will be
     *         filtered if one of the relevant dimensions is out of the window.
     * 'weakFilter': data items which are out of window will be removed. This option
     *         is applicable when filtering outliers. For each data item, it will be
     *         filtered only if all  of the relevant dimensions are out of the same
     *         side of the window.
     * 'empty': data items which are out of window will be set to empty.
     *         This option is applicable when user should not neglect
     *         that there are some data items out of window.
     * 'none': Do not filter.
     * Taking line chart as an example, line will be broken in
     * the filtered points when filterModel is set to 'empty', but
     * be connected when set to 'filter'.
     */
    filterMode?: 'filter' | 'weakFilter' | 'empty' | 'none';
    /**
     * Dispatch action by the fixed rate, avoid frequency.
     * default 100. Do not throttle when use null/undefined.
     * If animation === true and animationDurationUpdate > 0,
     * default value is 100, otherwise 20.
     */
    throttle?: number | null | undefined;
    /**
     * Start percent. 0 ~ 100
     */
    start?: number;
    /**
     * End percent. 0 ~ 100
     */
    end?: number;
    /**
     * Start value. If startValue specified, start is ignored
     */
    startValue?: number | string | Date;
    /**
     * End value. If endValue specified, end is ignored.
     */
    endValue?: number | string | Date;
    /**
     * Min span percent, 0 - 100
     * The range of dataZoom can not be smaller than that.
     */
    minSpan?: number;
    /**
     * Max span percent, 0 - 100
     * The range of dataZoom can not be larger than that.
     */
    maxSpan?: number;
    minValueSpan?: number;
    maxValueSpan?: number;
    rangeMode?: ['value' | 'percent', 'value' | 'percent'];
    realtime?: boolean;
    textStyle?: LabelOption;
}

interface SliderDataZoomOption extends DataZoomOption, BoxLayoutOptionMixin {
    show?: boolean;
    /**
     * Slider dataZoom don't support textStyle
     */
    /**
     * Background of slider zoom component
     */
    backgroundColor?: ZRColor;
    /**
     * @deprecated Use borderColor instead
     */
    /**
     * border color of the box. For compatibility,
     * if dataBackgroundColor is set, borderColor
     * is ignored.
     */
    borderColor?: ZRColor;
    /**
     * Border radius of the box.
     */
    borderRadius?: number | number[];
    dataBackground?: {
        lineStyle?: LineStyleOption;
        areaStyle?: AreaStyleOption;
    };
    selectedDataBackground?: {
        lineStyle?: LineStyleOption;
        areaStyle?: AreaStyleOption;
    };
    /**
     * Color of selected area.
     */
    fillerColor?: ZRColor;
    /**
     * @deprecated Use handleStyle instead
     */
    handleIcon?: string;
    /**
     * number: height of icon. width will be calculated according to the aspect of icon.
     * string: percent of the slider height. width will be calculated according to the aspect of icon.
     */
    handleSize?: string | number;
    handleStyle?: ItemStyleOption;
    /**
     * Icon to indicate it is a draggable panel.
     */
    moveHandleIcon?: string;
    moveHandleStyle?: ItemStyleOption;
    /**
     * Height of handle rect. Can be a percent string relative to the slider height.
     */
    moveHandleSize?: number;
    labelPrecision?: number | 'auto';
    labelFormatter?: string | ((value: number, valueStr: string) => string);
    showDetail?: boolean;
    showDataShadow?: 'auto' | boolean;
    zoomLock?: boolean;
    textStyle?: LabelOption;
    /**
     * If eable select by brushing
     */
    brushSelect?: boolean;
    brushStyle?: ItemStyleOption;
    emphasis?: {
        handleStyle?: ItemStyleOption;
        moveHandleStyle?: ItemStyleOption;
    };
}

interface InsideDataZoomOption extends DataZoomOption {
    /**
     * Whether disable this inside zoom.
     */
    disabled?: boolean;
    /**
     * Whether disable zoom but only pan.
     */
    zoomLock?: boolean;
    zoomOnMouseWheel?: boolean | 'shift' | 'ctrl' | 'alt';
    moveOnMouseMove?: boolean | 'shift' | 'ctrl' | 'alt';
    moveOnMouseWheel?: boolean | 'shift' | 'ctrl' | 'alt';
    preventDefaultMouseMove?: boolean;
    /**
     * Inside dataZoom don't support textStyle
     */
    textStyle?: never;
}

interface ContinousVisualMapOption extends VisualMapOption {
    align?: 'auto' | 'left' | 'right' | 'top' | 'bottom';
    /**
     * This prop effect default component type determine
     * @see echarts/component/visualMap/typeDefaulter.
     */
    calculable?: boolean;
    /**
     * selected range. In default case `range` is [min, max]
     * and can auto change along with modification of min max,
     * util user specifid a range.
     */
    range?: number[];
    /**
     * Whether to enable hover highlight.
     */
    hoverLink?: boolean;
    /**
     * The extent of hovered data.
     */
    hoverLinkDataSize?: number;
    /**
     * Whether trigger hoverLink when hover handle.
     * If not specified, follow the value of `realtime`.
     */
    hoverLinkOnHandle?: boolean;
    handleIcon?: string;
    handleSize?: string | number;
    handleStyle?: ItemStyleOption;
    indicatorIcon?: string;
    indicatorSize?: string | number;
    indicatorStyle?: ItemStyleOption;
    emphasis?: {
        handleStyle?: ItemStyleOption;
    };
}

interface VisualPiece extends VisualOptionPiecewise {
    min?: number;
    max?: number;
    lt?: number;
    gt?: number;
    lte?: number;
    gte?: number;
    value?: number;
    label?: string;
}
/**
 * Order Rule:
 *
 * option.categories / option.pieces / option.text / option.selected:
 *     If !option.inverse,
 *     Order when vertical: ['top', ..., 'bottom'].
 *     Order when horizontal: ['left', ..., 'right'].
 *     If option.inverse, the meaning of
 *     the order should be reversed.
 *
 * this._pieceList:
 *     The order is always [low, ..., high].
 *
 * Mapping from location to low-high:
 *     If !option.inverse
 *     When vertical, top is high.
 *     When horizontal, right is high.
 *     If option.inverse, reverse.
 */
interface PiecewiseVisualMapOption extends VisualMapOption {
    align?: 'auto' | 'left' | 'right';
    minOpen?: boolean;
    maxOpen?: boolean;
    /**
     * When put the controller vertically, it is the length of
     * horizontal side of each item. Otherwise, vertical side.
     * When put the controller vertically, it is the length of
     * vertical side of each item. Otherwise, horizontal side.
     */
    itemWidth?: number;
    itemHeight?: number;
    itemSymbol?: string;
    pieces?: VisualPiece[];
    /**
     * category names, like: ['some1', 'some2', 'some3'].
     * Attr min/max are ignored when categories set. See "Order Rule"
     */
    categories?: string[];
    /**
     * If set to 5, auto split five pieces equally.
     * If set to 0 and component type not set, component type will be
     * determined as "continuous". (It is less reasonable but for ec2
     * compatibility, see echarts/component/visualMap/typeDefaulter)
     */
    splitNumber?: number;
    /**
     * Object. If not specified, means selected. When pieces and splitNumber: {'0': true, '5': true}
     * When categories: {'cate1': false, 'cate3': true} When selected === false, means all unselected.
     */
    selected?: Dictionary<boolean>;
    selectedMode?: 'multiple' | 'single' | boolean;
    /**
     * By default, when text is used, label will hide (the logic
     * is remained for compatibility reason)
     */
    showLabel?: boolean;
    itemGap?: number;
    hoverLink?: boolean;
}

declare type MarkerStatisticType = 'average' | 'min' | 'max' | 'median';
/**
 * Option to specify where to put the marker.
 */
interface MarkerPositionOption {
    x?: number | string;
    y?: number | string;
    /**
     * Coord on any coordinate system
     */
    coord?: (ScaleDataValue | MarkerStatisticType)[];
    xAxis?: ScaleDataValue;
    yAxis?: ScaleDataValue;
    radiusAxis?: ScaleDataValue;
    angleAxis?: ScaleDataValue;
    type?: MarkerStatisticType;
    /**
     * When using statistic method with type.
     * valueIndex and valueDim can be specify which dim the statistic is used on.
     */
    valueIndex?: number;
    valueDim?: string;
    /**
     * Value to be displayed as label. Totally optional
     */
    value?: string | number;
}
interface MarkerOption extends ComponentOption, AnimationOptionMixin {
    silent?: boolean;
    data?: unknown[];
    tooltip?: CommonTooltipOption<unknown> & {
        trigger?: 'item' | 'axis' | boolean | 'none';
    };
}

interface MarkLineStateOption {
    lineStyle?: LineStyleOption;
    /**
     * itemStyle for symbol
     */
    itemStyle?: ItemStyleOption;
    label?: SeriesLineLabelOption;
}
interface MarkLineDataItemOptionBase extends MarkLineStateOption, StatesOptionMixin<MarkLineStateOption, StatesMixinBase> {
    name?: string;
}
interface MarkLine1DDataItemOption extends MarkLineDataItemOptionBase {
    xAxis?: number | string;
    yAxis?: number | string;
    type?: MarkerStatisticType;
    /**
     * When using statistic method with type.
     * valueIndex and valueDim can be specify which dim the statistic is used on.
     */
    valueIndex?: number;
    valueDim?: string;
    /**
     * Symbol for both two ends
     */
    symbol?: string[] | string;
    symbolSize?: number[] | number;
    symbolRotate?: number[] | number;
    symbolOffset?: number | string | (number | string)[];
}
interface MarkLine2DDataItemDimOption extends MarkLineDataItemOptionBase, SymbolOptionMixin, MarkerPositionOption {
}
declare type MarkLine2DDataItemOption = [
    MarkLine2DDataItemDimOption,
    MarkLine2DDataItemDimOption
];
interface MarkLineOption extends MarkerOption, MarkLineStateOption, StatesOptionMixin<MarkLineStateOption, StatesMixinBase> {
    mainType?: 'markLine';
    symbol?: string[] | string;
    symbolSize?: number[] | number;
    symbolRotate?: number[] | number;
    symbolOffset?: number | string | (number | string)[];
    /**
     * Precision used on statistic method
     */
    precision?: number;
    data?: (MarkLine1DDataItemOption | MarkLine2DDataItemOption)[];
}

interface MarkPointStateOption {
    itemStyle?: ItemStyleOption;
    label?: SeriesLabelOption;
}
interface MarkPointDataItemOption extends MarkPointStateOption, StatesOptionMixin<MarkPointStateOption, StatesMixinBase>, SymbolOptionMixin<CallbackDataParams>, MarkerPositionOption {
    name: string;
}
interface MarkPointOption extends MarkerOption, SymbolOptionMixin<CallbackDataParams>, StatesOptionMixin<MarkPointStateOption, StatesMixinBase>, MarkPointStateOption {
    mainType?: 'markPoint';
    precision?: number;
    data?: MarkPointDataItemOption[];
}

interface MarkAreaStateOption {
    itemStyle?: ItemStyleOption;
    label?: SeriesLabelOption;
}
interface MarkAreaDataItemOptionBase extends MarkAreaStateOption, StatesOptionMixin<MarkAreaStateOption, StatesMixinBase> {
    name?: string;
}
interface MarkArea1DDataItemOption extends MarkAreaDataItemOptionBase {
    xAxis?: number;
    yAxis?: number;
    type?: MarkerStatisticType;
    valueIndex?: number;
    valueDim?: string;
}
interface MarkArea2DDataItemDimOption extends MarkAreaDataItemOptionBase, MarkerPositionOption {
}
declare type MarkArea2DDataItemOption = [
    MarkArea2DDataItemDimOption,
    MarkArea2DDataItemDimOption
];
interface MarkAreaOption extends MarkerOption, MarkAreaStateOption, StatesOptionMixin<MarkAreaStateOption, StatesMixinBase> {
    mainType?: 'markArea';
    precision?: number;
    data?: (MarkArea1DDataItemOption | MarkArea2DDataItemOption)[];
}

declare type LineDataValue = OptionDataValue | OptionDataValue[];
interface LineStateOptionMixin {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean;
    };
}
interface LineStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    label?: SeriesLabelOption;
    endLabel?: LineEndLabelOption;
}
interface LineDataItemOption extends SymbolOptionMixin, LineStateOption, StatesOptionMixin<LineStateOption, LineStateOptionMixin> {
    name?: string;
    value?: LineDataValue;
}
interface LineEndLabelOption extends SeriesLabelOption {
    valueAnimation?: boolean;
}
interface LineSeriesOption extends SeriesOption<LineStateOption<CallbackDataParams>, LineStateOptionMixin & {
    emphasis?: {
        lineStyle?: Omit<LineStyleOption, 'width'> & {
            width?: LineStyleOption['width'] | 'bolder';
        };
        areaStyle?: AreaStyleOption;
    };
    blur?: {
        lineStyle?: LineStyleOption;
        areaStyle?: AreaStyleOption;
    };
}>, LineStateOption<CallbackDataParams>, SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin, SeriesStackOptionMixin, SeriesSamplingOptionMixin, SymbolOptionMixin<CallbackDataParams>, SeriesEncodeOptionMixin {
    type?: 'line';
    coordinateSystem?: 'cartesian2d' | 'polar';
    clip?: boolean;
    label?: SeriesLabelOption;
    endLabel?: LineEndLabelOption;
    lineStyle?: LineStyleOption;
    areaStyle?: AreaStyleOption & {
        origin?: 'auto' | 'start' | 'end' | number;
    };
    step?: false | 'start' | 'end' | 'middle';
    smooth?: boolean | number;
    smoothMonotone?: 'x' | 'y' | 'none';
    connectNulls?: boolean;
    showSymbol?: boolean;
    showAllSymbol?: 'auto' | boolean;
    data?: (LineDataValue | LineDataItemOption)[];
    triggerLineEvent?: boolean;
}

interface ScatterStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    label?: SeriesLabelOption;
}
interface ScatterStatesOptionMixin {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean;
    };
}
interface ScatterDataItemOption extends SymbolOptionMixin, ScatterStateOption, StatesOptionMixin<ScatterStateOption, ScatterStatesOptionMixin>, OptionDataItemObject<OptionDataValue> {
}
interface ScatterSeriesOption extends SeriesOption<ScatterStateOption<CallbackDataParams>, ScatterStatesOptionMixin>, ScatterStateOption<CallbackDataParams>, SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin, SeriesOnCalendarOptionMixin, SeriesOnGeoOptionMixin, SeriesOnSingleOptionMixin, SeriesLargeOptionMixin, SeriesStackOptionMixin, SymbolOptionMixin<CallbackDataParams>, SeriesEncodeOptionMixin {
    type?: 'scatter';
    coordinateSystem?: string;
    cursor?: string;
    clip?: boolean;
    data?: (ScatterDataItemOption | OptionDataValue | OptionDataValue[])[] | ArrayLike<number>;
}

interface PieItemStyleOption<TCbParams = never> extends ItemStyleOption<TCbParams> {
    borderRadius?: (number | string)[] | number | string;
}
interface PieCallbackDataParams extends CallbackDataParams {
    percent: number;
}
interface PieStateOption<TCbParams = never> {
    itemStyle?: PieItemStyleOption<TCbParams>;
    label?: PieLabelOption;
    labelLine?: PieLabelLineOption;
}
interface PieLabelOption extends Omit<SeriesLabelOption, 'rotate' | 'position'> {
    rotate?: number | boolean | 'radial' | 'tangential';
    alignTo?: 'none' | 'labelLine' | 'edge';
    edgeDistance?: string | number;
    /**
     * @deprecated Use `edgeDistance` instead
     */
    margin?: string | number;
    bleedMargin?: number;
    distanceToLabelLine?: number;
    position?: SeriesLabelOption['position'] | 'outer' | 'inner' | 'center' | 'outside';
}
interface PieLabelLineOption extends LabelLineOption {
    /**
     * Max angle between labelLine and surface normal.
     * 0 - 180
     */
    maxSurfaceAngle?: number;
}
interface ExtraStateOption {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean;
        scaleSize?: number;
    };
}
interface PieDataItemOption extends OptionDataItemObject<OptionDataValueNumeric>, PieStateOption, StatesOptionMixin<PieStateOption, ExtraStateOption> {
    cursor?: string;
}
interface PieSeriesOption extends Omit<SeriesOption<PieStateOption<PieCallbackDataParams>, ExtraStateOption>, 'labelLine'>, PieStateOption<PieCallbackDataParams>, CircleLayoutOptionMixin, BoxLayoutOptionMixin, SeriesEncodeOptionMixin {
    type?: 'pie';
    roseType?: 'radius' | 'area';
    clockwise?: boolean;
    startAngle?: number;
    minAngle?: number;
    minShowLabelAngle?: number;
    selectedOffset?: number;
    avoidLabelOverlap?: boolean;
    percentPrecision?: number;
    stillShowZeroSum?: boolean;
    animationType?: 'expansion' | 'scale';
    animationTypeUpdate?: 'transition' | 'expansion';
    showEmptyCircle?: boolean;
    emptyCircleStyle?: PieItemStyleOption;
    data?: (OptionDataValueNumeric | OptionDataValueNumeric[] | PieDataItemOption)[];
}

declare type RadarSeriesDataValue = OptionDataValue[];
interface RadarStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface RadarSeriesStateOption<TCbParams = never> {
    lineStyle?: LineStyleOption;
    areaStyle?: AreaStyleOption;
    label?: SeriesLabelOption;
    itemStyle?: ItemStyleOption<TCbParams>;
}
interface RadarSeriesDataItemOption extends SymbolOptionMixin, RadarSeriesStateOption<CallbackDataParams>, StatesOptionMixin<RadarSeriesStateOption<CallbackDataParams>, RadarStatesMixin>, OptionDataItemObject<RadarSeriesDataValue> {
}
interface RadarSeriesOption extends SeriesOption<RadarSeriesStateOption, RadarStatesMixin>, RadarSeriesStateOption, SymbolOptionMixin<CallbackDataParams>, SeriesEncodeOptionMixin {
    type?: 'radar';
    coordinateSystem?: 'radar';
    radarIndex?: number;
    radarId?: string;
    data?: (RadarSeriesDataItemOption | RadarSeriesDataValue)[];
}

interface CurveLineStyleOption extends LineStyleOption {
    curveness?: number;
}
interface TreeSeriesStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    /**
     * Line style of the edge between node and it's parent.
     */
    lineStyle?: CurveLineStyleOption;
    label?: SeriesLabelOption;
}
interface TreeStatesMixin {
    emphasis?: {
        focus?: DefaultEmphasisFocus | 'ancestor' | 'descendant' | 'relative';
        scale?: boolean;
    };
}
interface TreeSeriesNodeItemOption extends SymbolOptionMixin<CallbackDataParams>, TreeSeriesStateOption<CallbackDataParams>, StatesOptionMixin<TreeSeriesStateOption<CallbackDataParams>, TreeStatesMixin>, OptionDataItemObject<OptionDataValue> {
    children?: TreeSeriesNodeItemOption[];
    collapsed?: boolean;
    link?: string;
    target?: string;
}
/**
 * Configuration of leaves nodes.
 */
interface TreeSeriesLeavesOption extends TreeSeriesStateOption, StatesOptionMixin<TreeSeriesStateOption, TreeStatesMixin> {
}
interface TreeSeriesOption extends SeriesOption<TreeSeriesStateOption, TreeStatesMixin>, TreeSeriesStateOption, SymbolOptionMixin, BoxLayoutOptionMixin, RoamOptionMixin {
    type?: 'tree';
    layout?: 'orthogonal' | 'radial';
    edgeShape?: 'polyline' | 'curve';
    /**
     * Available when edgeShape is polyline
     */
    edgeForkPosition?: string | number;
    nodeScaleRatio?: number;
    /**
     * The orient of orthoginal layout, can be setted to 'LR', 'TB', 'RL', 'BT'.
     * and the backward compatibility configuration 'horizontal = LR', 'vertical = TB'.
     */
    orient?: 'LR' | 'TB' | 'RL' | 'BT' | 'horizontal' | 'vertical';
    expandAndCollapse?: boolean;
    /**
     * The initial expanded depth of tree
     */
    initialTreeDepth?: number;
    leaves?: TreeSeriesLeavesOption;
    data?: TreeSeriesNodeItemOption[];
}

declare type TreemapSeriesDataValue = number | number[];
interface BreadcrumbItemStyleOption extends ItemStyleOption {
    textStyle?: LabelOption;
}
interface TreemapSeriesLabelOption extends SeriesLabelOption {
    formatter?: string | ((params: CallbackDataParams) => string);
}
interface TreemapSeriesItemStyleOption<TCbParams = never> extends ItemStyleOption<TCbParams> {
    borderRadius?: number | number[];
    colorAlpha?: number;
    colorSaturation?: number;
    borderColorSaturation?: number;
    gapWidth?: number;
}
interface TreePathInfo {
    name: string;
    dataIndex: number;
    value: TreemapSeriesDataValue;
}
interface TreemapSeriesCallbackDataParams extends CallbackDataParams {
    /**
     * @deprecated
     */
    treePathInfo?: TreePathInfo[];
    treeAncestors?: TreePathInfo[];
}
interface ExtraStateOption$1 {
    emphasis?: {
        focus?: DefaultEmphasisFocus | 'descendant' | 'ancestor';
    };
}
interface TreemapStateOption<TCbParams = never> {
    itemStyle?: TreemapSeriesItemStyleOption<TCbParams>;
    label?: TreemapSeriesLabelOption;
    upperLabel?: TreemapSeriesLabelOption;
}
interface TreemapSeriesVisualOption {
    /**
     * Which dimension will be applied with the visual properties.
     */
    visualDimension?: number | string;
    /**
     * @deprecated Use colorBy instead
     */
    colorMappingBy?: 'value' | 'index' | 'id';
    visualMin?: number;
    visualMax?: number;
    colorAlpha?: number[] | 'none';
    colorSaturation?: number[] | 'none';
    /**
     * A node will not be shown when its area size is smaller than this value (unit: px square).
     */
    visibleMin?: number;
    /**
     * Children will not be shown when area size of a node is smaller than this value (unit: px square).
     */
    childrenVisibleMin?: number;
}
interface TreemapSeriesLevelOption extends TreemapSeriesVisualOption, TreemapStateOption, StatesOptionMixin<TreemapStateOption, ExtraStateOption$1> {
    color?: ColorString[] | 'none';
    decal?: DecalObject[] | 'none';
}
interface TreemapSeriesNodeItemOption extends TreemapSeriesVisualOption, TreemapStateOption, StatesOptionMixin<TreemapStateOption, ExtraStateOption$1> {
    id?: OptionId;
    name?: OptionName;
    value?: TreemapSeriesDataValue;
    children?: TreemapSeriesNodeItemOption[];
    color?: ColorString[] | 'none';
    decal?: DecalObject[] | 'none';
}
interface TreemapSeriesOption extends SeriesOption<TreemapStateOption<TreemapSeriesCallbackDataParams>, ExtraStateOption$1>, TreemapStateOption<TreemapSeriesCallbackDataParams>, BoxLayoutOptionMixin, RoamOptionMixin, TreemapSeriesVisualOption {
    type?: 'treemap';
    /**
     * configuration in echarts2
     * @deprecated
     */
    size?: (number | string)[];
    /**
     * If sort in desc order.
     * Default to be desc. asc has strange effect
     */
    sort?: boolean | 'asc' | 'desc';
    /**
     * Size of clipped window when zooming. 'origin' or 'fullscreen'
     */
    clipWindow?: 'origin' | 'fullscreen';
    squareRatio?: number;
    /**
     * Nodes on depth from root are regarded as leaves.
     * Count from zero (zero represents only view root).
     */
    leafDepth?: number;
    drillDownIcon?: string;
    /**
     * Be effective when using zoomToNode. Specify the proportion of the
     * target node area in the view area.
     */
    zoomToNodeRatio?: number;
    /**
     * Leaf node click behaviour: 'zoomToNode', 'link', false.
     * If leafDepth is set and clicking a node which has children but
     * be on left depth, the behaviour would be changing root. Otherwise
     * use behavious defined above.
     */
    nodeClick?: 'zoomToNode' | 'link';
    breadcrumb?: BoxLayoutOptionMixin & {
        show?: boolean;
        height?: number;
        emptyItemWidth?: number;
        itemStyle?: BreadcrumbItemStyleOption;
        emphasis?: {
            itemStyle?: BreadcrumbItemStyleOption;
        };
    };
    levels?: TreemapSeriesLevelOption[];
    data?: TreemapSeriesNodeItemOption[];
}

declare type GraphDataValue = OptionDataValue | OptionDataValue[];
interface GraphEdgeLineStyleOption extends LineStyleOption {
    curveness?: number;
}
interface GraphNodeStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    label?: SeriesLabelOption;
}
interface ExtraEmphasisState {
    focus?: DefaultEmphasisFocus | 'adjacency';
}
interface GraphNodeStatesMixin {
    emphasis?: ExtraEmphasisState;
}
interface GraphEdgeStatesMixin {
    emphasis?: ExtraEmphasisState;
}
interface GraphNodeItemOption extends SymbolOptionMixin, GraphNodeStateOption, GraphNodeStateOption, StatesOptionMixin<GraphNodeStateOption, GraphNodeStatesMixin> {
    id?: string;
    name?: string;
    value?: GraphDataValue;
    /**
     * Fixed x position
     */
    x?: number;
    /**
     * Fixed y position
     */
    y?: number;
    /**
     * If this node is fixed during force layout.
     */
    fixed?: boolean;
    /**
     * Index or name of category
     */
    category?: number | string;
    draggable?: boolean;
    cursor?: string;
}
interface GraphEdgeStateOption {
    lineStyle?: GraphEdgeLineStyleOption;
    label?: SeriesLineLabelOption;
}
interface GraphEdgeItemOption extends GraphEdgeStateOption, StatesOptionMixin<GraphEdgeStateOption, GraphEdgeStatesMixin>, GraphEdgeItemObject<OptionDataValueNumeric> {
    value?: number;
    /**
     * Symbol of both line ends
     */
    symbol?: string | string[];
    symbolSize?: number | number[];
    ignoreForceLayout?: boolean;
}
interface GraphCategoryItemOption extends SymbolOptionMixin, GraphNodeStateOption, StatesOptionMixin<GraphNodeStateOption, GraphNodeStatesMixin> {
    name?: string;
    value?: OptionDataValue;
}
interface GraphSeriesOption extends SeriesOption<GraphNodeStateOption<CallbackDataParams>, GraphNodeStatesMixin>, SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin, SeriesOnCalendarOptionMixin, SeriesOnGeoOptionMixin, SeriesOnSingleOptionMixin, SymbolOptionMixin<CallbackDataParams>, RoamOptionMixin, BoxLayoutOptionMixin {
    type?: 'graph';
    coordinateSystem?: string;
    legendHoverLink?: boolean;
    layout?: 'none' | 'force' | 'circular';
    data?: (GraphNodeItemOption | GraphDataValue)[];
    nodes?: (GraphNodeItemOption | GraphDataValue)[];
    edges?: GraphEdgeItemOption[];
    links?: GraphEdgeItemOption[];
    categories?: GraphCategoryItemOption[];
    /**
     * @deprecated
     */
    focusNodeAdjacency?: boolean;
    /**
     * Symbol size scale ratio in roam
     */
    nodeScaleRatio?: 0.6;
    draggable?: boolean;
    edgeSymbol?: string | string[];
    edgeSymbolSize?: number | number[];
    edgeLabel?: SeriesLineLabelOption;
    label?: SeriesLabelOption;
    itemStyle?: ItemStyleOption<CallbackDataParams>;
    lineStyle?: GraphEdgeLineStyleOption;
    emphasis?: {
        focus?: Exclude<GraphNodeItemOption['emphasis'], undefined>['focus'];
        scale?: boolean;
        label?: SeriesLabelOption;
        edgeLabel?: SeriesLabelOption;
        itemStyle?: ItemStyleOption;
        lineStyle?: LineStyleOption;
    };
    blur?: {
        label?: SeriesLabelOption;
        edgeLabel?: SeriesLabelOption;
        itemStyle?: ItemStyleOption;
        lineStyle?: LineStyleOption;
    };
    select?: {
        label?: SeriesLabelOption;
        edgeLabel?: SeriesLabelOption;
        itemStyle?: ItemStyleOption;
        lineStyle?: LineStyleOption;
    };
    circular?: {
        rotateLabel?: boolean;
    };
    force?: {
        initLayout?: 'circular' | 'none';
        repulsion?: number | number[];
        gravity?: number;
        friction?: number;
        edgeLength?: number | number[];
        layoutAnimation?: boolean;
    };
    /**
     * auto curveness for multiple edge, invalid when `lineStyle.curveness` is set
     */
    autoCurveness?: boolean | number | number[];
}

declare type GaugeColorStop = [number, ColorString];
interface LabelFormatter$1 {
    (value: number): string;
}
interface PointerOption {
    icon?: string;
    show?: boolean;
    /**
     * If pointer shows above title and detail
     */
    showAbove?: boolean;
    keepAspect?: boolean;
    itemStyle?: ItemStyleOption;
    /**
     * Can be percent
     */
    offsetCenter?: (number | string)[];
    length?: number | string;
    width?: number;
}
interface AnchorOption {
    show?: boolean;
    showAbove?: boolean;
    size?: number;
    icon?: string;
    offsetCenter?: (number | string)[];
    keepAspect?: boolean;
    itemStyle?: ItemStyleOption;
}
interface ProgressOption {
    show?: boolean;
    overlap?: boolean;
    width?: number;
    roundCap?: boolean;
    clip?: boolean;
    itemStyle?: ItemStyleOption;
}
interface TitleOption$1 extends LabelOption {
    /**
     * [x, y] offset
     */
    offsetCenter?: (number | string)[];
    formatter?: LabelFormatter$1 | string;
    /**
     * If do value animtion.
     */
    valueAnimation?: boolean;
}
interface DetailOption extends LabelOption {
    /**
     * [x, y] offset
     */
    offsetCenter?: (number | string)[];
    formatter?: LabelFormatter$1 | string;
    /**
     * If do value animtion.
     */
    valueAnimation?: boolean;
}
interface GaugeStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface GaugeStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
}
interface GaugeDataItemOption extends GaugeStateOption, StatesOptionMixin<GaugeStateOption<CallbackDataParams>, GaugeStatesMixin> {
    name?: string;
    value?: OptionDataValueNumeric;
    pointer?: PointerOption;
    progress?: ProgressOption;
    title?: TitleOption$1;
    detail?: DetailOption;
}
interface GaugeSeriesOption extends SeriesOption<GaugeStateOption, GaugeStatesMixin>, GaugeStateOption<CallbackDataParams>, CircleLayoutOptionMixin, SeriesEncodeOptionMixin {
    type?: 'gauge';
    radius?: number | string;
    startAngle?: number;
    endAngle?: number;
    clockwise?: boolean;
    min?: number;
    max?: number;
    splitNumber?: number;
    itemStyle?: ItemStyleOption;
    axisLine?: {
        show?: boolean;
        roundCap?: boolean;
        lineStyle?: Omit<LineStyleOption, 'color'> & {
            color?: GaugeColorStop[];
        };
    };
    progress?: ProgressOption;
    splitLine?: {
        show?: boolean;
        /**
         * Can be percent
         */
        length?: number;
        distance?: number;
        lineStyle?: LineStyleOption;
    };
    axisTick?: {
        show?: boolean;
        splitNumber?: number;
        /**
         * Can be percent
         */
        length?: number | string;
        distance?: number;
        lineStyle?: LineStyleOption;
    };
    axisLabel?: LabelOption & {
        formatter?: LabelFormatter$1 | string;
    };
    pointer?: PointerOption;
    anchor?: AnchorOption;
    title?: TitleOption$1;
    detail?: DetailOption;
    data?: (OptionDataValueNumeric | GaugeDataItemOption)[];
}

declare type FunnelLabelOption = Omit<SeriesLabelOption, 'position'> & {
    position?: LabelOption['position'] | 'outer' | 'inner' | 'center' | 'rightTop' | 'rightBottom' | 'leftTop' | 'leftBottom';
};
interface FunnelStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface FunnelCallbackDataParams extends CallbackDataParams {
    percent: number;
}
interface FunnelStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    label?: FunnelLabelOption;
    labelLine?: LabelLineOption;
}
interface FunnelDataItemOption extends FunnelStateOption, StatesOptionMixin<FunnelStateOption, FunnelStatesMixin>, OptionDataItemObject<OptionDataValueNumeric> {
    itemStyle?: ItemStyleOption & {
        width?: number | string;
        height?: number | string;
    };
}
interface FunnelSeriesOption extends SeriesOption<FunnelStateOption<FunnelCallbackDataParams>, FunnelStatesMixin>, FunnelStateOption<FunnelCallbackDataParams>, BoxLayoutOptionMixin, SeriesEncodeOptionMixin {
    type?: 'funnel';
    min?: number;
    max?: number;
    /**
     * Absolute number or percent string
     */
    minSize?: number | string;
    maxSize?: number | string;
    sort?: 'ascending' | 'descending' | 'none';
    orient?: LayoutOrient;
    gap?: number;
    funnelAlign?: HorizontalAlign | VerticalAlign;
    data?: (OptionDataValueNumeric | OptionDataValueNumeric[] | FunnelDataItemOption)[];
}

declare type ParallelSeriesDataValue = OptionDataValue[];
interface ParallelStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface ParallelStateOption<TCbParams = never> {
    lineStyle?: LineStyleOption<(TCbParams extends never ? never : (params: TCbParams) => ZRColor) | ZRColor>;
    label?: SeriesLabelOption;
}
interface ParallelSeriesDataItemOption extends ParallelStateOption, StatesOptionMixin<ParallelStateOption, ParallelStatesMixin> {
    value?: ParallelSeriesDataValue[];
}
interface ParallelSeriesOption extends SeriesOption<ParallelStateOption<CallbackDataParams>, ParallelStatesMixin>, ParallelStateOption<CallbackDataParams>, SeriesEncodeOptionMixin {
    type?: 'parallel';
    coordinateSystem?: string;
    parallelIndex?: number;
    parallelId?: string;
    inactiveOpacity?: number;
    activeOpacity?: number;
    smooth?: boolean | number;
    realtime?: boolean;
    tooltip?: SeriesTooltipOption;
    parallelAxisDefault?: ParallelAxisOption;
    data?: (ParallelSeriesDataValue | ParallelSeriesDataItemOption)[];
}

declare type FocusNodeAdjacency = boolean | 'inEdges' | 'outEdges' | 'allEdges';
interface SankeyNodeStateOption<TCbParams = never> {
    label?: SeriesLabelOption;
    itemStyle?: ItemStyleOption<TCbParams>;
}
interface SankeyEdgeStateOption {
    lineStyle?: SankeyEdgeStyleOption;
}
interface SankeyBothStateOption<TCbParams> extends SankeyNodeStateOption<TCbParams>, SankeyEdgeStateOption {
}
interface SankeyEdgeStyleOption extends LineStyleOption {
    curveness?: number;
}
interface ExtraStateOption$2 {
    emphasis?: {
        focus?: DefaultEmphasisFocus | 'adjacency';
    };
}
interface SankeyNodeItemOption extends SankeyNodeStateOption, StatesOptionMixin<SankeyNodeStateOption, ExtraStateOption$2>, OptionDataItemObject<OptionDataValue> {
    id?: string;
    localX?: number;
    localY?: number;
    depth?: number;
    draggable?: boolean;
    focusNodeAdjacency?: FocusNodeAdjacency;
}
interface SankeyEdgeItemOption extends SankeyEdgeStateOption, StatesOptionMixin<SankeyEdgeStateOption, ExtraStateOption$2>, GraphEdgeItemObject<OptionDataValueNumeric> {
    focusNodeAdjacency?: FocusNodeAdjacency;
}
interface SankeyLevelOption extends SankeyNodeStateOption, SankeyEdgeStateOption {
    depth: number;
}
interface SankeySeriesOption extends SeriesOption<SankeyBothStateOption<CallbackDataParams>, ExtraStateOption$2>, SankeyBothStateOption<CallbackDataParams>, BoxLayoutOptionMixin {
    type?: 'sankey';
    /**
     * color will be linear mapped.
     */
    color?: ColorString[];
    coordinateSystem?: 'view';
    orient?: LayoutOrient;
    /**
     * The width of the node
     */
    nodeWidth?: number;
    /**
     * The vertical distance between two nodes
     */
    nodeGap?: number;
    /**
     * Control if the node can move or not
     */
    draggable?: boolean;
    /**
     * Will be allEdges if true.
     * @deprecated
     */
    focusNodeAdjacency?: FocusNodeAdjacency;
    /**
     * The number of iterations to change the position of the node
     */
    layoutIterations?: number;
    nodeAlign?: 'justify' | 'left' | 'right';
    data?: SankeyNodeItemOption[];
    nodes?: SankeyNodeItemOption[];
    edges?: SankeyEdgeItemOption[];
    links?: SankeyEdgeItemOption[];
    levels?: SankeyLevelOption[];
}

declare type BoxplotDataValue = OptionDataValueNumeric[];
interface BoxplotStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    label?: SeriesLabelOption;
}
interface BoxplotDataItemOption extends BoxplotStateOption, StatesOptionMixin<BoxplotStateOption, ExtraStateOption$3> {
    value: BoxplotDataValue;
}
interface ExtraStateOption$3 {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean;
    };
}
interface BoxplotSeriesOption extends SeriesOption<BoxplotStateOption<CallbackDataParams>, ExtraStateOption$3>, BoxplotStateOption<CallbackDataParams>, SeriesOnCartesianOptionMixin, SeriesEncodeOptionMixin {
    type?: 'boxplot';
    coordinateSystem?: 'cartesian2d';
    layout?: LayoutOrient;
    /**
     * [min, max] can be percent of band width.
     */
    boxWidth?: (string | number)[];
    data?: (BoxplotDataValue | BoxplotDataItemOption)[];
}

declare type CandlestickDataValue = OptionDataValue[];
interface CandlestickItemStyleOption extends ItemStyleOption {
    color0?: ZRColor;
    borderColor0?: ColorString;
}
interface CandlestickStateOption {
    itemStyle?: CandlestickItemStyleOption;
    label?: SeriesLabelOption;
}
interface CandlestickDataItemOption extends CandlestickStateOption, StatesOptionMixin<CandlestickStateOption, ExtraStateOption$4> {
    value: CandlestickDataValue;
}
interface ExtraStateOption$4 {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean;
    };
}
interface CandlestickSeriesOption extends SeriesOption<CandlestickStateOption, ExtraStateOption$4>, CandlestickStateOption, SeriesOnCartesianOptionMixin, SeriesLargeOptionMixin, SeriesEncodeOptionMixin {
    type?: 'candlestick';
    coordinateSystem?: 'cartesian2d';
    layout?: LayoutOrient;
    clip?: boolean;
    barMaxWidth?: number | string;
    barMinWidth?: number | string;
    barWidth?: number | string;
    data?: (CandlestickDataValue | CandlestickDataItemOption)[];
}

interface RippleEffectOption {
    period?: number;
    /**
     * Scale of ripple
     */
    scale?: number;
    brushType?: 'fill' | 'stroke';
    color?: ZRColor;
    /**
     * ripple number
     */
    number?: number;
}
interface SymbolDrawStateOption {
    itemStyle?: ItemStyleOption;
    label?: LabelOption;
}
interface SymbolDrawItemModelOption extends SymbolOptionMixin<object>, StatesOptionMixin<SymbolDrawStateOption, {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean | number;
    };
}>, SymbolDrawStateOption {
    cursor?: string;
    rippleEffect?: RippleEffectOption;
}

declare type ScatterDataValue = OptionDataValue | OptionDataValue[];
interface EffectScatterStatesOptionMixin {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean | number;
    };
}
interface EffectScatterStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams>;
    label?: SeriesLabelOption;
}
interface EffectScatterDataItemOption extends SymbolOptionMixin, EffectScatterStateOption, StatesOptionMixin<EffectScatterStateOption, EffectScatterStatesOptionMixin> {
    name?: string;
    value?: ScatterDataValue;
    rippleEffect?: SymbolDrawItemModelOption['rippleEffect'];
}
interface EffectScatterSeriesOption extends SeriesOption<EffectScatterStateOption<CallbackDataParams>, EffectScatterStatesOptionMixin>, EffectScatterStateOption<CallbackDataParams>, SeriesOnCartesianOptionMixin, SeriesOnPolarOptionMixin, SeriesOnCalendarOptionMixin, SeriesOnGeoOptionMixin, SeriesOnSingleOptionMixin, SymbolOptionMixin<CallbackDataParams>, SeriesEncodeOptionMixin {
    type?: 'effectScatter';
    coordinateSystem?: string;
    effectType?: 'ripple';
    /**
     * When to show the effect
     */
    showEffectOn?: 'render' | 'emphasis';
    clip?: boolean;
    /**
     * Ripple effect config
     */
    rippleEffect?: SymbolDrawItemModelOption['rippleEffect'];
    data?: (EffectScatterDataItemOption | ScatterDataValue)[];
}

interface LineDrawStateOption {
    lineStyle?: LineStyleOption;
    label?: LineLabelOption;
}
interface LineDrawModelOption extends LineDrawStateOption, StatesOptionMixin<LineDrawStateOption, {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
    };
}> {
    effect?: {
        show?: boolean;
        period?: number;
        delay?: number | ((idx: number) => number);
        /**
         * If move with constant speed px/sec
         * period will be ignored if this property is > 0,
         */
        constantSpeed?: number;
        symbol?: string;
        symbolSize?: number | number[];
        loop?: boolean;
        /**
         * Length of trail, 0 - 1
         */
        trailLength?: number;
        /**
         * Default to be same with lineStyle.color
         */
        color?: ColorString;
    };
}

declare type LinesCoords = number[][];
declare type LinesValue = OptionDataValue | OptionDataValue[];
interface LinesLineStyleOption<TClr> extends LineStyleOption<TClr> {
    curveness?: number;
}
interface LinesStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface LinesStateOption<TCbParams = never> {
    lineStyle?: LinesLineStyleOption<(TCbParams extends never ? never : (params: TCbParams) => ZRColor) | ZRColor>;
    label?: SeriesLineLabelOption;
}
interface LinesDataItemOption extends LinesStateOption<CallbackDataParams>, StatesOptionMixin<LinesStateOption<CallbackDataParams>, LinesStatesMixin> {
    name?: string;
    fromName?: string;
    toName?: string;
    symbol?: string[] | string;
    symbolSize?: number[] | number;
    coords?: LinesCoords;
    value?: LinesValue;
    effect?: LineDrawModelOption['effect'];
}
interface LinesSeriesOption extends SeriesOption<LinesStateOption, LinesStatesMixin>, LinesStateOption, SeriesOnCartesianOptionMixin, SeriesOnGeoOptionMixin, SeriesOnPolarOptionMixin, SeriesOnCalendarOptionMixin, SeriesLargeOptionMixin {
    type?: 'lines';
    coordinateSystem?: string;
    symbol?: string[] | string;
    symbolSize?: number[] | number;
    effect?: LineDrawModelOption['effect'];
    /**
     * If lines are polyline
     * polyline not support curveness, label, animation
     */
    polyline?: boolean;
    /**
     * If clip the overflow.
     * Available when coordinateSystem is cartesian or polar.
     */
    clip?: boolean;
    data?: LinesDataItemOption[] | ArrayLike<number>;
    dimensions?: DimensionDefinitionLoose | DimensionDefinitionLoose[];
}

declare type HeatmapDataValue = OptionDataValue[];
interface HeatmapStateOption<TCbParams = never> {
    itemStyle?: ItemStyleOption<TCbParams> & {
        borderRadius?: number | number[];
    };
    label?: SeriesLabelOption;
}
interface FunnelStatesMixin$1 {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface HeatmapDataItemOption extends HeatmapStateOption, StatesOptionMixin<HeatmapStateOption, FunnelStatesMixin$1> {
    value: HeatmapDataValue;
}
interface HeatmapSeriesOption extends SeriesOption<HeatmapStateOption<CallbackDataParams>, FunnelStatesMixin$1>, HeatmapStateOption<CallbackDataParams>, SeriesOnCartesianOptionMixin, SeriesOnGeoOptionMixin, SeriesOnCalendarOptionMixin, SeriesEncodeOptionMixin {
    type?: 'heatmap';
    coordinateSystem?: 'cartesian2d' | 'geo' | 'calendar';
    blurSize?: number;
    pointSize?: number;
    maxOpacity?: number;
    minOpacity?: number;
    data?: (HeatmapDataItemOption | HeatmapDataValue)[];
}

interface PictorialBarStateOption {
    itemStyle?: ItemStyleOption;
    label?: SeriesLabelOption;
}
interface PictorialBarSeriesSymbolOption {
    /**
     * Customized bar shape
     */
    symbol?: string;
    /**
     * Can be ['100%', '100%'], null means auto.
     * The percent will be relative to category width. If no repeat.
     * Will be relative to symbolBoundingData.
     */
    symbolSize?: (number | string)[] | number | string;
    symbolRotate?: number;
    /**
     * Default to be auto
     */
    symbolPosition?: 'start' | 'end' | 'center';
    /**
     * Can be percent offset relative to the symbolSize
     */
    symbolOffset?: (number | string)[] | number | string;
    /**
     * start margin and end margin. Can be a number or a percent string relative to symbolSize.
     * Auto margin by default.
     */
    symbolMargin?: (number | string)[] | number | string;
    /**
     * true: means auto calculate repeat times and cut by data.
     * a number: specifies repeat times, and do not cut by data.
     * 'fixed': means auto calculate repeat times but do not cut by data.
     *
     * Otherwise means no repeat
     */
    symbolRepeat?: boolean | number | 'fixed';
    /**
     * From start to end or end to start.
     */
    symbolRepeatDirection?: 'start' | 'end';
    symbolClip?: boolean;
    /**
     * It will define the size of graphic elements.
     */
    symbolBoundingData?: number | number[];
    symbolPatternSize?: number;
}
interface ExtraStateOption$5 {
    emphasis?: {
        focus?: DefaultEmphasisFocus;
        scale?: boolean;
    };
}
interface PictorialBarDataItemOption extends PictorialBarSeriesSymbolOption, AnimationOptionMixin, PictorialBarStateOption, StatesOptionMixin<PictorialBarStateOption, ExtraStateOption$5>, OptionDataItemObject<OptionDataValue> {
    z?: number;
    cursor?: string;
}
interface PictorialBarSeriesOption extends BaseBarSeriesOption<PictorialBarStateOption, ExtraStateOption$5>, PictorialBarStateOption, PictorialBarSeriesSymbolOption, SeriesStackOptionMixin, SeriesEncodeOptionMixin {
    type?: 'pictorialBar';
    coordinateSystem?: 'cartesian2d';
    data?: (PictorialBarDataItemOption | OptionDataValue | OptionDataValue[])[];
}

interface ThemeRiverSeriesLabelOption extends SeriesLabelOption {
    margin?: number;
}
declare type ThemerRiverDataItem = [OptionDataValueDate, OptionDataValueNumeric, string];
interface ThemeRiverStatesMixin {
    emphasis?: DefaultStatesMixinEmphasis;
}
interface ThemeRiverStateOption<TCbParams = never> {
    label?: ThemeRiverSeriesLabelOption;
    itemStyle?: ItemStyleOption<TCbParams>;
}
interface ThemeRiverSeriesOption extends SeriesOption<ThemeRiverStateOption<CallbackDataParams>, ThemeRiverStatesMixin>, ThemeRiverStateOption<CallbackDataParams>, SeriesOnSingleOptionMixin, BoxLayoutOptionMixin {
    type?: 'themeRiver';
    color?: ZRColor[];
    coordinateSystem?: 'singleAxis';
    /**
     * gap in axis's orthogonal orientation
     */
    boundaryGap?: (string | number)[];
    /**
     * [date, value, name]
     */
    data?: ThemerRiverDataItem[];
}

interface SunburstItemStyleOption<TCbParams = never> extends ItemStyleOption<TCbParams> {
    borderRadius?: (number | string)[] | number | string;
}
interface SunburstLabelOption extends Omit<SeriesLabelOption, 'rotate' | 'position'> {
    rotate?: 'radial' | 'tangential' | number;
    minAngle?: number;
    silent?: boolean;
    position?: SeriesLabelOption['position'] | 'outside';
}
interface SunburstStatesMixin {
    emphasis?: {
        focus?: DefaultEmphasisFocus | 'descendant' | 'ancestor';
    };
}
interface SunburstStateOption<TCbParams = never> {
    itemStyle?: SunburstItemStyleOption<TCbParams>;
    label?: SunburstLabelOption;
}
interface SunburstSeriesLevelOption extends SunburstStateOption, StatesOptionMixin<SunburstStateOption, SunburstStatesMixin> {
    radius?: (number | string)[];
    /**
     * @deprecated use radius instead
     */
    r?: number | string;
    /**
     * @deprecated use radius instead
     */
    r0?: number | string;
    highlight?: {
        itemStyle?: SunburstItemStyleOption;
        label?: SunburstLabelOption;
    };
}
interface SortParam {
    dataIndex: number;
    depth: number;
    height: number;
    getValue(): number;
}
interface SunburstSeriesOption extends SeriesOption<SunburstStateOption, SunburstStatesMixin>, SunburstStateOption, SunburstColorByMixin, CircleLayoutOptionMixin {
    type?: 'sunburst';
    clockwise?: boolean;
    startAngle?: number;
    minAngle?: number;
    /**
     * If still show when all data zero.
     */
    stillShowZeroSum?: boolean;
    /**
     * Policy of highlighting pieces when hover on one
     * Valid values: 'none' (for not downplay others), 'descendant',
     * 'ancestor', 'self'
     */
    nodeClick?: 'rootToNode' | 'link';
    renderLabelForZeroData?: boolean;
    levels?: SunburstSeriesLevelOption[];
    animationType?: 'expansion' | 'scale';
    sort?: 'desc' | 'asc' | ((a: SortParam, b: SortParam) => number);
}

interface GraphicComponentBaseElementOption extends Partial<Pick<Element, TransformProp | 'silent' | 'ignore' | 'textConfig' | 'draggable' | ElementEventNameWithOn>>, 
/**
 * left/right/top/bottom: (like 12, '22%', 'center', default undefined)
 * If left/rigth is set, shape.x/shape.cx/position will not be used.
 * If top/bottom is set, shape.y/shape.cy/position will not be used.
 * This mechanism is useful when you want to position a group/element
 * against the right side or the center of this container.
 */
Partial<Pick<BoxLayoutOptionMixin, 'left' | 'right' | 'top' | 'bottom'>> {
    /**
     * element type, mandatory.
     * Only can be omit if call setOption not at the first time and perform merge.
     */
    type?: string;
    id?: OptionId;
    name?: string;
    parentId?: OptionId;
    parentOption?: GraphicComponentElementOption;
    children?: GraphicComponentElementOption[];
    hv?: [boolean, boolean];
    /**
     * bounding: (enum: 'all' (default) | 'raw')
     * Specify how to calculate boundingRect when locating.
     * 'all': Get uioned and transformed boundingRect
     *     from both itself and its descendants.
     *     This mode simplies confining a group of elements in the bounding
     *     of their ancester container (e.g., using 'right: 0').
     * 'raw': Only use the boundingRect of itself and before transformed.
     *     This mode is similar to css behavior, which is useful when you
     *     want an element to be able to overflow its container. (Consider
     *     a rotated circle needs to be located in a corner.)
     */
    bounding?: 'raw' | 'all';
    /**
     * info: custom info. enables user to mount some info on elements and use them
     * in event handlers. Update them only when user specified, otherwise, remain.
     */
    info?: GraphicExtraElementInfo;
    clipPath?: Omit<GraphicComponentZRPathOption, 'clipPath'> | false;
    textContent?: Omit<GraphicComponentTextOption, 'clipPath'>;
    textConfig?: ElementTextConfig;
    $action?: 'merge' | 'replace' | 'remove';
    tooltip?: CommonTooltipOption<unknown>;
    enterAnimation?: AnimationOption$1;
    updateAnimation?: AnimationOption$1;
    leaveAnimation?: AnimationOption$1;
}
interface GraphicComponentDisplayableOption extends GraphicComponentBaseElementOption, Partial<Pick<Displayable, 'zlevel' | 'z' | 'z2' | 'invisible' | 'cursor'>> {
    style?: ZRStyleProps;
    z2?: number;
}
interface GraphicComponentGroupOption extends GraphicComponentBaseElementOption, TransitionOptionMixin<GroupProps> {
    type?: 'group';
    /**
     * width/height: (can only be pixel value, default 0)
     * Only be used to specify contianer(group) size, if needed. And
     * can not be percentage value (like '33%'). See the reason in the
     * layout algorithm below.
     */
    width?: number;
    height?: number;
    children: GraphicComponentElementOption[];
    keyframeAnimation?: ElementKeyframeAnimationOption<GroupProps> | ElementKeyframeAnimationOption<GroupProps>[];
}
interface GraphicComponentZRPathOption extends GraphicComponentDisplayableOption, TransitionOptionMixin<PathProps> {
    shape?: PathProps['shape'] & TransitionOptionMixin<PathProps['shape']>;
    style?: PathStyleProps & TransitionOptionMixin<PathStyleProps>;
    keyframeAnimation?: ElementKeyframeAnimationOption<PathProps> | ElementKeyframeAnimationOption<PathProps>[];
}
interface GraphicComponentImageOption extends GraphicComponentDisplayableOption, TransitionOptionMixin<ImageProps> {
    type?: 'image';
    style?: ImageStyleProps & TransitionOptionMixin<ImageStyleProps>;
    keyframeAnimation?: ElementKeyframeAnimationOption<ImageProps> | ElementKeyframeAnimationOption<ImageProps>[];
}
interface GraphicComponentTextOption extends Omit<GraphicComponentDisplayableOption, 'textContent' | 'textConfig'>, TransitionOptionMixin<TextProps> {
    type?: 'text';
    style?: TextStyleProps & TransitionOptionMixin<TextStyleProps>;
    keyframeAnimation?: ElementKeyframeAnimationOption<TextProps> | ElementKeyframeAnimationOption<TextProps>[];
}
declare type GraphicComponentElementOption = GraphicComponentGroupOption | GraphicComponentZRPathOption | GraphicComponentImageOption | GraphicComponentTextOption;
declare type GraphicExtraElementInfo = Dictionary<unknown>;
declare type GraphicComponentLooseOption = (GraphicComponentOption | GraphicComponentElementOption) & {
    mainType?: 'graphic';
};
interface GraphicComponentOption extends ComponentOption, AnimationOptionMixin {
    elements?: GraphicComponentElementOption[];
}

declare const ICON_TYPES: readonly ["rect", "polygon", "lineX", "lineY", "keep", "clear"];
declare type IconType = typeof ICON_TYPES[number];
interface ToolboxBrushFeatureOption extends ToolboxFeatureOption {
    type?: IconType[];
    icon?: {
        [key in IconType]?: string;
    };
    title?: {
        [key in IconType]?: string;
    };
}

interface ToolboxDataViewFeatureOption extends ToolboxFeatureOption {
    readOnly?: boolean;
    optionToContent?: (option: ECUnitOption) => string | HTMLElement;
    contentToOption?: (viewMain: HTMLDivElement, oldOption: ECUnitOption) => ECUnitOption;
    icon?: string;
    title?: string;
    lang?: string[];
    backgroundColor?: ColorString;
    textColor?: ColorString;
    textareaColor?: ColorString;
    textareaBorderColor?: ColorString;
    buttonColor?: ColorString;
    buttonTextColor?: ColorString;
}

declare const ICON_TYPES$1: readonly ["zoom", "back"];
declare type IconType$1 = typeof ICON_TYPES$1[number];
interface ToolboxDataZoomFeatureOption extends ToolboxFeatureOption {
    type?: IconType$1[];
    icon?: {
        [key in IconType$1]?: string;
    };
    title?: {
        [key in IconType$1]?: string;
    };
    filterMode?: 'filter' | 'weakFilter' | 'empty' | 'none';
    xAxisIndex?: ModelFinderIndexQuery;
    yAxisIndex?: ModelFinderIndexQuery;
    xAxisId?: ModelFinderIdQuery;
    yAxisId?: ModelFinderIdQuery;
    brushStyle?: ItemStyleOption;
}

declare const ICON_TYPES$2: readonly ["line", "bar", "stack"];
declare const TITLE_TYPES: readonly ["line", "bar", "stack", "tiled"];
declare type IconType$2 = typeof ICON_TYPES$2[number];
declare type TitleType = typeof TITLE_TYPES[number];
interface ToolboxMagicTypeFeatureOption extends ToolboxFeatureOption {
    type?: IconType$2[];
    /**
     * Icon group
     */
    icon?: {
        [key in IconType$2]?: string;
    };
    title?: {
        [key in TitleType]?: string;
    };
    option?: {
        [key in IconType$2]?: SeriesOption;
    };
    /**
     * Map of seriesType: seriesIndex
     */
    seriesIndex?: {
        line?: number;
        bar?: number;
    };
}

interface ToolboxRestoreFeatureOption extends ToolboxFeatureOption {
    icon?: string;
    title?: string;
}

interface ToolboxSaveAsImageFeatureOption extends ToolboxFeatureOption {
    icon?: string;
    title?: string;
    type?: 'png' | 'jpeg';
    backgroundColor?: ZRColor;
    connectedBackgroundColor?: ZRColor;
    name?: string;
    excludeComponents?: string[];
    pixelRatio?: number;
    lang?: string[];
}

interface ToolboxComponentOption extends ToolboxOption {
    feature?: {
        brush?: ToolboxBrushFeatureOption;
        dataView?: ToolboxDataViewFeatureOption;
        dataZoom?: ToolboxDataZoomFeatureOption;
        magicType?: ToolboxMagicTypeFeatureOption;
        restore?: ToolboxRestoreFeatureOption;
        saveAsImage?: ToolboxSaveAsImageFeatureOption;
        [key: string]: ToolboxFeatureOption | {
            [key: string]: any;
        } | undefined;
    };
}

declare type DataZoomComponentOption = SliderDataZoomOption | InsideDataZoomOption;

declare type VisualMapComponentOption = ContinousVisualMapOption | PiecewiseVisualMapOption;

declare type LegendComponentOption = LegendOption | ScrollableLegendOption;

declare type SeriesInjectedOption = {
    markArea?: MarkAreaOption;
    markLine?: MarkLineOption;
    markPoint?: MarkPointOption;
    tooltip?: SeriesTooltipOption;
};
declare type LineSeriesOption$1 = LineSeriesOption & SeriesInjectedOption;
declare type BarSeriesOption$1 = BarSeriesOption & SeriesInjectedOption;
declare type ScatterSeriesOption$1 = ScatterSeriesOption & SeriesInjectedOption;
declare type PieSeriesOption$1 = PieSeriesOption & SeriesInjectedOption;
declare type RadarSeriesOption$1 = RadarSeriesOption & SeriesInjectedOption;
declare type MapSeriesOption$1 = MapSeriesOption & SeriesInjectedOption;
declare type TreeSeriesOption$1 = TreeSeriesOption & SeriesInjectedOption;
declare type TreemapSeriesOption$1 = TreemapSeriesOption & SeriesInjectedOption;
declare type GraphSeriesOption$1 = GraphSeriesOption & SeriesInjectedOption;
declare type GaugeSeriesOption$1 = GaugeSeriesOption & SeriesInjectedOption;
declare type FunnelSeriesOption$1 = FunnelSeriesOption & SeriesInjectedOption;
declare type ParallelSeriesOption$1 = ParallelSeriesOption & SeriesInjectedOption;
declare type SankeySeriesOption$1 = SankeySeriesOption & SeriesInjectedOption;
declare type BoxplotSeriesOption$1 = BoxplotSeriesOption & SeriesInjectedOption;
declare type CandlestickSeriesOption$1 = CandlestickSeriesOption & SeriesInjectedOption;
declare type EffectScatterSeriesOption$1 = EffectScatterSeriesOption & SeriesInjectedOption;
declare type LinesSeriesOption$1 = LinesSeriesOption & SeriesInjectedOption;
declare type HeatmapSeriesOption$1 = HeatmapSeriesOption & SeriesInjectedOption;
declare type PictorialBarSeriesOption$1 = PictorialBarSeriesOption & SeriesInjectedOption;
declare type ThemeRiverSeriesOption$1 = ThemeRiverSeriesOption & SeriesInjectedOption;
declare type SunburstSeriesOption$1 = SunburstSeriesOption & SeriesInjectedOption;
declare type CustomSeriesOption$1 = CustomSeriesOption & SeriesInjectedOption;
/**
 * A map from series 'type' to series option
 * It's used for declaration merging in echarts extensions.
 * For example:
 * ```ts
 * import echarts from 'echarts';
 * declare module 'echarts/types/dist/echarts' {
 *   interface RegisteredSeriesOption {
 *     wordCloud: WordCloudSeriesOption
 *   }
 * }
 * ```
 */
interface RegisteredSeriesOption {
    line: LineSeriesOption$1;
    bar: BarSeriesOption$1;
    scatter: ScatterSeriesOption$1;
    pie: PieSeriesOption$1;
    radar: RadarSeriesOption$1;
    map: MapSeriesOption$1;
    tree: TreeSeriesOption$1;
    treemap: TreemapSeriesOption$1;
    graph: GraphSeriesOption$1;
    gauge: GaugeSeriesOption$1;
    funnel: FunnelSeriesOption$1;
    parallel: ParallelSeriesOption$1;
    sankey: SankeySeriesOption$1;
    boxplot: BoxplotSeriesOption$1;
    candlestick: CandlestickSeriesOption$1;
    effectScatter: EffectScatterSeriesOption$1;
    lines: LinesSeriesOption$1;
    heatmap: HeatmapSeriesOption$1;
    pictorialBar: PictorialBarSeriesOption$1;
    themeRiver: ThemeRiverSeriesOption$1;
    sunburst: SunburstSeriesOption$1;
    custom: CustomSeriesOption$1;
}
declare type Values<T> = T[keyof T];
declare type SeriesOption$1 = Values<RegisteredSeriesOption>;
interface EChartsOption extends ECBasicOption {
    dataset?: DatasetOption | DatasetOption[];
    aria?: AriaOption;
    title?: TitleOption | TitleOption[];
    grid?: GridOption | GridOption[];
    radar?: RadarOption | RadarOption[];
    polar?: PolarOption | PolarOption[];
    geo?: GeoOption | GeoOption[];
    angleAxis?: AngleAxisOption | AngleAxisOption[];
    radiusAxis?: RadiusAxisOption | RadiusAxisOption[];
    xAxis?: XAXisOption | XAXisOption[];
    yAxis?: YAXisOption | YAXisOption[];
    singleAxis?: SingleAxisOption | SingleAxisOption[];
    parallel?: ParallelCoordinateSystemOption | ParallelCoordinateSystemOption[];
    parallelAxis?: ParallelAxisOption | ParallelAxisOption[];
    calendar?: CalendarOption | CalendarOption[];
    toolbox?: ToolboxComponentOption | ToolboxComponentOption[];
    tooltip?: TooltipOption | TooltipOption[];
    axisPointer?: AxisPointerOption | AxisPointerOption[];
    brush?: BrushOption | BrushOption[];
    timeline?: TimelineOption | SliderTimelineOption;
    legend?: LegendComponentOption | (LegendComponentOption)[];
    dataZoom?: DataZoomComponentOption | (DataZoomComponentOption)[];
    visualMap?: VisualMapComponentOption | (VisualMapComponentOption)[];
    graphic?: GraphicComponentLooseOption | GraphicComponentLooseOption[];
    series?: SeriesOption$1 | SeriesOption$1[];
    options?: EChartsOption[];
    baseOption?: EChartsOption;
}

declare function install$o(registers: EChartsExtensionInstallRegisters): void;

declare function install$p(registers: EChartsExtensionInstallRegisters): void;

declare function install$q(registers: EChartsExtensionInstallRegisters): void;

declare function install$r(registers: EChartsExtensionInstallRegisters): void;

declare function install$s(registers: EChartsExtensionInstallRegisters): void;

declare function install$t(registers: EChartsExtensionInstallRegisters): void;

declare function install$u(registers: EChartsExtensionInstallRegisters): void;

declare function install$v(registers: EChartsExtensionInstallRegisters): void;

declare function install$w(registers: EChartsExtensionInstallRegisters): void;

declare function install$x(registers: EChartsExtensionInstallRegisters): void;

declare function install$y(registers: EChartsExtensionInstallRegisters): void;

declare function install$z(registers: EChartsExtensionInstallRegisters): void;

declare function install$A(registers: EChartsExtensionInstallRegisters): void;

declare function install$B(registers: EChartsExtensionInstallRegisters): void;

declare function install$C(registers: EChartsExtensionInstallRegisters): void;

declare function install$D(registers: EChartsExtensionInstallRegisters): void;

declare function install$E(registers: EChartsExtensionInstallRegisters): void;

declare function install$F(registers: EChartsExtensionInstallRegisters): void;

declare function install$G(registers: EChartsExtensionInstallRegisters): void;

declare function install$H(registers: EChartsExtensionInstallRegisters): void;

declare function install$I(registers: EChartsExtensionInstallRegisters): void;

declare function install$J(registers: EChartsExtensionInstallRegisters): void;

declare function install$K(registers: EChartsExtensionInstallRegisters): void;

declare function install$L(registers: EChartsExtensionInstallRegisters): void;

declare function install$M(registers: EChartsExtensionInstallRegisters): void;

declare function install$N(registers: EChartsExtensionInstallRegisters): void;

declare function install$O(registers: EChartsExtensionInstallRegisters): void;

declare function install$P(registers: EChartsExtensionInstallRegisters): void;

declare function install$Q(registers: EChartsExtensionInstallRegisters): void;

declare function install$R(registers: EChartsExtensionInstallRegisters): void;

declare function installUniversalTransition(registers: EChartsExtensionInstallRegisters): void;

declare function installLabelLayout(registers: EChartsExtensionInstallRegisters): void;

export { AngleAxisOption, AnimationDelayCallback, AnimationDelayCallbackParam, AnimationDurationCallback, AriaOption, Axis, AxisPointerOption, BarSeriesOption$1 as BarSeriesOption, BoxplotSeriesOption$1 as BoxplotSeriesOption, BrushOption, CalendarOption, CallbackDataParams, CandlestickSeriesOption$1 as CandlestickSeriesOption, ChartView, ComponentModel, ComponentView, ComposeOption, ContinousVisualMapOption, CustomSeriesOption$1 as CustomSeriesOption, CustomSeriesRenderItem, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, CustomSeriesRenderItemReturn, DataZoomComponentOption, DatasetOption, ECBasicOption, EChartsOption, EChartsType, EffectScatterSeriesOption$1 as EffectScatterSeriesOption, FunnelSeriesOption$1 as FunnelSeriesOption, GaugeSeriesOption$1 as GaugeSeriesOption, GeoOption, GraphSeriesOption$1 as GraphSeriesOption, GraphicComponentLooseOption, GridOption, HeatmapSeriesOption$1 as HeatmapSeriesOption, ImagePatternObject, InsideDataZoomOption, LabelFormatterCallback, LabelLayoutOptionCallback, LabelLayoutOptionCallbackParams, LegendComponentOption, LegendOption, LineSeriesOption$1 as LineSeriesOption, LinearGradientObject, LinesSeriesOption$1 as LinesSeriesOption, MapSeriesOption$1 as MapSeriesOption, MarkAreaOption, MarkLineOption, MarkPointOption, Model, PRIORITY, ParallelCoordinateSystemOption, ParallelSeriesOption$1 as ParallelSeriesOption, PatternObject, Payload, PictorialBarSeriesOption$1 as PictorialBarSeriesOption, PieSeriesOption$1 as PieSeriesOption, PiecewiseVisualMapOption, PolarOption, RadarOption, RadarSeriesOption$1 as RadarSeriesOption, RadialGradientObject, RadiusAxisOption, RegisteredSeriesOption, ResizeOpts, SVGPatternObject, SankeySeriesOption$1 as SankeySeriesOption, ScatterSeriesOption$1 as ScatterSeriesOption, ScrollableLegendOption, SeriesData, SeriesModel, SeriesOption$1 as SeriesOption, SetOptionOpts, SetOptionTransitionOpt, SetOptionTransitionOptItem, SingleAxisOption, SliderDataZoomOption, SunburstSeriesOption$1 as SunburstSeriesOption, ThemeRiverSeriesOption$1 as ThemeRiverSeriesOption, TimelineOption, TitleOption, ToolboxComponentOption, TooltipFormatterCallback, TooltipOption, TooltipPositionCallback, TooltipPositionCallbackParams, TopLevelFormatterParams, TreeSeriesOption$1 as TreeSeriesOption, TreemapSeriesOption$1 as TreemapSeriesOption, VisualMapComponentOption, XAXisOption, YAXisOption, ZRColor, brushSingle, color_d, connect, dataTool, dependencies, disConnect, disconnect, dispose$1 as dispose, env, extendChartView, extendComponentModel, extendComponentView, extendSeriesModel, format_d, getCoordinateSystemDimensions, getInstanceByDom, getInstanceById, getMap, graphic_d, helper_d, init$1 as init, install$1 as install, install$2 as install$1, install$b as install$10, install$c as install$11, install$d as install$12, install$e as install$13, install$f as install$14, install$g as install$15, install$h as install$16, install$i as install$17, install$j as install$18, install$k as install$19, install$3 as install$2, install$l as install$20, install$m as install$21, install$o as install$22, install$p as install$23, install$q as install$24, install$r as install$25, install$s as install$26, install$t as install$27, install$u as install$28, install$v as install$29, install$4 as install$3, install$w as install$30, install$x as install$31, install$y as install$32, install$z as install$33, install$A as install$34, install$n as install$35, install$B as install$36, install$C as install$37, install$D as install$38, install$E as install$39, install$5 as install$4, install$F as install$40, install$G as install$41, install$H as install$42, install$I as install$43, install$J as install$44, install$K as install$45, install$L as install$46, install$M as install$47, install$N as install$48, install$O as install$49, install$6 as install$5, install$P as install$50, install as install$51, install$Q as install$52, install$R as install$53, install$7 as install$6, install$8 as install$7, install$9 as install$8, install$a as install$9, installLabelLayout, installUniversalTransition, matrix_d, number_d, parseGeoJSON, registerAction, registerCoordinateSystem, registerLayout, registerLoading, registerLocale, registerMap, registerPostInit, registerPostUpdate, registerPreprocessor, registerProcessor, registerTheme, registerTransform, registerUpdateLifecycle, registerVisual, setCanvasCreator, setPlatformAPI, throttle, time_d, use, util_d, util_d$1, vector_d, version$1 as version, zrender_d };