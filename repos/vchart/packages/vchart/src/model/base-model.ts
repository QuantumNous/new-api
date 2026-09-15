import { createID } from '../util/id';
import { Event } from '../event/event';
import type { IEvent } from '../event/interface';
import type {
  IEffect,
  IModel,
  IModelInitOption,
  IModelOption,
  IModelEvaluateOption,
  IModelSpec,
  IModelMarkInfo,
  IModelSpecInfo,
  IUpdateSpecResult
} from './interface';
import type { CoordinateType } from '../typings/coordinate';
import type {
  AnimationStateValues,
  ICompileMarkConfig,
  IMark,
  IMarkGraphic,
  IMarkOption,
  IMarkRaw,
  IMarkStyle
} from '../mark/interface';
import type {
  Datum,
  StateValueType,
  ConvertToMarkStyleSpec,
  ICommonSpec,
  StringOrNumber,
  IRect,
  ILayoutRect
} from '../typings';
import { isValid } from '@visactor/vutils';
import { Factory } from '../core/factory';
import { MarkSet } from '../mark/mark-set';
import type { ILayoutItem } from '../layout/interface';
import { CompilableBase } from '../compile/compilable-base';
import { PREFIX } from '../constant/base';
import { BaseModelSpecTransformer } from './base-model-transformer';
import { getProperty } from '@visactor/vutils-extension';
import type { IGroup } from '@visactor/vrender-core';
import type { ICompilableData } from '../compile/data/interface';

export abstract class BaseModel<T extends IModelSpec> extends CompilableBase implements IModel {
  readonly transformerConstructor = BaseModelSpecTransformer;

  protected _spec: T;
  getSpec(): T {
    return this._spec || ({} as T);
  }

  /** 获取当前 model 对应在图表 spec 上的路径 */
  getSpecPath() {
    return this._option?.specPath;
  }

  /** 获取当前 model 对应在图表 specInfo 上的路径 */
  getSpecInfoPath() {
    return this._option?.specInfoPath ?? this._option?.specPath;
  }

  readonly type: string = 'null';
  readonly modelType: string = 'null';

  readonly id;

  userId: StringOrNumber | undefined = undefined;

  // 事件
  readonly event: IEvent;

  // 副作用
  readonly effect: IEffect;

  // 数据
  protected _data: ICompilableData = null;
  getData() {
    return this._data;
  }

  // 布局
  protected _layout?: ILayoutItem = null;
  get layout() {
    return this._layout;
  }

  readonly specKey: string = '';

  protected declare _option: IModelOption;
  getOption() {
    return this._option;
  }

  protected _marks: MarkSet = new MarkSet();
  getMarks(): IMark[] {
    return this._marks?.getMarks() ?? [];
  }
  getMarkNameMap() {
    return this._marks?.getMarkNameMap();
  }
  getMarkSet() {
    return this._marks;
  }

  getChart() {
    return this._option.getChart();
  }

  protected get _theme() {
    return this.getSpecInfo()?.theme;
  }

  /** for layout diff */
  protected _lastLayoutRect: ILayoutRect = null;

  constructor(spec: T, option: IModelOption) {
    super(option);
    this.id = createID();
    this.userId = spec.id;
    this._spec = spec;
    this.effect = {};
    this.event = new Event(option.eventDispatcher, option.mode);
    option.map?.set(this.id, this);
  }
  coordinate?: CoordinateType;

  protected _releaseEvent() {
    this.event.release();
  }

  created() {
    this.setAttrFromSpec();
  }

  init(option: IModelInitOption) {
    // do nothing
  }

  afterInit() {
    // do nothing
  }

  getVisible() {
    return (this._spec as unknown as any)?.visible !== false;
  }

  onLayoutStart(layoutRect: IRect, viewRect: ILayoutRect): void {
    // do nothing
    this._layout?.onLayoutStart(layoutRect, viewRect);
  }
  onLayoutEnd(): void {
    this._layout?.onLayoutEnd();
    this.getMarks().forEach(m => m.commit(false, true));
  }

  onEvaluateEnd(ctx: IModelEvaluateOption) {
    // do nothing
  }

  onBeforeRender() {
    // do nothing
  }

  onDataUpdate() {
    // do nothing
  }

  beforeRelease() {
    // do nothing
  }

  clear() {
    this.getMarks().forEach(m => m.clear?.());
  }

  release() {
    this._releaseEvent();
    this._spec = undefined;
    this.getMarks().forEach(m => m.release());
    this._data?.release();
    this._data = null;
    this._marks.clear();
    super.release();
  }

  updateSpec(spec: T) {
    const result = this._compareSpec(spec, this._spec);
    // 如果发现需要改变
    if (result.reRender || result.reMake || result.reCompile) {
      this._layout?.setWillLayoutTag();
    }
    this._spec = spec;

    return result;
  }

  protected _compareSpec(spec: T, prevSpec: T): IUpdateSpecResult {
    const result: IUpdateSpecResult = {
      change: false,
      reMake: false,
      reRender: false,
      reSize: false,
      reCompile: false
    };
    return result;
  }

  reInit(spec?: T) {
    if (spec) {
      this._spec = spec;
    }
    this.setAttrFromSpec();
  }

  updateLayoutAttribute() {
    // do nothing
  }

  setAttrFromSpec() {
    this._layout?.setAttrFromSpec(this._spec, this._option.getChartViewRect());
  }

  /** mark style 内部转换逻辑，override 使用 */
  protected _convertMarkStyle<T extends ICommonSpec = ICommonSpec>(
    style: Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>>
  ): Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>> {
    return { ...style };
  }

  setMarkStyle<T extends ICommonSpec>(
    mark: IMarkRaw<T>,
    style?: Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>>,
    state?: StateValueType,
    level?: number
  ) {
    if (!isValid(mark) || !isValid(style)) {
      return;
    }
    mark.setStyle(this._convertMarkStyle(style), state, level);
  }

  initMarkStyleWithSpec(mark?: IMark, spec?: any) {
    if (!isValid(mark) || !isValid(spec)) {
      return;
    }
    const { style, state } = spec;
    const newSpec = { ...spec };

    if (style) {
      newSpec.style = this._convertMarkStyle(style);
    }
    if (state) {
      newSpec.state = {};
      Object.keys(state).forEach(key => {
        newSpec.state[key] = this._convertMarkStyle(state[key]);
      });
    }
    mark.initStyleWithSpec(newSpec);
  }

  protected stateKeyToSignalName(key: string, opt?: string) {
    let name = `${PREFIX}_${this.modelType}_${this.type}_${this.id}_${key}`;
    opt && (name += `_${opt}`);
    return name;
  }

  compileData() {
    this._data?.compile();
  }

  compileMarks(group?: IGroup) {
    this.getMarks().forEach(m => {
      m.compile({ group });
    });
  }

  protected _createMark<T extends IMark>(
    markInfo: IModelMarkInfo,
    option: Partial<IMarkOption> = {},
    config?: ICompileMarkConfig
  ): T {
    const { type, name } = markInfo;
    const { parent, ...others } = option;
    const m = Factory.createMark(type as any, name, {
      model: this,
      map: this._option.map,
      getCompiler: this.getCompiler,
      globalScale: this._option.globalScale,
      ...others
    }) as T;

    if (parent) {
      parent.addMark(m);
    } else {
      this.getCompiler().addRootMark(m);
    }

    if (m) {
      m.created();
      config && m.setMarkConfig(config);
    }
    return m;
  }

  /**
   * 数据唯一ID
   * 根据自身动画数据匹配需求设置返回值。
   * 默认返回 undefined 时，根据 VGrammar 默认数据 ID 进行索引和匹配。
   */
  protected _getDataIdKey(): string | ((datum: Datum) => string) | undefined {
    return undefined;
  }

  getColorScheme() {
    return this._option.getTheme?.('colorScheme');
  }

  getSpecInfo() {
    const specInfo = this._option.getSpecInfo?.() ?? {};
    return getProperty<IModelSpecInfo>(specInfo, this.getSpecInfoPath());
  }

  getSpecIndex() {
    const path = this.getSpecPath();
    if (!path?.length) {
      return 0;
    }
    const index = Number(path[path.length - 1]);
    if (isNaN(index)) {
      return 0;
    }
    return index;
  }

  private _aniamtionStateCallback: (graphic: IMarkGraphic) => AnimationStateValues;

  updateAnimateStateCallback(callback: (graphic: IMarkGraphic) => AnimationStateValues) {
    this._aniamtionStateCallback = callback;
  }

  getAnimationStateCallback() {
    return this._aniamtionStateCallback;
  }
}
