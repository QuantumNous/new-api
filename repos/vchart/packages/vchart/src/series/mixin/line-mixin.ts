import { PREFIX } from '../../constant/base';
import type { ISeriesOption } from '../interface/common';
import { DataView } from '@visactor/vdataset';
import { ChartEvent } from '../../constant/event';
import type { ISeries } from '../interface/series';
import { AttributeLevel } from '../../constant/attribute';

import type {
  ICompileMarkConfig,
  IMark,
  IMarkProgressiveConfig,
  ILabelMark,
  ILineMark,
  ISymbolMark,
  ITextMark
} from '../../mark/interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from '../../mark/interface/type';
import type { DirectionType, IInvalidType, InterpolateType, Maybe, Datum, ILayoutRect } from '../../typings';
import { DEFAULT_LINEAR_INTERPOLATE, DEFAULT_SMOOTH_INTERPOLATE } from '../../typings/interpolate';
import { Direction } from '../../typings/space';
// eslint-disable-next-line no-duplicate-imports
import { DEFAULT_CLOSE_STROKE_JOIN } from '../../typings/line-stroke';
// eslint-disable-next-line no-duplicate-imports
import type { ISeriesMarkInfo, ISeriesMarkInitOption, ISeriesTooltipHelper } from '../interface';
import { shouldMarkDoMorph } from '../../animation/utils';
import type { DimensionEventParams } from '../../event/events/dimension';
// eslint-disable-next-line no-duplicate-imports
import { DimensionEventEnum } from '../../event/events/dimension';
import type { EventCallback, EventParams } from '../../event/interface';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { lineLikeSeriesMark } from './constant';
import type { IRegion } from '../../region/interface';
import { mergeSpec } from '@visactor/vutils-extension';
import type { ILineLikeSeriesTheme } from './interface';
import type { ICompilableData } from '../../compile/data';

export const LINE_LIKE_SERIES_DATA_RELATED_KEYS: Record<string, true> = {
  sampling: true,
  samplingFactor: true
};

export interface LineLikeSeriesMixin extends ISeries {
  _spec: any;
  _option: ISeriesOption;
  _seriesField: string;
  _theme: Maybe<ILineLikeSeriesTheme>;
  _tooltipHelper: ISeriesTooltipHelper;
  _invalidType: IInvalidType;
  _region: IRegion;
  _direction: DirectionType;
  _data: ICompilableData;

  _lineMark: ILineMark;
  _symbolMark: ISymbolMark;
  _symbolActiveMark: ISymbolMark;
  _labelMark: ITextMark;
  _fieldX?: string[];
  _fieldY?: string[];
  _fieldZ?: string[];

  _createMark: (markInfo: ISeriesMarkInfo, option?: ISeriesMarkInitOption, config?: ICompileMarkConfig) => IMark;
  _getInvalidDefined: (datum: Datum) => boolean;
  _getInvalidConnectType: () => IInvalidType;

  getLayoutRect: () => ILayoutRect;
}

export class LineLikeSeriesMixin {
  addSamplingCompile(): void {
    if (this._spec.sampling) {
      const { width, height } = this._region.getLayoutRect();
      const fieldsY = this._fieldY;
      const fieldsX = this._fieldX;

      if (this._data) {
        this._data.setTransform([
          {
            type: 'dataSampling',
            size: this._direction === Direction.horizontal ? height : width,
            factor: this._spec.samplingFactor,
            yfield: this._direction === Direction.horizontal ? fieldsX[0] : fieldsY[0],
            groupBy: this._seriesField,
            mode: this._spec.sampling
          }
        ]);
      }
    }
  }

  addOverlapCompile(): void {
    if (this._spec.markOverlap) {
      const overlapTrans = [];
      overlapTrans.push({
        type: 'symbolOverlap',
        direction: this._direction === Direction.horizontal && this.coordinate === 'cartesian' ? 2 : 1,
        delta: this._spec.pointDis,
        deltaMul: this._spec.pointDisMul,
        groupBy: this._seriesField
      });
      this._symbolMark?.setTransform(overlapTrans);
    }
  }

  reCompileSampling(): void {
    if (this._spec.sampling) {
      this.compile();
    }
  }

  initLineMark(isSeriesMark?: boolean) {
    this._lineMark = this._createMark(
      lineLikeSeriesMark.line,
      {
        groupKey: this._seriesField,
        isSeriesMark: isSeriesMark ?? true
      },
      {
        morphElementKey: this.getDimensionField()[0]
      }
    ) as ILineMark;
    return this._lineMark;
  }

  initLineMarkStyle(direction?: DirectionType, areaCurveType?: InterpolateType) {
    const lineMark = this._lineMark;
    if (lineMark) {
      this.setMarkStyle(
        lineMark,
        {
          stroke: this.getColorAttribute()
        },
        'normal',
        AttributeLevel.Series
      );
      if (this._invalidType !== 'zero') {
        this.setMarkStyle(
          lineMark,
          {
            defined: this._getInvalidDefined.bind(this),
            connectedType: this._getInvalidConnectType()
          },
          'normal',
          AttributeLevel.Series
        );
      }
      this.event.on(ChartEvent.viewDataStatisticsUpdate, { filter: param => param.model === this }, () => {
        this.encodeDefined(lineMark, 'defined');
      });
      if (this.coordinate === 'polar') {
        // 极坐标系下需要关闭
        this.setMarkStyle(
          lineMark,
          {
            lineJoin: DEFAULT_CLOSE_STROKE_JOIN,
            curveType: DEFAULT_LINEAR_INTERPOLATE,
            closePath: true
          },
          'normal',
          AttributeLevel.Series
        );
      } else {
        const userCurveType = areaCurveType ?? this.getSpec().line?.style?.curveType;
        const curveType =
          userCurveType === DEFAULT_SMOOTH_INTERPOLATE
            ? direction === Direction.horizontal
              ? 'monotoneY'
              : 'monotoneX'
            : userCurveType;

        this.setMarkStyle(
          lineMark,
          {
            curveType
          },
          'normal',
          AttributeLevel.Built_In
        );
      }

      this.setMarkStyle(
        lineMark,
        {
          x: this.dataToPositionX.bind(this),
          y: this.dataToPositionY.bind(this),
          z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
        },
        'normal',
        AttributeLevel.Series
      );
    }
    return lineMark;
  }

  protected _getEventElement(params: DimensionEventParams, reverse: boolean = false): Datum[] {
    // items 修改遍历方法从 mark
    let data: Datum[] = [];
    params.dimensionInfo.some(df => {
      df.data.some(dd => {
        if (dd.series === this) {
          data = dd.datum;
          return true;
        }
        return false;
      });
      return !data.length;
    });
    return data;
  }

  protected _dimensionTrigger(params: DimensionEventParams) {
    const elements = this._getEventElement(params);

    switch (params.action) {
      case 'enter':
        this._symbolActiveMark.getDataView().parse(elements);
        this._symbolActiveMark.getData().updateData(false);
        break;
      case 'leave':
        this._symbolActiveMark.getDataView().parse([]);
        this._symbolActiveMark.getData().updateData(false);
      case 'click':
      case 'move':
      default:
        break;
    }
  }

  initSymbolMark(isSeriesMark?: boolean) {
    const pointSpec = this._spec.point || {};

    if (pointSpec.visible !== false) {
      this._symbolMark = this._createMark(
        lineLikeSeriesMark.point,
        {
          groupKey: this._seriesField,
          isSeriesMark: !!isSeriesMark
        },
        {
          morph: shouldMarkDoMorph(this._spec, lineLikeSeriesMark.point.name),
          morphElementKey: this.getDimensionField()[0]
        }
      ) as ISymbolMark;
    }

    if (this._spec.activePoint === true) {
      const activeData = new DataView(this._option.dataSet, { name: `${PREFIX}_series_${this.id}_active_point` });
      activeData.parse([]);
      this._symbolActiveMark = this._createMark(
        { name: `active_point_${this.id}`, type: MarkTypeEnum.symbol },
        {
          groupKey: this._seriesField,
          isSeriesMark: false,
          dataView: activeData,
          parent: this._region.getInteractionMark()
        },
        {
          morph: false
        }
      ) as ISymbolMark;
      this._symbolActiveMark.setVisible(false);
    }

    return this._symbolMark;
  }

  initSymbolMarkStyle() {
    const symbolMark = this._symbolMark;
    if (!symbolMark) {
      this._initSymbolActiveMarkAlone();
      return symbolMark;
    }
    // 设置基础样式
    this._initSymbolMark(symbolMark);

    // setStyle to active point
    if (this._symbolActiveMark && this._symbolMark.stateStyle.dimension_hover) {
      // active point will show
      this._symbolActiveMark.setVisible(true);
      this.event.on(DimensionEventEnum.dimensionHover, this._dimensionTrigger.bind(this) as EventCallback<EventParams>);
      // set style with referer
      for (const state in this._symbolMark.stateStyle) {
        this._symbolActiveMark.stateStyle[state] = {};
        for (const key in this._symbolMark.stateStyle[state]) {
          // symbolActiveMark 的 visible 具有额外逻辑，不要使用原始 symbol 的 visible
          if (key === 'visible') {
            continue;
          }
          this._symbolActiveMark.stateStyle[state][key] = {
            style: null,
            level: AttributeLevel.Series,
            referer: symbolMark
          };
        }
      }
      // make sure activeMark in state
      this._symbolActiveMark.state.changeStateInfo({
        stateValue: STATE_VALUE_ENUM.STATE_DIMENSION_HOVER,
        filter: () => true
      });
    }

    return symbolMark;
  }

  private _initSymbolMark(symbolMark: ISymbolMark) {
    if (!symbolMark) {
      return;
    }
    this.setMarkStyle(
      symbolMark,
      {
        fill: this.getColorAttribute()
      },
      'normal',
      AttributeLevel.Series
    );

    this.setMarkStyle(
      symbolMark,
      {
        x: (datum: Datum) => {
          // 对于symbol而言，如果undefined 的元素还进行scale机会，Null/undefined 会被当成0，导致交互误显示的问题
          return this._invalidType !== 'zero' && !this._getInvalidDefined(datum)
            ? Number.NaN
            : this.dataToPositionX(datum);
        },
        y: (datum: Datum) => {
          return this._invalidType !== 'zero' && !this._getInvalidDefined(datum)
            ? Number.NaN
            : this.dataToPositionY(datum);
        },
        z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
      },
      'normal',
      AttributeLevel.Series
    );
  }

  private _initSymbolActiveMarkAlone() {
    const symbolMark = this._symbolActiveMark;
    if (!symbolMark) {
      return;
    }
    this._initSymbolMark(symbolMark);

    // 这里应该不能讲trigger-mark改为activeMark，activeMark数据会变，并且目前不支持selected等操作改变它的数据
    // this._trigger.registerMark(symbolMark);

    // setStyle to active point
    if (symbolMark && this._spec[lineLikeSeriesMark.point.name]?.state?.dimension_hover) {
      // active point will show
      symbolMark.setVisible(true);
      this.event.on(DimensionEventEnum.dimensionHover, this._dimensionTrigger.bind(this) as EventCallback<EventParams>);
      // set style with referer
      this.initMarkStyleWithSpec(
        symbolMark,
        mergeSpec({}, this._spec[lineLikeSeriesMark.point.name], { visible: true })
      );
      // make sure activeMark in state
      this._symbolActiveMark.state.changeStateInfo({
        stateValue: STATE_VALUE_ENUM.STATE_DIMENSION_HOVER,
        filter: () => true
      });
    }
  }

  initLabelMarkStyle(labelMark?: ILabelMark) {
    if (!labelMark) {
      return;
    }
    if (labelMark.getTarget()?.type !== 'symbol') {
      labelMark.setRule('line-data');
    }
    this.setMarkStyle(labelMark, {
      fill: this.getColorAttribute(),
      text: (datum: Datum) => {
        return datum[this.getStackValueField()];
      },
      z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
    });

    if (this._invalidType !== 'zero') {
      this.setMarkStyle(
        labelMark,
        {
          visible: this._getInvalidDefined.bind(this)
        },
        'normal',
        AttributeLevel.Series
      );
    }

    this.event.on(ChartEvent.viewDataStatisticsUpdate, { filter: param => param.model === this }, () => {
      this.encodeDefined(labelMark, 'visible');
    });
  }

  initLineLabelMarkStyle(labelMark?: ILabelMark) {
    if (!labelMark) {
      return;
    }

    this.setMarkStyle(labelMark, {
      fill: this.getColorAttribute(),
      text: (datum: Datum) => {
        return datum[this.getSeriesField()] ?? this.getSeriesKeys()[0];
      },
      z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
    });
  }

  encodeDefined(mark: IMark, attr: string) {
    if (!mark) {
      return;
    }
    const allValid = this._isFieldAllValid();
    if (this._invalidType === 'zero' || allValid) {
      if (mark.stateStyle.normal?.[attr]?.style === true) {
        // no change
        return;
      }
      this.setMarkStyle(mark, { [attr]: true }, 'normal', AttributeLevel.Series);
    } else {
      if (mark.stateStyle.normal?.[attr]?.style !== true) {
        // no change
        return;
      }
      this.setMarkStyle(mark, { [attr]: this._getInvalidDefined.bind(this) }, 'normal', AttributeLevel.Series);
    }
    // if has produce, reCompile encode to set attribute to product
    mark.compileEncode();
  }

  protected _isFieldAllValid() {
    const viewStatistics = this.getViewDataStatistics();
    const field = this.getStackValueField();
    if (viewStatistics && viewStatistics.latestData && field) {
      return viewStatistics.latestData[field] && viewStatistics.latestData[field].allValid;
    }
    return false;
  }
}
