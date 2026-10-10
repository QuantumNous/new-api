import type { PanEventParam, ZoomEventParam } from '../../event/interface';
import type { IModel } from '../../model/interface';
import type { DataSet, DataView, ITransformOptions } from '@visactor/vdataset';
import type { IGroupMark, ILabelMark, IMark } from '../../mark/interface';
import type { CoordinateType, IPoint, IPolarPoint } from '../../typings/coordinate';
import type { IRegion } from '../../region/interface';
import type { IBaseScale } from '@visactor/vscale';
import type { IAxisHelper } from '../../component/axis/cartesian/interface';
import type { IPolarAxisHelper } from '../../component/axis/polar/interface';
import type { ISeriesSeriesInfo, ISeriesSpecInfo, ISeriesStackData } from './common';
import type { ISeriesTooltipHelper } from './tooltip-helper';
import type { IInvalidType, Datum, DirectionType, IGroup, StringOrNumber } from '../../typings';
import type { ISeriesMarkAttributeContext, StateValueType } from '../../compile/mark/interface';
import type { IGeoCoordinateHelper } from '../../component/geo/interface';
import type { ILabelSpec, ILabelInfo } from '../../component/label/interface';
import type { StatisticOperations } from '../../data/transforms/interface';
import type { ILegend } from '../../component/legend/interface';
import type { IBaseTriggerOptions } from '../../interaction/interface/trigger';

// 使用类型约束系列支持的样式，但是感觉这样不合理 不使用这样的方式去做
// export interface ISeries<A extends string> extends IModel

export interface ISeries extends IModel {
  readonly type: string;
  readonly name?: string;

  // tooltip
  tooltipHelper: ISeriesTooltipHelper;

  // 配置
  getSpec: () => any;

  // 坐标系信息
  readonly coordinate: CoordinateType;

  // layout
  onLayoutEnd: () => void;

  // 数据
  getRawData: () => DataView | undefined;
  getViewDataFilter: () => DataView | undefined;
  getViewData: () => DataView | undefined;
  getViewDataProductId: () => string | undefined;
  getRawDataStatisticsByField: (field: string, isNumeric?: boolean) => { values?: any[]; min?: number; max?: number };
  getViewDataStatistics?: () => DataView | undefined;
  getDataSet?: () => DataSet;
  getFieldAlias: (field: string) => string;
  // 更新原始数据
  updateRawData: (d: any) => void;
  setData?: (dv: DataView) => void;
  rawDataUpdate: (d: DataView) => void;
  viewDataUpdate: (d: DataView) => void;
  viewDataStatisticsUpdate: (d: DataView) => void;
  addViewDataFilter: (option: ITransformOptions) => void;
  reFilterViewData: () => void;
  reTransformViewData: () => void;
  fillData: () => void;
  isHierarchyData?: () => boolean;
  getMarkData?: (d: Datum) => Datum;

  /**
   * 常见数据使用问题
   *
   * 一、使用图表最终展示数据
   * 比如 markline，数值轴 这样的组件
   * 需要操作展示数据，做 筛选 ｜ 变换 的
   * 比如图例，datazoom
      series.getViewData().transform({},false)
   * 需要获取展示数据，生成自身数据做自身展示的 使用消息机制。比如 轴
      series.event.on('viewDataStatisticsUpdate' ｜ 'viewDataUpdate', { filter: ({ model }) => model?.id === series.id }, () => {
        this.updateData();
      });
   *
   * 二、使用图表原始数据
   * 比如图例，datazoom
   * 需要使用原始数据信息，生成自身数据
   * 比如图例，datazoom
      series.getRawData().parserData  ｜   latestData    // parserData latestData 区别见下面说明
      series.getRawDataStatistics().latestData

      series.event.on('rawDataUpdate', { filter: ({ model }) => model?.id === series.id }, () => {
        this.updateData();
      });
   * 或者使用系列自身的特殊api 特殊情况外不建议这样用
      series.getSeriesInfoList()

   * 建议：使用数据时需要注意数据更新，使用系列数据更新组件数据的场景，只建议使用消息监听
      series.event.on(
        'viewDataStatisticsUpdate' ｜
        'viewDataUpdate' |
        'rawDataUpdate',
        { filter: ({ model }) => model?.id === series.id })
   */

  // 区域
  getRegion: () => IRegion;

  // mark
  initMark: () => void;
  getMarks: () => IMark[];
  getMarksWithoutRoot: () => IMark[];
  getMarkNameMap: () => Record<string, IMark>;
  getMarksInType: (type: string | string[]) => IMark[];
  getMarkInName: (name: string) => IMark | undefined;
  getMarkInId: (id: number) => IMark | undefined;

  getRootMark: () => IGroupMark;
  getActiveMarks: () => IMark[];
  getSeriesMark: () => IMark;

  // example
  /**
   *  [
   *  {
   *    fields: {
   *       x: '周一',
   *       __VChart_STACK: 'stack'
   *    },
   *    valueField: 'y',
   *    values: [{x: '周一', y: 20}];
   *  },
   *  {
   *    fields: {
   *       x: '周一',
   *       stack: 'stackA'
   *    },
   *    valueField: 'y',
   *    values: [{x: '周一', y: 20, stack: 'stackA'}];
   *  },
   *  {
   *    fields: {
   *       x: '周一',
   *       stack: 'stackB'
   *    },
   *    valueField: 'y',
   *    values: [{x: '周一', y: 20, stack: 'stackB'}];
   *  },
   *  ]
   */
  getStackData: () => ISeriesStackData;

  getStack: () => boolean;
  getStackValue: () => StringOrNumber | undefined;
  getPercent: () => boolean;
  getStackOffsetSilhouette: () => boolean;

  getStackValueField: () => string;
  setValueFieldToStack: () => void;
  setValueFieldToPercent: () => void;
  setValueFieldToStackOffsetSilhouette: () => void;

  getStackGroupFields: () => string[];
  getSeriesField: () => string | undefined;
  getSeriesKeys: () => string[];
  getSeriesStyle: (datum: Datum) => ISeriesSeriesInfo['style'];
  getSeriesInfoInField: (field: string) => ISeriesSeriesInfo[];
  getSeriesInfoList: () => ISeriesSeriesInfo[];
  getGroups: () => IGroup | undefined;
  getDimensionField: () => string[];
  getMeasureField: () => string[];
  getStatisticFields: () => { key: string; operations: StatisticOperations }[];
  getDatumPositionValues: (datum: Datum, fields: string | string[]) => any[];
  getDatumPositionValue: (datum: Datum, field: string) => any;

  setSeriesField: (field: string) => void;
  handleZoom?: (e: ZoomEventParam) => void;
  handlePan?: (e: PanEventParam) => void;

  // 数据映射
  dataToPosition: (datum: Datum, checkInViewData?: boolean) => IPoint | null;
  dataToPositionX: (datum: Datum) => number | null;
  dataToPositionY: (datum: Datum) => number | null;
  dataToPositionZ?: (datum: Datum) => number | null;
  valueToPosition: (value1: any, value2?: any) => IPoint;

  getColorAttribute: () => { scale: IBaseScale; field: string };
  getDefaultColorDomain: () => any[];

  getInvalidType: () => IInvalidType;

  // 交互

  /**
   * 获取系列默认的缩略图形
   * @returns 默认的缩略图形
   */
  getDefaultShapeType: () => string;
  /** 获取系列标签配置 */
  initLabelMarkStyle?: (labelMark: ILabelMark, labelSpec: ILabelSpec) => void;
  /** 设置总计标签配置 */
  initTotalLabelMarkStyle?: (labelMark: ILabelMark) => void;
  getTotalLabelComponentStyle?: (info: Pick<ILabelInfo, 'baseMark' | 'labelMark'>) => any;

  getGroupFields: () => string[];

  getSpecInfo: () => ISeriesSpecInfo;
  getMarkAttributeContext: () => ISeriesMarkAttributeContext;

  getSeriesFieldValue: (datum: Datum, seriesField?: string) => any;

  legendSelectedFilter?: (component: ILegend, selectedKeys: StringOrNumber[]) => StringOrNumber[];
  parseLabelStyle?: (labelStyle: any, labelSpec: any, labelMark?: ILabelMark) => any;

  getInteractionTriggers?: () => { trigger: Partial<IBaseTriggerOptions>; marks: IMark[] }[];
}

export interface ICartesianSeries extends ISeries {
  readonly coordinate: 'cartesian';
  readonly direction: DirectionType;

  scaleX: IBaseScale;
  setScaleX: (s: IBaseScale) => void;
  scaleY: IBaseScale;
  setScaleY: (s: IBaseScale) => void;
  scaleZ?: IBaseScale;
  setScaleZ: (s: IBaseScale) => void;
  // 要考虑基于多个field的场景
  fieldX: string[];
  setFieldX: (field: string | string[], level?: number) => void;
  fieldX2: string;
  setFieldX2: (field: string) => void;
  fieldY: string[];
  setFieldY: (field: string | string[], level?: number) => void;
  fieldY2: string;
  setFieldY2: (field: string) => void;
  fieldZ?: string[];
  setFieldZ: (field: string | string[], level?: number) => void;

  positionToData: (p: IPoint) => any | null;
  positionToDataX: (xPos: number) => any | null;
  positionToDataY: (yPos: number) => any | null;

  // 轴API
  getXAxisHelper: () => IAxisHelper;
  setXAxisHelper: (h: IAxisHelper) => void;
  getYAxisHelper: () => IAxisHelper;
  setYAxisHelper: (h: IAxisHelper) => void;
  getZAxisHelper: () => IAxisHelper | undefined;
  setZAxisHelper: (h: IAxisHelper) => void;

  dataToPositionX1: (datum: Datum) => number | null;
  dataToPositionY1: (datum: Datum) => number | null;

  valueToPosition: (value1: any, value2: any) => IPoint;
  valueToPositionX: (value: StringOrNumber | StringOrNumber[], datum?: any) => any;
  valueToPositionY: (value: StringOrNumber | StringOrNumber[], datum?: any) => any;
}

export interface IPolarSeries extends ISeries {
  readonly coordinate: 'polar';

  outerRadius: number;
  innerRadius: number;

  getRadiusField: () => string[];
  setRadiusField: (field: string | string[], level?: number) => void;
  getAngleField: () => string[];
  setAngleField: (field: string | string[], level?: number) => void;

  // 轴将是一个实现了 scale 的组件。这里接收的可以是一个轴
  radiusScale: IBaseScale;
  setRadiusScale: (s: IBaseScale) => void;
  angleScale: IBaseScale;
  setAngleScale: (s: IBaseScale) => void;

  // TODO:
  positionToData: (point: IPolarPoint) => any;
  radiusToData: (radius: number) => any;
  angleToData: (angle: number) => any;

  // 轴
  radiusAxisHelper: IPolarAxisHelper;
  angleAxisHelper: IPolarAxisHelper;

  valueToPosition: (value1: any, value2: any) => IPoint;
}

export interface IGeoSeries extends ISeries {
  readonly coordinate: 'geo';

  nameField?: string;
  valueField?: string;

  getMapViewData: () => DataView;
  getNameProperty: () => string;

  dataToPosition: (datum: any, checkInViewData?: boolean) => IPoint | null;
  dataToLatitude: (latValue: any) => number | null;
  dataToLongitude: (lonValue: any) => number | null;
  nameValueToPosition: (name: string) => IPoint | null;

  positionToData: (p: IPoint) => any;
  latitudeToData: (lat: number) => any;
  longitudeToData: (lon: number) => any;

  getCoordinateHelper: () => IGeoCoordinateHelper;
  setCoordinateHelper: (helper: IGeoCoordinateHelper) => void;

  valueToPosition: (value1: any, value2: any) => IPoint;
  getDatumCenter: (datum: any) => [number, number];
}

// 收拢扇区标签形式依赖的 api
export interface IArcSeries extends IPolarSeries {
  getCenter: () => IPoint;
  getRadius: (state?: StateValueType) => number;
  getInnerRadius: (state?: StateValueType) => number;

  computeRadius: (r: number, k?: number) => number;
  computeDatumRadius: (datum: any, state?: StateValueType) => number;
}

export interface IFunnelSeries extends ISeries {
  getPoints: (datum: any) => IPoint[];
  getCategoryField: () => string;

  valueToPosition: (value: any) => IPoint;
}
