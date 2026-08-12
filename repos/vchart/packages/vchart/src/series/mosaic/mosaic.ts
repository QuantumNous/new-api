import { BarSeries } from '../bar/bar';
// eslint-disable-next-line no-duplicate-imports
import { SeriesTypeEnum } from '../interface/type';
// eslint-disable-next-line no-duplicate-imports
import { registerRectMark } from '../../mark/rect';
// eslint-disable-next-line no-duplicate-imports
import { registerTextMark } from '../../mark/text';
import { registerFadeInOutAnimation } from '../../animation/config';
import type { IMosaicSeriesSpec } from './interface';
import { Factory } from '../../core/factory';
import { BarSeriesSpecTransformer } from '../bar/bar-transformer';
import { registerCartesianLinearAxis } from '../../component/axis/cartesian';
import { Direction } from '../../typings/space';
import {
  MOSAIC_CAT_END_PERCENT,
  MOSAIC_CAT_START_PERCENT,
  MOSAIC_VALUE_END_PERCENT,
  MOSAIC_VALUE_START_PERCENT
} from '../../constant/data';
import { isNil } from '@visactor/vutils';
import type { IBarSeriesTheme } from '../bar/interface';
import { mosaic } from '../../theme/builtin/common/series/mosaic';

export class MosaicSeries<T extends IMosaicSeriesSpec = IMosaicSeriesSpec> extends BarSeries<any> {
  static readonly type: string = SeriesTypeEnum.mosaic;
  type = SeriesTypeEnum.mosaic;

  protected declare _spec: T;
  static readonly builtInTheme: Record<string, IBarSeriesTheme> = { mosaic };

  static readonly transformerConstructor = BarSeriesSpecTransformer as any;
  readonly transformerConstructor = BarSeriesSpecTransformer as any;

  private _bandWidthField?: string;
  get bandWidthField() {
    return this._bandWidthField;
  }
  getStack() {
    return true;
  }

  getPercent() {
    return this._spec.percent;
  }

  getGroupFields() {
    return this.direction === 'vertical' ? this._specXField : this._specYField;
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    const isPercent = this.getPercent();

    if (this.direction === Direction.horizontal) {
      if (isPercent) {
        this.setFieldX(MOSAIC_VALUE_END_PERCENT);
        this.setFieldX2(MOSAIC_VALUE_START_PERCENT);
      }

      this.setFieldY(MOSAIC_CAT_END_PERCENT);
      this.setFieldY2(MOSAIC_CAT_START_PERCENT);
    } else {
      if (isPercent) {
        this.setFieldY(MOSAIC_VALUE_END_PERCENT);
        this.setFieldY2(MOSAIC_VALUE_START_PERCENT);
      }

      this.setFieldX(MOSAIC_CAT_END_PERCENT);
      this.setFieldX2(MOSAIC_CAT_START_PERCENT);
    }

    if (this._spec.bandWidthField) {
      this._bandWidthField = this._spec.bandWidthField;
    }
  }

  parseLabelStyle(labelStyle: any, labelSpec: any) {
    if (labelSpec?.filterByGroup && isNil(labelStyle.dataFilter)) {
      const allGroupFields = this.getGroupFields();
      const { field, type: filterType = 'max', filter } = labelSpec.filterByGroup;
      delete labelStyle.filterField;
      const fieldIndex = allGroupFields.indexOf(field);

      if (fieldIndex < 0) {
        return;
      }
      const isCatField = !!(fieldIndex % 2);
      const valueField = isCatField
        ? filterType === 'min'
          ? this.direction === Direction.horizontal
            ? this._fieldY2
            : this._fieldX2
          : this.direction === Direction.horizontal
          ? this._fieldY
          : this._fieldX
        : filterType === 'min'
        ? this.direction === Direction.horizontal
          ? this._fieldX2
          : this._fieldY2
        : this.direction === Direction.horizontal
        ? this._fieldX
        : this._fieldY;
      const filterFunc =
        filterType === 'min'
          ? (a: any, b: any) => {
              return a.data?.[valueField as string] < b.data?.[valueField as string];
            }
          : (a: any, b: any) => {
              return a.data?.[valueField as string] > b.data?.[valueField as string];
            };

      labelStyle.dataFilter = (data: any) => {
        const filteredData: any = {};

        data.forEach((d: any) => {
          const datum = d.data;
          const fieldValue = datum?.[field];

          if (isNil(fieldValue) || (filter && !filter(d))) {
            return;
          }

          if (!filteredData[fieldValue] || filterFunc(d, filteredData[fieldValue])) {
            filteredData[fieldValue] = d;
          }
        });
        return data.filter((d: any) => {
          const fieldValue = d.data?.[field];
          return filteredData[fieldValue] && filteredData[fieldValue] === d;
        });
      };
    }

    return labelStyle;
  }
}

export const registerMosaicSeries = () => {
  registerRectMark();
  registerTextMark();
  registerFadeInOutAnimation();
  registerCartesianLinearAxis();
  Factory.registerSeries(MosaicSeries.type, MosaicSeries);
};
