import type { IWordCloud3dSeriesSpec } from './interface';
import { registerWordCloud3dAnimation } from './animation';
import { SeriesType3dEnum } from '../3d/enum';
import type { Datum, ITextMark } from '@visactor/vchart';
import {
  animationConfig,
  AttributeLevel,
  BaseWordCloudSeries,
  Factory,
  registerTextMark,
  SeriesMarkNameEnum,
  userAnimationConfig
} from '@visactor/vchart';
import { wordCloud3d } from './theme';

export class WordCloud3dSeries<
  T extends IWordCloud3dSeriesSpec = IWordCloud3dSeriesSpec
> extends BaseWordCloudSeries<T> {
  static readonly type: string = SeriesType3dEnum.wordCloud3d;
  type = SeriesType3dEnum.wordCloud3d;
  static readonly builtInTheme = { wordCloud3d };

  protected _wordCloudTransformOption() {
    return {
      ...super._wordCloudTransformOption(),
      postProjection: this._spec.postProjection ?? 'StereographicProjection',
      depth_3d: this._spec.depth_3d
    };
  }

  protected _wordCloudShapeTransformOption() {
    return {
      ...super._wordCloudShapeTransformOption(),
      postProjection: this._spec.postProjection ?? 'StereographicProjection',
      depth_3d: this._spec.depth_3d
    };
  }

  initMark(): void {
    this._wordMark = this._createMark(
      BaseWordCloudSeries.mark.word,
      {
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        support3d: true
      }
    ) as ITextMark;
  }

  initMarkStyle() {
    super.initMarkStyle();
    const wordMark = this._wordMark;
    if (wordMark) {
      this.setMarkStyle(
        wordMark,
        {
          z: (datum: Datum) => datum.z ?? 0
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  initAnimation() {
    const padding = this._padding ?? {};
    if (this._wordMark) {
      this._wordMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('wordCloud3d')?.(() => {
            const stage = this.getCompiler().getStage();

            const width = stage.width - padding.left || 0 - padding.right || 0;
            const height = stage.height - padding.top || 0 - padding.bottom || 0;
            const r = Math.max(width, height) / 2;
            return {
              center: { x: r, y: r, z: this._spec.depth_3d ?? r },
              r
            };
          }),
          userAnimationConfig(SeriesMarkNameEnum.word, this._spec, this._markAttributeContext)
        )
      );
    }
  }
}

export const registerWordCloud3dSeries = () => {
  registerTextMark();
  registerWordCloud3dAnimation();
  Factory.registerSeries(WordCloud3dSeries.type, WordCloud3dSeries);
};

export const registerWordCloudShape3dSeries = () => {
  registerWordCloud3dSeries();
};
