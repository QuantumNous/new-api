import type { IRegionConstructor } from '../../region/interface';
import { ChartData } from '../chart-meta/data';
import type { ICrossHair } from '../../component/crosshair/interface/spec';
import type { IDimensionInfo } from '../../event/events/dimension/interface';
import type {
  Datum,
  IMarkStateSpec,
  IVisual,
  IVisualSpecScale,
  IRegionQuerier,
  MaybeArray,
  IPadding,
  IRect,
  StringOrNumber,
  IChartSpec,
  IDataValues,
  ILayoutRect,
  ILayoutOrientPadding
} from '../../typings';
import type { ILayoutItem, LayoutCallBack } from '../../layout/interface';
import { GlobalScale } from '../../scale/global-scale';
import type { ILayoutModelState, IModel, IModelOption, IModelSpecInfo, IUpdateSpecResult } from '../../model/interface';
import type {
  IChart,
  IChartOption,
  IChartEvaluateOption,
  DimensionIndexOption,
  IChartSpecTransformerOption,
  IChartSpecTransformer
} from '../interface';
import type { ICartesianSeries, ISeries, ISeriesConstructor } from '../../series/interface';
// eslint-disable-next-line no-duplicate-imports
import type { IRegion } from '../../region/interface';
import { ComponentTypeEnum } from '../../component/interface';
// eslint-disable-next-line no-duplicate-imports
import type { IComponent, IComponentConstructor } from '../../component/interface';
import type { IMark, IMarkGraphic, IRectMark } from '../../mark/interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from '../../mark/interface';
import type { IEvent } from '../../event/interface';
import type { DataView } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import type { DataSet } from '@visactor/vdataset';
import { Factory } from '../../core/factory';
import { Event } from '../../event/event';
import {
  isArray,
  isValid,
  createID,
  calcPadding,
  normalizeLayoutPaddingSpec,
  array,
  isCollectionMark,
  getDatumOfGraphic
} from '../../util';
import { BaseModel } from '../../model/base-model';
import { BaseMark } from '../../mark/base/base-mark';
import { DEFAULT_CHART_WIDTH, DEFAULT_CHART_HEIGHT } from '../../constant/base';
// eslint-disable-next-line no-duplicate-imports
import type { IParserOptions } from '@visactor/vdataset';
import type { IBoundsLike, Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isFunction, isEmpty, isNil, isString, isEqual, pickWithout } from '@visactor/vutils';
import { getDataScheme } from '../../theme/color-scheme/util';
import { CompilableBase } from '../../compile/compilable-base';
import type { IStateInfo } from '../../compile/mark/interface';
// eslint-disable-next-line no-duplicate-imports
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { ChartEvent, HOOK_EVENT } from '../../constant/event';
import type { IGlobalScale } from '../../scale/interface';
import { DimensionEventEnum } from '../../event/events/dimension/interface';
import type { ITooltip } from '../../component/tooltip/interface';
import {
  calculateChartSize,
  isUpdateSpecResultComponentOnly,
  isUpdateSpecResultLocalOnly,
  mergeUpdateResult
} from '../util';
import { isDiscrete } from '@visactor/vscale';
import { updateDataViewInData } from '../../data/initialize';
import { LayoutZIndex } from '../../constant/layout';
import type { IAxis } from '../../component/axis/interface/common';
import type { IMorphConfig } from '../../animation/spec';
import { Interaction } from '../../interaction/interaction';
import type { IInteraction } from '../../interaction/interface/common';
import type { IBaseTriggerOptions } from '../../interaction/interface/trigger';
import { animationConfig, userAnimationConfig } from '../../animation/utils';

const MARKER_COMPONENT_SPEC_KEYS: Record<string, boolean> = {
  [ComponentTypeEnum.markPoint]: true,
  [ComponentTypeEnum.markLine]: true,
  [ComponentTypeEnum.markArea]: true
};

const MARKER_ADDITION_REMAKE_SPEC_KEYS: Record<string, boolean> = {
  regionId: true,
  regionIndex: true,
  seriesId: true,
  seriesIndex: true,
  specifiedDataSeriesId: true,
  specifiedDataSeriesIndex: true
};

export class BaseChart<T extends IChartSpec> extends CompilableBase implements IChart {
  readonly type: string = 'chart';
  readonly seriesType: string;
  readonly transformerConstructor: new (option: IChartSpecTransformerOption) => IChartSpecTransformer;
  readonly id: number = createID();

  //FIXME: 转换后的 spec 需要声明 ITransformedChartSpec
  protected _spec: T;
  getSpec() {
    return this._spec;
  }
  setSpec(s: T) {
    // TODO 通过spec设置进行图表更新
    this._spec = s;
  }

  getOption() {
    return this._option;
  }

  protected _regions: IRegion[] = [];
  // 系列
  protected _series: ISeries[] = [];
  // 组件
  protected _components: IComponent[] = [];
  protected _specTransformer: Maybe<IChartSpecTransformer> = null;

  // 布局
  protected _layoutFunc: LayoutCallBack;
  protected _layoutRect: IRect = {
    x: 0,
    y: 0,
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT
  };
  getLayoutRect() {
    return this._layoutRect;
  }
  protected _viewRect: ILayoutRect = {
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT
  };
  getViewRect() {
    return this._viewRect;
  }
  protected _viewBox: IBoundsLike = {
    x1: 0,
    y1: 0,
    x2: DEFAULT_CHART_WIDTH,
    y2: DEFAULT_CHART_HEIGHT
  };

  protected _layoutTag: boolean = true;
  getLayoutTag() {
    return this._layoutTag;
  }
  setLayoutTag(tag: boolean, morphConfig?: IMorphConfig, renderNextTick: boolean = true): boolean {
    this._layoutTag = tag;
    const compiler = this.getCompiler();

    if (compiler) {
      compiler.updateLayoutTag();
      tag && renderNextTick && compiler.renderNextTick(morphConfig);
    }
    return this._layoutTag;
  }

  resetLayoutItemTag() {
    this.getLayoutElements().forEach(element => element.setWillLayoutTag());
  }

  // 模块参数
  protected _modelOption: IModelOption;

  getModelOption() {
    return this._modelOption;
  }

  // 全局通道
  // protected _globalScale: { [key: string]: IBaseScale } = {};
  protected _globalScale: IGlobalScale;

  getGlobalScale() {
    return this._globalScale;
  }

  // mark & model 的 id 映射
  protected _idMap: Map<number, IModel | IMark> = new Map();

  protected _event: IEvent;
  getEvent() {
    return this._event;
  }

  // data
  protected _dataSet: DataSet;
  protected _chartData: ChartData;
  get chartData() {
    return this._chartData;
  }

  protected declare _option: IChartOption;

  // 模块内的需要动态影像图表的属性
  readonly state: ILayoutModelState = {
    layoutUpdateRank: 1
  };

  // stack

  padding: IPadding = { top: 0, left: 0, right: 0, bottom: 0 };
  protected _paddingSpec: ILayoutOrientPadding;

  protected _canvasRect: ILayoutRect;

  // background
  protected _backgroundMark: IRectMark;

  protected _interaction: IInteraction;

  protected _setModelOption(): void {
    // implement in subclass
  }

  constructor(spec: T, option: IChartOption) {
    super(option);
    this._paddingSpec = normalizeLayoutPaddingSpec(spec.padding ?? option.getTheme('padding'));

    this._event = new Event(option.eventDispatcher, option.mode);
    this._dataSet = option.dataSet;
    this._chartData = new ChartData(this._dataSet);
    this._modelOption = {
      ...option,
      mode: this._option.mode,
      map: this._idMap,
      getChartLayoutRect: () => this._layoutRect,
      getChartViewRect: () => this._viewRect,
      getChart: () => this,
      globalScale: this._globalScale,
      onError: this._option?.onError,
      disableTriggerEvent: this._option?.disableTriggerEvent === true,
      componentShowContent: this._option?.componentShowContent,
      getSeriesData: this._chartData.getSeriesData.bind(this._chartData),
      // @ts-ignore
      dispatchEvent: (eType, params) => this._option.globalInstance.event.emit(eType, params)
    };

    if ((this as any)._setModelOption) {
      (this as any)._setModelOption();
    }

    this._spec = spec;
  }

  created(transformer: Maybe<IChartSpecTransformer>) {
    this._specTransformer = transformer;
    // data
    this._chartData.parseData(this._spec.data);
    // scale
    this._createGlobalScale();
    // background
    this._createBackground();
    // 基础内容
    this._createLayout();
    // 基于spec 创建元素。
    // region
    transformer.forEachRegionInSpec(this._spec, this._createRegion.bind(this));
    // series
    transformer.forEachSeriesInSpec(this._spec, this._createSeries.bind(this));
    // components
    transformer.forEachComponentInSpec(this._spec, this._createComponent.bind(this), this._option.getSpecInfo());
  }
  _initInteractions() {
    if (this._option.disableTriggerEvent) {
      return;
    }

    // 创建交互
    this._interaction = new Interaction();

    const series = this.getAllSeries();
    const mergedTriggers: Partial<IBaseTriggerOptions>[] = [];
    const groupedTriggers: Array<{
      regionId: number;
      config: Partial<IBaseTriggerOptions>;
      trigger: Partial<IBaseTriggerOptions>;
    }> = [];

    series.forEach(s => {
      const triggers = s.getInteractionTriggers();

      if (triggers && triggers.length) {
        const regionId = s.getRegion().id;

        triggers.forEach(({ trigger, marks }) => {
          const sameTrigger = groupedTriggers.find(item => item.regionId === regionId && isEqual(item.config, trigger));

          if (sameTrigger) {
            sameTrigger.trigger.marks.push(...marks);
          } else {
            const mergedTrigger = { ...trigger, marks: [...marks] };

            groupedTriggers.push({
              regionId,
              config: { ...trigger },
              trigger: mergedTrigger
            });
            mergedTriggers.push(mergedTrigger);
          }
        });
      }
    });

    mergedTriggers.forEach(trigger => {
      const triggerInstance = Factory.createInteractionTrigger((trigger as any).type, {
        ...trigger,
        event: this._event,
        interaction: this._interaction
      });

      if (triggerInstance) {
        triggerInstance.init();
        this._interaction.addTrigger(triggerInstance);
      }
    });
  }

  init() {
    (this as any)._beforeInit?.();
    // 元素创建完毕后再执行各元素的初始化 方便各元素能获取到其他模块
    this._regions.forEach(r => r.init({}));
    this._series.forEach(s => s.init({}));
    this._components.forEach(c => c.init({ dataSet: this._dataSet }));

    // event
    this._initEvent();

    (this as any)._initStack?.();

    // data flow start
    this.reDataFlow();

    this._initInteractions();

    this.initStageAnimation();
  }

  initStageAnimation() {
    const compiler = this._option.getCompiler();
    if (!compiler?.setStageAnimationConfig) {
      return;
    }
    compiler.setStageAnimationConfig(
      animationConfig(
        {}, // Factory.getAnimationInKey('stage')?.({}, null),
        userAnimationConfig('stage', this._spec as any, {}),
        null
      )
    );
  }

  reDataFlow() {
    this._series.forEach(s => s.getRawData()?.markRunning());
    this._series.forEach(s => s.fillData());
    this.updateGlobalScaleDomain();
  }

  onResize(width: number, height: number, reRender: boolean = true): void {
    const canvasRect = {
      width,
      height
    };
    this._canvasRect = canvasRect;
    this._updateLayoutRect(this._option.viewBox);
    this.resetLayoutItemTag();
    this.setLayoutTag(true, null, reRender);
  }

  updateViewBox(viewBox: IBoundsLike, reLayout: boolean) {
    this._option.viewBox = viewBox;
    this._updateLayoutRect(viewBox);
    this.resetLayoutItemTag();
    this.setLayoutTag(true, null, reLayout);
  }

  private _createBackground() {
    const bg = this._spec.background;
    if (!bg || typeof bg !== 'object' || isValid(bg.gradient)) {
      return;
    }
    const backgroundStyle = pickWithout(bg, ['x', 'y', 'width', 'height', 'x1', 'y1', 'image']);
    (backgroundStyle as any).background = (bg as any).image;

    this._backgroundMark = Factory.createMark(MarkTypeEnum.group, 'chart-background', {
      model: this as any,
      map: this._option.map,
      getCompiler: this.getCompiler,
      globalScale: this._globalScale
    }) as IRectMark;
    this._backgroundMark.created();
    this._backgroundMark.setStyle({
      ...backgroundStyle,
      x: () => this._viewBox.x1,
      y: () => this._viewBox.y1,
      width: () => this._viewBox.x2 - this._viewBox.x1,
      height: () => this._viewBox.y2 - this._viewBox.y1
    });
    this._backgroundMark.setMarkConfig({
      zIndex: LayoutZIndex.SeriesGroup - 2
    });

    this.getCompiler().addRootMark(this._backgroundMark);
  }

  protected _createRegion(constructor: IRegionConstructor, specInfo: IModelSpecInfo) {
    if (!constructor) {
      return;
    }

    const { spec, ...others } = specInfo;
    const region = new constructor(spec, {
      ...this._modelOption,
      ...others
    });
    if (region) {
      region.created();
      this._regions.push(region);
    }
  }

  protected _createSeries(constructor: ISeriesConstructor, specInfo: IModelSpecInfo) {
    if (!constructor) {
      return;
    }

    const { spec, ...others } = specInfo;

    let region: IRegion | undefined;
    if (isValid(spec.regionId)) {
      region = this.getRegionsInUserId(spec.regionId);
    } else if (isValid(spec.regionIndex)) {
      region = this.getRegionsInIndex([spec.regionIndex])[0];
    }

    if (!region && !(region = this._regions[0])) {
      return;
    }

    const series = new constructor(spec, {
      ...this._modelOption,
      ...others,
      type: spec.type,
      region,
      globalScale: this._globalScale,
      sourceDataList: this._chartData.dataList
    });

    if (series) {
      series.created();
      this._series.push(series);
      region.addSeries(series);
    }
  }

  getAllSeries = (): ISeries[] => {
    return this._series ?? [];
  };

  getSeriesById(id: number): ISeries | undefined {
    return this._series.find(x => x.id === id);
  }

  protected _createComponent(constructor: IComponentConstructor, specInfo: IModelSpecInfo) {
    const component = constructor.createComponent(specInfo, {
      ...this._modelOption,
      type: constructor.type,
      getAllRegions: this.getAllRegions,
      getRegionsInIndex: this.getRegionsInIndex,
      getRegionsInIds: this.getRegionsInIds,
      getRegionsInUserIdOrIndex: this.getRegionsInUserIdOrIndex,
      getAllSeries: this.getAllSeries,
      getSeriesInIndex: this.getSeriesInIndex,
      getSeriesInIds: this.getSeriesInIds,
      getSeriesInUserIdOrIndex: this.getSeriesInUserIdOrIndex,
      getAllComponents: this.getComponents,
      getComponentByIndex: this.getComponentByIndex,
      getComponentByUserId: this.getComponentByUserId,
      getComponentsByKey: this.getComponentsByKey,
      getComponentsByType: this.getComponentsByType
    });
    if (!component) {
      return;
    }
    component.created();
    this._components.push(component);
  }

  getAllComponents(): IComponent[] {
    return this._components;
  }

  getAllModels(): IModel[] {
    return [].concat(this.getAllSeries(), this.getAllComponents(), this.getAllRegions());
  }

  getModelInFilter(filter: string | { type: string; index: number } | ((model: IModel) => boolean)) {
    if (isString(filter)) {
      return this.getAllModels().find(m => m.userId === filter);
    } else if (isFunction(filter)) {
      return this.getAllModels().find(m => filter(m));
    }
    let index = 0;
    return this.getAllModels().find(m => {
      if ((m.specKey ?? m.type) === filter.type) {
        if (index === filter.index) {
          return true;
        }
        index++;
      }
      return false;
    });
  }

  private _createLayout() {
    this._updateLayoutRect(this._option.viewBox);
    this._initLayoutFunc();
  }

  setLayout(layout: LayoutCallBack) {
    // 统一自定义 layout 到 option 中
    this._option.layout = layout;
    this._initLayoutFunc();
  }

  /** 可以通过设置 layout = null 来取消自定义布局。启用spec上的布局配置 */
  private _initLayoutFunc() {
    this._layoutFunc = this._option.layout;
    if (!this._layoutFunc) {
      const constructor = Factory.getLayoutInKey(this._spec.layout?.type ?? 'base');
      if (constructor) {
        const layout = new constructor(this._spec.layout, {
          onError: this._option?.onError
        });
        this._layoutFunc = layout.layoutItems.bind(layout);
      }
    }
  }

  layout(): void {
    this._option.performanceHook?.beforeLayoutWithSceneGraph?.(this._option.globalInstance);
    if (this.getLayoutTag()) {
      this._event.emit(ChartEvent.layoutStart, { chart: this, vchart: this._option.globalInstance });

      this.onLayoutStart();
      const elements = this.getLayoutElements();
      this._layoutFunc(this, elements, this._layoutRect, this._viewBox);
      this._event.emit(ChartEvent.afterLayout, { elements, chart: this });
      this.setLayoutTag(false);
      this.onLayoutEnd();

      this._event.emit(ChartEvent.layoutEnd, { chart: this, vchart: this._option.globalInstance });
    }
    this._option.performanceHook?.afterLayoutWithSceneGraph?.(this._option.globalInstance);
  }

  // 通知所有需要通知的元素 onLayout 钩子
  onLayoutStart() {
    const elements = this.getAllModels();
    elements.forEach(element => element.onLayoutStart(this._layoutRect, this._viewRect));
  }

  // 通知所有需要通知的元素 onLayoutEnd 钩子
  onLayoutEnd() {
    const elements = this.getAllModels();
    elements.forEach(element => {
      // series.onLayoutEnd will be called by region model
      if (element.modelType !== 'series') {
        element.onLayoutEnd();
      }
    });
  }

  onEvaluateEnd(option: IChartEvaluateOption) {
    const elements = [...this._components, ...this._regions, ...this._series];
    elements.forEach(element => element.onEvaluateEnd(option));
  }

  onBeforeRender() {
    const elements = [...this._components, ...this._regions, ...this._series];
    elements.forEach(element => element.onBeforeRender());
  }

  getLayoutElements(): ILayoutItem[] {
    return this.getAllModels()
      .map(i => i.layout)
      .filter(i => !!i);
  }

  // 区域
  getRegionsInIndex = (index?: number[]): IRegion[] => {
    if (!index || index.length === 0) {
      return [this._regions[0]];
    }
    return this._regions.filter((_r, i) => index.includes(i));
  };

  getAllRegions = () => {
    return this._regions;
  };

  getRegionsInIds = (ids: number[]): IRegion[] => {
    if (!ids) {
      return [];
    }
    return this._regions.filter(r => ids.includes(r.id));
  };

  getRegionsInQuerier = (region?: MaybeArray<IRegionQuerier>) => {
    if (region) {
      return this._regions.filter((r, index) => {
        return array(region).some(
          regionFilter =>
            (isValid(regionFilter.regionId) && regionFilter.regionId === r.userId) || regionFilter.regionIndex === index
        );
      });
    }
    return this._regions;
  };

  getRegionsInUserId = (userId: StringOrNumber): IRegion | undefined => {
    if (!userId) {
      return undefined;
    }
    return this._regions.find(r => r.userId === userId);
  };

  getRegionsInUserIdOrIndex = (user_ids?: StringOrNumber[], index?: number[]): IRegion[] => {
    const regions = this.getAllRegions();
    return regions.filter(r => {
      if (user_ids?.length) {
        return r.userId && user_ids.includes(r.userId);
      } else if (index?.length) {
        return index.includes(r.getSpecIndex());
      }
      return true;
    });
  };

  // 模块
  getComponents = () => {
    return this._components;
  };

  // 区域
  getSeriesInIndex = (index?: number[]): ISeries[] => {
    if (!index || index.length === 0) {
      return [this._series[0]];
    }
    return this._series.filter((_r, i) => index.includes(i));
  };

  getSeriesInIds = (ids?: number[]): ISeries[] => {
    if (!ids) {
      return [];
    }
    return this._series.filter(r => ids.includes(r.id));
  };

  getSeriesInUserId = (userId: StringOrNumber): ISeries | undefined => {
    if (!userId) {
      return undefined;
    }
    return this._series.find(r => r.userId === userId);
  };

  getSeriesInUserIdOrIndex = (user_ids?: StringOrNumber[], index?: number[]): ISeries[] => {
    const series = this.getAllSeries();
    return series.filter(s => {
      if (user_ids?.length) {
        return s.userId && user_ids.includes(s.userId);
      } else if (index?.length) {
        return index.includes(s.getSpecIndex());
      }
      return true;
    });
  };

  getComponentByIndex = (key: string, index: number) => {
    const components = this._components.filter(c => (c.specKey || c.type) === key);
    if (!components || components.length === 0) {
      return undefined;
    }
    return components[index];
  };

  getComponentsByKey = (key: string) => {
    return this._components.filter(c => (c.specKey || c.type) === key);
  };

  getComponentByUserId = (userId: StringOrNumber) => {
    const component = this._components.find(s => s.userId === userId);
    if (component) {
      return component;
    }
    return undefined;
  };

  getComponentsByType = (type: string) => {
    return this._components.filter(c => c.type === type);
  };

  getModelById(id: number): IModel | undefined {
    const model = this._idMap.get(id);
    if (model && model instanceof BaseModel) {
      return model;
    }
    return undefined;
  }

  getModelByUserId(userId: StringOrNumber): IModel | undefined {
    // TODO: 考虑通过 map 结构优化获取方式 & 补充所有 model 的寻找方法
    const series = this.getSeriesInUserId(userId);
    if (series) {
      return series;
    }
    const region = this.getRegionsInUserId(userId);
    if (region) {
      return region;
    }
    const component = this.getComponentByUserId(userId);
    if (component) {
      return component;
    }
    return undefined;
  }

  getAllMarks(): IMark[] {
    const items = Array.from(this._idMap.values());
    return items.filter(item => item && item instanceof BaseMark) as IMark[];
  }

  getMarkById(id: number): IMark | undefined {
    const mark = this._idMap.get(id);
    if (mark && mark instanceof BaseMark) {
      return mark as IMark;
    }
    return undefined;
  }

  getMarkByUserName(name: string): IMark[] {
    return this.getAllMarks().filter(m => m.name && m.name === name);
  }

  updateData(id: StringOrNumber, data: unknown, updateGlobalScale: boolean = true, options?: IParserOptions) {
    const dv = this._dataSet.getDataView(id as string);
    if (dv) {
      dv.markRunning();
      dv.parseNewData(data, options);
    }

    if (updateGlobalScale) {
      this.updateGlobalScaleDomain();
    }
    this.getAllModels().forEach(model => model.onDataUpdate());
  }

  updateFullData(data: IDataValues | IDataValues[], updateGlobalScale: boolean = true) {
    array(data).forEach(d => {
      const dv = this._dataSet.getDataView(d.id);
      if (dv) {
        dv.markRunning();
      }
    });
    array(data).forEach(d => {
      const dv = this._dataSet.getDataView(d.id);
      if (dv) {
        updateDataViewInData(dv, d, true);
      }
    });
    if (updateGlobalScale) {
      this.updateGlobalScaleDomain();
    }
    this.getAllModels().forEach(model => model.onDataUpdate());
  }

  setCanvasRect(width: number, height: number) {
    this._canvasRect = { width, height };
  }

  getCanvasRect(): Omit<IRect, 'x' | 'y'> {
    if (this._canvasRect) {
      return this._canvasRect;
    }

    this._canvasRect = calculateChartSize(this._spec, this._option, {
      width: DEFAULT_CHART_WIDTH,
      height: DEFAULT_CHART_HEIGHT
    });

    return this._canvasRect;
  }

  getSeriesData(id: StringOrNumber | undefined, index: number | undefined): DataView | undefined {
    return this._chartData.getSeriesData(id, index);
  }

  private _transformSpecScale() {
    const scales: IChartSpec['scales'] = this._spec.scales ? [...this._spec.scales] : [];
    let colorScaleSpec: IVisualSpecScale<any, any> = scales.find(s => s.id === 'color');
    const colorScheme = this.getColorScheme();
    if (!colorScaleSpec) {
      colorScaleSpec = {
        type: 'ordinal',
        id: 'color',
        domain: null,
        range: null
      };
      scales.push(colorScaleSpec);
      if (this._spec.color) {
        const colorSpec = this._spec.color as string[] | IVisual<string>;

        // range array
        if (isArray(colorSpec)) {
          colorScaleSpec.range = colorSpec;
        } else {
          const tempSpec = colorSpec as IVisualSpecScale<any, any>;
          Object.prototype.hasOwnProperty.call(tempSpec, 'type') && (colorScaleSpec.type = tempSpec.type);
          Object.prototype.hasOwnProperty.call(tempSpec, 'domain') && (colorScaleSpec.domain = tempSpec.domain);
          Object.prototype.hasOwnProperty.call(tempSpec, 'range') && (colorScaleSpec.range = tempSpec.range);
          Object.prototype.hasOwnProperty.call(tempSpec, 'specified') &&
            (colorScaleSpec.specified = tempSpec.specified);
          Object.prototype.hasOwnProperty.call(tempSpec, 'clamp') && (colorScaleSpec.clamp = tempSpec.clamp);
        }
      }
    }
    // 如果没有range设置
    // length === 0 就认为是没有配置，用户配置 color: [] 依然认为是无效配置，启用主题色板
    if (!colorScaleSpec.range?.length) {
      colorScaleSpec.range = getDataScheme(colorScheme);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      colorScaleSpec.rangeTheme = true;
    }
    return scales;
  }

  // 全局通道
  private _createGlobalScale() {
    this._globalScale = new GlobalScale(this._transformSpecScale(), this);
    this._modelOption.globalScale = this._globalScale;
  }

  updateGlobalScaleDomain() {
    const domainSet = new Set();
    this._series.forEach(s => {
      const keys = s.getSeriesKeys();
      keys && keys.forEach(k => domainSet.add(k));
    });
    // domain
    const domain = Array.from(domainSet);
    // 如果 global scale 当前没有 domain 的话，就使用这个domain
    // 整理了目前会影响全局 scale 的逻辑，但是当前这个节点使用这个逻辑可行
    // 但是考虑到组件也可能会有修改 scale 的逻辑
    // 增加一个属性设置优先级也许是必须的？
    this._globalScale.updateScaleDomain(domain);
  }

  updateGlobalScale(result: IUpdateSpecResult) {
    mergeUpdateResult(result, this._globalScale.updateSpec(this._transformSpecScale()));
  }

  updateGlobalScaleTheme() {
    const colorSpec = this._globalScale.getScaleSpec('color');
    const colorScheme = this.getColorScheme();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (colorSpec.rangeTheme) {
      colorSpec.range = getDataScheme(colorScheme);
      this._globalScale.getScale('color').range(colorSpec.range);
    }
  }

  private _getSpecKeys(spec: T) {
    const ignoreKeys: Record<string, boolean> = {
      width: true,
      height: true,
      xField: true,
      yField: true
    };
    return Object.keys(spec)
      .filter(key => !ignoreKeys[key])
      .sort();
  }

  private _isSeriesRelatedSpecKey(key: string) {
    return !!this._specTransformer?.getSeriesRelatedSpecKeys()?.[key];
  }

  private _canChangeSpecKeysWithoutRemake(currentKeys: string[], nextKeys: string[]) {
    const currentKeySet = new Set(currentKeys);
    const nextKeySet = new Set(nextKeys);
    const changedKeys = [
      ...currentKeys.filter(key => !nextKeySet.has(key)),
      ...nextKeys.filter(key => !currentKeySet.has(key))
    ];

    return changedKeys.length > 0 && changedKeys.every(key => this._isSeriesRelatedSpecKey(key));
  }

  updateSpec(spec: T) {
    const result: IUpdateSpecResult = {
      change: false,
      reMake: false,
      reRender: false,
      reSize: false,
      reCompile: false
    };
    // 第一版简易逻辑如果配置项出现增删，直接重新创建chart
    // 如果出现类型不同，同上
    if (spec.type !== this.type) {
      result.reMake = true;
      this.setLayoutTag(true, null, false);
      return result;
    }
    // spec set & transformSpec
    // diff meta length;

    const currentKeys = this._getSpecKeys(this._spec);
    const nextKeys = this._getSpecKeys(spec);
    if (!isEqual(currentKeys, nextKeys) && !this._canChangeSpecKeysWithoutRemake(currentKeys, nextKeys)) {
      result.reMake = true;
      this.setLayoutTag(true, null, false);
      return result;
    }
    const specKeys = Array.from(new Set([...currentKeys, ...nextKeys])).sort();
    // spec key 的个数一致，但是数组长度不一致时。remake
    for (let i = 0; i < specKeys.length; i++) {
      const key = specKeys[i];
      const currentSpec = (this._spec as any)[key];
      const nextSpec = (spec as any)[key];
      if (
        isArray(currentSpec) &&
        currentSpec.length !== array(nextSpec).length &&
        !this._canChangeMarkerComponentsWithoutRemake(key, currentSpec, nextSpec)
      ) {
        result.reMake = true;
        this.setLayoutTag(true, null, false);
        return result;
      }
    }
    const oldSpec = this._spec;
    const onlyMarkerComponentsRemoved = this._isOnlyMarkerComponentsRemoved(this._spec, spec, specKeys);
    const onlyComponentSpecsChanged = this._isOnlyComponentSpecsChanged(this._spec, spec, specKeys);
    const onlySeriesSpecsChanged = this._isOnlySeriesSpecsChanged(this._spec, spec, specKeys);
    const onlyComponentOrSeriesSpecsChanged =
      onlyComponentSpecsChanged || onlySeriesSpecsChanged
        ? true
        : this._isOnlyComponentOrSeriesSpecsChanged(this._spec, spec, specKeys);

    this._spec = spec;
    if (onlyMarkerComponentsRemoved) {
      this._removeMarkerComponentsForEmptySpecs(result);
      return result;
    }
    // update chart config
    this.updateChartConfig(result, oldSpec);
    if (result.reMake) {
      this.setLayoutTag(true, null, false);
      return result;
    }

    this.updateGlobalScale(result);
    if (result.reMake) {
      this.setLayoutTag(true, null, false);
      return result;
    }
    // region 变化
    this.updateRegionSpec(result);
    if (result.reMake) {
      this.setLayoutTag(true, null, false);
      return result;
    }
    const componentUpdateResult = this.updateComponentSpec(result);
    if (result.reMake) {
      this.setLayoutTag(true, null, false);
      return result;
    }
    if (!onlyComponentSpecsChanged && result.effects?.localOnly) {
      delete result.effects.localOnly;
    }
    if (isUpdateSpecResultLocalOnly(result)) {
      return result;
    }
    if (
      onlyComponentSpecsChanged &&
      !componentUpdateResult.hasNonComponentOnlyUpdate &&
      (isUpdateSpecResultComponentOnly(result) || this._isComponentScaleDomainOnlyUpdate(result))
    ) {
      componentUpdateResult.componentOnlyUpdatedComponents.forEach(component => {
        component.reInit(component.getSpec());
      });
      if (result.effects?.layout) {
        this.setLayoutTag(true, null, false);
      }
      return result;
    }
    // 需要重新布局
    this.setLayoutTag(true, null, false);
    this.updateSeriesSpec(result);
    if (result.reMake) {
      return result;
    }
    /**
     * 当图表不是`remake`，而是部分更新的时候，所有的model需要`reInit`
     * 由于 data 最终是挂在到model上的，data的transform又依赖model中的`spec`，
     * 所以在更新model前需要调用`reInit`确保`spec`和内部变量已经更新
     */
    this.reInit();
    if (!onlyComponentOrSeriesSpecsChanged || !this._canSkipChartDataStages(result)) {
      this.updateDataSpec();
      // ensure that series data transforms and scale domains follow the data change
      this.reDataFlow();
      this._reRunStackDataFlow();
      this.getAllModels().forEach(model => model.onDataUpdate());
    }
    return result;
  }

  updateChartConfig(result: IUpdateSpecResult, oldSpec: IChartSpec) {
    // padding;
    this._paddingSpec = normalizeLayoutPaddingSpec(this._spec.padding ?? this._option?.getTheme('padding'));

    // re compute padding & layout
    this._updateLayoutRect(this._viewBox);
  }

  updateDataSpec() {
    if (!this._spec.data) {
      return;
    }
    this._chartData.updateData(this._spec.data, false, true);
  }

  updateRegionSpec(result: IUpdateSpecResult) {
    if (!this._spec?.region) {
      return;
    }
    // 长度不同，直接判定为 remake
    if (this._spec.region.length !== this._regions.length) {
      result.reMake = true;
      return;
    }
    this._regions.forEach(r => {
      mergeUpdateResult(result, r.updateSpec(this._spec.region[r.getSpecIndex()]));
    });
  }

  updateComponentSpec(result: IUpdateSpecResult) {
    const componentOnlyUpdatedComponents: IComponent[] = [];
    let hasNonComponentOnlyUpdate = false;
    // 用来检测组件是否有新增
    const componentCache: {
      [key in string]: {
        specCount: number;
        componentCount: number;
      };
    } = {};
    const checkVisibleComponents: Record<string, boolean> = {
      [ComponentTypeEnum.title]: true,
      [ComponentTypeEnum.brush]: true,
      [ComponentTypeEnum.indicator]: true
    };
    const removedComponents: IComponent[] = [];
    let hasNonLocalComponentRemoval = false;

    this._components.forEach(c => {
      if (c.type === ComponentTypeEnum.label || c.type === ComponentTypeEnum.totalLabel) {
        // label配置都会被解析到series中，所以不适合放在这里进行比对
        if (!c.getSpecInfo()) {
          removedComponents.push(c);
          hasNonLocalComponentRemoval = true;
          hasNonComponentOnlyUpdate = true;
        }
        return;
      }
      if (checkVisibleComponents[c.type]) {
        checkVisibleComponents[c.type] = false;
      }

      const compSpecKey = c.specKey || c.type;
      // 每一个组件获取对应的speck
      const cmpSpec = (this._spec as any)[compSpecKey] ?? {};

      if (isArray(cmpSpec)) {
        componentCache[compSpecKey] = componentCache[compSpecKey] || {
          specCount: cmpSpec.length,
          componentCount: 0
        };
        if (this._canRemoveMarkerComponentsWithoutRemake(compSpecKey, [c.getSpec()], cmpSpec)) {
          removedComponents.push(c);
          return;
        }
        componentCache[compSpecKey].componentCount++;
        const componentSpec = cmpSpec[c.getSpecIndex()] ?? {};
        const previousComponentSpec = c.getSpec();
        const componentResult = c.updateSpec(componentSpec, cmpSpec);
        if (
          isUpdateSpecResultComponentOnly(componentResult) ||
          this._isComponentScaleDomainOnlyUpdate(componentResult)
        ) {
          componentOnlyUpdatedComponents.push(c);
        } else if (!isEqual(previousComponentSpec, componentSpec)) {
          hasNonComponentOnlyUpdate = true;
        }
        mergeUpdateResult(result, componentResult);
      } else {
        const previousComponentSpec = c.getSpec();
        const componentResult = c.updateSpec(cmpSpec);
        if (
          isUpdateSpecResultComponentOnly(componentResult) ||
          this._isComponentScaleDomainOnlyUpdate(componentResult)
        ) {
          componentOnlyUpdatedComponents.push(c);
        } else if (!isEqual(previousComponentSpec, cmpSpec)) {
          hasNonComponentOnlyUpdate = true;
        }
        mergeUpdateResult(result, componentResult);
      }
    });
    if (!result.reMake) {
      this._createMissingMarkerComponentsForSpecs(result, componentCache);
    }
    for (const key in componentCache) {
      if (Object.prototype.hasOwnProperty.call(componentCache, key)) {
        const element = componentCache[key];
        if (element.componentCount !== element.specCount) {
          result.reMake = true;
        }
      }
    }

    if (removedComponents.length) {
      removedComponents.forEach(component => {
        this._removeComponent(component);
      });
      result.change = true;
      result.effects = {
        ...result.effects,
        component: true,
        ...(hasNonLocalComponentRemoval ? { layout: true, render: true } : { localOnly: true })
      };
    }

    /** 这些组件 visible: false 不创建组件，也在this._components中，所以需要额外检测是否有visible 的切换 */
    const isVisible = (compSpec: any) => compSpec && compSpec.visible !== false;
    Object.keys(checkVisibleComponents).forEach(type => {
      if (checkVisibleComponents[type]) {
        const compSpec = (this._spec as any)[type];
        const switchToVisible = isArray(compSpec) ? compSpec.some(isVisible) : isVisible(compSpec);

        if (switchToVisible) {
          result.reMake = true;
        }
      }
    });
    return {
      componentOnlyUpdatedComponents,
      hasNonComponentOnlyUpdate
    };
  }

  private _canChangeMarkerComponentsWithoutRemake(key: string, currentSpec: any, nextSpec: any) {
    return (
      this._canRemoveMarkerComponentsWithoutRemake(key, currentSpec, nextSpec) ||
      this._canAddMarkerComponentsWithoutRemake(key, currentSpec, nextSpec)
    );
  }

  private _canAddMarkerComponentsWithoutRemake(key: string, currentSpec: any, nextSpec: any) {
    if (!MARKER_COMPONENT_SPEC_KEYS[key] || !isArray(currentSpec) || !isArray(nextSpec)) {
      return false;
    }

    if (nextSpec.length <= currentSpec.length) {
      return false;
    }

    return nextSpec.slice(currentSpec.length).every(this._isMarkerAdditionSpecSafeWithoutRemake);
  }

  private _isMarkerAdditionSpecSafeWithoutRemake = (spec: unknown) => {
    if (!spec || typeof spec !== 'object') {
      return false;
    }

    const markerSpec = spec as Record<string, unknown>;
    if (markerSpec.visible === false) {
      return false;
    }

    return !Object.keys(MARKER_ADDITION_REMAKE_SPEC_KEYS).some(key => !isNil(markerSpec[key]));
  };

  private _isAutoRangeMarkerSpec(spec: unknown) {
    return !!spec && typeof spec === 'object' && (spec as { autoRange?: boolean }).autoRange === true;
  }

  private _canRemoveMarkerComponentsWithoutRemake(key: string, currentSpec: any, nextSpec: any) {
    return (
      MARKER_COMPONENT_SPEC_KEYS[key] &&
      isArray(currentSpec) &&
      currentSpec.length > 0 &&
      isArray(nextSpec) &&
      nextSpec.length === 0
    );
  }

  private _isOnlyMarkerComponentsRemoved(currentSpec: any, nextSpec: any, specKeys: string[]) {
    let hasMarkerRemoval = false;

    const onlyMarkerRemoval = specKeys.every(key => {
      if (this._canRemoveMarkerComponentsWithoutRemake(key, currentSpec[key], nextSpec[key])) {
        hasMarkerRemoval = true;
        return true;
      }

      return isEqual(currentSpec[key], nextSpec[key]);
    });

    return hasMarkerRemoval && onlyMarkerRemoval;
  }

  private _isComponentSpecKey(key: string) {
    if (MARKER_COMPONENT_SPEC_KEYS[key]) {
      return true;
    }

    return this._components.some(component => {
      return (component.specKey || component.type) === key;
    });
  }

  private _isOnlyComponentSpecsChanged(currentSpec: object, nextSpec: object, specKeys: string[]) {
    let hasComponentSpecChange = false;
    const currentSpecRecord = currentSpec as Record<string, unknown>;
    const nextSpecRecord = nextSpec as Record<string, unknown>;

    const onlyComponentSpecChange = specKeys.every(key => {
      if (isEqual(currentSpecRecord[key], nextSpecRecord[key])) {
        return true;
      }
      if (this._isComponentSpecKey(key)) {
        hasComponentSpecChange = true;
        return true;
      }
      return false;
    });

    return hasComponentSpecChange && onlyComponentSpecChange;
  }

  private _isOnlySeriesSpecsChanged(currentSpec: object, nextSpec: object, specKeys: string[]) {
    let hasSeriesSpecChange = false;
    const currentSpecRecord = currentSpec as Record<string, unknown>;
    const nextSpecRecord = nextSpec as Record<string, unknown>;
    const seriesRelatedSpecKeys = this._specTransformer?.getSeriesRelatedSpecKeys() ?? {};

    const onlySeriesSpecChange = specKeys.every(key => {
      if (isEqual(currentSpecRecord[key], nextSpecRecord[key])) {
        return true;
      }
      if (seriesRelatedSpecKeys[key]) {
        hasSeriesSpecChange = true;
        return true;
      }
      return false;
    });

    return hasSeriesSpecChange && onlySeriesSpecChange;
  }

  private _isOnlyComponentOrSeriesSpecsChanged(currentSpec: object, nextSpec: object, specKeys: string[]) {
    let hasComponentOrSeriesSpecChange = false;
    const currentSpecRecord = currentSpec as Record<string, unknown>;
    const nextSpecRecord = nextSpec as Record<string, unknown>;
    const seriesRelatedSpecKeys = this._specTransformer?.getSeriesRelatedSpecKeys() ?? {};

    const onlyComponentOrSeriesSpecChange = specKeys.every(key => {
      if (isEqual(currentSpecRecord[key], nextSpecRecord[key])) {
        return true;
      }
      if (this._isComponentSpecKey(key) || seriesRelatedSpecKeys[key]) {
        hasComponentOrSeriesSpecChange = true;
        return true;
      }
      return false;
    });

    return hasComponentOrSeriesSpecChange && onlyComponentOrSeriesSpecChange;
  }

  private _canSkipChartDataStages(result: IUpdateSpecResult) {
    const effects = result.effects;

    return !!effects?.series && !effects.remake && !effects.data && !effects.scaleDomain && !result.reMake;
  }

  private _isComponentScaleDomainOnlyUpdate(result: IUpdateSpecResult) {
    const effects = result.effects;

    return (
      !!effects?.component &&
      !!effects.scaleDomain &&
      !result.reMake &&
      !result.reCompile &&
      !result.reSize &&
      !effects.remake &&
      !effects.compile &&
      !effects.data &&
      !effects.series &&
      !effects.animation &&
      !result.reTransformSpec &&
      !result.reAnimate &&
      !result.changeTheme &&
      !result.changeBackground
    );
  }

  private _reRunStackDataFlow() {
    if (!this._series.some(series => series.getStack?.())) {
      return;
    }

    (this as any)._stack?.stackAll?.();
    this._series.forEach(series => {
      if (series.getViewDataFilter()) {
        series.reTransformViewData();
      }
    });
  }

  private _getModelSpecIndex(specInfo: IModelSpecInfo) {
    const specPath = specInfo.specPath ?? [];
    const specIndex = specPath[specPath.length - 1];

    return typeof specIndex === 'number' ? specIndex : 0;
  }

  private _hasComponentForSpecInfo(key: string, specInfo: IModelSpecInfo) {
    const specIndex = this._getModelSpecIndex(specInfo);

    return this._components.some(component => {
      return (component.specKey || component.type) === key && component.getSpecIndex() === specIndex;
    });
  }

  private _createMissingMarkerComponentsForSpecs(
    result: IUpdateSpecResult,
    componentCache: Record<string, { specCount: number; componentCount: number }>
  ) {
    let createdCount = 0;
    let hasAutoRangeMarker = false;

    this._specTransformer?.forEachComponentInSpec(
      this._spec,
      (constructor, specInfo) => {
        if (result.reMake) {
          return;
        }
        const compSpecKey = constructor.specKey || constructor.type;

        if (!MARKER_COMPONENT_SPEC_KEYS[compSpecKey] || this._hasComponentForSpecInfo(compSpecKey, specInfo)) {
          return;
        }
        if (!this._isMarkerAdditionSpecSafeWithoutRemake(specInfo.spec)) {
          result.reMake = true;
          return;
        }

        this._createComponent(constructor, specInfo);
        if (componentCache[compSpecKey]) {
          componentCache[compSpecKey].componentCount++;
        }
        createdCount++;
        hasAutoRangeMarker = hasAutoRangeMarker || this._isAutoRangeMarkerSpec(specInfo.spec);
      },
      this._option.getSpecInfo()
    );

    if (!createdCount) {
      return;
    }

    result.change = true;
    result.effects = {
      ...result.effects,
      component: true,
      ...(hasAutoRangeMarker ? { scaleDomain: true } : null),
      layout: true,
      render: true
    };
  }

  private _removeMarkerComponentsForEmptySpecs(result: IUpdateSpecResult) {
    const removedComponents = this._components.filter(component => {
      const compSpecKey = component.specKey || component.type;
      const cmpSpec = (this._spec as any)[compSpecKey] ?? {};

      return this._canRemoveMarkerComponentsWithoutRemake(compSpecKey, [component.getSpec()], cmpSpec);
    });

    if (!removedComponents.length) {
      return;
    }

    removedComponents.forEach(component => {
      this._removeComponent(component);
    });
    result.change = true;
    result.effects = {
      ...result.effects,
      component: true,
      localOnly: true
    };
  }

  private _removeComponent(component: IComponent) {
    this._components = this._components.filter(c => c !== component);
    this._idMap.delete(component.id);
    component.getMarks().forEach(mark => {
      this.getCompiler().removeRootMark(mark);
    });
    component.release();
  }

  updateSeriesSpec(result: IUpdateSpecResult) {
    // 长度不同，直接判定为 remake
    if (this._spec.series.length !== this._series.length) {
      result.reMake = true;
      return;
    }
    this._series.forEach(s => {
      const spec = this._spec.series[s.getSpecIndex()];
      mergeUpdateResult(result, s.updateSpec(spec));
    });
  }

  getCanvas() {
    return this.getCompiler()?.getCanvas() ?? null;
  }

  private _updateLayoutRect(viewBox: IBoundsLike) {
    const canvasRect = this.getCanvasRect();
    let viewRect = canvasRect;
    if (viewBox) {
      this._viewBox = viewBox;
      const { x1 = 0, y1 = 0, x2, y2 } = viewBox;
      viewRect = {
        width: x2 - x1,
        height: y2 - y1
      };
    } else {
      this._viewBox = { x1: 0, y1: 0, x2: viewRect.width, y2: viewRect.height };
    }
    this._viewRect = viewRect;
    // resize 时 padding 也应该会发生变化 先计算
    this.padding = calcPadding(this._paddingSpec, viewRect, viewRect);
    this._layoutRect.width = viewRect.width - this.padding.left - this.padding.right;
    this._layoutRect.height = viewRect.height - this.padding.top - this.padding.bottom;
    this._layoutRect.x = this.padding.left;
    this._layoutRect.y = this.padding.top;

    this._event.emit(ChartEvent.layoutRectUpdate, { chart: this });
  }

  /** 设置当前全局主题 */
  setCurrentTheme() {
    // update chart config
    this.updateChartConfig({ change: true, reMake: false }, this._spec);

    // 需要重新布局
    this.resetLayoutItemTag();
    this.setLayoutTag(true, null, false);

    // 设置色板，只设置 colorScale 的 range
    this.updateGlobalScaleTheme();
    this.reInit();
  }

  reInit() {
    [...this._regions, ...this._series, ...this._components].forEach(model => {
      const specInfo = model.getSpecInfo();

      if (specInfo && specInfo.spec) {
        // 找不到，说明在更新spec中，组件被注销了
        model.reInit(specInfo.spec);
      }
    });
  }

  clear() {
    // call on recompile & release
    this.getAllModels().forEach(i => i.clear?.());
  }

  compile() {
    this.compileBackground();
    this.compileLayout();
    this.compileRegions();
    this.compileSeries();
    this.compileComponents();
  }

  afterCompile() {
    this.getAllRegions().forEach(r => {
      r.afterCompile?.();
    });
    this.getAllSeries().forEach(s => {
      s.afterCompile?.();
    });
    this.getAllComponents().forEach(c => {
      c.afterCompile?.();
    });
  }

  compileLayout() {
    const { width, height } = this.getCanvasRect();
    this.getCompiler().setSize(width, height);
  }

  compileBackground() {
    if (!this._backgroundMark) {
      return;
    }
    this._backgroundMark.compile();
  }

  compileRegions() {
    this._option.performanceHook?.beforeRegionCompile?.(this._option.globalInstance);
    this.getAllRegions().forEach(r => {
      r.compile();
    });
    this._option.performanceHook?.afterRegionCompile?.(this._option.globalInstance);
  }

  compileSeries() {
    this._option.performanceHook?.beforeSeriesCompile?.(this._option.globalInstance);
    this.getAllSeries().forEach(s => {
      s.compile();
    });
    this._option.performanceHook?.afterSeriesCompile?.(this._option.globalInstance);
  }

  compileComponents() {
    this._option.performanceHook?.beforeComponentCompile?.(this._option.globalInstance);
    this.getAllComponents().forEach(c => {
      c.compile();
    });
    this._option.performanceHook?.afterComponentCompile?.(this._option.globalInstance);
  }

  release(forceReleaseVRenderComponents: boolean = true) {
    /* release 前的处理 */
    if (forceReleaseVRenderComponents) {
      [...this._components, ...this._regions, ...this._series].forEach(m => {
        m.beforeRelease();
      });
    }

    /* 开始 release */
    super.release();
    // clear event , temporary function of  chart items
    this.clear();

    [...this._components, ...this._regions, ...this._series].forEach(m => {
      m.release();
    });
    this._components = this._regions = this._series = [];
    this._spec = {} as any;
    // FIXME: type lint
    this._dataSet = this._globalScale = this._layoutFunc = null as unknown as any;
    this._layoutTag = false;
    this._idMap.clear();
  }

  onLayout() {
    this.layout();
  }

  /**
   * 更新或设置图元状态
   * @param state 状态筛选器
   * @param filter 筛选器
   */
  updateState(
    state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
    filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean //series + mark 筛选
  ): void {
    const seriesArr = this.getAllSeries();
    for (const key in state) {
      if (isEmpty(state[key])) {
        continue;
      }
      const stateSpec = state[key];
      let stateInfo: IStateInfo = { stateValue: key };
      if (isFunction(stateSpec.filter)) {
        stateInfo = { filter: stateSpec.filter, ...stateInfo };
      } else {
        stateInfo = { ...stateSpec.filter, ...stateInfo };
      }
      if (stateSpec.level) {
        stateInfo.level = stateSpec.level;
      }
      seriesArr.forEach(series => {
        series.getMarks().forEach(m => {
          if (!m.stateStyle[key]) {
            return;
          }
          if (!filter || filter(series, m, key)) {
            m.state.changeStateInfo(stateInfo);
            m.updateMarkState(key);
          }
        });
      });
    }
  }

  /**
   * 更新图元选中状态
   * @param datum hover 图元数据
   * @param filter 筛选器 用来筛选系列与mark
   * @param region region 筛选器
   */
  setSelected(
    datum: MaybeArray<any> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ): void {
    this._setStateInDatum(STATE_VALUE_ENUM.STATE_SELECTED, datum, filter, region);
  }

  /**
   * 更新图元 hover 状态
   * @param datum hover 图元数据
   * @param filter 筛选器 用来筛选系列与mark
   * @param region region 筛选器
   */
  setHovered(
    datum: MaybeArray<Datum> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ): void {
    this._setStateInDatum(STATE_VALUE_ENUM.STATE_HOVER, datum, filter, region);
  }

  /**
   * 清除所有图元的状态
   *
   * @since 1.11.0
   */
  clearState(state: string) {
    this._interaction.clearByState(state);
  }

  /**
   * 清除所有图元的所有状态
   *
   * @since 1.12.4
   */
  clearAllStates() {
    this._interaction.clearAllStates();
  }

  /**
   * 清除所有图元的选中状态
   *
   * @since 1.11.0
   */
  clearSelected() {
    this.clearState(STATE_VALUE_ENUM.STATE_SELECTED);
  }

  /**
   * 清除所有图元的hover状态
   *
   * @since 1.11.0
   */
  clearHovered() {
    this.clearState(STATE_VALUE_ENUM.STATE_HOVER);
  }

  private _initEvent() {
    [ChartEvent.dataZoomChange, ChartEvent.scrollBarChange].forEach(event => {
      this._event.on(event, ({ value }) => {
        this._disableMarkAnimation(['exit', 'update']);
        const enableMarkAnimate = () => {
          this._enableMarkAnimation(['exit', 'update']);
          this._event.off(HOOK_EVENT.AFTER_MARK_RENDER_END, enableMarkAnimate);
        };
        this._event.on(HOOK_EVENT.AFTER_MARK_RENDER_END, enableMarkAnimate);
      });
    });
  }

  protected _enableMarkAnimation(states: string | string[]) {
    const marks = this.getAllMarks();
    marks.forEach(mark => mark.enableAnimationByState(states));
  }

  protected _disableMarkAnimation(states: string | string[]) {
    const marks = this.getAllMarks();
    marks.forEach(mark => mark.disableAnimationByState(states));
  }

  filterGraphicsByDatum(
    datum: MaybeArray<Datum> | null,
    opt: {
      filter?: (series: ISeries, mark: IMark) => boolean;
      region?: IRegionQuerier;
      getDatum?: (el: IMarkGraphic, mark: IMark, s: ISeries, r: IRegion) => Datum;
      callback?: (el: IMarkGraphic, mark: IMark, s: ISeries, r: IRegion) => void;
      regionCallback?: (pickElements: IMarkGraphic[], r: IRegion) => void;
    } = {}
  ) {
    datum = datum ? array(datum) : null;
    const keys = !datum ? null : Object.keys((datum as Datum[])[0]);
    const allElements = [] as IMarkGraphic[];
    const getDatumOfElement = opt.getDatum ?? getDatumOfGraphic;

    this.getRegionsInQuerier(opt.region).forEach(r => {
      const pickElements = [] as IMarkGraphic[];
      datum &&
        r.getSeries().forEach(s => {
          s.getMarks().forEach(m => {
            const graphics = m.getGraphics();
            if (!graphics || !graphics.length) {
              return;
            }
            if (!opt.filter || (isFunction(opt.filter) && opt.filter(s, m))) {
              const isCollect = isCollectionMark(m.type);

              if (isCollect) {
                graphics.filter(e => {
                  const elDatum = getDatumOfElement(e, m, s, r) as Datum[];
                  const isPick =
                    // eslint-disable-next-line max-nested-callbacks, eqeqeq
                    elDatum && (datum as Datum[]).every((d, index) => keys.every(k => d[k] == elDatum[index][k]));

                  if (isPick) {
                    pickElements.push(e);
                    allElements.push(e);
                    opt.callback && opt.callback(e, m, s, r);
                  }
                });
              } else {
                if (datum.length > 1) {
                  const datumTemp = (datum as Datum[]).slice();

                  graphics.forEach(e => {
                    const elDatum = getDatumOfElement(e, m, s, r) as Datum;
                    // eslint-disable-next-line max-nested-callbacks, eqeqeq
                    const index = elDatum && datumTemp.findIndex(d => keys.every(k => d[k] == elDatum[k]));
                    if (index >= 0) {
                      datumTemp.splice(index, 1);

                      pickElements.push(e);
                      allElements.push(e);
                      opt.callback && opt.callback(e, m, s, r);
                    }
                  });
                } else {
                  const el = graphics.find(e => {
                    const elDatum = getDatumOfElement(e, m, s, r) as Datum;
                    // eslint-disable-next-line eqeqeq
                    return elDatum && keys.every(k => (datum as Datum[])[0][k] == elDatum[k]);
                  });

                  if (el) {
                    pickElements.push(el);
                    allElements.push(el);
                    opt.callback && opt.callback(el, m, s, r);
                  }
                }
              }
            }
          });
        });

      opt.regionCallback && opt.regionCallback(pickElements, r);
    });

    return allElements;
  }

  protected _setStateInDatum(
    stateKey: string,
    d: MaybeArray<Datum> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) {
    if (!d) {
      this._interaction.clearByState(stateKey);
      return;
    }

    const pickGraphics = this.filterGraphicsByDatum(d, {
      filter,
      region
    });
    this._interaction.updateStateOfGraphics(stateKey, pickGraphics);
  }

  /**
   * setDimensionIndex could trigger mark state, tooltip, crosshair
   * @param value dimension value
   * @param opt option for set trigger
   */
  setDimensionIndex(value: StringOrNumber, opt: DimensionIndexOption) {
    // event
    let dimensionInfo: IDimensionInfo[] | null = null;
    Array.from(this._event.getComposedEventMap().values()).forEach(e => {
      const { eventType, event } = e;
      if (eventType === DimensionEventEnum.dimensionHover || eventType === DimensionEventEnum.dimensionClick) {
        const info = event.dispatch(value, opt) as [];
        if (info?.length) {
          dimensionInfo = info;
        }
      }
    });
    const isUnableValue =
      isNil(value) || !dimensionInfo || dimensionInfo.every(d => isDiscrete(d.axis.getScale().type) && isNil(d.index));

    const isUnableTooltip =
      // 如果数据本身不可用
      isUnableValue ||
      // 或者数据为空
      dimensionInfo.every(d => isDiscrete(d.axis.getScale().type) && d.data.every(_data => _data.datum.length === 0));
    // tooltip
    if (opt.tooltip !== false) {
      const tooltip = this.getComponentsByType(ComponentTypeEnum.tooltip)[0] as unknown as ITooltip;

      if (tooltip?.getVisible()) {
        if (isUnableValue || isUnableTooltip) {
          (<any>tooltip).hideTooltip?.();
        } else {
          const dataFilter: { [key: string]: any } = {};
          dimensionInfo.forEach((d: IDimensionInfo) => {
            const { axis, value, data } = d;
            const isY = axis.getOrient() === 'left' || axis.getOrient() === 'right';
            data.forEach(d => {
              const field = isY ? (<ICartesianSeries>d.series).fieldY[0] : (<ICartesianSeries>d.series).fieldX[0];

              dataFilter[field] = d.datum?.[0]?.[field] ?? value;
            });
          });
          tooltip.showTooltip(dataFilter, opt.showTooltipOption);
        }
      }
    }
    if (opt.crosshair !== false) {
      const crosshair = this.getComponentsByType(ComponentTypeEnum.cartesianCrosshair)[0] as unknown as ICrossHair;

      if (crosshair && crosshair.clearAxisValue && crosshair.setAxisValue) {
        if (isUnableValue) {
          crosshair.hideCrosshair();
        } else {
          crosshair.showCrosshair(dimensionInfo as { axis: IAxis; value: string | number }[]);
        }
      }
    }
  }

  showCrosshair(cb: (axis: IAxis) => false | string | number) {
    const crosshair =
      this.getComponentsByType(ComponentTypeEnum.cartesianCrosshair)[0] ??
      this.getComponentsByType(ComponentTypeEnum.polarCrosshair)[0];
    if (!crosshair) {
      return;
    }
    const axes = this.getComponentsByKey('axes') as IAxis[];
    const dimInfo: { axis: IAxis; value: string | number }[] = [];
    axes.forEach(axis => {
      const value = cb(axis);
      if (value !== false) {
        dimInfo.push({
          axis,
          value
        });
      }
    });
    (crosshair as ICrossHair).showCrosshair(dimInfo);
  }

  getColorScheme() {
    return this._option.getTheme?.('colorScheme');
  }
}
