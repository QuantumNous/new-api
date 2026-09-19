import type { StringOrNumber } from '@visactor/vchart';
import {
  AttributeLevel,
  CartesianSeries,
  Factory,
  MarkTypeEnum,
  SeriesMarkNameEnum,
  baseSeriesMark,
  registerSymbolMark,
  registerTextMark,
  registerLineMark,
  registerPathMark,
  STATE_VALUE_ENUM,
  type Datum,
  type IMark,
  type IPoint,
  type SeriesMarkMap,
  BaseSeriesSpecTransformer
} from '@visactor/vchart';
import { EVENT_SERIES_TYPE } from './constant';
import type { IEventSeriesSpec, LabelPosition } from './interface';
import { event } from './theme';
import { isValid } from '@visactor/vutils';

type AxisHelper = {
  isContinuous?: boolean;
  getSpec?: () => { type?: string };
  dataToPosition?: (values: unknown[], cfg?: { bandPosition?: number }) => number;
  valueToPosition?: (value: unknown) => number;
};

const eventSeriesMark = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.line]: { name: SeriesMarkNameEnum.line, type: MarkTypeEnum.line },
  [SeriesMarkNameEnum.dot]: { name: SeriesMarkNameEnum.dot, type: MarkTypeEnum.symbol },
  icon: { name: 'icon', type: MarkTypeEnum.symbol },
  [SeriesMarkNameEnum.title]: { name: SeriesMarkNameEnum.title, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.subTitle]: { name: SeriesMarkNameEnum.subTitle, type: MarkTypeEnum.text },
  arrow: { name: 'arrow', type: MarkTypeEnum.path }
} as any;

export class EventSeries<T extends IEventSeriesSpec = IEventSeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = EVENT_SERIES_TYPE;
  type = EVENT_SERIES_TYPE as any;

  static readonly mark: SeriesMarkMap = eventSeriesMark;
  static readonly builtInTheme = { event };
  static readonly transformerConstructor = BaseSeriesSpecTransformer as any;
  readonly transformerConstructor = BaseSeriesSpecTransformer as any;

  readonly coordinate: 'cartesian' = 'cartesian';

  protected declare _spec: T;

  private _dotMark?: IMark;
  private _iconMark?: IMark;
  private _titleMark?: IMark;
  private _subTitleMark?: IMark;
  private _axisLineMark?: IMark;
  private _arrowMark?: IMark;

  private _timeField?: string;
  private _eventField?: string;
  private _subTitleField?: string;
  private _iconField?: string;
  private _labelPosition?: LabelPosition;

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this.setSeriesField(this._spec.seriesField);
    this._timeField = this._spec.timeField as string | undefined;
    this._eventField = this._spec.eventField;
    this._subTitleField = this._spec.subTitleField;
    this._iconField = this._spec.iconField;
    this._labelPosition = this._spec.labelPosition;
  }

  getDimensionField(): string[] {
    return this._timeField ? [this._timeField] : [];
  }

  getMeasureField(): string[] {
    const fields: string[] = [];
    if (this._eventField) {
      fields.push(this._eventField);
    }
    if (this._subTitleField) {
      fields.push(this._subTitleField);
    }
    return fields;
  }

  initMark(): void {
    this._axisLineMark = this._createMark(EventSeries.mark.line, {
      isSeriesMark: true,
      groupKey: this._seriesField
    });
    this._arrowMark = this._createMark((EventSeries.mark as any).arrow, {
      isSeriesMark: true
    });

    this._dotMark = this._createMark(EventSeries.mark.dot, {
      isSeriesMark: true
    });

    this._iconMark = this._createMark((EventSeries.mark as any).icon, {
      isSeriesMark: true
    });
    this._titleMark = this._createMark(EventSeries.mark.title);

    this._subTitleMark = this._createMark(EventSeries.mark.subTitle);
  }

  protected initTooltip() {
    super.initTooltip();

    // 将 dot、icon 和 arrow mark 添加到 tooltip 触发器集合中
    this._dotMark && this._tooltipHelper.activeTriggerSet.mark.add(this._dotMark);
    this._titleMark && this._tooltipHelper.activeTriggerSet.mark.add(this._titleMark);
    this._subTitleMark && this._tooltipHelper.activeTriggerSet.mark.add(this._subTitleMark);
    this._iconMark && this._tooltipHelper.activeTriggerSet.mark.add(this._iconMark);
    this._arrowMark && this._tooltipHelper.activeTriggerSet.mark.add(this._arrowMark);
  }

  initMarkStyle(): void {
    if (this._axisLineMark) {
      this.setMarkStyle(
        this._axisLineMark,
        {
          points: this._getAxisPoints.bind(this),
          visible: this._isFirstDataInGroup.bind(this),
          stroke: '#c0c3c7',
          lineWidth: 1
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }

    const dotSpec = this._spec.dot as { style?: { size?: number; fill?: unknown } } | undefined;
    const dotSize = typeof dotSpec?.style?.size === 'number' ? dotSpec.style.size : 8;

    const titleSpec = this._spec.title;
    const titleStyle = titleSpec?.style ?? {};
    const subTitleSpec = this._spec.subTitle;
    const subTitleStyle = subTitleSpec?.style ?? {};

    // 获取 title 字体大小，用于计算 subTitle 的位置
    const titleFontSize = typeof titleStyle.fontSize === 'number' ? titleStyle.fontSize : 14;

    // dot 和 label 之间的间距
    const labelOffset = dotSize / 2 + (titleSpec?.offset ?? 6);

    if (this._dotMark) {
      this.setMarkStyle(
        this._dotMark,
        {
          x: (datum: Datum) => this._getPoint(datum).x,
          y: (datum: Datum) => this._getPoint(datum).y,
          size: dotSize,
          fill: dotSpec?.style?.fill ?? this.getColorAttribute()
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }

    if (this._arrowMark) {
      this.setMarkStyle(
        this._arrowMark,
        {
          path: (datum: Datum) => this._getArrowPath(datum),
          fill: dotSpec?.style?.fill ?? this.getColorAttribute()
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }

    if (this._titleMark) {
      this.setMarkStyle(
        this._titleMark,
        {
          fontSize: 14,
          ...titleStyle,
          x: (datum: Datum) => this._getTitlePosition(datum, labelOffset).x,
          y: (datum: Datum) => this._getTitlePosition(datum, labelOffset).y,
          textAlign: (datum: Datum) => this._getLabelTextAlign(datum),
          textBaseline: (datum: Datum) => this._getLabelTextBaseline(datum, true),
          text: (datum: Datum) => this._getDatumString(datum, this._eventField)
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }

    if (this._subTitleMark) {
      this.setMarkStyle(
        this._subTitleMark,
        {
          ...subTitleStyle,
          x: (datum: Datum) => this._getSubTitlePosition(datum, labelOffset, titleFontSize).x,
          y: (datum: Datum) => this._getSubTitlePosition(datum, labelOffset, titleFontSize).y,
          textAlign: (datum: Datum) => this._getLabelTextAlign(datum),
          textBaseline: (datum: Datum) => this._getLabelTextBaseline(datum, false),
          text: (datum: Datum) => this._getDatumString(datum, this._subTitleField)
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }

    // icon 和 line 之间的间距

    const iconSpec = this._spec.icon as { offset?: number; style?: { size?: number; fill?: unknown } } | undefined;
    const iconSize = typeof iconSpec?.style?.size === 'number' ? iconSpec.style.size : 20;
    const iconOffset = (isValid(iconSpec?.offset) ? iconSpec.offset + dotSize / 2 : labelOffset) + iconSize / 2;

    if (this._iconMark) {
      this.setMarkStyle(
        this._iconMark,
        {
          x: (datum: Datum) => this._getIconPosition(datum, iconOffset).x,
          y: (datum: Datum) => this._getIconPosition(datum, iconOffset).y,
          size: iconSize,
          fill: iconSpec?.style?.fill ?? this.getColorAttribute(),
          shape: (datum: Datum) => this._getDatumString(datum, this._iconField) || 'circle'
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }
  }

  /**
   * 根据数据索引判断标签应该放在哪一侧
   * @returns 'primary' 表示 top/left，'secondary' 表示 bottom/right
   */
  private _getLabelSide(datum: Datum): 'primary' | 'secondary' {
    const data = this._getViewDataList();
    const index = data.indexOf(datum);
    const position = this._labelPosition;

    if (this.direction === 'vertical') {
      // vertical 布局: left/right
      switch (position) {
        case 'left':
          return 'primary';
        case 'right':
          return 'secondary';
        case 'left-right':
          return index % 2 === 0 ? 'primary' : 'secondary';
        case 'right-left':
          return index % 2 === 0 ? 'secondary' : 'primary';
        default:
          return 'primary'; // 默认 left
      }
    } else {
      // horizontal 布局: top/bottom
      switch (position) {
        case 'top':
          return 'primary';
        case 'bottom':
          return 'secondary';
        case 'top-bottom':
          return index % 2 === 0 ? 'primary' : 'secondary';
        case 'bottom-top':
          return index % 2 === 0 ? 'secondary' : 'primary';
        default:
          return 'primary'; // 默认 top
      }
    }
  }

  /**
   * 获取标签的文本对齐方式
   */
  private _getLabelTextAlign(datum: Datum): 'left' | 'right' | 'center' {
    if (this.direction === 'vertical') {
      const side = this._getLabelSide(datum);
      return side === 'primary' ? 'right' : 'left';
    }
    return 'center';
  }

  /**
   * 获取标签的文本基线
   */
  private _getLabelTextBaseline(datum: Datum, isTitle: boolean): 'top' | 'bottom' | 'middle' {
    if (this.direction === 'vertical') {
      // vertical 布局时：title 用 top，subTitle 用 top
      return 'middle';
    }
    const side = this._getLabelSide(datum);
    return side === 'primary' ? 'bottom' : 'top';
  }

  /**
   * 获取 title 的位置
   */
  private _getTitlePosition(datum: Datum, offset: number): IPoint {
    const point = this._getPoint(datum);
    const side = this._getLabelSide(datum);

    if (this.direction === 'vertical') {
      // vertical: left/right，标签垂直排列
      return {
        x: side === 'primary' ? point.x - offset : point.x + offset,
        y: point.y
      };
    }
    // horizontal: top/bottom
    return {
      x: point.x,
      y: side === 'primary' ? point.y - offset : point.y + offset
    };
  }

  /**
   * 获取 subTitle 的位置
   */
  private _getSubTitlePosition(datum: Datum, offset: number, titleFontSize: number): IPoint {
    const point = this._getPoint(datum);
    const side = this._getLabelSide(datum);
    const gap = this._spec.title?.subTitleGap ?? 4;

    if (this.direction === 'vertical') {
      // vertical: left/right，subTitle 在 title 下方
      // offset 是 title 的偏移，subTitle 需要在 title 基础上再向下偏移
      const titleStyle = this._spec.title?.style ?? {};
      const titleLineHeight = typeof titleStyle.lineHeight === 'number' ? titleStyle.lineHeight : titleFontSize * 1.2;

      return {
        x: side === 'primary' ? point.x - offset : point.x + offset,
        y: point.y + titleLineHeight + gap
      };
    }
    // horizontal: top/bottom
    return {
      x: point.x,
      y: side === 'primary' ? point.y - (offset + titleFontSize + gap) : point.y + (offset + titleFontSize + gap)
    };
  }

  /**
   * 获取 icon 的位置
   * icon 与 title 关于 lineMark 对称
   */
  private _getIconPosition(datum: Datum, offset: number): IPoint {
    const point = this._getPoint(datum);
    const side = this._getLabelSide(datum);

    if (this.direction === 'vertical') {
      // vertical: 当 title 在 right 时，icon 在 left；当 title 在 left 时，icon 在 right
      return {
        x: side === 'primary' ? point.x + offset : point.x - offset,
        y: point.y
      };
    }
    // horizontal: 当 title 在 top 时，icon 在 bottom；当 title 在 bottom 时，icon 在 top
    return {
      x: point.x,
      y: side === 'primary' ? point.y + offset : point.y - offset
    };
  }

  private _getViewDataList(): Datum[] {
    return this.getViewData()?.latestData ?? [];
  }

  private _getPoint(datum: Datum): IPoint {
    if (this.direction === 'vertical') {
      // vertical 布局：x 轴是分类方向（seriesField），y 轴是时间方向（timeField）
      const x = this._getPositionFromAxis(datum, this.getXAxisHelper(), this._seriesField);
      const y = this._getPositionFromAxis(datum, this.getYAxisHelper(), this._timeField);
      return { x, y };
    }

    // horizontal 布局：x 轴是时间方向（timeField），y 轴是分类方向（seriesField）
    const x = this._getPositionFromAxis(datum, this.getXAxisHelper(), this._timeField);
    const y = this._getPositionFromAxis(datum, this.getYAxisHelper(), this._seriesField);
    return { x, y };
  }

  /**
   * 根据轴的类型计算位置
   * @param datum 数据项
   * @param axisHelper 轴助手
   * @param field 字段名
   * @returns 位置值
   */
  private _getPositionFromAxis(datum: Datum, axisHelper: AxisHelper | undefined, field?: string): number {
    if (!axisHelper) {
      // 如果没有轴助手，使用默认的中间位置
      return this._getDefaultPosition(field);
    }

    if (!field || !(field in datum)) {
      // 如果没有字段或数据中没有该字段，使用默认位置
      return this._getDefaultPosition(field);
    }

    const value = (datum as Record<string, unknown>)[field];
    const axisType = axisHelper.getSpec?.()?.type;

    // 根据轴类型选择不同的计算方式
    if (axisType === 'band' || !axisHelper.isContinuous) {
      // band 轴：使用 dataToPosition，传入值数组
      return axisHelper.dataToPosition?.([value], { bandPosition: 0.5 }) ?? this._getDefaultPosition(field);
    }

    // linear/time 轴：使用 valueToPosition，直接传入值
    return axisHelper.valueToPosition?.(value) ?? this._getDefaultPosition(field);
  }

  onXAxisHelperUpdate(): void {
    super.onXAxisHelperUpdate?.();
    this.onMarkPositionUpdate();
  }

  onYAxisHelperUpdate(): void {
    super.onYAxisHelperUpdate?.();
    this.onMarkPositionUpdate();
  }

  /**
   * 获取默认位置（当没有轴或字段时使用）
   */
  private _getDefaultPosition(field?: string): number {
    const rect = this._region.getLayoutRect();

    // 如果没有 seriesField，说明没有分类轴，返回中心位置
    if (!this._seriesField || field === this._seriesField) {
      const isHorizontal = this.direction !== 'vertical';
      // horizontal 布局：返回垂直中心（y方向）
      // vertical 布局：返回水平中心（x方向）
      return isHorizontal ? rect.height * 0.5 : rect.width * 0.5;
    }

    // 对于时间轴，返回区域起点
    return 0;
  }

  private _getAxisPoints(datum: Datum): IPoint[] {
    const rect = this._region.getLayoutRect();

    if (this.direction === 'vertical') {
      // vertical 布局：轴是垂直的，x 位置根据 seriesField 计算
      const x = this._getPositionFromAxis(datum, this.getXAxisHelper(), this._seriesField);
      return [
        { x, y: 0 },
        { x, y: rect.height }
      ];
    }

    // horizontal 布局：轴是水平的，y 位置根据 seriesField 计算
    const y = this._getPositionFromAxis(datum, this.getYAxisHelper(), this._seriesField);
    return [
      { x: 0, y },
      { x: rect.width, y }
    ];
  }

  private _isFirstDataInGroup(datum: Datum): boolean {
    if (!this._seriesField) {
      const data = this._getViewDataList();
      return data.indexOf(datum) === 0;
    }

    const data = this._getViewDataList();
    const categoryValue = (datum as Record<string, unknown>)[this._seriesField];

    // 找到该分类中的第一条数据
    const firstInGroup = data.find(
      d => this._seriesField && (d as Record<string, unknown>)[this._seriesField] === categoryValue
    );
    return datum === firstInGroup;
  }

  private _getNextDatum(datum: Datum): Datum | null {
    const data = this._getViewDataList();
    const currentIndex = data.indexOf(datum);

    if (currentIndex === -1 || currentIndex === data.length - 1) {
      return null;
    }

    if (!this._seriesField) {
      return data[currentIndex + 1];
    }

    const categoryValue = (datum as Record<string, unknown>)[this._seriesField];

    // 在同一分组中找到下一个数据
    for (let i = currentIndex + 1; i < data.length; i++) {
      const nextDatum = data[i];
      if ((nextDatum as Record<string, unknown>)[this._seriesField] === categoryValue) {
        return nextDatum;
      }
    }

    return null;
  }

  private _getPreviousDatum(datum: Datum): Datum | null {
    const data = this._getViewDataList();
    const currentIndex = data.indexOf(datum);

    if (currentIndex === -1 || currentIndex === 0) {
      return null;
    }

    if (!this._seriesField) {
      return data[currentIndex - 1];
    }

    const categoryValue = (datum as Record<string, unknown>)[this._seriesField];

    // 在同一分组中找到上一个数据
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevDatum = data[i];
      if ((prevDatum as Record<string, unknown>)[this._seriesField] === categoryValue) {
        return prevDatum;
      }
    }

    return null;
  }

  private _getArrowPath(datum: Datum): string {
    const point = this._getPoint(datum);
    const nextDatum = this._getNextDatum(datum);
    const prevDatum = this._getPreviousDatum(datum);

    const arrowThickness = this._spec.arrow?.thickness ?? 16;
    const rect = this._region.getLayoutRect();

    if (this.direction === 'vertical') {
      const axisHelper = this.getYAxisHelper();
      const inverse = axisHelper.isInverse();
      const startPoint = prevDatum
        ? {
            x: point.x,
            y: (this._getPoint(prevDatum).y + point.y) / 2
          }
        : { x: point.x, y: inverse ? 0 : rect.height };
      const endPoint = nextDatum
        ? {
            x: point.x,
            y: (this._getPoint(nextDatum).y + point.y) / 2
          }
        : { x: point.x, y: inverse ? rect.height : 0 };
      const tag = inverse ? 1 : -1;

      const arrowHeight = arrowThickness / 3;
      const arrowWidth = arrowThickness / 2;

      return `M ${startPoint.x - arrowWidth} ${startPoint.y} L ${startPoint.x} ${startPoint.y + tag * arrowHeight} L ${
        startPoint.x + arrowWidth
      } ${startPoint.y} 
      L ${endPoint.x + arrowWidth} ${endPoint.y - tag * arrowHeight} 
      L ${endPoint.x} ${endPoint.y}
      L ${endPoint.x - arrowWidth} ${endPoint.y - tag * arrowHeight} Z`;
    }

    const axisHelper = this.getXAxisHelper();
    const inverse = axisHelper.isInverse();
    const startPoint = prevDatum
      ? {
          x: (this._getPoint(prevDatum).x + point.x) / 2,
          y: point.y
        }
      : { x: inverse ? rect.width : 0, y: point.y };
    const endPoint = nextDatum
      ? {
          x: (this._getPoint(nextDatum).x + point.x) / 2,
          y: point.y
        }
      : { x: inverse ? 0 : rect.width, y: point.y };
    const tag = inverse ? -1 : 1;

    const arrowHeight = arrowThickness / 2;
    const arrowWidth = arrowThickness / 3;

    return `M ${startPoint.x} ${startPoint.y - arrowHeight} L ${startPoint.x + tag * arrowWidth} ${startPoint.y} L ${
      startPoint.x
    } ${startPoint.y + arrowHeight} 
      L ${endPoint.x - tag * arrowWidth} ${endPoint.y + arrowHeight} 
      L ${endPoint.x} ${endPoint.y} 
      L ${endPoint.x - tag * arrowWidth} ${endPoint.y - arrowHeight} Z`;
  }

  private _getDatumString(datum: Datum | undefined, field?: string): string {
    if (!datum || !field) {
      return '';
    }
    const value = (datum as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  valueToPosition(timeValue: StringOrNumber, eventValue?: StringOrNumber): IPoint {
    if (timeValue && typeof timeValue === 'object') {
      return this.dataToPosition(timeValue as Datum);
    }

    const mockDatum: Record<string, unknown> = {};
    if (this._timeField) {
      mockDatum[this._timeField] = timeValue;
    }
    if (this._eventField && eventValue !== undefined) {
      mockDatum[this._eventField] = eventValue;
    }
    return this._getPoint(mockDatum as Datum);
  }

  getActiveMarks(): IMark[] {
    return [
      this._axisLineMark,
      this._dotMark,
      this._iconMark,
      this._arrowMark,
      this._titleMark,
      this._subTitleMark
    ].filter(Boolean) as IMark[];
  }
}

export const registerEventSeries = () => {
  registerSymbolMark();
  registerTextMark();
  registerLineMark();
  registerPathMark();
  Factory.registerSeries(EventSeries.type, EventSeries);
};
