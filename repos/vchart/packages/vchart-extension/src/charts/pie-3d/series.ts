// eslint-disable-next-line no-duplicate-imports
import type { IPie3dSeriesSpec } from './interface';
import { registerArc3dMark } from '../3d/arc-3d';
import { pie3dSeriesMark } from './constant';
import { MarkType3dEnum, SeriesMark3dNameEnum, SeriesType3dEnum } from '../3d/enum';
import { AttributeLevel } from '@visactor/vchart/esm/constant/attribute';
import { Factory } from '@visactor/vchart/esm/core/factory';
import type { ITextMark } from '@visactor/vchart/esm/mark/interface/mark';
import type { IArcSeries } from '@visactor/vchart/esm/series/interface/series';
import { BasePieSeries } from '@visactor/vchart/esm/series/pie/pie';
import { Pie3dSeriesSpecTransformer } from './series-spec-transformer';
import { registerPie3dAnimation } from './animation';
import { registerLayout3d } from '../3d/layout';
import { pie3d } from './theme';

export class Pie3dSeries<T extends IPie3dSeriesSpec = IPie3dSeriesSpec> extends BasePieSeries<T> implements IArcSeries {
  static readonly type: string = SeriesType3dEnum.pie3d;
  type = SeriesType3dEnum.pie3d;
  protected _pieMarkName = SeriesMark3dNameEnum.pie3d;
  protected _pieMarkType = MarkType3dEnum.arc3d;

  static readonly mark = pie3dSeriesMark;
  static readonly builtInTheme = { pie3d };
  static readonly transformerConstructor = Pie3dSeriesSpecTransformer as any;
  readonly transformerConstructor = Pie3dSeriesSpecTransformer as any;

  protected _angle3d: number;

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this._angle3d = this._spec?.angle3d ?? -Math.PI / 3;
  }

  initMarkStyle(): void {
    super.initMarkStyle();
    const pieMark = this._pieMark;
    if (pieMark) {
      this.setMarkStyle(
        pieMark,
        {
          beta: () => this._angle3d
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  initLabelMarkStyle(textMark: ITextMark, spec: any = {}): void {
    if (!textMark) {
      return;
    }
    super.initLabelMarkStyle(textMark);
    this.setMarkStyle(textMark, { support3d: true }, undefined, AttributeLevel.Mark);
  }
}

export const registerPie3dSeries = () => {
  registerPie3dAnimation();
  registerArc3dMark();
  Factory.registerSeries(Pie3dSeries.type, Pie3dSeries);
};
