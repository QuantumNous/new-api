import { DiffState } from '../interface/enum';
import { type IStateInfo, type IModelMarkAttributeContext, STATE_VALUE_ENUM } from '../../compile/mark/interface';
import type { BaseSeries } from '../../series/base/base-series';
import type {
  Datum,
  IMarkSpec,
  ConvertToMarkStyleSpec,
  GradientStop,
  IVisual,
  IVisualScale,
  IVisualSpecStyle,
  ICommonSpec,
  FunctionType,
  ValueType,
  StringOrNumber,
  Maybe
} from '../../typings';
import type { DataView } from '@visactor/vdataset';
import { mergeSpec } from '@visactor/vutils-extension';
import { Color } from '../../util/color';
import { createScaleWithSpec } from '../../util/scale';
import { MarkTypeEnum } from '../interface';
import type {
  IMarkRaw,
  IMarkStateStyle,
  IMarkStyle,
  IMark,
  IMarkOption,
  StyleConvert,
  VisualScaleType,
  MarkInputStyle,
  GroupedData,
  IAttrs,
  IMarkGraphic,
  DiffStateValues,
  ProgressiveContext,
  IProgressiveTransformResult,
  MarkType,
  AnimationStateValues
} from '../interface';
import { GradientType, DEFAULT_GRADIENT_CONFIG } from '../../constant/gradient';
import { AttributeLevel } from '../../constant/attribute';
import { isValidScaleType } from '@visactor/vscale';
import { computeActualDataScheme, getDataScheme } from '../../theme/color-scheme/util';
import type { ISeries } from '../../series/interface';
import { MarkStateManager } from '../../compile/mark';
import type {
  ICompilableMark,
  IMarkCompileOption,
  IMarkConfig,
  IMarkStateManager,
  StateValueType
} from '../../compile/mark/interface';
import { array, degreeToRadian, isArray, isBoolean, isFunction, isNil, isObject, isValid } from '@visactor/vutils';
import { curveTypeTransform, groupData, runEncoder } from '../utils/common';
import type { ICompilableInitOption } from '../../compile/interface';
import { LayoutState } from '../../compile/interface';
import type {
  IGroupGraphicAttribute,
  IGraphicAttribute,
  IGroup,
  IGraphic,
  StateDefinitionsInput,
  StateResolveContext
} from '@visactor/vrender-core';
import { createGroup, CustomPath2D } from '@visactor/vrender-core';
import { isStateAttrChangeable } from '../../compile/mark/util';
import { Factory } from '../../core/factory';
import { DEFAULT_DATA_KEY } from '../../constant/data';
import { GrammarItem } from '../../compile/grammar-item';
import { LayoutZIndex } from '../../constant/layout';
import type { IModel } from '../../model/interface';
import type { ICompilableData } from '../../compile/data/interface';
import type { IAnimationConfig } from '../../animation/interface';
import { AnimationStateEnum, type MarkAnimationSpec } from '../../animation/interface';
import { CompilableData } from '../../compile/data/compilable-data';
import { getDiffAttributesOfGraphic } from '../../util/mark';
import { log } from '../../util/debug';
import { morph as runMorph } from '../../compile/morph';
import { addGraphicState, removeGraphicState, setGraphicStates } from '../../util/graphic-state';

export type ExChannelCall = (
  key: string | number | symbol,
  datum: Datum,
  states: StateValueType,
  baseValue: unknown
) => unknown;

const statesClearedBeforeReInitKey = Symbol('statesClearedBeforeReInit');

type ReinitStateGraphic = IMarkGraphic & {
  [statesClearedBeforeReInitKey]?: string[];
};

export class BaseMark<T extends ICommonSpec> extends GrammarItem implements IMarkRaw<T> {
  /** 类型 */
  readonly type: MarkType = undefined as unknown as MarkType;

  /** name */
  readonly name: string = 'mark';

  /** key field */
  readonly key: ICompilableMark['key'];

  protected _markConfig: IMarkConfig = {
    zIndex: LayoutZIndex.Mark,
    /** morph动画关联关系配置 */
    morph: false
  };

  protected _isCommited?: boolean;

  commit(render?: boolean, recursion?: boolean) {
    if (recursion && this.getMarks().length > 0) {
      this.getMarks().forEach(m => m.commit(false, recursion));
    }

    this._isCommited = true;
    if (render) {
      this.getCompiler().renderNextTick();
    }
  }

  uncommit() {
    this._isCommited = false;
  }

  isCommited() {
    return this._isCommited;
  }

  getMarkConfig(): IMarkConfig {
    return this._markConfig;
  }
  setMarkConfig(config: IMarkConfig) {
    Object.keys(config).forEach(key => {
      (this._markConfig as any)[key] = (config as any)[key];
    });
  }

  /** 可见性 */
  protected _visible: boolean = true;
  getVisible() {
    return this._visible;
  }
  setVisible(visible: boolean) {
    this._visible = visible;
  }

  /**
   * 用户设置的 id
   */
  protected _userId: StringOrNumber;
  getUserId() {
    return this._userId;
  }
  setUserId(userId: StringOrNumber) {
    if (isValid(userId)) {
      this._userId = userId;
    }
  }

  /** parent model */
  readonly model: IModel;

  /** 数据（可以没有） */
  protected _data: ICompilableData;
  getDataView(): DataView | undefined {
    return this._data?.getDataView();
  }
  setDataView(d?: DataView) {
    if (isNil(this._data)) {
      this.initMarkData(this._option);
    }
    this._data.setDataView(d);
  }
  getData() {
    return this._data;
  }
  setData(d?: ICompilableData) {
    this._data = d;
    if (d) {
      d.addRelatedMark(this);
    }
  }

  /** 默认的stateStyle */
  stateStyle: IMarkStateStyle<T> = {};

  /** 状态管理器 */
  state: IMarkStateManager;

  protected _unCompileChannel: { [key in string]: boolean } = {};

  hasState(state: string) {
    return state in this.state.getStateMap();
  }
  getState(state: string) {
    return this.state.getStateMap()[state];
  }

  protected _animationConfig: Partial<MarkAnimationSpec>;
  getAnimationConfig() {
    return this._animationConfig;
  }

  setAnimationConfig(config: Partial<MarkAnimationSpec>) {
    // group mark 动画默认只挂到自己
    const defaultPrams = this.type === 'group' ? { selfOnly: true } : {};
    const formatAnimationCfg = (cfg: IAnimationConfig) => {
      const options = (cfg as any)!.options ?? {};

      return {
        ...defaultPrams,
        ...cfg,
        options: (datum: any, graphic: IMarkGraphic, customParams: any) => {
          const _options = typeof options === 'function' ? options(datum, graphic, customParams) : options;

          if (graphic && graphic.context && graphic.context.compiler && isValid(graphic.context.modelId)) {
            const model = graphic.context.compiler.getChart()?.getModelById(graphic.context.modelId);

            return {
              ..._options,
              layoutRect: (model as any)?.getLayoutRect?.()
            };
          }

          return {
            ..._options
          };
        }
      };
    };

    // 封装options，批量添加一些默认参数
    const animationConfig: Partial<MarkAnimationSpec> = {};

    Object.keys(config).forEach(key => {
      const value = (config as any)[key];
      if (isArray(value)) {
        (animationConfig as any)[key] = value.map(formatAnimationCfg);
      } else if (isValid(value)) {
        (animationConfig as any)[key] = formatAnimationCfg(value);
      }
    });
    this._animationConfig = animationConfig;
  }

  protected _disabledAnimationStates?: string[] = [];

  disableAnimationByState(state: string | string[]) {
    const states = array(state);
    this._disabledAnimationStates = [...new Set([...this._disabledAnimationStates, ...states])];
  }

  enableAnimationByState(state: string | string[]) {
    const states = array(state);
    this._disabledAnimationStates = this._disabledAnimationStates.filter(s => !states.includes(s));
  }

  /** 布局标记 */
  private _skipBeforeLayouted = false;

  setSkipBeforeLayouted(skip: boolean) {
    this._skipBeforeLayouted = skip;
  }
  protected _groupKey?: string;
  setGroupKey(groupKey: string) {
    this._groupKey = groupKey;
  }

  protected _stateSort?: (stateA: string, stateB: string) => number;

  protected declare _product: Maybe<IGroup>;
  getProduct() {
    return this._product;
  }

  // 保存上一次的mark，用于morph的时候获取上次的图元
  protected declare _lastMark?: IMark;

  /** 初始化 mark data */
  protected initMarkData(option: ICompilableInitOption) {
    this._data = new CompilableData(option);

    this._data.addRelatedMark(this);
  }

  protected _compileProduct(option?: IMarkCompileOption) {
    this.commit();
    this._context = option?.context;
    const product = this.getProduct();
    // 处理 visible 为 false 的情况
    if (!this._visible) {
      if (isValid(product)) {
        this.removeProduct();
      }
      return;
    } else if (isValid(product)) {
      if (option.group && product.parent !== option.group) {
        option.group.appendChild(product);
      }
    } else {
      const compiler = this.getCompiler();
      if (!compiler.isInited) {
        return;
      }
      this._initProduct(option?.group);
    }

    if (isNil(this._product)) {
      return;
    }
    this.compileData();
    this.compileState();
    this.compileEncode();
    // this.compileContext(option?.context);
    // this.compileTransform();
  }

  /** 创建语法元素对象 */
  protected _initProduct(group?: IGroup) {
    const stage = this.getStage();

    if (!stage) {
      return;
    }

    // 声明语法元素
    const id = this.getProductId();

    this._product = createGroup(
      this.type !== MarkTypeEnum.group
        ? {
            pickable: false,
            zIndex: this._markConfig.zIndex,
            overflow: this._markConfig.overflow
          }
        : {}
    );
    // todo 为了和之前的版本兼容，这里暂时设置成name
    this._product.name = id;
    // 为了从graphic上能索引到mark
    this._product.mark = this;

    (group ?? this.getCompiler()?.getRootGroup()).appendChild(this._product);

    // if (this.name && this._product) {
    //   this._product.name = this.name;
    // }
    this._compiledProductId = id;
  }

  generateProductId() {
    if (this._userId) {
      return `${this._userId}`;
    }
    return `${this.name}_${this.id}`;
  }

  layout(layout: () => void) {
    // todo
  }

  compileData() {
    if (isNil(this._data)) {
      return;
    }
    this._data.compile();

    // 绑定数据
    // const dataProduct = this._data.getProduct();
    // if (isValid(this._product) && isValid(dataProduct)) {
    //   // this._product.join(dataProduct as IData, this.key, undefined, this.getGroupKey());
    // }
  }

  // protected _separateStyle() {
  //   const { [STATE_VALUE_ENUM.STATE_NORMAL]: normalStyle } = this.stateStyle;

  //   const enterStyles: Record<string, MarkFunctionType<any>> = this._option.noSeparateStyle ? null : {};
  //   const updateStyles: Record<string, MarkFunctionType<any>> = {};
  //   Object.keys(normalStyle).forEach(key => {
  //     if (this._unCompileChannel[key]) {
  //       return;
  //     }

  //     if (this._option.noSeparateStyle || isStateAttrChangeable(key, normalStyle, this.getGroupKey())) {
  //       updateStyles[key] = {
  //         callback: this._computeAttribute(key, 'normal'),
  //         dependency: [this.stateKeyToSignalName('markUpdateRank')]
  //       };
  //     } else {
  //       enterStyles[key] = this._computeAttribute(key, 'normal');
  //     }
  //   });
  //   return { enterStyles, updateStyles };
  // }

  compileEncode() {
    // const { [STATE_VALUE_ENUM.STATE_NORMAL]: normalStyle, ...temp } = this.stateStyle;
    // const { enterStyles, updateStyles } = this._separateStyle();
    // const encoders: any = {
    //   update: updateStyles,
    //   group: enterStyles
    // };
    // Object.keys(temp).forEach(state => {
    //   const styles: Record<string, MarkFunctionType<any>> = {};
    //   Object.keys(temp[state]).forEach(key => {
    //     if (this._unCompileChannel[key]) {
    //       return;
    //     }
    //     styles[key] = {
    //       callback: this._computeAttribute(key, state),
    //       dependency: [this.stateKeyToSignalName('markUpdateRank')]
    //     };
    //   });
    //   encoders[state] = styles;
    // });
    // // 在布局完成前不进行encode
    // if (this._skipBeforeLayouted) {
    // }
  }

  compileState() {
    // this.state.compileState(this, this._stateSort);
  }

  compileAnimation() {
    // if (this._animationConfig) {
    //   let stateSignal: any;
    //   if (this.type === 'component') {
    //     // 组件有自己的动画状态
    //     stateSignal = (this.model as IComponent).animate?.getAnimationStateSignalName();
    //   } else {
    //     const region = (this.model as ISeries).getRegion?.();
    //     stateSignal = region?.animate?.getAnimationStateSignalName();
    //   }
    //   this._product.animation(this._animationConfig);
    //   this._product.animationState({
    //     callback: (datum: Datum, element: IElement, parameters: Record<string, any>) => {
    //       return parameters[stateSignal]?.callback(datum, element);
    //     },
    //     dependency: stateSignal
    //   });
    //   if (this._animationConfig.normal) {
    //     if (!this._animationConfig.appear) {
    //       this._event.on(VGRAMMAR_HOOK_EVENT.AFTER_DO_RENDER, () => {
    //         this.runAnimationByState(AnimationStateEnum.normal);
    //       });
    //     } else {
    //       this._event.on(VGRAMMAR_HOOK_EVENT.ANIMATION_END, ({ event }) => {
    //         if (event.mark === this.getProduct() && event.animationState === AnimationStateEnum.appear) {
    //           this.runAnimationByState(AnimationStateEnum.normal);
    //         }
    //       });
    //     }
    //   }
    // }
  }

  _context: any;

  compileContext(extraContext?: any) {
    // const config: IMarkConfig = {
    //   ...this._markConfig,
    //   context: {
    //   }
    // };

    this._context = {
      markId: this.id,
      modelId: this.model.id,
      markUserId: this._userId,
      modelUserId: this.model.userId,
      ...extraContext
    };
  }

  getContext() {
    return this._context;
  }

  protected compileTransform() {
    // if (this._transform?.length) {
    //   this.getProduct().transform(this._transform);
    // }
  }

  updateState(newState: Record<string, unknown>, noRender?: boolean) {
    this.commit();

    return this.state.updateState(newState, noRender);
  }

  getMarks(): IMark[] {
    return [];
  }

  runAnimationByState(state?: string) {
    // return this.getProduct()?.animate?.runAnimationByState(state);
  }

  stopAnimationByState(state?: string) {
    // return this.getProduct()?.animate?.stopAnimationByState(state);
  }

  pauseAnimationByState(state?: string) {
    // return this.getProduct()?.animate?.pauseAnimationByState(state);
  }

  resumeAnimationByState(state?: string) {
    // return this.getProduct()?.animate?.resumeAnimationByState(state);
  }

  removeProduct(releaseDetach?: boolean) {
    if (this._product && this._product.parent) {
      this._product.parent.removeChild(this._product, releaseDetach);
    }
    this._product = null;
    this._compiledProductId = null;
  }
  release() {
    // if (this._product && this._product.parent) {
    //   this._product.parent.removeChild(this._product);
    // }

    this.state.release();
    super.release();
    this._lastMark = null;
  }

  protected _simpleStyle: T;

  setSimpleStyle(s: T) {
    this._simpleStyle = s;
  }

  getSimpleStyle(): T {
    return this._simpleStyle;
  }

  protected declare _option: IMarkOption;

  protected _attributeContext: IModelMarkAttributeContext;

  protected _encoderOfState: Record<string, Record<string, (datum: Datum) => any>>;

  protected _sharedStateDefinitionsCacheKey?: string;

  protected _sharedStateDefinitionsCache?: StateDefinitionsInput<Record<string, unknown>>;

  protected _sharedStateDefinitionRefIds = new WeakMap<object, number>();

  protected _sharedStateDefinitionRefId = 0;

  /** by _unCompileChannel, some channel need add default channel to make sure update available */
  _extensionChannel: {
    [key: string | number | symbol]: string[];
  } = {};
  /** same as _extensionChannel. when compute channel, add extension channel effect */
  _computeExChannel: {
    [key: string | number | symbol]: ExChannelCall;
  } = {};

  constructor(name: string, option: IMarkOption) {
    super(option);
    this.name = name;
    this.model = option.model;
    this.key = option.key;
    this.state = new MarkStateManager(option, this as unknown as IMark) as unknown as IMarkStateManager;
    // 这里的上下文多数情况下与 mark 是什么是没有关系的，与mark的使用者，也就是series，component有的逻辑有关。
    this._attributeContext = option.attributeContext;
    option.map?.set(this.id, this as unknown as IMark);
  }

  created(): void {
    this._initStyle();
  }

  /**
   * 外部调用，根据 spec 初始化 style（如果由 IModel 派生类调用，请使用 IModel.initMarkStyleWithSpec）
   * @param spec
   * @param key
   * @returns
   */
  initStyleWithSpec(spec: IMarkSpec<T>) {
    if (!spec) {
      return;
    }

    if (isValid(spec.id)) {
      this._userId = spec.id;
    }

    // interactive
    if (isBoolean(spec.interactive)) {
      this._markConfig.interactive = spec.interactive;
    }
    // zIndex
    if (isValid(spec.zIndex)) {
      this._markConfig.zIndex = spec.zIndex;
    }
    // visible
    if (isBoolean(spec.visible)) {
      this.setVisible(spec.visible);
    }

    this._markConfig.setCustomizedShape = spec.customShape;

    this._stateSort = spec.stateSort;

    // style
    this._initSpecStyle(spec);
  }

  protected _transformStyleValue<T>(
    styleConverter: StyleConvert<T>,
    transform: (value: ValueType<T>) => ValueType<T>
  ): StyleConvert<any> {
    if ((styleConverter as VisualScaleType).scale) {
      const scale = (styleConverter as VisualScaleType).scale;
      const range = scale.range();
      scale.range(range.map(transform));
      return styleConverter as StyleConvert<T>;
    } else if (typeof styleConverter === 'function') {
      return ((...args) => {
        return transform((styleConverter as FunctionType<number>)(...args) as ValueType<T>);
      }) as StyleConvert<T>;
    }
    return transform(styleConverter as ValueType<T>);
  }

  convertAngleToRadian(styleConverter: StyleConvert<number>) {
    // 用户传入的角度配置，需要做一层转换
    return this._transformStyleValue(styleConverter, degreeToRadian);
  }

  isUserLevel(level: number) {
    return [
      AttributeLevel.User_Mark,
      AttributeLevel.User_Series,
      AttributeLevel.User_Chart,
      AttributeLevel.User_SeriesStyle
    ].includes(level);
  }

  /**
   * 由外部series调用，设置markStyle的接口（如果由 IModel 派生类调用，请使用 IModel.setMarkStyle）
   * @param style
   * @param level
   * @param state
   */
  setStyle<U extends keyof T>(
    style: Partial<IMarkStyle<T>>,
    state: StateValueType = 'normal',
    level: number = 0
  ): void {
    if (isNil(style)) {
      return;
    }

    if (this.stateStyle[state] === undefined) {
      this.stateStyle[state] = {};
    }

    const isUserLevel = this.isUserLevel(level);

    Object.keys(style).forEach((attr: string) => {
      let attrStyle = style[attr] as MarkInputStyle<T[U]>;
      if (isNil(attrStyle)) {
        return;
      }

      attrStyle = this._filterAttribute(attr as any, attrStyle, state, level, isUserLevel);

      this.setAttribute(attr as any, attrStyle, state, level);
    });
  }

  getStyle(key: string, state: StateValueType = 'normal'): any {
    return this.stateStyle[state][key]?.style;
  }

  /** 过滤单个 attribute */
  protected _filterAttribute<U extends keyof T>(
    attr: U,
    style: MarkInputStyle<T[U]>,
    state: StateValueType,
    level: number,
    isUserLevel: boolean
  ): StyleConvert<T[U]> {
    let newStyle = this._styleConvert(style);
    if (isUserLevel) {
      switch (attr) {
        case 'angle':
          newStyle = this.convertAngleToRadian(newStyle);
          break;
        case 'innerPadding':
        case 'outerPadding':
          // VRender 的 padding 定义基于 centent-box 盒模型，默认正方向是向外扩，与 VChart 不一致。这里将 padding 符号取反
          newStyle = this._transformStyleValue(newStyle, (value: number) => -value);
          break;
        case 'curveType':
          newStyle = this._transformStyleValue(newStyle, (value: string) =>
            curveTypeTransform(value, (this._option.model as any).direction)
          );
          break;
      }
    }
    return newStyle;
  }

  /**
   * TODO: 没有外部调用
   * 设置mark样式所参考的图元
   */
  setReferer<U extends keyof T>(mark: IMarkRaw<T>, styleKey?: U, state?: StateValueType) {
    if (!mark) {
      return;
    }
    if (styleKey && state) {
      const style = this.stateStyle[state] ?? { [styleKey]: {} };
      this.stateStyle[state][styleKey] = {
        ...(style[styleKey] as unknown as any),
        ...{ referer: mark }
      };
      return;
    }

    Object.entries(this.stateStyle).forEach(([state, style]) => {
      Object.entries(style).forEach(([styleKey, style]) => {
        this.stateStyle[state][styleKey].referer = mark;
      });
    });
  }

  setPostProcess<U extends keyof T>(key: U, postProcessFunc: any, state: StateValueType = 'normal') {
    if (this.stateStyle[state]?.[key]) {
      this.stateStyle[state][key].postProcess = postProcessFunc;
    }
  }

  getAttribute<U extends keyof T>(key: U, datum: Datum, state: StateValueType = 'normal') {
    return this._computeAttribute(key, state)(datum);
  }

  getAttributesOfState(datum: Datum, state: StateValueType = 'normal') {
    const style = this.stateStyle[state];

    if (style) {
      const res: any = {};
      Object.keys(style).forEach(k => {
        if (!this._unCompileChannel[k]) {
          res[k] = this._computeAttribute(k, state)(datum);
        }
      });
      return res;
    }
  }

  setAttribute<U extends keyof T>(
    attr: U,
    style: MarkInputStyle<T[U]>,
    state: StateValueType = 'normal',
    level: number = 0
  ) {
    if (this.stateStyle[state] === undefined) {
      this.stateStyle[state] = {};
    }

    if (this.stateStyle[state][attr] === undefined) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.stateStyle[state][attr] = {
        level,
        style,
        referer: undefined
      };
    }
    const attrLevel = this.stateStyle[state][attr]?.level;
    if (isValid(attrLevel) && attrLevel <= level) {
      mergeSpec(this.stateStyle[state][attr], { style, level });
    }

    // some attr has extension channel in VChart to make some effect
    if (state !== 'normal') {
      if (attr in this._extensionChannel) {
        this._extensionChannel[attr].forEach(key => {
          if (this.stateStyle[state][key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.stateStyle[state][key as keyof T] = this.stateStyle.normal[key];
          }
        });
      }
    }
  }

  /**
   * 与 vgrammar 默认值一致的样式可以不设置默认值或设置为undefined, 减少encode属性
   */
  protected _getDefaultStyle() {
    return {
      visible: true,
      // mark的层级应该在mark层 不在encode属性层
      // zIndex: LayoutZIndex.Mark,
      x: 0,
      y: 0
    } as IMarkStyle<T>;
  }

  // /**
  //  * 获取该 mark 不支持的图形属性，由子类覆写
  //  * @returns
  //  */
  // protected getIgnoreAttributes(): string[] {
  //   return [];
  // }

  protected _styleConvert<U extends keyof T>(style?: MarkInputStyle<T[U]>): StyleConvert<T[U]> | undefined {
    if (!style) {
      return style as undefined;
    }
    // visual spec 转换为 scale 类型的mark style
    if (isValidScaleType((style as IVisualSpecStyle<unknown, T[U]>).type) || (style as IVisualScale).scale) {
      // const _style = style as IVisual<T[U]>;
      const scale = createScaleWithSpec(style as IVisual<T[U]>, {
        globalScale: this._option.globalScale,
        seriesId: this._option.seriesId
      });
      if (scale) {
        return {
          scale,
          field: (style as IVisual<T[U]>).field,
          changeDomain: (style as IVisualScale).changeDomain
        };
      }
    }
    return style as StyleConvert<T[U]>;
  }

  protected _computeAttribute<U extends keyof T>(key: U, state: StateValueType) {
    let stateStyle = this.stateStyle[state]?.[key];
    if (!stateStyle) {
      stateStyle = this.stateStyle.normal[key];
    }
    const baseValueFunctor = this._computeStateAttribute(stateStyle, key, state);
    const hasPostProcess = isFunction(stateStyle?.postProcess);
    const hasExCompute = key in this._computeExChannel;

    if (hasPostProcess && hasExCompute) {
      const exCompute = this._computeExChannel[key];
      return (datum: Datum) => {
        let baseValue = baseValueFunctor(datum);

        baseValue = stateStyle.postProcess(baseValue, datum, this._attributeContext, this.getDataView());

        return exCompute(key, datum, state, baseValue);
      };
    } else if (hasPostProcess) {
      return (datum: Datum) => {
        return stateStyle.postProcess(baseValueFunctor(datum), datum, this._attributeContext, this.getDataView());
      };
    } else if (hasExCompute) {
      const exCompute = this._computeExChannel[key];
      return (datum: Datum) => {
        return exCompute(key, datum, state, baseValueFunctor(datum));
      };
    }
    return baseValueFunctor;
  }

  protected _computeStateAttribute<U extends keyof T>(stateStyle: any, key: U, state: StateValueType) {
    if (!stateStyle) {
      return (datum: Datum) => undefined as any;
    }
    if (stateStyle.referer) {
      return stateStyle.referer._computeAttribute(key, state);
    }
    if (!stateStyle.style) {
      return (datum: Datum) => stateStyle.style;
    }

    if (typeof stateStyle.style === 'function') {
      return (datum: Datum) => stateStyle.style(datum, this._attributeContext, { mark: this }, this.getDataView());
    }

    if (GradientType.includes(stateStyle.style.gradient)) {
      // 渐变色处理，支持各个属性回调
      return this._computeGradientAttr(stateStyle.style);
    }

    if (['outerBorder', 'innerBorder'].includes(key as string)) {
      // 内外描边处理，支持各个属性回调
      return this._computeBorderAttr(stateStyle.style);
    }

    if (isValidScaleType(stateStyle.style.scale?.type)) {
      return (datum: Datum) => {
        let data = datum;
        if (this.model.modelType === 'series' && (this.model as unknown as ISeries).getMarkData) {
          data = (this.model as unknown as ISeries).getMarkData(datum);
        }

        return stateStyle.style.scale.scale(data[stateStyle.style.field]);
      };
    }
    return (datum: Datum) => {
      return stateStyle.style;
    };
  }

  private _initStyle(): void {
    const defaultStyle = this._getDefaultStyle();
    this.setStyle(defaultStyle, 'normal', 0);
  }

  private _initSpecStyle(spec: IMarkSpec<T>) {
    // style
    if (spec.style) {
      this.setStyle(spec.style, 'normal', AttributeLevel.User_Mark);
    }
    const state = spec.state;
    if (state) {
      Object.keys(state).forEach(key => {
        const stateTemp = state[key];
        if ('style' in stateTemp) {
          const style = stateTemp.style;
          let stateInfo: IStateInfo = { stateValue: key };
          if ('level' in stateTemp) {
            stateInfo.level = stateTemp.level as number;
          }
          if ('filter' in stateTemp) {
            if (isFunction(stateTemp.filter)) {
              stateInfo = {
                filter: stateTemp.filter as (datum: any, options: Record<string, any>) => boolean,
                ...stateInfo
              };
            } else {
              stateInfo = { ...stateTemp.filter, ...stateInfo };
            }
          }
          this.state.addStateInfo(stateInfo);
          this.setStyle(style as ConvertToMarkStyleSpec<T>, key, AttributeLevel.User_Mark);
        } else {
          this.setStyle(stateTemp, key, AttributeLevel.User_Mark);
        }
      });
    }
  }

  private _computeGradientAttr(gradientStyle: any) {
    const { gradient, scale, field, ...rest } = gradientStyle;

    let colorScale = scale;
    let colorField = field;
    if ((!scale || !field) && this.model.modelType === 'series') {
      // 目前只有series有这个属性
      const { scale: globalColorScale, field: globalField } = (this.model as BaseSeries<any>).getColorAttribute();
      if (!scale) {
        // 获取全局的 colorScale
        colorScale = globalColorScale;
      }
      if (!colorField) {
        colorField = globalField;
      }
    }

    const themeColor = computeActualDataScheme(
      getDataScheme(
        this.model.getColorScheme(),
        this.model.modelType === 'series' ? this.model.getSpec?.() : undefined
      ),
      (this.model as unknown as ISeries)?.getDefaultColorDomain?.() ?? []
    );
    // 默认配置处理
    const mergedStyle = {
      ...(DEFAULT_GRADIENT_CONFIG as any)[gradient],
      ...rest
    };
    return (data: Datum) => {
      const computeStyle: any = {};
      const markData = this.getDataView();
      Object.keys(mergedStyle).forEach(key => {
        const value = mergedStyle[key];
        if (key === 'stops') {
          computeStyle.stops = value.map((stop: GradientStop) => {
            const { opacity, color, offset } = stop;
            let computeColor = color ?? colorScale?.scale(data[colorField]);
            if (isFunction(color)) {
              computeColor = color(data, this._attributeContext, markData);
            }

            if (isValid(opacity)) {
              computeColor = Color.SetOpacity(computeColor as string, opacity);
            }

            return {
              offset: isFunction(offset) ? offset(data, this._attributeContext, markData) : offset,
              color: computeColor || themeColor[0]
            };
          });
        } else if (isFunction(value)) {
          computeStyle[key] = value(data, this._attributeContext, markData);
        } else {
          computeStyle[key] = value;
        }
      });

      computeStyle.gradient = gradient;

      return computeStyle;
    };
  }

  private _computeBorderAttr(borderStyle: any) {
    const { scale, field, ...mergedStyle } = borderStyle;

    return (data: Datum) => {
      const computeStyle: any = {};

      Object.keys(mergedStyle).forEach(key => {
        const value = mergedStyle[key];
        if (isFunction(value)) {
          computeStyle[key] = value(data, this._attributeContext, this.getDataView());
        } else {
          computeStyle[key] = value;
        }
      });
      if (!('stroke' in computeStyle)) {
        const themeColor = computeActualDataScheme(
          getDataScheme(
            this.model.getColorScheme(),
            this.model.modelType === 'series' ? this.model.getSpec?.() : undefined
          ),
          (this.model as unknown as ISeries).getDefaultColorDomain()
        );
        let colorScale = scale;
        let colorField = field;
        if ((!scale || !field) && this.model.modelType === 'series') {
          // 目前只有series有这个属性
          const { scale: globalColorScale, field: globalField } = (this.model as BaseSeries<any>).getColorAttribute();
          if (!scale) {
            // 获取全局的 colorScale
            colorScale = globalColorScale;
          }
          if (!colorField) {
            colorField = globalField;
          }
          computeStyle.stroke = colorScale?.scale(data[colorField]) || themeColor[0];
        }
      } else if (GradientType.includes(mergedStyle.stroke?.gradient)) {
        computeStyle.stroke = this._computeGradientAttr(mergedStyle.stroke)(data);
      }
      return computeStyle;
    };
  }

  protected _dataByGroup: GroupedData<Datum>;
  /**
   * 最新的数据map
   */
  protected _dataByKey: GroupedData<Datum>;
  /**
   * 上一次的数据map
   */
  protected _prevDataByKey: GroupedData<Datum>;
  protected _graphicMap: Map<string, IMarkGraphic> = new Map();
  protected _graphics: IMarkGraphic[] = [];
  /**
   * only need to clear elements after join and render
   * but `handleRenderEnd` will be call after every render
   */
  needClear?: boolean;

  protected _keyGetter: (datum: Datum) => string;
  protected _groupKeyGetter: (datum: Datum) => string;
  protected renderContext?: {
    parameters?: any;
    progressive?: ProgressiveContext;
    beforeTransformProgressive?: IProgressiveTransformResult;
  };
  protected _attrsByGroup?: Record<string, T>;

  protected _getDataByKey(data: Datum[]) {
    return groupData(data, (datum: Datum, index: number) => {
      return `${this._groupKeyGetter(datum)}_${this._keyGetter(datum) ?? index}`;
    });
  }

  protected _getCommonContext() {
    return {
      compiler: this.getCompiler(),
      markType: this.type as MarkTypeEnum,
      markId: this.id,
      modelId: this.model.id,
      markUserId: this._userId,
      modelUserId: this.model.userId
    };
  }

  prepareMorph(mark: IMark) {
    this._lastMark = mark;
  }

  reuse(mark: IMark) {
    if (this.type !== mark.type) {
      return;
    }
    this._product = mark.getProduct();
    if (!this._product) {
      return;
    }
    this._product.clearStates();
    this._graphics = mark.getGraphics();
    this._graphics.forEach(g => {
      g.clearStates();
    });
    this._graphicMap = (mark as any)._graphicMap;

    this._graphicMap.forEach(g => {
      g.context = { ...g.context, ...this._getCommonContext() };
    });
    this._dataByKey = (mark as any)._dataByKey;
    this._prevDataByKey = (mark as any)._prevDataByKey;
    this.needClear = (mark as any).needClear;
  }

  private _parseProgressiveContext(data: Datum[]) {
    const enableProgressive =
      this._markConfig.progressiveStep > 0 &&
      this._markConfig.progressiveThreshold > 0 &&
      this._markConfig.progressiveStep < this._markConfig.progressiveThreshold;
    const large =
      this._markConfig.large && this._markConfig.largeThreshold > 0 && data.length >= this._markConfig.largeThreshold;

    if (enableProgressive) {
      const groupedData = this._dataByGroup;

      if (
        groupedData &&
        groupedData.keys &&
        groupedData.keys.some(key => groupedData.data.get(key).length > this._markConfig.progressiveThreshold)
      ) {
        return {
          large,
          progressive: {
            data,
            step: this._markConfig.progressiveStep,
            currentIndex: 0,
            totalStep: groupedData.keys.reduce((total, key) => {
              return Math.max(Math.ceil(groupedData.data.get(key).length / this._markConfig.progressiveStep), total);
            }, 1),
            groupedData: groupedData.data as Map<string, any[]>
          }
        };
      }

      return { large };
    }

    return {
      large
    };
  }

  getGraphics() {
    return this._graphics;
  }

  protected _createGraphic(attrs: any = {}): IGraphic {
    return Factory.createGraphicComponent(this.type, attrs);
  }

  protected _runGroupData(data: Datum[]) {
    this._keyGetter = isFunction(this.key)
      ? (this.key as (datum: Datum) => string)
      : isValid(this.key)
      ? (datum: Datum) => datum?.[this.key as string]
      : (datum: Datum) => datum?.[DEFAULT_DATA_KEY];
    this._groupKeyGetter = isValid(this._groupKey)
      ? (datum: Datum) => {
          return `${datum?.[this._groupKey]}`;
        }
      : () => 'key';

    this._dataByGroup = groupData(data, this._groupKeyGetter);
  }

  getAnimationState() {
    const graphicsAnimationStates = this._graphics.map(g => g.context.animationState);
    const animationState = graphicsAnimationStates.every(state => state === AnimationStateEnum.appear)
      ? AnimationStateEnum.appear
      : graphicsAnimationStates.every(state => state === AnimationStateEnum.disappear)
      ? AnimationStateEnum.disappear
      : graphicsAnimationStates[0];
    return animationState ?? AnimationStateEnum.none;
  }

  protected createAnimationStateList(type: string, animationConfig: Partial<MarkAnimationSpec>) {
    let config = (animationConfig as any)[type];
    if (config && Array.isArray(config)) {
      config = config.length === 1 ? config[0] : config;
    }
    // TODO 因为数据的覆盖特点，无动画的时候新的更新一定会覆盖前一次的旧值，所以默认都是后面的动画覆盖前面的动画
    // TODO 但是如果用户定义了一个动画数组，他的预期是动画不会覆盖，通过priority为INfinity来控制不覆盖
    if (Array.isArray(config)) {
      return config.map((item: any, index: number) => ({
        ...item,
        priority: item.priority ?? Infinity
      }));
    }
    return config
      ? {
          ...config,
          // 循环动画的优先级定为最高，不会被屏蔽掉
          priority: type === 'normal' ? config.priority ?? Infinity : config.priority
        }
      : config;
  }

  /**
   * 尝试执行morphing动画
   * @param graphics
   * @returns
   */
  protected tryRunMorphing(graphics: IMarkGraphic[]) {
    if (this._lastMark) {
      // 得设置入场图元的属性
      graphics.forEach(g => {
        if (g.context.animationState === 'appear' || g.context.animationState === 'enter') {
          g.setAttributes((g.getAttributes as any)(true));
        }
      });
      const res = runMorph([this._lastMark], [this as any], {});
      this._lastMark = null;
      return res;
    }
    return false;
  }

  protected _runStateAnimation(graphics: IMarkGraphic[]) {
    if (!this._animationConfig || graphics.length === 0) {
      return;
    }

    if (this.tryRunMorphing(graphics)) {
      return;
    }
    const animationConfig = this.getAnimationConfig();
    const useSequentialAnimation = this._markConfig.useSequentialAnimation ?? false;
    if (useSequentialAnimation && (this as any)._runSequentialAnimations) {
      (this as any)._runSequentialAnimations(graphics);
      return;
    }
    // 过滤出appear动画出来，appear动画是整体动画，可以放在全局，同时appear动画和normal动画是串行关系
    const isAppear = graphics.every(g => g.context.animationState === 'appear');
    // const appearConfig = (animationConfig as any).appear?.[0]; // TODO: animation: appear 数组
    const appearConfig = this.createAnimationStateList('appear', animationConfig);
    if (isAppear && this._product) {
      // TODO 一般appear都在最开始执行，所以这里不需要停掉normal动画
      // (this._product as IGroup).stopAnimationState('normal');
      const stateArray = appearConfig ? ['appear'] : [];
      const configArray = appearConfig
        ? [
            {
              name: 'appear',
              animation: appearConfig
            }
          ]
        : [];

      if ((animationConfig as any).normal) {
        stateArray.push('normal');
        const normal = this.createAnimationStateList('normal', animationConfig);
        const normalConfig = {
          name: 'normal',
          animation: normal
        };

        configArray.push(normalConfig);
      }
      this._product.applyAnimationState(stateArray, configArray);
    }

    // 判断是否需要走normal动画，enter动画执行完成后，需要跟一个normal动画
    let shouldRunNormal = false;
    // 处理除了appear以外的动画
    graphics.forEach(g => {
      const state = g.context.animationState;
      if (state === 'appear') {
        return;
      }
      if (state === 'update' && !this._hasDiffAttrs(g)) {
        return;
      }
      const config = (animationConfig as any)[state] as any;
      if (config && config.length > 0) {
        const configList = config.map((item: any, index: number) => ({
          name: `${state}_${index}`,
          animation: item
        }));

        configList.forEach((item: any) => {
          item.animation.customParameters = g.context;
        });

        // configList.forEach((item: any) => {
        //   item.animation.customParameters = g.context;
        // });
        const stateArray = [state];

        g.applyAnimationState(stateArray, [configList.length === 1 ? configList[0] : configList]);
        // configList.forEach((item: any) => {
        //   item.animation.customParameters = null;
        // });
      }
      if (state === 'enter' && animationConfig.normal) {
        shouldRunNormal = true;
      }
    });

    if (shouldRunNormal && this._product && (animationConfig as any).normal?.length) {
      // 停止normal动画，并回复最初的属性
      (this._product as IGroup).stopAnimationState('normal', 'start');
      const normal = this.createAnimationStateList('normal', animationConfig);
      const normalConfig = {
        name: 'normal',
        animation: normal
      };
      (this._product as IGroup).applyAnimationState(['normal'], [normalConfig]);
    }
  }

  protected _setAnimationState(g: IMarkGraphic) {
    const callback =
      (this.type === MarkTypeEnum.component
        ? this.model.getAnimationStateCallback()
        : (this.model as ISeries).getRegion?.()?.getAnimationStateCallback()) ||
      ((g: IMarkGraphic) => {
        const diffState = g.context?.diffState;
        return diffState === AnimationStateEnum.exit
          ? AnimationStateEnum.exit
          : diffState === AnimationStateEnum.update
          ? AnimationStateEnum.update
          : AnimationStateEnum.appear;
      });
    const customizedState = callback(g);

    g.context.animationState = customizedState ?? g.context.diffState;

    // 复用exit的图元，需要设置属性为最初的属性
    if (g.context.animationState === DiffState.exit) {
      // 表示正在被复用，后续需要重设属性的
      g.context.reusing = true;
      // 停止所有动画，
      // TODO：属性可能回不去了（如果enter和exit不是一个动画），所以在encode阶段要获取finalAttribute，设置上去
      g.stopAnimates();
      // force element to stop exit animation if it is reentered
      // todo animaiton
      // const animators = this.animate?.getElementAnimators(element, DiffState.exit);
      // animators && animators.forEach(animator => animator.stop('start'));
    }
  }

  protected _runJoin(data: Datum[]) {
    const newGroupedData = this._getDataByKey(data);
    const prevGroupedData = this._prevDataByKey;
    const allGraphics: IMarkGraphic[] = [];

    const enterGraphics = new Set<IMarkGraphic>(this._graphics.filter(g => g.context.diffState === DiffState.enter));

    const callback = (key: string, newData: Datum[], prevData: Datum[]) => {
      let g: IMarkGraphic;
      let diffState: DiffStateValues;

      if (isNil(newData)) {
        g = this._graphicMap.get(key);

        if (g) {
          diffState = DiffState.exit;
        }
      } else if (isNil(prevData)) {
        // enter
        if (this._graphicMap.has(key)) {
          g = this._graphicMap.get(key);
        } else {
          g = {} as IMarkGraphic; //
        }
        diffState = DiffState.enter;
        g.isExiting = false;

        this._graphicMap.set(key, g as IMarkGraphic);
        allGraphics.push(g as IMarkGraphic);
      } else {
        // update
        g = this._graphicMap.get(key);

        if (g) {
          diffState = DiffState.update;
          allGraphics.push(g);
        }
      }

      if (g) {
        enterGraphics.delete(g);
        g.context = {
          ...this._getCommonContext(),
          diffState,
          // 从旧context中继承
          reusing: g.context?.reusing,
          // 从旧context中继承
          originalFieldX: g.context?.originalFieldX,
          // 从旧context中继承
          originalFieldY: g.context?.originalFieldY,
          // 从旧context中继承
          fieldX: g.context?.fieldX,
          // 从旧context中继承
          fieldY: g.context?.fieldY,
          // TODO 如果newData为空，则使用旧的data，避免exit图元找不到data
          data: newData ?? g.context?.data,
          uniqueKey: key,
          key: newData ? this._keyGetter(newData[0]) : g.context?.key,
          groupKey: newData ? this._groupKeyGetter(newData[0]) : g.context?.groupKey,
          // TODO 用于判定这个图元是第几个，在OneByOne动画中控制顺序
          indexKey: '__VCHART_DEFAULT_DATA_INDEX',
          stateAnimateConfig: this.getAnimationConfig()?.state
        };
        this._setAnimationState(g);
      }
      return g;
    };

    if (prevGroupedData && newGroupedData) {
      const prevMap = new Map(prevGroupedData.data);
      const newKeys = newGroupedData.keys;

      newKeys.forEach(key => {
        callback(key, newGroupedData.data.get(key), prevMap.get(key));
        prevMap.delete(key);
      });

      prevGroupedData.keys.forEach(key => {
        if (prevMap.has(key)) {
          callback(key, null, prevMap.get(key));
        }
      });
    } else if (newGroupedData) {
      newGroupedData.keys.forEach(key => {
        // appear
        const g = callback(key, newGroupedData.data.get(key), null);
        if (g) {
          g.context.animationState = AnimationStateEnum.appear;
          // this._setAnimationState(g);
        }
      });
    } else if (prevGroupedData) {
      prevGroupedData.keys.forEach(key => {
        // disappear
        const g = callback(key, null, prevGroupedData.data.get(key));
        g.context.animationState = AnimationStateEnum.disappear;
        // this._setAnimationState(g);
      });
    }

    // Enter elements between dataflow start data and end data should be removed directly.
    enterGraphics.forEach(g => {
      this._graphicMap.delete(g.context.uniqueKey);

      if ((g as IMarkGraphic).parent) {
        (g as IMarkGraphic).parent.removeChild(g as IMarkGraphic);
      }

      (g as IMarkGraphic).release();
    });
    const graphicCount = allGraphics.length;
    allGraphics.forEach((g, index) => {
      g.context.graphicCount = graphicCount;
      g.context.graphicIndex = index;
      g.stateSort = this._stateSort;
    });
    this._dataByKey = newGroupedData;
    this._graphics = allGraphics;
    this.needClear = true;
  }

  _runEncoderOfGraphic(styles: Record<string, (datum: Datum) => any>, g: IMarkGraphic, attrs: any = {}) {
    return runEncoder(styles, g.context.data[0], attrs);
  }

  _runGroupEncoder(groupStyles: Record<string, (datum: Datum) => any>) {
    if (!this._dataByGroup) {
      return null;
    }

    const attrsByGroup: any = {};

    this._dataByGroup.keys.forEach(key => {
      attrsByGroup[key] = runEncoder(groupStyles, this._dataByGroup.data.get(key)[0]);
    });
    this._attrsByGroup = attrsByGroup;

    return attrsByGroup;
  }

  protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any) {
    return {
      ...groupAttrs,
      ...attrs
    };
  }

  protected _separateNormalStyle(normalStyle: Partial<IAttrs<T>>) {
    const updateStyles = {};
    const groupStyles = {};

    Object.keys(normalStyle).forEach(key => {
      if (this._unCompileChannel[key]) {
        return;
      }

      if (this._option.noSeparateStyle || isStateAttrChangeable(key, normalStyle, this._groupKey)) {
        (updateStyles as any)[key] = normalStyle[key];
      } else {
        (groupStyles as any)[key] = normalStyle[key];
      }
    });

    return { updateStyles, groupStyles };
  }

  protected _getEncoderOfStyle = (stateName: string, style: Partial<IAttrs<T>>) => {
    if (style && stateName) {
      const validEncoder: Record<string, (datum: Datum) => any> = {};
      Object.keys(style).forEach(key => {
        if (this._unCompileChannel[key]) {
          return;
        }

        validEncoder[key] = this._computeAttribute(key, stateName);
      });

      return validEncoder;
    }

    return null;
  };

  protected _setGraphicFromMarkConfig = (g: IMarkGraphic) => {
    const { setCustomizedShape, graphicName } = this._markConfig;

    if (setCustomizedShape) {
      g.pathProxy = (attrs: Partial<IGraphicAttribute>) => {
        return setCustomizedShape(g.context.data, attrs, new CustomPath2D());
      };
    }

    if (graphicName) {
      if (isFunction(graphicName)) {
        g.name = (graphicName as (e: IMarkGraphic) => string)(g);
      } else {
        g.name = graphicName as string;
      }
    }
  };

  protected _setStateOfGraphic = (g: IMarkGraphic, hasAnimation?: boolean) => {
    const targetStates =
      g.context.diffState === DiffState.enter || g.context.diffState === DiffState.update
        ? g.context.states
        : undefined;
    const hasCurrentState =
      !!g.currentStates?.length ||
      !!g.effectiveStates?.length ||
      !!g.resolvedStatePatch ||
      !!g.registeredActiveScopes?.size;

    if (!targetStates?.length && !hasCurrentState) {
      return;
    }

    setGraphicStates(g, targetStates, hasAnimation);
  };

  protected _getSharedStateDefinitionRefId(value: unknown) {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      return `${value}`;
    }

    const objectValue = value as object;
    let id = this._sharedStateDefinitionRefIds.get(objectValue);
    if (!id) {
      id = ++this._sharedStateDefinitionRefId;
      this._sharedStateDefinitionRefIds.set(objectValue, id);
    }

    return `ref:${id}`;
  }

  protected _getSharedStateDefinitionValueKey(value: unknown) {
    try {
      const jsonValue = JSON.stringify(value);
      return jsonValue ?? `${value}`;
    } catch (_error) {
      return this._getSharedStateDefinitionRefId(value);
    }
  }

  protected _isStaticSharedStateAttribute(stateName: string, key: string) {
    const stateStyle = this.stateStyle[stateName]?.[key];
    if (!stateStyle || stateStyle.referer || isFunction(stateStyle.postProcess) || key in this._computeExChannel) {
      return false;
    }

    const style = stateStyle.style as any;
    if (isFunction(style)) {
      return false;
    }

    if (GradientType.includes(style?.gradient)) {
      return false;
    }

    if (['outerBorder', 'innerBorder'].includes(key)) {
      return false;
    }

    if (isValidScaleType(style?.scale?.type)) {
      return false;
    }

    return true;
  }

  protected _applySharedStateDefinitions() {
    if (!this._product) {
      return;
    }

    const stateNames = Object.keys(this._encoderOfState ?? {}).filter(
      stateName => stateName !== 'group' && stateName !== 'update'
    );

    if (!stateNames.length) {
      if (this._product.sharedStateDefinitions !== undefined) {
        this._product.sharedStateDefinitions = undefined;
      }
      return;
    }

    const sortedStateNames = this._stateSort ? stateNames.slice().sort(this._stateSort) : stateNames;
    const statePriority = new Map<string, number>();

    sortedStateNames.forEach((stateName, index) => {
      statePriority.set(stateName, index);
    });

    const sharedStateDefinitions: StateDefinitionsInput<Record<string, unknown>> = {};
    const cacheKeys: string[] = [];

    stateNames.forEach(stateName => {
      const encoder = this._encoderOfState[stateName];
      const patch: Record<string, unknown> = {};
      const dynamicEncoder: Record<string, (datum: Datum) => any> = {};
      const patchKeys: string[] = [];
      const dynamicKeys: string[] = [];

      Object.keys(encoder ?? {}).forEach(key => {
        if (this._isStaticSharedStateAttribute(stateName, key)) {
          patch[key] = this._computeAttribute(key as keyof T, stateName)(undefined);
          patchKeys.push(key);
        } else {
          dynamicEncoder[key] = encoder[key];
          dynamicKeys.push(key);
        }
      });

      if (!patchKeys.length && !dynamicKeys.length) {
        return;
      }

      const definition: any = {
        priority: statePriority.get(stateName) ?? 0
      };

      if (patchKeys.length) {
        definition.patch = patch;
      }

      if (dynamicKeys.length) {
        definition.declaredAffectedKeys = dynamicKeys;
        definition.resolver = ({ graphic }: StateResolveContext<Record<string, unknown>>) =>
          this._runEncoderOfGraphic(dynamicEncoder, graphic as IMarkGraphic);
      }

      sharedStateDefinitions[stateName] = definition;
      cacheKeys.push(
        [
          stateName,
          definition.priority,
          patchKeys.sort().map(key => `${key}:${this._getSharedStateDefinitionValueKey(patch[key])}`),
          dynamicKeys.sort().map(key => {
            const stateStyle = this.stateStyle[stateName]?.[key];
            const styleId = this._getSharedStateDefinitionRefId(stateStyle?.style);
            const postProcessId = this._getSharedStateDefinitionRefId(stateStyle?.postProcess);
            const refererId = this._getSharedStateDefinitionRefId(stateStyle?.referer);

            return `${key}:${styleId}:${postProcessId}:${refererId}`;
          })
        ].join('|')
      );
    });

    if (!cacheKeys.length) {
      if (this._product.sharedStateDefinitions !== undefined) {
        this._product.sharedStateDefinitions = undefined;
      }
      return;
    }

    const cacheKey = cacheKeys.sort().join('||');
    if (cacheKey === this._sharedStateDefinitionsCacheKey && this._sharedStateDefinitionsCache) {
      if (this._product.sharedStateDefinitions !== this._sharedStateDefinitionsCache) {
        this._product.sharedStateDefinitions = this._sharedStateDefinitionsCache;
      }
      return;
    }

    this._sharedStateDefinitionsCacheKey = cacheKey;
    this._sharedStateDefinitionsCache = sharedStateDefinitions;
    this._product.sharedStateDefinitions = sharedStateDefinitions;
  }

  protected _addProgressiveGraphic(parent: IGroup, g: IMarkGraphic) {
    (parent as IGroup).incrementalAppendChild(g);
  }

  protected _runEncoder(graphics: IMarkGraphic[], noGroupEncode?: boolean) {
    const attrsByGroup = noGroupEncode ? null : this._runGroupEncoder(this._encoderOfState?.group);
    graphics.forEach(g => {
      const attrs = this._runEncoderOfGraphic(this._encoderOfState?.update, g);

      // 配置的优先级高于encoder
      if (!isNil(this._markConfig.interactive)) {
        attrs.pickable = this._markConfig.interactive;
      }
      const finalAttrs = this._transformGraphicAttributes(g, attrs, attrsByGroup?.[g.context.groupKey]);

      g.context.finalAttrs = finalAttrs;
    });
  }

  protected _excludeStateControlledDiffAttrs(g: IMarkGraphic, diffAttrs: Record<string, any>) {
    if (!diffAttrs || !Object.keys(diffAttrs).length || !g.resolvedStatePatch) {
      return diffAttrs;
    }

    let nextDiffAttrs: Record<string, any>;
    Object.keys(g.resolvedStatePatch).forEach(key => {
      if (!(key in diffAttrs)) {
        return;
      }
      if (!nextDiffAttrs) {
        nextDiffAttrs = { ...diffAttrs };
      }
      delete nextDiffAttrs[key];
    });

    return nextDiffAttrs ?? diffAttrs;
  }

  protected _hasDiffAttrs(g: IMarkGraphic) {
    return !!g.context.diffAttrs && Object.keys(g.context.diffAttrs).length > 0;
  }

  protected _commitPreventedAnimationStaticAttrs(g: IMarkGraphic, attrs: Record<string, any>) {
    if (!attrs || !Object.keys(attrs).length) {
      return;
    }

    const graphic = g as any;
    graphic.setFinalAttributes?.(attrs);

    if (graphic._commitAnimationStaticAttributes) {
      graphic._commitAnimationStaticAttributes(attrs);
    } else {
      graphic.commitInternalBaseAttributes?.(attrs);
    }
  }

  protected _runApplyGraphic(graphics: IMarkGraphic[]) {
    const hasAnimation = this.hasAnimation();

    graphics.forEach((g, index) => {
      const finalAttrs = g.context.finalAttrs;

      const hasStateAnimation = this.hasAnimationByState(g.context.animationState);
      // 新创建的graphic
      if (!(g as any).setAttributes) {
        const mockGraphic = g;
        // TODO：如果要走入场、Enter动画，就不用设置值了，保存到diffAttrs中由入场动画自己去设置，因为入场动画可能会延迟执行，所以首帧不能直接设置属性
        // TODO 太麻烦了，会影响后续bounds等计算逻辑，还是首帧设置吧。。。
        g = this._createGraphic(finalAttrs) as IMarkGraphic;
        g.context = mockGraphic.context;
        g.context.diffAttrs = finalAttrs;
        g.stateSort = this._stateSort;

        const gIndex = this._graphics === graphics ? index : index + this._graphics.length - graphics.length;
        if (gIndex >= 0) {
          this._graphics[gIndex] = g;
        }

        if (this.renderContext?.progressive) {
          const groupIndex = this._dataByGroup ? this._dataByGroup.keys.indexOf(g.context.groupKey) : 0;
          const group = groupIndex >= 0 ? this._product.getChildAt(groupIndex) : null;
          if (group) {
            this._addProgressiveGraphic(group as IGroup, g);
          }
        } else {
          this._product.appendChild(g);
          this._graphicMap.set(g.context.uniqueKey, g);
        }
      } else {
        const diffAttrs = this._excludeStateControlledDiffAttrs(g, getDiffAttributesOfGraphic(g, finalAttrs));
        g.context.diffAttrs = diffAttrs;
        if (g.context.reusing) {
          // 表示正在被复用，需要重设属性的
          // TODO 理论上复用后只会走一次enter，所以这里lastAttrs不需要后续清除，这里需要硬拷贝(通过initAttributes重设属性也行)
          g.context.lastAttrs = g.attribute;
          g.initAttributes(finalAttrs);
          // 为了避免exit一些和enter不一样的属性，所以这里要重置属性
          // const finalAttrs = g.getFinalAttribute();
          // finalAttrs && g.initAttributes({ ...finalAttrs });
          // g.initAttributes(finalAttrs);
          g.context.reusing = false;
        } else if (!hasStateAnimation) {
          // 不是正在被复用的属性，也不需要走动画，那就设置属性
          if (hasAnimation) {
            g.setAttributesAndPreventAnimate(diffAttrs);
            this._commitPreventedAnimationStaticAttrs(g, diffAttrs);
          } else {
            g.setAttributes(diffAttrs);
          }
        }

        // 恢复visible: true时，需要将graphic重新添加到product中
        if (!this.renderContext?.progressive && this._product && g.parent !== this._product) {
          this._product.appendChild(g);
        }
      }

      this._setStateOfGraphic(g, hasStateAnimation);
      this._setGraphicFromMarkConfig(g);
    });
  }

  protected _updateEncoderByState() {
    const encoderOfState: Record<string, Record<string, (datum: Datum) => any>> = {};

    Object.keys(this.stateStyle).forEach(stateName => {
      if (stateName === STATE_VALUE_ENUM.STATE_NORMAL) {
        const { groupStyles, updateStyles } = this._separateNormalStyle(this.stateStyle[stateName]);

        encoderOfState.group = this._getEncoderOfStyle(stateName, groupStyles);
        encoderOfState.update = this._getEncoderOfStyle(stateName, updateStyles);
      } else {
        encoderOfState[stateName] = this._getEncoderOfStyle(stateName, this.stateStyle[stateName]);
      }
    });

    this._encoderOfState = encoderOfState;
  }

  protected _runState(graphics: IMarkGraphic[]) {
    graphics.forEach(g => {
      const prevInteractionStateValues = (g.currentStates ?? []).filter((sv: string) => {
        return !this.state.getStateInfo(sv);
      });
      const newStateValues = [...prevInteractionStateValues, ...this.state.checkState(g, g.context.data)];

      if (this._stateSort && newStateValues.length) {
        newStateValues.sort(this._stateSort);
      }
      // const prevStateValues = g.context.states;
      // const isStateChanged =
      //   newStateValues.length !== prevStateValues.length ||
      //   newStateValues.some((newState: string, index: number) => newState !== prevStateValues[index]);

      g.context.states = newStateValues;
    });
  }

  protected _getAttrsFromConfig(attrs: IGroupGraphicAttribute = {}): IGroupGraphicAttribute {
    const { zIndex, clip, clipPath, overflow } = this._markConfig;

    if (!isNil(zIndex)) {
      attrs.zIndex = zIndex;
    }

    if (!isNil(clip)) {
      attrs.clip = clip;
    }

    if (!isNil(clipPath)) {
      const paths = isArray(clipPath) ? clipPath : clipPath(this._graphics);

      if (paths && paths.length) {
        attrs.path = paths;
      } else {
        attrs.clip = false;
        attrs.path = paths;
      }
    }

    if (!isNil(overflow)) {
      attrs.overflow = overflow;
    }

    return attrs;
  }

  protected _updateAttrsOfGroup() {
    const attrs = this._getAttrsFromConfig();

    this._product?.setAttributes(attrs);

    if (this._markConfig.support3d && this._product) {
      this._product.setMode('3d');
    }
  }

  protected _runBeforeTransform(data: Datum[]) {
    const transforms = this._transform?.filter(transformSpec => {
      if (transformSpec.type) {
        const transform = Factory.getGrammarTransform(transformSpec.type);
        return transform && (!transform.runType || transform.runType === 'beforeJoin');
      }

      return false;
    });

    return this.runTransforms(transforms, data);
  }

  protected _runEncoderTransform(data: Datum[], isProgressive: boolean) {
    const transforms = this._transform?.filter(transformSpec => {
      if (transformSpec.type) {
        const transform = Factory.getGrammarTransform(transformSpec.type);
        return transform && transform.runType === 'afterEncode' && !!transform.canProgressive === isProgressive;
      }

      return false;
    });

    return this.runTransforms(transforms, data);
  }

  renderInner() {
    this._updateEncoderByState();
    this._applySharedStateDefinitions();

    const data = this._data?.getProduct() ?? [{}];

    const transformData = this._runBeforeTransform(data);
    let markData: Datum[];

    if ((transformData as any)?.progressive) {
      this.renderContext = {
        beforeTransformProgressive: (transformData as any).progressive as IProgressiveTransformResult
      };
      const p = (transformData as any).progressive;
      if (p.canAnimate && p.canAnimate() && p.unfinished()) {
        this._updateAttrsOfGroup();
        return;
      }
      markData = p.output();
    } else {
      markData = array(transformData);
      this._runGroupData(markData);
      this.renderContext = this._parseProgressiveContext(markData);
    }

    if (this.renderContext?.progressive) {
      this._graphicMap.clear();
      this._runProgressiveStep();
    } else {
      this._runJoin(markData);
      this._runState(this._graphics);
      this._runEncoder(this._graphics);
      this._runEncoderTransform(this._graphics, false);
      this._runApplyGraphic(this._graphics);
    }

    this._updateAttrsOfGroup();
  }

  render() {
    if (this.isCommited()) {
      if (
        this.getVisible() &&
        (!this._skipBeforeLayouted || this.getCompiler().getLayoutState() !== LayoutState.before)
      ) {
        // A mark may lose its product when visibility toggles to false during compile.
        // Later data/layout updates can make it visible again without triggering compile,
        // so recreate the product lazily before rendering.
        if (!this._product) {
          this._initProduct();
        }
        log(`render mark: ${this.getProductId()}, type is ${this.type}`);
        this.renderInner();
      }

      this.uncommit();
    }
  }

  updateMarkState(key: string): void {
    if (!this._product) {
      return;
    }
    const stateInfo = this.state.getStateInfo(key);

    this._graphics.forEach(g => {
      const reinitStateGraphic = g as ReinitStateGraphic;
      const statesClearedBeforeReInit = reinitStateGraphic[statesClearedBeforeReInitKey];
      const wasStateClearedBeforeReInit = statesClearedBeforeReInit?.includes(key);
      const hasStateAnimation = wasStateClearedBeforeReInit ? false : this.hasAnimationByState('state');

      if (this.state.checkOneState(g, g.context.data, stateInfo) === 'in') {
        addGraphicState(g, key, true, hasStateAnimation);
      } else {
        removeGraphicState(g, key, hasStateAnimation);
      }

      if (wasStateClearedBeforeReInit) {
        const nextStates = statesClearedBeforeReInit.filter(stateName => stateName !== key);
        if (nextStates.length) {
          reinitStateGraphic[statesClearedBeforeReInitKey] = nextStates;
        } else {
          delete reinitStateGraphic[statesClearedBeforeReInitKey];
        }
      }
    });
  }

  clearExitGraphics() {
    this._prevDataByKey = this._dataByKey;

    const doRemove = (g: IMarkGraphic, key: string) => {
      this._graphicMap.delete(key);
      if (g.parent) {
        g.parent.removeChild(g);
      }
      if (g.release) {
        g.release();
      }
    };
    this._graphicMap.forEach((g, key) => {
      if (g.context.diffState !== DiffState.exit || g.isExiting) {
        return;
      }
      // 避免重复执行退场动画
      if (g.context.animationState === DiffState.exit && this.hasAnimationByState('exit')) {
        g.isExiting = true;
        // 执行exit动画
        const animationConfig = this.getAnimationConfig();
        if ((animationConfig as any).exit && (animationConfig as any).exit.length) {
          const exitConfigList = (animationConfig as any).exit.map((item: any, index: number) => ({
            name: `exit_${index}`,
            animation: {
              ...item,
              customParameters: g.context
            }
          }));
          g.applyAnimationState(['exit'], [exitConfigList.length === 1 ? exitConfigList[0] : exitConfigList], () => {
            // 有可能又被复用了，所以这里需要判断，如果还是在 exiting 阶段的话才删除
            if (g.context.diffState === DiffState.exit && g.isExiting && this._graphicMap.get(key) === g) {
              doRemove(g, key);
            }
          });
        }
      } else {
        doRemove(g, key);
      }
    });
  }

  isProgressive() {
    return this.renderContext && (!!this.renderContext.progressive || !!this.renderContext.beforeTransformProgressive);
  }

  canAnimateAfterProgressive() {
    return (
      this.renderContext &&
      this.renderContext.beforeTransformProgressive &&
      this.renderContext.beforeTransformProgressive.canAnimate?.()
    );
  }

  isDoingProgressive() {
    return (
      this.renderContext &&
      ((this.renderContext.progressive &&
        this.renderContext.progressive.currentIndex < this.renderContext.progressive.totalStep) ||
        (this.renderContext.beforeTransformProgressive && this.renderContext.beforeTransformProgressive.unfinished()))
    );
  }

  clearProgressive() {
    if (this.renderContext && this.renderContext.progressive) {
      this._graphics = [];

      (this._product as any).children.forEach((group: IGroup) => {
        group.incrementalClearChild();
      });
      (this._product as any).removeAllChild();
    }

    if (this.renderContext && this.renderContext.beforeTransformProgressive) {
      this.renderContext.beforeTransformProgressive.release();
    }

    this.renderContext = null;
  }

  restartProgressive() {
    if (this.renderContext && this.renderContext.progressive) {
      this.renderContext.progressive.currentIndex = 0;
    }
  }
  private _runBeforeProgressive() {
    const transform = this.renderContext.beforeTransformProgressive;

    transform.progressiveRun();
    const output = transform.output();

    if (transform.canAnimate?.()) {
      if (transform.unfinished()) {
        return;
      }

      this._runGroupData(output);
      this._runJoin(output);
      this._runState(this._graphics);
      this._runEncoder(this._graphics);
      this._runApplyGraphic(this._graphics);
    }
  }

  protected _runProgressiveJoin(): {
    graphicsByGroup?: Record<string, IMarkGraphic[]>;
    graphics?: IMarkGraphic[];
    needUpdate?: boolean;
  } {
    const currentIndex = this.renderContext.progressive.currentIndex;

    const graphics: IMarkGraphic[] = [];
    const graphicsByGroup: Record<string, IMarkGraphic[]> = {};
    this._dataByGroup.keys.forEach(groupKey => {
      const data = this.renderContext.progressive.groupedData.get(groupKey as string);
      const groupStep = this.renderContext.progressive.step;
      const dataSlice = data.slice(currentIndex * groupStep, (currentIndex + 1) * groupStep);
      const group: IMarkGraphic[] = [];

      dataSlice.forEach((entry, i) => {
        const key = this._keyGetter(entry);
        const g = {
          context: {
            ...this._getCommonContext(),
            diffState: DiffState.enter,
            data: [entry],
            uniqueKey: `${groupKey}_${key ?? currentIndex * groupStep + i}`,
            key,
            groupKey: groupKey
          }
        };

        group.push(g as IMarkGraphic);
        graphics.push(g as IMarkGraphic);
      });

      graphicsByGroup[groupKey as string] = group;
    });

    return { graphicsByGroup, graphics, needUpdate: true };
  }

  protected _createIncrementalGraphics() {
    this._product.removeAllChild();

    this._dataByGroup.keys.forEach(key => {
      const graphicItem = createGroup({
        pickable: false,
        zIndex: this._markConfig.zIndex
      });
      graphicItem.incremental = this.renderContext.progressive.step;
      this._product.appendChild(graphicItem);
    });
  }

  protected _setCommonAttributesToTheme(g: IMarkGraphic) {
    if (this._attrsByGroup && g) {
      const parent = g.parent;

      if (parent && this._attrsByGroup?.[g.context?.groupKey]) {
        parent.setTheme({
          common: this._attrsByGroup[g.context?.groupKey] as any
        });
      }
    }
  }

  protected _runProgressiveEncoder(graphics: IMarkGraphic[]) {
    const progressiveIndex = this.renderContext.progressive.currentIndex;

    if (progressiveIndex === 0) {
      this._runEncoder(graphics);
    } else {
      this._runEncoder(graphics, true);
    }
  }

  protected _runProgressiveApplyGraphic(graphics: IMarkGraphic[]) {
    const progressiveIndex = this.renderContext.progressive.currentIndex;

    if (progressiveIndex === 0) {
      this._runApplyGraphic(graphics);
      this._setCommonAttributesToTheme(graphics[0]);
    } else {
      this._runApplyGraphic(graphics);
    }
  }

  protected _runProgressiveStep() {
    const { graphics, graphicsByGroup, needUpdate } = this._runProgressiveJoin();

    if (this.renderContext.progressive.currentIndex === 0) {
      this._createIncrementalGraphics();
      this._graphics = graphics;
    } else if (needUpdate) {
      graphics.forEach(g => {
        this._graphics.push(g);
      });
    }
    this._runState(graphics);

    Object.keys(graphicsByGroup).forEach(groupKey => {
      this._runProgressiveEncoder(graphicsByGroup[groupKey]);
    });
    this._runEncoderTransform(this._graphics, true);

    Object.keys(graphicsByGroup).forEach(groupKey => {
      this._runProgressiveApplyGraphic(graphicsByGroup[groupKey]);
    });

    this.renderContext.progressive.currentIndex += 1;
  }

  renderProgressive() {
    if (this.renderContext?.beforeTransformProgressive) {
      this._runBeforeProgressive();
      return;
    } else if (this.renderContext.progressive) {
      this._runProgressiveStep();
    }
  }

  hasAnimationByState(state: AnimationStateValues) {
    if (
      !state ||
      !this._animationConfig ||
      !(this._animationConfig as any)[state] ||
      this._disabledAnimationStates.includes(state)
    ) {
      return false;
    }
    const stateAnimationConfig = (this._animationConfig as any)[state];
    return (stateAnimationConfig as IAnimationConfig[]).length > 0 || isObject(stateAnimationConfig);
  }

  hasAnimation() {
    if (!this._animationConfig) {
      return false;
    }
    return Object.keys(this._animationConfig).length > 0;
  }

  runAnimation() {
    this._runStateAnimation(this.getGraphics());
  }

  clearBeforeReInit() {
    this.state.clearAllStateInfo();
    this.uncommit();
    this.stateStyle = {};
    this.getGraphics().forEach(g => {
      if (g.currentStates?.length) {
        (g as ReinitStateGraphic)[statesClearedBeforeReInitKey] = g.currentStates.slice();
      }
    });
  }
}
