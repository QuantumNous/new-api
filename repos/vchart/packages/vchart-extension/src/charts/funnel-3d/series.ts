/* eslint-disable no-duplicate-imports */
import type { IFunnel3dSeriesSpec } from './interface';
import { funnel3dSeriesMark } from './constant';
import { Funnel3dSeriesSpecTransformer } from './series-spec-transformer';
import type { AdaptiveSpec, ILabelMark, IRuleMark, ITextMark } from '@visactor/vchart';
import { AttributeLevel, Factory, FunnelSeries, registerRuleMark, registerTextMark } from '@visactor/vchart';
import { MarkType3dEnum, SeriesMark3dNameEnum, SeriesType3dEnum } from '../3d/enum';
import type { IPyramid3dMark } from '../3d/interface';
import { registerPyramid3dMark } from '../3d/pyramid-3d';
import { funnel3d } from './theme';

export class Funnel3dSeries<T extends IFunnel3dSeriesSpec = IFunnel3dSeriesSpec> extends FunnelSeries<
  AdaptiveSpec<T, 'type'>
> {
  static readonly type: string = SeriesType3dEnum.funnel3d;
  type = SeriesType3dEnum.funnel3d;
  protected _funnelMarkName: string = SeriesMark3dNameEnum.funnel3d;
  protected _funnelMarkType: string = MarkType3dEnum.pyramid3d;
  protected _transformMarkName: string = SeriesMark3dNameEnum.transform3d;
  protected _transformMarkType: string = MarkType3dEnum.pyramid3d;

  static readonly mark = funnel3dSeriesMark;
  static readonly builtInTheme = { funnel3d };
  static readonly transformerConstructor = Funnel3dSeriesSpecTransformer as any;
  readonly transformerConstructor = Funnel3dSeriesSpecTransformer as any;

  initMark() {
    this._funnelMark = this._createMark(
      {
        ...Funnel3dSeries.mark.funnel3d,
        name: this._funnelMarkName,
        type: this._funnelMarkType
      },
      {
        themeSpec: this._theme?.funnel3d,
        key: this._seriesField,
        isSeriesMark: true
      },
      {
        support3d: true
      }
    ) as IPyramid3dMark;

    if (this._spec.isTransform) {
      this._funnelTransformMark = this._createMark(
        {
          ...Funnel3dSeries.mark.transform3d,
          name: this._transformMarkName,
          type: this._transformMarkType
        },
        {
          themeSpec: this._theme?.transform3d,
          key: this._seriesField,
          skipBeforeLayouted: false,
          dataView: this._viewDataTransform.getDataView(),
          dataProductId: this._viewDataTransform.getProductId()
        }
      );
    }

    if (this._spec?.outerLabel?.visible) {
      const { line } = this._spec.outerLabel ?? {};
      const { line: lineTheme } = this._theme?.outerLabel ?? {};

      this._funnelOuterLabelMark.label = this._createMark(Funnel3dSeries.mark.outerLabel, {
        themeSpec: this._theme?.outerLabel,
        key: this._seriesField,
        markSpec: this._spec.outerLabel
      }) as ITextMark;

      this._funnelOuterLabelMark.line = this._createMark(Funnel3dSeries.mark.outerLabelLine, {
        themeSpec: lineTheme,
        key: this._seriesField,
        markSpec: line
      }) as IRuleMark;
    }
  }

  initMarkStyle() {
    super.initMarkStyle();
    const funnelMark = this._funnelMark;
    if (funnelMark) {
      this.setMarkStyle(
        funnelMark,
        {
          z: _ => {
            if (this._isHorizontal()) {
              return 0;
            }
            const points = this.getPoints(_);
            const width = Math.max(Math.abs(points[0].x - points[1].x), Math.abs(points[2].x - points[3].x));
            return (this._computeMaxSize() - width) / 2;
          }
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  initLabelMarkStyle(labelMark?: ILabelMark) {
    super.initLabelMarkStyle(labelMark);

    this.setMarkStyle(
      labelMark,
      {
        z: _ => {
          if (this._isHorizontal()) {
            return 0;
          }
          const points = this.getPoints(_);
          const width = Math.max(Math.abs(points[0].x - points[1].x), Math.abs(points[2].x - points[3].x));
          return (this._computeMaxSize() - width) / 2;
        }
      },
      'normal',
      AttributeLevel.Series
    );

    this._labelMark = labelMark;

    if (this._funnelOuterLabelMark?.label) {
      // this._funnelOuterLabelMark.label.setDepend(labelMark.getComponent());
    }

    if (this._funnelOuterLabelMark?.line) {
      // this._funnelOuterLabelMark.line.setDepend(...this._funnelOuterLabelMark.line.getDepend());
    }
  }
}

export const registerFunnel3dSeries = () => {
  registerPyramid3dMark();
  registerTextMark();
  registerRuleMark();
  Factory.registerSeries(Funnel3dSeries.type, Funnel3dSeries);
};
