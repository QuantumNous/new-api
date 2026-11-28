import type { ICartesianSeries, IPolarSeries, ISeries } from '../../series/interface';
import { eachSeries } from '../../util/model';
import { BaseComponent } from '../base/base-component';
import type { IEffect, IModelInitOption } from '../../model/interface';
import { ComponentTypeEnum, type IComponent, type IComponentOption } from '../interface';
import {
  dataFilterComputeDomain,
  dataFilterWithNewDomain,
  dataToStatePoint,
  getAxisBandSize,
  isReverse,
  lockStatisticsFilter,
  modeCheck,
  parseDomainFromStateAndValue,
  parseDomainFromState,
  statePointToData
} from './util';
import type {
  AdaptiveSpec,
  ILayoutPoint,
  ILayoutRect,
  ILayoutType,
  IOrientType,
  IRect,
  StringOrNumber
} from '../../typings';
import { registerDataSetInstanceParser, registerDataSetInstanceTransform } from '../../data/register';
import type { IContinuousScale } from '@visactor/vscale';
import {
  BandScale,
  isContinuous,
  isDiscrete,
  LinearScale,
  type IBandLikeScale,
  type IBaseScale
} from '@visactor/vscale';
import { Direction } from '../../typings/space';
import type { CartesianAxis, ICartesianBandAxisSpec } from '../axis/cartesian';
import type { IAxis } from '../axis';
import { getDirectionByOrient, getOrient } from '../axis/cartesian/util/common';
import {
  mixin,
  isNil,
  isEqual,
  isValid,
  array,
  minInArray,
  maxInArray,
  last,
  type IBoundsLike,
  isValidNumber
} from '@visactor/vutils';
import type { IDataFilterComponent, IDataFilterComponentSpec, IFilterMode } from './interface';
import { dataViewParser, DataView } from '@visactor/vdataset';
import { CompilableData } from '../../compile/data/compilable-data';
import { Zoomable } from '../../interaction/zoom/zoomable';
import type { AbstractComponent, DataZoom as DataZoomComponent } from '@visactor/vrender-components';
import { TransformLevel } from '../../data/initialize';
import type { IDataZoomSpec } from './data-zoom/interface';
import type { IGraphic, IGroup } from '@visactor/vrender-core';
import { AttributeLevel } from '../../constant/attribute';
import type { IGroupMark } from '../../mark/interface/mark';
import { DataFilterEvent } from './data-filter-event';
import { ChartEvent } from '../../constant/event';

export abstract class DataFilterBaseComponent<T extends IDataFilterComponentSpec = IDataFilterComponentSpec>
  extends BaseComponent<AdaptiveSpec<T, 'width' | 'height'>>
  implements IDataFilterComponent
{
  protected _dataFilterEvent: DataFilterEvent;
  layoutType: ILayoutType | 'none' = 'none';

  protected _component: AbstractComponent;

  protected _orient: IOrientType = 'left';
  protected _isHorizontal: boolean;
  get isHorizontal() {
    return this._isHorizontal;
  }

  // 是否为自动模式
  protected _auto?: boolean;
  protected _fixedBandSize?: number;
  protected _cacheRect?: ILayoutRect;
  protected _cacheLayoutStartPoint?: ILayoutPoint;
  protected _cacheVisibility?: boolean = undefined;
  protected _dataUpdating: boolean = false;

  // 数据
  protected _stateScale: IBaseScale;
  get stateScale() {
    return this._stateScale;
  }
  protected _hasInitStateScale: boolean = false;

  // 与系列的关联关系
  // 优先级：id > index
  // 最终结果：series & region取交集
  protected _seriesUserId?: StringOrNumber[];
  protected _seriesIndex?: number[];
  protected _regionUserId!: string[];
  protected _regionIndex!: number[];
  protected _newDomain: any[];
  protected _relatedAxisComponent!: IComponent;
  get relatedAxisComponent() {
    return this._relatedAxisComponent;
  }
  protected _originalStateFields: Record<number, string | number>;

  // 起点数据
  protected _startValue!: number | string;
  // 终点数据
  protected _endValue!: number | string;
  // 开始值，百分比值，0 - 1
  protected _start!: number;
  // 结束值，百分比值，0 - 1
  protected _end!: number;
  // 最小窗口范围
  protected _minSpan!: number;
  // 最大窗口范围
  protected _maxSpan!: number;
  // 窗口范围缓存
  protected _spanCache!: number;
  protected _shouldChange: boolean = true;

  protected _domainCache!: any;

  protected _field!: string | undefined;
  protected _stateField: string = 'x';
  protected _valueField?: string;

  protected _width!: number;
  protected _height!: number;

  protected _filterMode!: IFilterMode;

  protected _handleDataCollectionChangeBound!: any;
  protected _currentDataCollection: any[] = [];

  /*** start: public function ***/
  /**
   * 外部可以通过此方法强制改变datazoom的start和end，达到聚焦定位的效果
   * @param start datazoom起点所在的相对位置
   * @param end datazoom终点所在的相对位置
   * @returns
   */
  setStartAndEnd(
    start: number | string,
    end: number | string,
    rangeMode: ['percent' | 'value', 'percent' | 'value'] = ['percent', 'percent']
  ) {
    const [startMode = 'percent', endMode = 'percent'] = rangeMode;

    const startPercent = (
      startMode === 'percent' ? start : dataToStatePoint(start, this._stateScale, this._isHorizontal)
    ) as number;
    const endPercent = (
      endMode === 'percent' ? end : dataToStatePoint(end, this._stateScale, this._isHorizontal)
    ) as number;
    this._handleChange(startPercent, endPercent, true);
  }
  enableInteraction() {
    this._dataFilterEvent.enableInteraction();
  }
  disableInteraction() {
    this._dataFilterEvent.disableInteraction();
  }
  zoomIn(location?: { x: number; y: number }) {
    this._dataFilterEvent.zoomIn(location);
  }
  zoomOut(location?: { x: number; y: number }) {
    this._dataFilterEvent.zoomOut(location);
  }
  /*** end: public function ***/

  protected abstract _createOrUpdateComponent(): void;
  protected abstract _computeWidth(): number;
  protected abstract _computeHeight(): number;
  protected abstract _handleDataCollectionChange(): void;
  protected abstract _updateScaleRange(): void;

  /*** start: init event and event dispatch ***/
  protected _initEvent() {
    this._dataFilterEvent.initZoomEvent();

    this._relatedAxisComponent?.event.on(ChartEvent.scaleRawDomainUpdate, ({ model }) => {
      // eslint-disable-next-line no-console
      console.log('scaleRawDomainUpdate', (model as unknown as { getRawDomain: () => any }).getRawDomain());
    });
  }
  protected _handleChange(start: number, end: number, updateComponent?: boolean) {
    const zoomLock = this._spec?.zoomLock ?? false;
    if (
      zoomLock ||
      // 拖拽两端的handler, 而非拖拽中间handler
      (end - start !== this._spanCache &&
        // 拖拽后超出限制范围
        (end - start < this._minSpan || end - start > this._maxSpan))
    ) {
      this._shouldChange = false;
    } else {
      this._shouldChange = true;
      this._spanCache = end - start;
    }
  }

  protected _updateRangeFactor(tag?: 'startHandler' | 'endHandler') {
    // 轴的range有时是相反的
    // 比如相同的region范围, 有的场景range为[0, 500], 有的场景range为[500, 0]
    // 而datazoom/scrollbar的range是根据布局强制转化为[0, 500]
    // 所以这里在转换时进行判断并做转置, 有待优化
    // 轴在inverse时，也要做转置处理
    const axis = this._relatedAxisComponent as CartesianAxis<any>;
    const axisScale = axis.getScale() as IBandLikeScale;
    const reverse = isReverse(axis, this._isHorizontal);
    const newRangeFactor: [number, number] = reverse ? [1 - this._end, 1 - this._start] : [this._start, this._end];

    if (reverse) {
      switch (tag) {
        case 'startHandler':
          axis.scaleRangeFactorEnd(newRangeFactor[1]);
          break;
        case 'endHandler':
          axis.scaleRangeFactorStart(newRangeFactor[0]);
          break;
        default:
          axis.scaleRangeFactorStart(newRangeFactor[0], true);
          axis.scaleRangeFactorEnd(newRangeFactor[1]); // end 保证为准确值
      }
    } else {
      switch (tag) {
        case 'startHandler':
          axis.scaleRangeFactorStart(newRangeFactor[0]);
          break;
        case 'endHandler':
          axis.scaleRangeFactorEnd(newRangeFactor[1]);
          break;
        default:
          axis.scaleRangeFactorEnd(newRangeFactor[1], true);
          axis.scaleRangeFactorStart(newRangeFactor[0]); // start 保证为准确值
      }
    }

    const newFactor = axisScale.rangeFactor();
    if (newFactor) {
      this._start = reverse ? 1 - newFactor[1] : newFactor[0];
      this._end = reverse ? 1 - newFactor[0] : newFactor[1];
    } else {
      this._start = 0;
      this._end = 1;
    }
  }

  protected _handleStateChange = (startValue: number, endValue: number, tag?: string) => {
    this._startValue = startValue;
    this._endValue = endValue;
    this._newDomain = parseDomainFromState(this._startValue, this._endValue, this._stateScale);
    this.effect.onZoomChange?.(tag);
    return true;
  };

  effect: IEffect = {
    onZoomChange: (tag?: 'startHandler' | 'endHandler') => {
      const axis = this._relatedAxisComponent as CartesianAxis<any>;
      if (axis && this._filterMode === 'axis') {
        const axisScale = axis.getScale() as IBandLikeScale;
        const axisSpec = axis.getSpec() as ICartesianBandAxisSpec;
        // 判断是否允许自由更改轴 bandSize
        if (this._auto && getAxisBandSize(axisSpec) && (this._spec as IDataZoomSpec).ignoreBandSize) {
          axisScale.bandwidth('auto');
          axisScale.maxBandwidth('auto');
          axisScale.minBandwidth('auto');
        }

        this._updateRangeFactor(tag);
        if (this._auto) {
          // tag
          (this._component as DataZoomComponent)?.setStartAndEnd?.(this._start, this._end);
        }

        // 强制更新视图, 不管/component/axis/base-axis.ts computeData中的tickData判断
        axis.effect.scaleUpdate({
          value: 'force'
        });
      } else {
        eachSeries(
          this._regions,
          s => {
            s.getViewData()?.markRunning();
          },
          {
            userId: this._seriesUserId,
            specIndex: this._seriesIndex
          }
        );
        eachSeries(
          this._regions,
          s => {
            s.reFilterViewData();
          },
          {
            userId: this._seriesUserId,
            specIndex: this._seriesIndex
          }
        );
      }
    }
  };
  /*** end: init event and event dispatch ***/

  protected _visible: boolean = true;
  get visible() {
    return this._visible;
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec as any, options);
    this._orient = getOrient(spec as any);
    this._isHorizontal = getDirectionByOrient(this._orient) === Direction.horizontal;
    this._dataFilterEvent = new DataFilterEvent(
      (this as any).type,
      this._spec,
      this._handleChange.bind(this),
      this.getLayoutRect.bind(this),
      () => {
        return {
          start: this._start,
          end: this._end
        };
      },
      () => this._regions,
      (() => this._option).bind(this),
      () => this.event
    );
  }

  /*** start: component lifecycle ***/
  created() {
    this._handleDataCollectionChangeBound = this._handleDataCollectionChange.bind(this);
    super.created();
    this._setAxisFromSpec();
    this._setRegionsFromSpec();
    this._initEvent();
    this._initData();
    this._initStateScale();
    this._setStateFromSpec();
  }

  initLayout(): void {
    super.initLayout();
    this._layout && (this._layout.layoutOrient = this._orient);
  }

  init(option: IModelInitOption): void {
    super.init(option);
    this._addTransformToSeries();
    // 初始化轴的 domain 这样在轴初次布局时，能正确的获取展示标签
    if (this._start !== 0 || this._end !== 1) {
      this.effect.onZoomChange();
    }
  }

  _compareSpec(spec: AdaptiveSpec<T, 'width' | 'height'>, prevSpec: AdaptiveSpec<T, 'width' | 'height'>) {
    const result = super._compareSpec(spec, prevSpec);
    if (!result.reMake && !isEqual(prevSpec, spec)) {
      result.change = true;
      result.reRender = true;
      if (!result.reCompile && this._isComponentOnlySpecChange(spec, prevSpec)) {
        result.effects = {
          ...result.effects,
          component: true,
          layout: true,
          render: true
        };
      } else {
        result.reMake = true;
      }
    }

    return result;
  }

  protected _getComponentOnlySpecKeys(): Record<string, boolean> {
    return null;
  }

  protected _isComponentOnlySpecChange(
    spec: AdaptiveSpec<T, 'width' | 'height'>,
    prevSpec: AdaptiveSpec<T, 'width' | 'height'>
  ) {
    const componentOnlySpecKeys = this._getComponentOnlySpecKeys();

    if (!componentOnlySpecKeys) {
      return false;
    }

    const keys = Object.keys({
      ...prevSpec,
      ...spec
    });

    return keys.every(key => {
      return isEqual(prevSpec?.[key], spec?.[key]) || componentOnlySpecKeys[key];
    });
  }

  reInit(spec?: AdaptiveSpec<T, 'width' | 'height'>) {
    super.reInit(spec);

    this._marks.forEach(g => {
      (<IGroupMark>g).getMarks().forEach(m => {
        this.initMarkStyleWithSpec(m, (this._spec as any)[m.name]);
      });
    });
  }

  onLayoutStart(layoutRect: IRect, viewRect: ILayoutRect): void {
    super.onLayoutStart(layoutRect, viewRect);
    const isShown = this._autoUpdate(layoutRect);
    this._autoVisible(isShown);
    this._dataUpdating = false;
  }

  updateLayoutAttribute(): void {
    this._visible && this._createOrUpdateComponent();

    // 第一次渲染, 根据配置强制触发start和end变更
    if (!this._hasInitStateScale) {
      if (this._start !== 0 || this._end !== 1) {
        this._newDomain = parseDomainFromStateAndValue(
          this._spec.start,
          this._startValue,
          this._spec.end,
          this._endValue,
          this._stateScale
        );
        this.effect.onZoomChange();
      }
      this._hasInitStateScale = true;
    }
  }

  protected _initAfterLayout() {
    // clear stateScale, 避免在_initStateScale中使用到旧的scale domain
    this._stateScale = null;
    this._initStateScale();
    // 这时轴的 scale range 是对的
    this._updateScaleRange();
    this._setStateFromAxis();
  }

  protected _beforeLayoutEnd() {
    if (!this._hasInitStateScale) {
      this._initAfterLayout();
    } else {
      this._updateScaleRange();
    }
  }

  onLayoutEnd(): void {
    this._beforeLayoutEnd();
    // 布局结束后, start和end会发生变化, 因此需要再次更新visible
    const isShown = !(this._start === 0 && this._end === 1);
    this._autoVisible(isShown);
    // onLayoutEnd 做的事情
    // updateLayoutAttribute
    // 更新 _newDomain
    // 创建 更新vrender组件属性
    super.onLayoutEnd();
    // 这里修改了轴的scaleRange, 因此需要更新轴的视图
    (this._relatedAxisComponent as IAxis)?.updateScaleRange();
  }

  /**
   * bounds预计算
   * @param rect
   * @returns
   */
  getBoundsInRect(rect: ILayoutRect): IBoundsLike {
    const result: IBoundsLike = { x1: this.getLayoutStartPoint().x, y1: this.getLayoutStartPoint().y, x2: 0, y2: 0 };

    if (this._isHorizontal) {
      result.y2 = result.y1 + this._height;
      result.x2 = result.x1 + rect.width;
    } else {
      result.x2 = result.x1 + this._width;
      result.y2 = result.y1 + rect.height;
    }
    return result;
  }
  /*** end: component lifecycle **/

  /*** start: set attributes & bind related axis and region ***/
  setAttrFromSpec() {
    super.setAttrFromSpec();
    // interaction相关
    this._dataFilterEvent.setEventAttrFromSpec();
    // style相关
    this._field = this._spec.field;
    this._width = this._computeWidth();
    this._height = this._computeHeight();
    this._visible = this._spec.visible ?? true;
  }
  protected _setAxisFromSpec() {
    if (isValid(this._spec.axisId)) {
      this._relatedAxisComponent = this._option.getComponentByUserId(this._spec.axisId);
    } else if (isValid(this._spec.axisIndex)) {
      this._relatedAxisComponent = this._option.getComponentByIndex('axes', this._spec.axisIndex);
    }

    // 如果用户没有配置关联轴 或 用户配置的关联轴和datazoom方向不一致
    // 则 使用与datazoom的方向相同的第一个axis作为关联轴
    if (isNil(this._spec.field) && !this._relatedAxisComponent) {
      const axes = this._option.getComponentsByKey('axes');
      const sameOrientAxis = axes.find(
        (cm: any) => getDirectionByOrient((cm as any)._orient) === getDirectionByOrient(this._orient)
      );

      if (sameOrientAxis) {
        this._relatedAxisComponent = sameOrientAxis;
      } else {
        const bandAxis = axes.find((cm: any) => !isContinuous((cm as any).getScale().type));

        this._relatedAxisComponent = bandAxis;
      }
    }
    if (this._relatedAxisComponent && this._filterMode === 'axis') {
      (this._relatedAxisComponent as CartesianAxis<any>).autoIndentOnce = true;
    }
  }

  protected _setRegionsFromSpec() {
    // 从axis中获取关联的regions
    this._regions = this._relatedAxisComponent ? this._relatedAxisComponent.getRegions() : this._option.getAllRegions();
    // 默认使用关联轴的系列绑定关系
    const bindSeriesFilter = this._relatedAxisComponent ? this._relatedAxisComponent.getBindSeriesFilter?.() : null;
    if (isValid(bindSeriesFilter)) {
      isValid(bindSeriesFilter.userId) && (this._seriesUserId = array(bindSeriesFilter.userId));
      isValid(bindSeriesFilter.specIndex) && (this._seriesIndex = array(bindSeriesFilter.specIndex));
    }
    // spec中的系列绑定关系 取交集
    if (isValid(this._spec.seriesId)) {
      const specSeriesId = array(this._spec.seriesId);
      if (this._seriesUserId) {
        this._seriesUserId = this._seriesUserId.filter(s => specSeriesId.includes(s));
      } else {
        this._seriesUserId = specSeriesId;
      }
    }
    if (isValid(this._spec.seriesIndex)) {
      const specSeriesIndex = array(this._spec.seriesIndex);
      if (this._seriesIndex) {
        this._seriesIndex = this._seriesIndex.filter(s => specSeriesIndex.includes(s));
      } else {
        this._seriesIndex = specSeriesIndex;
      }
    }
    if (isValid(this._spec.regionIndex)) {
      const regionsFromSpec = this._option.getRegionsInIndex(array(this._spec.regionIndex));
      // 如果用户配置了region就取 axis关联 和 用户配置 的交集
      this._regions = this._regions.filter(r => regionsFromSpec.includes(r));
      return;
    }
    if (isValid(this._spec.regionId)) {
      const ids = array(this._spec.regionId);
      // 如果用户配置了region就取 axis关联 和 用户配置 的交集
      this._regions = ids.length ? this._regions.filter(r => ids.includes(r.id)) : [];
      return;
    }
    return;
  }

  /*** end: set attributes & bind related axis and region ***/

  /*** start: data change and reset view  ***/
  protected _collectDataInfo() {
    const dataCollection: any[] = [];
    const seriesCollection: any[] = [];
    const stateFields: string[] = [];
    const valueFields: string[] = [];
    let isCategoryState: boolean;
    if (this._relatedAxisComponent) {
      const originalStateFields: any = {};
      eachSeries(
        this._regions,
        s => {
          // 如果副轴的类型是time或band，则无法进行数据统计
          const xAxisHelper =
            s.coordinate === 'cartesian'
              ? (s as ICartesianSeries).getXAxisHelper()
              : s.coordinate === 'polar'
              ? (s as IPolarSeries).angleAxisHelper
              : null;
          const yAxisHelper =
            s.coordinate === 'cartesian'
              ? (s as ICartesianSeries).getYAxisHelper()
              : s.coordinate === 'polar'
              ? (s as IPolarSeries).radiusAxisHelper
              : null;
          if (!xAxisHelper || !yAxisHelper) {
            return;
          }
          const stateAxisHelper =
            xAxisHelper.getAxisId() === this._relatedAxisComponent.id
              ? xAxisHelper
              : yAxisHelper.getAxisId() === this._relatedAxisComponent.id
              ? yAxisHelper
              : this._isHorizontal
              ? xAxisHelper
              : yAxisHelper;
          const valueAxisHelper = stateAxisHelper === xAxisHelper ? yAxisHelper : xAxisHelper;
          const isValidateValueAxis = isContinuous(valueAxisHelper.getScale(0).type);
          const isValidateStateAxis = isContinuous(stateAxisHelper.getScale(0).type);

          dataCollection.push(s.getRawData());
          // 这里获取原始的spec中的xField和yField，而非经过stack处理后的fieldX和fieldY，原因如下:
          // 1. dataFilterComputeDomain处理时拿到的viewData中没有__VCHART_STACK_START等属性，也就是还没处理
          // 2. datazoom计算的是原始的value值，如果要根据stack后的数据来算，则需要__VCHART_STACK_END - __VCHART_STACK_START
          const seriesSpec = s.getSpec();

          const xField =
            s.coordinate === 'cartesian'
              ? array(seriesSpec.xField)
              : array(seriesSpec.angleField ?? seriesSpec.categoryField);
          const yField =
            s.coordinate === 'cartesian'
              ? array(seriesSpec.yField)
              : array(seriesSpec.radiusField ?? seriesSpec.valueField);

          originalStateFields[s.id] =
            s.type === 'link' ? ['from_xField'] : stateAxisHelper === xAxisHelper ? xField : yField;

          if (isValidateStateAxis) {
            isCategoryState = false;
            stateFields.push(originalStateFields[s.id]);
          } else {
            isCategoryState = true;
            stateFields.push(originalStateFields[s.id][0]);
          }

          if (this._valueField) {
            const valueField = s.type === 'link' ? ['from_yField'] : valueAxisHelper === xAxisHelper ? xField : yField;
            if (isValidateValueAxis) {
              valueFields.push(...valueField);
            }
          }
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );

      this._originalStateFields = originalStateFields;
    } else {
      eachSeries(
        this._regions,
        s => {
          dataCollection.push(s.getRawData());
          seriesCollection.push(s);

          stateFields.push(this._field);
          if (this._valueField) {
            valueFields.push(this._spec.valueField);
          }
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
    }
    return { dataCollection, seriesCollection, stateFields, valueFields, isCategoryState };
  }

  protected _initData() {
    const { dataCollection, seriesCollection, stateFields, valueFields, isCategoryState } = this._collectDataInfo();
    const { dataSet } = this._option;
    registerDataSetInstanceParser(dataSet, 'dataview', dataViewParser);
    registerDataSetInstanceTransform(dataSet, 'dataFilterComputeDomain', dataFilterComputeDomain);
    const data = new DataView(dataSet, { name: `${this.type}_${this.id}_data` });
    data.transform(
      {
        type: 'dataFilterComputeDomain',
        options: {
          input: {
            dataCollection: dataCollection,
            seriesCollection,
            stateFields,
            valueFields,
            isCategoryState
          },
          output: {
            stateField: this._stateField,
            valueField: this._valueField
          }
        }
      },
      false
    );

    // todo 似乎没必要创建
    this._data = new CompilableData(this._option, data);
    data.reRunAllTransform();
    this._currentDataCollection = dataCollection;
    dataSet.multipleDataViewAddListener(dataCollection, 'change', this._handleDataCollectionChangeBound);
  }
  protected _addTransformToSeries() {
    if (!this._relatedAxisComponent || this._filterMode !== 'axis') {
      registerDataSetInstanceTransform(this._option.dataSet, 'dataFilterWithNewDomain', dataFilterWithNewDomain);
      registerDataSetInstanceTransform(this._option.dataSet, 'lockStatisticsFilter', lockStatisticsFilter);

      eachSeries(
        this._regions,
        s => {
          s.getViewDataStatistics().transform(
            {
              type: 'lockStatisticsFilter',
              options: {
                originalFields: () => {
                  return s.getViewDataStatistics().getFields();
                },
                getNewDomain: () => this._newDomain,
                field: () => {
                  return this._field ?? this._parseFieldOfSeries(s);
                },
                isContinuous: () => isContinuous(this._stateScale.type)
              },
              level: 1
            },
            false
          );

          s.addViewDataFilter({
            type: 'dataFilterWithNewDomain',
            options: {
              getNewDomain: () => this._newDomain,
              field: () => {
                return this._field ?? this._parseFieldOfSeries(s);
              },
              isContinuous: () => isContinuous(this._stateScale.type)
            },
            level: TransformLevel.dataZoomFilter
          });
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
    }
  }

  // 数据更新流程
  onDataUpdate(): void {
    const { dataCollection, seriesCollection, stateFields, valueFields, isCategoryState } = this._collectDataInfo();

    // 1. 重新注册事件
    if (
      this._currentDataCollection.length !== dataCollection.length ||
      this._currentDataCollection.some((dv, i) => dv !== dataCollection[i])
    ) {
      this._currentDataCollection.forEach(dv => {
        dv?.target?.removeListener('change', this._handleDataCollectionChangeBound);
      });
      this._currentDataCollection = dataCollection;
      const { dataSet } = this._option;
      dataSet.multipleDataViewAddListener(this._currentDataCollection, 'change', this._handleDataCollectionChangeBound);
    }

    // 2. 执行数据更新
    this._data.getDataView().transform(
      {
        type: 'dataFilterComputeDomain',
        options: {
          input: {
            dataCollection: dataCollection,
            seriesCollection,
            stateFields,
            valueFields,
            isCategoryState
          },
          output: {
            stateField: this._stateField,
            valueField: this._valueField
          }
        }
      },
      false
    );
    this._data.getDataView().reRunAllTransform();

    // 3. 重新计算domain
    const domain = this._computeDomainOfStateScale(isContinuous(this._stateScale.type));
    this._stateScale.domain(domain, false);

    // 4. 重新计算start和end
    // 如果 spec 中有配置 start/end，使用 spec 中的配置
    // 否则保持当前的 start/end
    if (isValid(this._spec.start) || isValid(this._spec.end)) {
      this._setStateFromSpec();
    }
    this._handleChange(this._start, this._end, true);

    // 5. 重新布局
    // auto 模式下需要重新布局
    if (this._spec.auto && !isEqual(this._domainCache, domain)) {
      this._domainCache = domain;
      this._dataUpdating = true;
      this.getChart()?.setLayoutTag(true, null, false);
    }
  }
  private _parseFieldOfSeries(s: ISeries) {
    return this._originalStateFields?.[s.id];
  }
  /*** end: data change and reset view  ***/

  /*** start: scale of filter ***/

  protected _setStateFromSpec() {
    this._auto = !!this._spec.auto;

    let start;
    let end;
    if (this._spec.rangeMode) {
      const [startMode, endMode] = this._spec.rangeMode;
      // 只有mode与配置相符时，才会生效
      // 比如rangeMode为['value', 'percent'],那么start为dataValue, end为[0, 1]
      if (modeCheck('start', startMode, this._spec) && modeCheck('end', endMode, this._spec)) {
        start =
          startMode === 'percent'
            ? this._spec.start
            : dataToStatePoint(this._spec.startValue, this._stateScale, this._isHorizontal);
        end =
          endMode === 'percent'
            ? this._spec.end
            : dataToStatePoint(this._spec.endValue, this._stateScale, this._isHorizontal);
      }
    } else {
      start = this._spec.start
        ? this._spec.start
        : this._spec.startValue
        ? dataToStatePoint(this._spec.startValue, this._stateScale, this._isHorizontal)
        : 0;
      end = this._spec.end
        ? this._spec.end
        : this._spec.endValue
        ? dataToStatePoint(this._spec.endValue, this._stateScale, this._isHorizontal)
        : 1;
    }
    this._start = Math.max(0, Math.min(1, start));
    this._end = Math.max(0, Math.min(1, end));
  }
  protected _setStateFromAxis() {
    // 此时 state scale 进行了更新，stateFromSpec 中补分逻辑需要使用scale计算，重新获取一遍
    this._setStateFromSpec();
    const axis = this._relatedAxisComponent as CartesianAxis<any>;
    this._startValue = statePointToData(this._start, this._stateScale, isReverse(axis, this._isHorizontal));
    this._endValue = statePointToData(this._end, this._stateScale, isReverse(axis, this._isHorizontal));
    this._minSpan = this._spec.minSpan ?? 0;
    this._maxSpan = this._spec.maxSpan ?? 1;
    if (isContinuous(this._stateScale.type) && this._stateScale.domain()[0] !== last(this._stateScale.domain())) {
      if (this._spec.minValueSpan) {
        this._minSpan = this._spec.minValueSpan / (last(this._stateScale.domain()) - this._stateScale.domain()[0]);
      }
      if (this._spec.maxValueSpan) {
        this._maxSpan = this._spec.maxValueSpan / (last(this._stateScale.domain()) - this._stateScale.domain()[0]);
      }
    }
    this._minSpan = Math.max(0, this._minSpan);
    this._maxSpan = Math.min(this._maxSpan, 1);
    if (!axis) {
      return;
    }
    // eslint-disable-next-line max-len
    if ((!axis || this._filterMode !== 'axis') && (this._start !== 0 || this._end !== 1)) {
      this._newDomain = parseDomainFromState(this._startValue, this._endValue, this._stateScale);
    }
  }
  protected _initStateScale() {
    const defaultRange = [0, 1];
    if (this._relatedAxisComponent) {
      const scale = (this._relatedAxisComponent as CartesianAxis<any>).getScale().clone() as
        | IContinuousScale
        | IBandLikeScale;
      // 需要清除rangeFactor 缓存，否则会导致计算错误
      this._stateScale = scale;
      (scale as IBandLikeScale).maxBandwidth?.('auto', true);
      (scale as IBandLikeScale).minBandwidth?.('auto', true);
      (scale as IBandLikeScale).bandwidth?.('auto', true);
      scale.rangeFactor(defaultRange as [number, number], true).range(defaultRange);
    } else {
      let fieldLinear = true;
      if (this._field) {
        eachSeries(
          this._regions,
          s => {
            const stats = s.getRawDataStatisticsByField(this._field);
            if (!isValidNumber(stats?.min) || !isValidNumber(stats?.max)) {
              fieldLinear = false;
            }
          },
          {
            userId: this._seriesUserId,
            specIndex: this._seriesIndex
          }
        );
      }

      this._stateScale = fieldLinear ? new LinearScale() : new BandScale();
      this._stateScale.domain(this._computeDomainOfStateScale(fieldLinear), true).range(defaultRange);
    }
  }

  protected _computeDomainOfStateScale(isContinuous?: boolean) {
    if ((this._spec as IDataZoomSpec).customDomain) {
      return (this._spec as IDataZoomSpec).customDomain;
    }
    const domain = this._data.getLatestData().map((d: any) => d[this._stateField]);
    if (isContinuous) {
      const domainNum = domain.map((n: any) => n * 1);
      return domain.length ? [minInArray(domainNum), maxInArray(domainNum)] : [-Infinity, Infinity];
    }

    return domain;
  }
  /*** end: scale of filter ***/

  /*** start: auto model process  ***/
  protected _autoVisible(isShown: boolean) {
    if (!this._auto) {
      return;
    }
    if (isShown) {
      this.show();
    } else {
      this.hide();
    }
    const sizeKey = this._isHorizontal ? 'height' : 'width';
    this.layout.setLayoutRect(
      {
        [sizeKey]: isShown ? this[`_${sizeKey}`] : 0
      },
      {
        [sizeKey]: AttributeLevel.Built_In
      }
    );
  }
  hide() {
    this._component?.hideAll();
  }

  show() {
    this._component?.showAll();
  }

  protected _autoUpdate(rect?: ILayoutRect): boolean {
    if (!this._auto) {
      this._cacheVisibility = undefined;
      return true;
    }

    const axis = this._relatedAxisComponent as CartesianAxis<any>;
    const axisSpec = axis?.getSpec() as ICartesianBandAxisSpec | undefined;
    const axisScale = axis?.getScale() as IBandLikeScale;
    const bandSizeResult = getAxisBandSize(axisSpec);

    if (
      !this._dataUpdating &&
      isDiscrete(axisScale.type) &&
      rect?.height === this._cacheRect?.height &&
      rect?.width === this._cacheRect?.width &&
      this._fixedBandSize === bandSizeResult?.bandSize
    ) {
      return this._cacheVisibility;
    }

    let isShown = true;
    if (this._isHorizontal && rect?.width !== this._cacheRect?.width) {
      axisScale.range(axis.getInverse() ? [rect.width, 0] : [0, rect.width]);
    } else if (rect?.height !== this._cacheRect?.height) {
      axisScale.range(axis.getInverse() ? [0, rect.height] : [rect.height, 0]);
    }

    this._cacheRect = {
      width: rect?.width,
      height: rect?.height
    };
    this._fixedBandSize = bandSizeResult?.bandSize;

    if (isDiscrete(axisScale.type)) {
      if (bandSizeResult && (this._start || this._end)) {
        if (this.type === ComponentTypeEnum.scrollBar) {
          this._start = 0;
          this._end = 1;
        }
        this._updateRangeFactor();
      }
      const [start, end] = axisScale.rangeFactor() ?? [];
      if (isNil(start) && isNil(end)) {
        isShown = false;
      } else {
        isShown = !(start === 0 && end === 1);
      }
    } else {
      const [start, end] = axisScale.rangeFactor() ?? [this._start, this._end];
      isShown = !(start === 0 && end === 1);
    }
    this.setStartAndEnd(this._start, this._end);
    this._cacheVisibility = isShown;
    return isShown;
  }
  /*** end: auto model process  ***/

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._component] as unknown as IGroup[];
  }
}

mixin(DataFilterBaseComponent, Zoomable);
