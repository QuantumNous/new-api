import { AreaSeries } from '../area/area';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import { registerAreaMark } from '../../mark/area';
import { Direction } from '../../typings/space';
import type { Datum } from '../../typings';
import { AttributeLevel } from '../../constant/attribute';
import { RangeAreaSeriesTooltipHelper } from './tooltip-helper';
import type { IAreaSeriesSpec } from '../area/interface';
import { rangeAreaSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import type { IAreaMark } from '../../mark/interface';

export class RangeAreaSeries<T extends IAreaSeriesSpec = IAreaSeriesSpec> extends AreaSeries<T> {
  static readonly type: string = SeriesTypeEnum.rangeArea;
  type = SeriesTypeEnum.rangeArea;

  static readonly mark: SeriesMarkMap = rangeAreaSeriesMark;

  initMark(): void {
    this._areaMark = this._createMark(
      RangeAreaSeries.mark.area,
      {
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        morphElementKey: this.getDimensionField()[0]
      }
    ) as IAreaMark;
  }

  initMarkStyle(): void {
    this.initAreaMarkStyle();
  }

  initAreaMarkStyle(): void {
    const areaMark = this._areaMark;
    if (areaMark) {
      super.initAreaMarkStyle();
      if (this._direction === Direction.horizontal) {
        this.setMarkStyle(
          this._areaMark,
          {
            x1: (datum: Datum) => {
              if (!this._xAxisHelper) {
                return Number.NaN;
              }
              const { dataToPosition } = this._xAxisHelper;
              return dataToPosition(this.getDatumPositionValues(datum, this._spec.xField[1]), {
                bandPosition: this._bandPosition
              });
            }
          },
          'normal',
          AttributeLevel.Series
        );
      } else {
        this.setMarkStyle(
          this._areaMark,
          {
            y1: (datum: Datum) => {
              if (!this._yAxisHelper) {
                return Number.NaN;
              }
              const { dataToPosition } = this._yAxisHelper;
              return dataToPosition(this.getDatumPositionValues(datum, this._spec.yField[1]), {
                bandPosition: this._bandPosition
              });
            }
          },
          'normal',
          AttributeLevel.Series
        );
      }

      this.setMarkStyle(areaMark, { stroke: false }, 'normal', AttributeLevel.Series);
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new RangeAreaSeriesTooltipHelper(this);
  }

  protected _isFieldAllValid() {
    const viewStatistics = this.getViewDataStatistics();
    const fields = this.fieldY;
    if (viewStatistics && viewStatistics.latestData && fields.length) {
      return fields.every(field => viewStatistics.latestData[field] && viewStatistics.latestData[field].allValid);
    }
    return false;
  }
}

export const registerRangeAreaSeries = () => {
  registerAreaMark();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(RangeAreaSeries.type, RangeAreaSeries);
};
