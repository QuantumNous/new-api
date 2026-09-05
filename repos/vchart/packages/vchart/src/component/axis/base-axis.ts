import type { IGroup } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import type { ITickDataOpt, AxisItem } from '@visactor/vrender-components/axis/type';
import type { IBandLikeScale, IBaseScale, IContinuousScale } from '@visactor/vscale';
// eslint-disable-next-line no-duplicate-imports
import { isContinuous } from '@visactor/vscale';
import type { IGraphic } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import type {
  IOrientType,
  IPolarOrientType,
  Datum,
  StringOrNumber,
  IGroup as ISeriesGroup,
  CoordinateType
} from '../../typings';
import { BaseComponent } from '../base/base-component';
import { CompilableData } from '../../compile/data';
import { AxisEnum, GridEnum, type IAxis, type ICommonAxisSpec, type ITick } from './interface';
import { ComponentTypeEnum, type IComponentOption } from '../interface';
import { eachSeries, getSeries } from '../../util/model';
// eslint-disable-next-line no-duplicate-imports
import { mergeSpec } from '@visactor/vutils-extension';
import type { ISeries } from '../../series/interface';
import { ChartEvent } from '../../constant/event';
import { LayoutZIndex } from '../../constant/layout';
import { animationConfig } from '../../animation/utils';
// eslint-disable-next-line no-duplicate-imports
import {
  degreeToRadian,
  pickWithout,
  isEqual,
  array,
  get,
  isArray,
  isFunction,
  isNil,
  isValid,
  maxInArray
} from '@visactor/vutils';
import { DEFAULT_TITLE_STYLE, transformAxisLineStyle } from './util';
import { transformAxisLabelStateStyle, transformStateStyle, transformToGraphic } from '../../util/style';
import type { ITransformOptions } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import { DataView } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import { registerComponentMark } from '../../mark/component';
import { Factory } from '../../core/factory';
// eslint-disable-next-line no-duplicate-imports
import { GroupTransition } from '@visactor/vrender-components/axis/animate/group-transition';
import { AXIS_ELEMENT_NAME } from '@visactor/vrender-components/axis/constant';
// eslint-disable-next-line no-duplicate-imports
import { GroupFadeOut, GroupFadeIn } from '@visactor/vrender-animate/custom/groupFade';
import { scaleParser } from '../../data/parser/scale';
import { registerDataSetInstanceParser } from '../../data/register';
import { getFormatFunction } from '../util';
import type { IComponentMark } from '../../mark/interface/mark';
import type { ICompilableMark } from '../../compile/mark';
import type { ICompilableData } from './../../compile/data/interface';
import { transformFunctionAttribute } from '../../util/spec/transform';

const AXIS_COMPONENT_ONLY_CHANGE_KEYS: Record<string, true> = {
  grid: true,
  subGrid: true,
  tick: true,
  subTick: true,
  label: true,
  domainLine: true,
  title: true,
  maxWidth: true,
  minWidth: true,
  maxHeight: true,
  minHeight: true
};

export abstract class AxisComponent<T extends ICommonAxisSpec & Record<string, any> = any> // FIXME: 补充公共类型，去掉 Record<string, any>
  extends BaseComponent<T>
  implements IAxis
{
  static specKey = 'axes';
  specKey = 'axes';

  protected _orient: IPolarOrientType | IOrientType;
  getOrient() {
    return this._orient;
  }

  protected _scale!: IBaseScale;
  getScale() {
    return this._scale;
  }

  protected _scales: IBaseScale[] = [];
  getScales() {
    return this._scales;
  }

  protected _tickData: CompilableData[] = [];
  getTickData(index = 0) {
    return this._tickData[index];
  }

  // 与系列的关联关系
  // 优先级：id > index
  // 最终结果：series & region取交集
  protected _seriesUserId?: StringOrNumber[];
  protected _seriesIndex?: number[];
  protected _regionUserId?: StringOrNumber[];
  protected _regionIndex?: number[];

  /**
   * if axis will be shown
   */
  protected _visible: boolean = true;
  getVisible() {
    return this._visible;
  }
  get visible() {
    return this._visible;
  }

  protected _specVisible: boolean = true;
  protected _hideWhenEmpty: boolean = false;

  /** 轴是否产生反转的真实值，在横向图表的竖轴上可能和用户在 spec 上配的值相反 */
  protected _inverse: boolean;
  getInverse() {
    return this._inverse;
  }

  protected _tick: ITick | undefined = undefined;
  protected abstract computeDomain(data: { min: number; max: number; values: any[] }[]): StringOrNumber[];
  abstract valueToPosition(value: any): number;
  protected abstract axisHelper(): any;
  protected abstract getSeriesStatisticsField(s: ISeries): string[];
  protected abstract updateSeriesScale(): void;
  protected abstract collectSeriesField(depth: number, series: ISeries): string | string[];
  abstract transformScaleDomain(): void;
  abstract updateScaleRange(): boolean;
  protected abstract getDefaultInteractive(): boolean;

  protected _dataFieldText: string;
  protected _axisMark: IComponentMark;

  protected _gridMark: IComponentMark;

  protected _coordinateType: CoordinateType;
  getCoordinateType() {
    return this._coordinateType;
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);
    this._specVisible = spec.visible ?? true;
    this._hideWhenEmpty = spec.hideWhenEmpty ?? false;
    this._visible = this._specVisible;
    this._coordinateType = 'none';
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this._specVisible = this._spec.visible ?? true;
    this._hideWhenEmpty = this._spec.hideWhenEmpty ?? false;
    this._visible = this._specVisible;

    if (this._scale) {
      this._refreshVisibilityByData();
    }
  }

  getVRenderComponents() {
    return [this._axisMark?.getProduct(), this._gridMark?.getProduct()].filter(isValid);
  }

  created() {
    super.created();
    //series and regions
    this.setSeriesAndRegionsFromSpec();
    // event
    this.initEvent();
    // scales
    this.initScales();
    this.updateSeriesScale();
    this._refreshVisibilityByData();
    // data
    this._shouldComputeTickData() && this._initData();

    if (this._specVisible) {
      // 创建语法元素
      const axisMark = this._createMark(
        { type: 'component', name: `axis-${this.getOrient()}` },
        {
          componentType: this.getOrient() === 'angle' ? AxisEnum.circleAxis : AxisEnum.lineAxis,
          mode: this._spec.mode
        },
        {
          skipTheme: true // skip theme of vgrammar to avoid merge
        }
      );
      this._updateTickDataMarks(axisMark);
      this._axisMark = axisMark as IComponentMark;
      axisMark.setMarkConfig({ zIndex: this.layoutZIndex });
      if (isValid(this._spec.id)) {
        axisMark.setUserId(this._spec.id);
      }
      axisMark.setMarkConfig({ interactive: this._spec.interactive ?? this.getDefaultInteractive() });
      this._marks.addMark(axisMark);

      if (this._spec.grid?.visible) {
        const gridMark = this._createMark(
          { type: 'component', name: `axis-${this.getOrient()}-grid` },
          {
            componentType: this.getOrient() === 'angle' ? GridEnum.circleAxisGrid : GridEnum.lineAxisGrid,
            mode: this._spec.mode
          },
          {
            skipTheme: true
          }
        );

        this._updateTickDataMarks(gridMark);
        gridMark.setMarkConfig({
          zIndex: this._spec.grid?.style?.zIndex ?? this._spec.grid?.zIndex ?? LayoutZIndex.Axis_Grid,
          interactive: false // 轴网格线关闭交互
        });
        this._marks.addMark(gridMark);
        this._gridMark = gridMark as IComponentMark;
      }

      this._syncComponentVisibility();

      // Tip: 支持 spec.animationAppear.axis，并且坐标轴默认关闭动画
      if (
        this._option.globalInstance?.isAnimationEnable() &&
        get(this._option.getChart().getSpec(), 'animation') !== false &&
        this._spec.animation === true
      ) {
        const axisAnimateConfig = animationConfig(Factory.getAnimationInKey('axis')?.(), {
          appear:
            this._spec.animationAppear ??
            get(this._option.getChart().getSpec(), 'animationAppear.axis') ??
            get(this._option.getChart().getSpec(), 'animationAppear'),
          disappear:
            this._spec.animationDisappear ??
            get(this._option.getChart().getSpec(), 'animationDisappear.axis') ??
            get(this._option.getChart().getSpec(), 'animationDisappear'),
          enter:
            this._spec.animationEnter ??
            get(this._option.getChart().getSpec(), 'animationEnter.axis') ??
            get(this._option.getChart().getSpec(), 'animationEnter'),
          exit:
            this._spec.animationExit ??
            get(this._option.getChart().getSpec(), 'animationExit.axis') ??
            get(this._option.getChart().getSpec(), 'animationExit'),
          update:
            this._spec.animationUpdate ??
            get(this._option.getChart().getSpec(), 'animationUpdate.axis') ??
            get(this._option.getChart().getSpec(), 'animationUpdate')
        });
        // 因为坐标轴的更新动画中处理了 enter，所以需要将 enter 的参数传入
        if (axisAnimateConfig.enter) {
          axisAnimateConfig.update[0].customParameters = {
            enter: axisAnimateConfig.enter[0]
          };
        }
        this._marks.forEach(m => m.setAnimationConfig(axisAnimateConfig));
      }
    }
  }

  protected _shouldComputeTickData() {
    // 当轴被展示、或者强制要求计算 data 时再计算 data
    return this.getVisible() || this._spec.forceInitTick || (this._specVisible && this._hideWhenEmpty);
  }

  protected _onTickDataChange = (tickData?: ICompilableData) => {
    this._forceLayout();
    tickData?.updateData();
  };

  // data
  protected _initData() {
    const tickData = this._initTickDataSet(this._tickTransformOption());
    const tickDataCompile = new CompilableData(this._option, tickData);
    this._tickData = [tickDataCompile];
    tickData.target.addListener('change', () => {
      this._onTickDataChange(tickDataCompile);
    });
  }

  protected collectData(depth: number, rawData?: boolean) {
    const data: { min: number; max: number; values: any[] }[] = [];
    this._regions &&
      eachSeries(
        this._regions,
        s => {
          let field = this.collectSeriesField(depth, s);
          field = (isArray(field) ? (isContinuous(this._scale.type) ? field : [field[0]]) : [field]) as string[];
          if (!depth) {
            this._dataFieldText = s.getFieldAlias(field[0]);
          }

          if (field) {
            const viewData = s.getViewData();
            if (rawData) {
              field.forEach(f => {
                data.push(
                  s.getRawDataStatisticsByField(f, !!isContinuous(this._scale.type)) as {
                    min: number;
                    max: number;
                    values: any[];
                  }
                );
              });
            } else if (viewData && viewData.latestData && viewData.latestData.length) {
              const seriesData = s.getViewDataStatistics?.();
              const userSetBreaks =
                this.type === ComponentTypeEnum.cartesianLinearAxis && this._spec.breaks && this._spec.breaks.length;

              field.forEach(f => {
                if (seriesData?.latestData?.[f]) {
                  if (userSetBreaks) {
                    data.push({
                      ...seriesData.latestData[f],
                      values: viewData.latestData.map((obj: Datum) => obj[f])
                    });
                  } else {
                    data.push(seriesData.latestData[f]);
                  }
                }
              });
            }
          }
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
    return data;
  }

  protected isSeriesDataEnable() {
    let enable = true;
    eachSeries(
      this._regions,
      s => {
        if (isArray(s.getViewDataStatistics()?.latestData)) {
          enable = false;
        }
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
    return enable;
  }

  protected setSeriesAndRegionsFromSpec() {
    const { seriesId, seriesIndex, regionId, regionIndex } = this._spec;
    isValid(seriesId) && (this._seriesUserId = array(seriesId));
    isValid(regionId) && (this._regionUserId = array(regionId));
    isValid(seriesIndex) && (this._seriesIndex = array(seriesIndex));
    isValid(regionIndex) && (this._regionIndex = array(regionIndex));
    this._regions = this._option.getRegionsInUserIdOrIndex(this._regionUserId as string[], this._regionIndex);
    // _regions 被更新了，layoutBindRegionID 也要更新
    this.layout.layoutBindRegionID = this._regions.map(x => x.id);
  }

  getBindSeriesFilter() {
    return {
      userId: this._seriesUserId,
      specIndex: this._seriesIndex
    };
  }

  protected initEvent() {
    this.event.on(
      ChartEvent.scaleUpdate,
      { filter: ({ model }) => model?.id === this.id },
      this.effect.scaleUpdate.bind(this)
    );
    const viewStatistics = getSeries(this._regions, {
      userId: this._seriesUserId,
      specIndex: this._seriesIndex
    })
      .map(s => s.getViewDataStatistics())
      .filter(v => !!v);

    if (viewStatistics.length > 1) {
      this._option.dataSet.multipleDataViewAddListener(viewStatistics, 'change', () => {
        this.updateScaleDomain();
      });
    } else if (viewStatistics.length === 1) {
      viewStatistics[0].target.addListener('change', () => {
        this.updateScaleDomain();
      });
    }

    eachSeries(
      this._regions,
      s => {
        s.event.on(ChartEvent.rawDataUpdate, { filter: ({ model }) => model?.id === s.id }, () => {
          // 只清除，不更新，在需要时，更新一次。避免多系列下多次更新
          this._clearRawDomain();
        });
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
  }

  protected updateScaleDomain() {
    // 留给各个类型的 axis 来 override
  }

  protected _hasCollectedSeriesData() {
    return this.collectData(0).length > 0;
  }

  protected _refreshVisibilityByData() {
    const nextVisible = this._specVisible && (!this._hideWhenEmpty || this._hasCollectedSeriesData());
    const changed = this._visible !== nextVisible;
    this._visible = nextVisible;

    if (this._axisMark || this._gridMark) {
      this._syncComponentVisibility();
    }

    if (changed) {
      this._forceLayout();
    }

    return changed;
  }

  protected _syncComponentVisibility() {
    this._axisMark?.setVisible(this._visible);
    this._gridMark?.setVisible(this._visible && this._spec.grid?.visible !== false);

    (this._axisMark?.getComponent?.() as IGroup)?.setAttributes?.({ visibleAll: this._visible });
    (this._gridMark?.getComponent?.() as IGroup)?.setAttributes?.({
      visibleAll: this._visible && this._spec.grid?.visible !== false
    });
  }

  protected _clearRawDomain() {
    // 留给各个类型的 axis 来 override
  }

  onLayoutEnd(): void {
    const changed = this.updateScaleRange();

    this.event.emit(ChartEvent.scaleUpdate, { model: this, value: 'range' });

    super.onLayoutEnd();
  }

  protected computeData(updateType?: 'domain' | 'range' | 'force'): void {
    // 对应问题#3287: 轴隐藏(tickData为[])时, dataZoom/scrollBar无法触发视图更新
    // 解决方式: dataZoom/scrollBar更新时, 使用force, 此时即使没有tickData也要触发视图更新
    // ps:
    // 1. 其他逻辑没有使用force更新, 所以不会带来额外影响
    // 2. force更新时, 如果有tickData仍然走老逻辑, 这里只考虑force && 无tickData的情况
    if (updateType === 'force' && (!this._tickData || !this._tickData.length)) {
      eachSeries(
        this._regions,
        s => {
          s.getViewData()?.reRunAllTransform();
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
    } else if (
      this._tickData &&
      this._tickData.length &&
      (updateType === 'force' || !isEqual(this._scale.range(), [0, 1]))
    ) {
      this._tickData.forEach(tickData => {
        tickData.getDataView().reRunAllTransform({
          skipEqual: true
        });
      });
    }
  }

  protected _updateTickDataMarks(m: ICompilableMark) {
    if (this._tickData) {
      this._tickData.forEach(d => {
        d.addRelatedMark(m);
      });
    }
  }

  protected initScales() {
    this._scales = [this._scale];
    const groups: ISeriesGroup[] = [];
    eachSeries(
      this._regions,
      s => {
        const g = s.getGroups();
        g && groups.push(g);
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
    if (groups.length !== 0) {
      const depth = maxInArray(groups.map(g => g.fields.length));
      for (let i = 1; i < depth; i++) {
        const scale = this._scale.clone();
        this._scales.push(scale);
      }
    }
    // this.updateScaleDomain();
  }

  /** Update API **/
  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    if (result.reMake) {
      return result;
    }
    const specChanged = !isEqual(prevSpec, spec);

    result.reRender = true;
    /**
     * 存在轴同步相关配置的时候，暂时通过`reMake`触发更新
     */
    if (prevSpec?.type !== spec?.type || prevSpec?.visible !== spec?.visible) {
      result.reMake = true;
      return result;
    }

    if (spec?.grid?.visible === true && prevSpec?.grid?.visible !== true && !this._gridMark) {
      result.reMake = true;
      return result;
    }

    if (specChanged && !result.reMake && this._isComponentOnlySpecChange(spec, prevSpec)) {
      result.effects = {
        ...result.effects,
        component: true,
        layout: true,
        render: true
      };
    }

    return result;
  }

  private _isComponentOnlySpecChange(spec: T, prevSpec: T) {
    const keys = Object.keys({
      ...prevSpec,
      ...spec
    });

    return keys.every(key => {
      return isEqual(prevSpec?.[key], spec?.[key]) || AXIS_COMPONENT_ONLY_CHANGE_KEYS[key];
    });
  }

  protected _getAxisAttributes() {
    const spec = this._spec;
    const axisAttrs: any = {
      orient: this.getOrient(),
      select: this._option.disableTriggerEvent === true ? false : spec.select,
      hover: this._option.disableTriggerEvent === true ? false : spec.hover
    };

    // 属性均需要显示开启
    if (spec.domainLine && spec.domainLine.visible) {
      axisAttrs.line = transformAxisLineStyle(spec.domainLine);
    } else {
      axisAttrs.line = { visible: false };
    }

    if (spec.label && spec.label.visible) {
      const labelSpec = pickWithout(spec.label, ['style', 'formatMethod', 'state']);
      axisAttrs.label = labelSpec;
      if (spec.label.style) {
        axisAttrs.label.style = isFunction(spec.label.style)
          ? (datum: Datum, index: number, data: Datum[], layer?: number) => {
              const style = spec.label.style(datum.rawValue, index, datum, data, layer);
              return transformToGraphic(mergeSpec({}, this._theme.label?.style, style));
            }
          : transformToGraphic(spec.label.style);
      }
      if (spec.label.formatMethod || spec.label.formatter) {
        axisAttrs.label.formatMethod = this._getLabelFormatMethod();
      }
      if (spec.label.state) {
        axisAttrs.label.state = transformAxisLabelStateStyle(spec.label.state);
      }
      if (isFunction(spec.label.dataFilter)) {
        axisAttrs.label.dataFilter = (data: AxisItem[], layer: number) =>
          spec.label.dataFilter(data, layer, { vchart: this._option.globalInstance });
      }
    } else {
      axisAttrs.label = {
        visible: false
      };
    }

    if (spec.tick && spec.tick.visible) {
      axisAttrs.tick = {
        visible: spec.tick.visible,
        length: spec.tick.tickSize,
        inside: spec.tick.inside,
        alignWithLabel: spec.tick.alignWithLabel,
        dataFilter: isFunction(spec.tick.dataFilter)
          ? (data: AxisItem[]) => spec.tick.dataFilter(data, { vchart: this._option.globalInstance })
          : undefined
      };
      if (spec.tick.style) {
        axisAttrs.tick.style = isFunction(spec.tick.style)
          ? (value: number, index: number, datum: Datum, data: Datum[]) => {
              const style = (spec.tick.style as any)(value, index, datum, data);
              return transformToGraphic(mergeSpec({}, this._theme.tick?.style, style));
            }
          : transformToGraphic(spec.tick.style);
      }
      if (spec.tick.state) {
        axisAttrs.tick.state = transformStateStyle(spec.tick.state);
      }
    } else {
      axisAttrs.tick = {
        visible: false
      };
    }

    if (spec.subTick && spec.subTick.visible) {
      axisAttrs.subTick = {
        visible: spec.subTick.visible,
        length: spec.subTick.tickSize,
        inside: spec.subTick.inside,
        count: spec.subTick.tickCount
      };
      if (spec.subTick.style) {
        axisAttrs.subTick.style = isFunction(spec.subTick.style)
          ? (value: number, index: number, datum: Datum, data: Datum[]) => {
              const style = (spec.subTick.style as any)(value, index, datum, data);
              return transformToGraphic(mergeSpec({}, this._theme.subTick?.style, style));
            }
          : transformToGraphic(spec.subTick.style);
      }
      if (spec.subTick.state) {
        axisAttrs.subTick.state = transformStateStyle(spec.subTick.state);
      }
    } else {
      axisAttrs.subTick = {
        visible: false
      };
    }

    if (spec.title && spec.title.visible) {
      const {
        autoRotate,
        angle,
        style: titleStyle = {},
        background: titleBackgroundSpec,
        state: titleState,
        shape: titleShapeSpec,
        ...restTitleAttrs
      } = spec.title;
      let titleAngle = angle;
      let titleTextStyle;
      if (spec.orient === 'left' || spec.orient === 'right') {
        // 处理纵轴的标题样式
        if (autoRotate && isNil(titleAngle)) {
          titleAngle = spec.orient === 'left' ? -90 : 90;
          titleTextStyle = (DEFAULT_TITLE_STYLE as any)[spec.orient];
        }
      }

      axisAttrs.title = {
        ...restTitleAttrs,
        autoRotate: false, // 默认不对外提供该配置
        angle: titleAngle ? degreeToRadian(titleAngle) : null,
        textStyle: mergeSpec({}, titleTextStyle, transformToGraphic(titleStyle)),
        pickable: titleStyle.pickable !== false,
        childrenPickable: titleStyle.pickable !== false,
        state: {}
      };

      if (titleShapeSpec && titleShapeSpec.visible) {
        axisAttrs.title.shape = {
          ...titleShapeSpec,
          style: transformToGraphic(titleShapeSpec.style)
        };
        if (titleShapeSpec.state) {
          axisAttrs.title.state.shape = transformStateStyle(titleShapeSpec.state);
        }
      } else {
        axisAttrs.title.shape = { visible: false };
      }

      if (titleBackgroundSpec && titleBackgroundSpec.visible) {
        axisAttrs.title.background = {
          ...titleBackgroundSpec,
          style: transformToGraphic(titleBackgroundSpec.style)
        };
        if (titleBackgroundSpec.state) {
          axisAttrs.title.state.background = transformStateStyle(titleBackgroundSpec.state);
        }
      } else {
        axisAttrs.title.background = { visible: false };
      }

      if (titleState) {
        axisAttrs.title.state.text = transformStateStyle(titleState);
      }
    } else {
      axisAttrs.title = {
        visible: false
      };
    }

    if (spec.background && spec.background.visible) {
      axisAttrs.panel = {
        visible: true
      };
      if (spec.background.style) {
        axisAttrs.panel.style = transformToGraphic(spec.background.style);
      }
      if (spec.background.state) {
        axisAttrs.panel.state = transformStateStyle(spec.background.state);
      }
    } else {
      axisAttrs.panel = {
        visible: false
      };
    }

    return axisAttrs;
  }

  protected _getGridAttributes() {
    const spec = this._spec;
    return {
      alternateColor: transformFunctionAttribute(spec.grid.alternateColor),
      alignWithLabel: spec.grid.alignWithLabel,
      style: isFunction(spec.grid.style)
        ? (datum: Datum, index: number) => {
            const style = spec.grid.style(datum.datum?.rawValue, index, datum.datum);
            return transformToGraphic(mergeSpec({}, this._theme.grid?.style, style));
          }
        : transformToGraphic(spec.grid.style),
      subGrid:
        spec.subGrid.visible === false
          ? { visible: false }
          : {
              type: 'line',
              visible: spec.subGrid.visible,
              alternateColor: transformFunctionAttribute(spec.subGrid.alternateColor),
              style: transformToGraphic(spec.subGrid.style)
            }
    };
  }

  protected _getLabelFormatMethod() {
    const { formatMethod, formatter } = this._spec.label;
    const { formatFunc } = getFormatFunction(formatMethod, formatter);
    return formatFunc ? (value: any, datum: any, index: number) => formatFunc(datum.rawValue, datum, formatter) : null;
  }

  protected abstract registerTicksTransform(): string;

  protected _initTickDataSet<T extends ITickDataOpt>(options: T, index: number = 0) {
    registerDataSetInstanceParser(this._option.dataSet, 'scale', scaleParser);
    const name = this.registerTicksTransform();
    const tickData = new DataView(this._option.dataSet, { name: `${this.type}_${this.id}_ticks_${index}` })
      .parse(this._scales[index], {
        type: 'scale'
      })
      .transform(
        {
          type: name,
          options
        },
        false
      );
    return tickData;
  }

  protected _tickTransformOption(): ITickDataOpt {
    const tick = this._tick || {};
    const label = this._spec.label || {};
    const { tickCount, forceTickCount, tickStep, tickMode } = tick;
    const { style: labelStyle, formatMethod: labelFormatter, minGap: labelGap } = label;
    return {
      sampling: this._spec.sampling !== false,
      tickCount,
      forceTickCount,
      tickStep,
      tickMode,
      axisOrientType: this._orient,
      coordinateType: this._coordinateType,

      labelStyle,
      labelFormatter,
      labelGap
    };
  }

  addTransformToTickData(options: ITransformOptions, execute?: boolean) {
    this._tickData.forEach(tickData => {
      tickData?.getDataView()?.transform(options, execute);
    });
  }

  dataToPosition(values: any[]): number {
    return this._scale.scale(values);
  }

  getDatum(childGraphic?: IGraphic) {
    if (childGraphic && childGraphic.name === AXIS_ELEMENT_NAME.label) {
      return childGraphic.data;
    }

    if (this._axisMark) {
      return (this._axisMark.getComponent() as any)?.attribute.items;
    }
  }

  scaleRangeFactor(_?: [number, number], slience?: boolean, clear?: boolean) {
    this._onTickDataChange(this.getTickData());
    return (this.getScale() as IContinuousScale | IBandLikeScale).rangeFactor(_, slience, clear);
  }

  scaleRangeFactorEnd(_?: number, slience?: boolean, clear?: boolean) {
    this._onTickDataChange(this.getTickData());
    return (this.getScale() as IContinuousScale | IBandLikeScale).rangeFactorEnd(_, slience);
  }

  scaleRangeFactorStart(_?: number, slience?: boolean, clear?: boolean) {
    this._onTickDataChange(this.getTickData());
    return (this.getScale() as IContinuousScale | IBandLikeScale).rangeFactorStart(_, slience);
  }
}

export const registerAxis = () => {
  registerComponentMark();
  Factory.registerAnimation('axis', () => ({
    appear: {
      type: 'fadeIn'
    },
    enter: {
      type: 'fadeIn'
    },
    update: {
      type: 'update'
    },
    exit: {
      type: 'fadeOut'
      // custom: GroupFadeOut
    }
  }));
};
